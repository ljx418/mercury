import {
  MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
  type MediaCaptureResponse,
  type StartMediaCaptureMessage,
  type StopMediaCaptureMessage
} from "./contracts";

export type CaptureTab = { id?: number; url?: string; active?: boolean };

export type MediaCaptureControllerDependencies = {
  queryTargetTab(surface: "side_panel" | "workspace"): Promise<CaptureTab | null>;
  hasPermission(): Promise<boolean>;
  getMediaStreamId(targetTabId: number): Promise<string>;
  ensureOffscreenDocument(): Promise<void>;
  sendOffscreenMessage(message: Record<string, unknown>): Promise<unknown>;
  closeOffscreenDocument(): Promise<void>;
  digest(value: string): Promise<string>;
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
  #lastStartResponse: MediaCaptureResponse = { ok: true, state: "stopped" };

  constructor(dependencies: MediaCaptureControllerDependencies) {
    this.#dependencies = dependencies;
  }

  arm(message: StartMediaCaptureMessage): MediaCaptureResponse {
    if (this.#activeGrantId || this.#armedMessage) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" };
    }
    if (!message.trustedClick || !message.userActivation) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    }
    this.#armedMessage = message;
    this.#lastStartResponse = { ok: true, state: "armed", grantId: message.grant.grantId };
    return this.#lastStartResponse;
  }

  async startArmed(invokedTab?: CaptureTab): Promise<MediaCaptureResponse> {
    const message = this.#armedMessage;
    if (!message) return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    this.#armedMessage = null;
    const tab = invokedTab ?? await this.#dependencies.queryTargetTab(message.grant.surface);
    if (!tab || typeof tab.id !== "number" || !tab.url?.startsWith("https://www.bilibili.com/video/")) {
      this.#dependencies.reportDiagnostic?.({
        stage: "tab_validation",
        errorName: "InvalidTargetTab",
        message: !tab ? "missing_tab" : typeof tab.id !== "number" ? "missing_tab_id" : "unsupported_tab_url"
      });
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_TAB_INVALID" });
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
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
    }
    if (!await this.#dependencies.hasPermission()) {
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PERMISSION_REQUIRED" });
    }
    this.#activeGrantId = message.grant.grantId;
    let stage = "stream_id";
    try {
      const streamId = await this.#dependencies.getMediaStreamId(tab.id);
      if (!streamId) throw new Error("empty stream ID");
      stage = "offscreen_document";
      await this.#dependencies.ensureOffscreenDocument();
      stage = "offscreen_start";
      const response = await this.#dependencies.sendOffscreenMessage({
        type: MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
        command: "start",
        streamId,
        ticket: message.ticket,
        binding: {
          taskId: message.grant.taskId,
          adapterId: message.grant.adapterId,
          pageIdentitySha256: message.grant.pageIdentitySha256,
          tabId: tab.id,
          tabIdSha256: message.grant.tabIdSha256,
          surface: message.grant.surface
        },
        sourceIdentity: message.sourceIdentity,
        acquisitionRecordId: message.acquisitionRecordId
      });
      if (!response || typeof response !== "object" || (response as Record<string, unknown>).ok !== true) {
        const failureCode = response && typeof response === "object"
          ? (response as Record<string, unknown>).failureCode
          : null;
        throw new Error(typeof failureCode === "string" ? failureCode : "offscreen start rejected");
      }
      return this.#remember({ ok: true, state: "capturing", grantId: message.grant.grantId });
    } catch (error) {
      this.#dependencies.reportDiagnostic?.({
        stage,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown"
      });
      this.#activeGrantId = null;
      await this.#dependencies.closeOffscreenDocument().catch(() => undefined);
      return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_START_FAILED" });
    }
  }

  async stop(message: StopMediaCaptureMessage): Promise<MediaCaptureResponse> {
    this.#armedMessage = null;
    if (!this.#activeGrantId) return this.#remember({ ok: true, state: "stopped" });
    try {
      const response = await this.#dependencies.sendOffscreenMessage({
        type: MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE,
        command: "stop",
        reason: message.reason
      });
      if (message.reason === "completed") {
        const record = response && typeof response === "object" ? response as Record<string, unknown> : null;
        const result = record?.result && typeof record.result === "object" ? record.result as Record<string, unknown> : null;
        const transcript = result?.transcript && typeof result.transcript === "object" ? result.transcript as Record<string, unknown> : null;
        if (record?.ok === true && result?.type === "failed" && typeof result.failureCode === "string") {
          return this.#remember({ ok: false, failureCode: result.failureCode });
        }
        if (record?.ok !== true || result?.type !== "completed" || typeof transcript?.taskId !== "string" || typeof transcript?.state !== "string") {
          return this.#remember({ ok: false, failureCode: "V3_MEDIA_CAPTURE_FINALIZE_FAILED" });
        }
        return this.#remember({ ok: true, state: "transcribing", transcript: { taskId: transcript.taskId, state: transcript.state } });
      }
    } finally {
      await this.#dependencies.closeOffscreenDocument().catch(() => undefined);
      this.#activeGrantId = null;
    }
    return this.#remember({ ok: true, state: "stopped" });
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
}
