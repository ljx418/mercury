import {
  MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
  type MediaCaptureResponse,
  type StartMediaCaptureMessage,
  type StopMediaCaptureMessage
} from "./contracts";
import {
  RELAY_FAILURE_CODES,
  type RelayFailureCode,
  type RelayResult
} from "./relayContracts";
import type { CaptureStopReason } from "./RuntimeCaptureTransport";

export type CaptureTab = { id?: number; url?: string; active?: boolean };

/**
 * R1: the Background Runtime transport, injected so the controller can
 * require Runtime `started` BEFORE any streamId leaves Background. The
 * controller never touches a WebSocket itself.
 */
/** Terminal result of a transport stop. */
export type RelayTerminal = {
  ok: boolean;
  failureCode?: RelayFailureCode;
  transcript?: Record<string, unknown>;
};

export type RelayTransportPort = {
  start(binding: {
    ticket: string;
    taskId: string;
    adapterId: string;
    surface: "side_panel" | "workspace";
    pageIdentitySha256: string;
    tabId: number;
    tabIdSha256: string;
    sourceIdentity: string;
    acquisitionRecordId: string;
  }): Promise<RelayResult>;
  /** Hand the one-shot streamId to the Offscreen producer. */
  sendStart(streamId: string): RelayResult;
  /** Ask the producer to stop producing new audio. */
  sendQuiesce(): void;
  /**
   * ATOMIC stop boundary: freeze the reason BEFORE any quiesce is sent so a
   * navigation / cancel / tab_close can never finalize as `completed`.
   */
  beginStop(reason: CaptureStopReason): void;
  /** Fail closed immediately with a fixed code. */
  abort(failureCode: RelayFailureCode): void;
  /** Drain, then finalize against Runtime and resolve the terminal. */
  stop(reason: CaptureStopReason): Promise<RelayTerminal>;
  disconnect(): void;
};

export type MediaCaptureControllerDependencies = {
  queryTargetTab(surface: "side_panel" | "workspace"): Promise<CaptureTab | null>;
  hasPermission(): Promise<boolean>;
  getMediaStreamId(targetTabId: number): Promise<string>;
  ensureOffscreenDocument(): Promise<void>;
  sendOffscreenMessage(message: Record<string, unknown>): Promise<unknown>;
  closeOffscreenDocument(): Promise<void>;
  digest(value: string): Promise<string>;
  /**
   * R1-C2-2: the single Background-owned Runtime capture transport. This
   * is REQUIRED: capture start/stop has exactly one control plane (the
   * frozen Port), so there is no optional fallback.
   */
  relay: RelayTransportPort;
  reportDiagnostic?(diagnostic: { stage: string; errorName: string; message: string }): void;
};

function same(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export class MediaCaptureController {
  readonly #dependencies: MediaCaptureControllerDependencies;
  #activeGrantId: string | null = null;
  #armedMessage: StartMediaCaptureMessage | null = null;
  #prepared = false;
  /**
   * R3: the single-start guard. `startArmed()` awaits several browser and
   * Runtime primitives, so a second invocation (a second action click, a
   * keyboard command, a tab event) can arrive mid-await. Without this flag
   * two Runtime sockets / Ports / Offscreen documents could be created for
   * ONE grant. The guard returns the frozen ALREADY_ACTIVE code instead.
   */
  #starting = false;
  #lastStartResponse: MediaCaptureResponse = { ok: true, state: "stopped" };

  constructor(dependencies: MediaCaptureControllerDependencies) {
    this.#dependencies = dependencies;
  }

  async prepare(): Promise<MediaCaptureResponse> {
    if (this.#activeGrantId || this.#armedMessage || this.#starting) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" };
    }
    try {
      await this.#dependencies.ensureOffscreenDocument();
      this.#prepared = true;
      return this.#remember({ ok: true, state: "prepared" });
    } catch (error) {
      this.#dependencies.reportDiagnostic?.({
        stage: "offscreen_prepare",
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown"
      });
      await this.#closePreparedDocument();
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PREPARE_FAILED" });
    }
  }

  arm(message: StartMediaCaptureMessage): MediaCaptureResponse {
    if (this.#activeGrantId || this.#armedMessage || this.#starting) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" };
    }
    if (!message.trustedClick || !message.userActivation) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    }
    if (!this.#prepared) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_PREPARE_REQUIRED" };
    }
    this.#armedMessage = message;
    this.#lastStartResponse = { ok: true, state: "armed", grantId: message.grant.grantId };
    return this.#lastStartResponse;
  }

  async startArmed(invokedTab?: CaptureTab): Promise<MediaCaptureResponse> {
    // R3-1: exactly one start owner. A second invocation while this one is
    // still awaiting a browser / Runtime primitive is refused with the frozen
    // ALREADY_ACTIVE code BEFORE any second socket, Port or Offscreen
    // document can be created.
    if (this.#starting) {
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
    }
    const message = this.#armedMessage;
    if (!message) return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    this.#armedMessage = null;
    this.#starting = true;
    this.#remember({ ok: true, state: "starting", grantId: message.grant.grantId });
    try {
      return await this.#runStart(message, invokedTab);
    } finally {
      this.#starting = false;
    }
  }

  async #runStart(message: StartMediaCaptureMessage, invokedTab?: CaptureTab): Promise<MediaCaptureResponse> {
    const tab = invokedTab ?? await this.#dependencies.queryTargetTab(message.grant.surface);
    if (!tab || typeof tab.id !== "number" || !tab.url?.startsWith("https://www.bilibili.com/video/")) {
      this.#dependencies.reportDiagnostic?.({
        stage: "tab_validation",
        errorName: "InvalidTargetTab",
        message: !tab ? "missing_tab" : typeof tab.id !== "number" ? "missing_tab_id" : "unsupported_tab_url"
      });
      // Nothing but the prewarmed document is owned yet.
      return this.#failStart("V3_MEDIA_CAPTURE_TAB_INVALID", false);
    }
    const [tabIdSha256, pageIdentitySha256] = await Promise.all([
      this.#dependencies.digest(String(tab.id)),
      this.#dependencies.digest(tab.url)
    ]);
    if (!same(tabIdSha256, message.grant.tabIdSha256) || !same(pageIdentitySha256, message.grant.pageIdentitySha256)) {
      this.#dependencies.reportDiagnostic?.({
        stage: "tab_binding",
        errorName: "CaptureBindingMismatch",
        message: "invoked_tab_does_not_match_armed_grant"
      });
      return this.#failStart("V3_MEDIA_CAPTURE_BINDING_MISMATCH", false);
    }
    if (!await this.#dependencies.hasPermission()) {
      return this.#failStart("V3_MEDIA_CAPTURE_PERMISSION_REQUIRED", false);
    }
    this.#activeGrantId = message.grant.grantId;
    let stage = "runtime_start";
    try {
      // R1/R3 ordering: the Runtime capture WebSocket is opened and must
      // reach `started` BEFORE any streamId is resolved, before the producer
      // `start` is dispatched, and before any chunk can be accepted. The
      // Offscreen never learns the ticket, binding, sourceIdentity or
      // acquisitionRecordId.
      const relay = this.#dependencies.relay;
      if (relay) {
        const started = await relay.start({
          ticket: message.ticket,
          taskId: message.grant.taskId,
          adapterId: message.grant.adapterId,
          surface: message.grant.surface,
          pageIdentitySha256: message.grant.pageIdentitySha256,
          tabId: tab.id,
          tabIdSha256: message.grant.tabIdSha256,
          sourceIdentity: message.sourceIdentity,
          acquisitionRecordId: message.acquisitionRecordId
        });
        if (!started.ok) {
          // `relay.start()` already closed the socket and settled the
          // failure terminal (and cleared the marker) inside the transport.
          return this.#failStart(started.failureCode, true);
        }
      }
      stage = "stream_id";
      const streamId = await this.#dependencies.getMediaStreamId(tab.id);
      if (!streamId) throw new Error("empty stream ID");
      stage = "offscreen_document";
      await this.#dependencies.ensureOffscreenDocument();
      stage = "offscreen_start";
      // The one and only producer start path: hand the one-shot streamId to
      // the Background-owned Port owner. There is no onMessage fallback.
      const handed = relay.sendStart(streamId);
      if (!handed.ok) {
        // The Port is not connected: abort the Runtime capture (socket +
        // marker + one producer abort over the frozen Port) and release the
        // Port and the Offscreen document.
        relay.abort(RELAY_FAILURE_CODES.PORT_DISCONNECTED);
        return this.#failStart(handed.failureCode, true);
      }
      this.#prepared = false;
      return this.#remember({ ok: true, state: "capturing", grantId: message.grant.grantId });
    } catch (error) {
      this.#dependencies.reportDiagnostic?.({
        stage,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown"
      });
      this.#dependencies.relay?.abort(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
      return this.#failStart("V3_MEDIA_CAPTURE_START_FAILED", true);
    }
  }

  /**
   * R3-2/R3-4: THE single fail-closed start closeout.
   *
   * Every start failure — tab validation, binding mismatch, missing
   * permission, Runtime start failure, streamId failure, Port not connected,
   * producer start failure — funnels through here so a failed start always
   * leaves the controller idle and releases everything this capture can
   * prove it owns:
   *   - the Runtime socket, restart marker and normalized failure terminal
   *     (through `relay.abort`, unless the transport already settled);
   *   - the Port (`relay.disconnect`);
   *   - the Offscreen document.
   * The marker is cleared at most once because the transport's
   * `clearRestartMarker()` is idempotent.
   */
  async #failStart(failureCode: string, relayOwnsTerminal: boolean): Promise<MediaCaptureResponse> {
    this.#activeGrantId = null;
    this.#prepared = false;
    if (relayOwnsTerminal) {
      // Already settled inside `relay.start()` / `relay.abort()`; the Port
      // must still be released so the next capture gets a new one.
      this.#dependencies.relay?.disconnect();
    }
    await this.#closePreparedDocument();
    return this.#remember({ ok: false, failureCode });
  }

  async stop(message: StopMediaCaptureMessage): Promise<MediaCaptureResponse> {
    this.#armedMessage = null;
    if (!this.#activeGrantId) {
      await this.#closePreparedDocument();
      return this.#remember({ ok: true, state: "stopped" });
    }
    const relay = this.#dependencies.relay;
    try {
      // R1 stop ordering (frozen): freeze the stop reason FIRST, then
      // quiesce the producer; the transport finalizes only after the
      // producer reports `stopped` and the backlog has drained. A
      // navigation / cancel / tab_close can never become `completed`.
      relay.beginStop(message.reason);
      relay.sendQuiesce();
      const terminal = await relay.stop(message.reason);
      if (!terminal.ok) {
        return this.#remember({
          ok: false,
          failureCode: terminal.failureCode ?? RELAY_FAILURE_CODES.FINALIZE_FAILED
        });
      }
      if (message.reason === "completed") {
        const transcript = terminal.transcript;
        if (!transcript || typeof transcript.taskId !== "string" || typeof transcript.state !== "string") {
          return this.#remember({ ok: false, failureCode: RELAY_FAILURE_CODES.FINALIZE_FAILED });
        }
        return this.#remember({
          ok: true,
          state: "transcribing",
          transcript: { taskId: transcript.taskId, state: transcript.state }
        });
      }
      return this.#remember({ ok: true, state: "stopped" });
    } finally {
      relay.disconnect();
      await this.#closePreparedDocument();
      this.#activeGrantId = null;
    }
  }

  status(): MediaCaptureResponse {
    return this.#lastStartResponse;
  }

  hasArmedCapture() {
    return this.#armedMessage !== null;
  }

  activeGrantId() {
    return this.#activeGrantId;
  }

  #remember(response: MediaCaptureResponse): MediaCaptureResponse {
    this.#lastStartResponse = response;
    return response;
  }

  async #closePreparedDocument() {
    this.#prepared = false;
    await this.#dependencies.closeOffscreenDocument().catch(() => undefined);
  }
}
