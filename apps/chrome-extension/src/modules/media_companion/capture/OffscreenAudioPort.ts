/**
 * WP0 R5-B — `OffscreenAudioPort`.
 *
 * Background-side owner of the frozen long-lived Port
 * `navia.mediaCapture.audio/v11`. It:
 *   - validates the Offscreen sender fail-closed (exact URL, no tab,
 *     frameId absent-or-zero, exactly one authoritative OFFSCREEN_DOCUMENT
 *     in `runtime.getContexts`, exact URL/origin/incognito, optional sender
 *     documentId cross-check, and first-time context documentId binding);
 *   - registers listeners BEFORE the ready/ack handshake so `ready` cannot
 *     be lost;
 *   - refuses a replacement Port and a second producer;
 *   - converts a Runtime ACK into exactly one `chunk_credit`;
 *   - normalizes producer-internal diagnostics onto the public 20-code set.
 */

import {
  PORT_MESSAGE,
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  RELAY_FAILURE_CODES,
  SESSION_ID_PATTERN,
  isOffscreenToBackgroundMessage,
  newCaptureSessionId,
  normalizeRelayFailureCode,
  type BackgroundToOffscreenMessage,
  type OffscreenToBackgroundMessage,
  type RelayFailureCode,
  type RelayResult
} from "./relayContracts";
import { buildChunkCredit } from "./audioChunk";
import type { RuntimeCaptureTransport } from "./RuntimeCaptureTransport";

export type OffscreenPortLike = {
  name: string;
  sender?: chrome.runtime.MessageSender;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
};

/**
 * Exact five-field sender facts. The expected extension URL prefix is
 * injected (not read from a chrome global) so the rule is deterministic and
 * unit-testable without a browser.
 */
export type OffscreenPortSenderFacts = {
  extensionId: string | undefined;
  senderUrl: string | undefined;
  hasSenderTab: boolean;
  frameId: number | undefined;
  documentId: string | undefined;
  expectedExtensionId: string;
  /** Exact expected Offscreen document URL (equality, not prefix). */
  expectedSenderUrl: string;
  /** Exact extension origin, for example `chrome-extension://<id>`. */
  expectedExtensionOrigin: string;
  extensionIncognito: boolean;
  contexts: readonly chrome.runtime.ExtensionContext[];
};

export type OffscreenPortSenderDiagnostic =
  | "not_attempted"
  | "validating"
  | "accepted"
  | "extension_id_mismatch"
  | "sender_tab_present"
  | "sender_url_mismatch"
  | "frame_id_mismatch"
  | "context_lookup_failed"
  | "context_count_mismatch"
  | "context_document_id_missing"
  | "context_url_mismatch"
  | "context_origin_mismatch"
  | "context_document_mismatch"
  | "incognito_mismatch";

export type OffscreenPortSenderResolution =
  | { ok: true; authoritativeDocumentId: string }
  | { ok: false; diagnostic: Exclude<OffscreenPortSenderDiagnostic, "not_attempted" | "validating" | "accepted"> };

export function resolveOffscreenPortSenderIdentity(facts: OffscreenPortSenderFacts): OffscreenPortSenderResolution {
  if (facts.extensionId !== facts.expectedExtensionId) return { ok: false, diagnostic: "extension_id_mismatch" };
  if (facts.hasSenderTab) return { ok: false, diagnostic: "sender_tab_present" };
  if (typeof facts.senderUrl !== "string" || facts.senderUrl !== facts.expectedSenderUrl) {
    return { ok: false, diagnostic: "sender_url_mismatch" };
  }
  if (facts.frameId !== undefined && facts.frameId !== 0) return { ok: false, diagnostic: "frame_id_mismatch" };
  const offscreen = facts.contexts.filter((context) => context.contextType === "OFFSCREEN_DOCUMENT");
  if (offscreen.length !== 1) return { ok: false, diagnostic: "context_count_mismatch" };
  const context = offscreen[0];
  if (typeof context.documentId !== "string" || !context.documentId) {
    return { ok: false, diagnostic: "context_document_id_missing" };
  }
  if (context.documentUrl !== facts.expectedSenderUrl) return { ok: false, diagnostic: "context_url_mismatch" };
  if (context.documentOrigin !== facts.expectedExtensionOrigin) return { ok: false, diagnostic: "context_origin_mismatch" };
  if (typeof facts.documentId === "string" && facts.documentId && context.documentId !== facts.documentId) {
    return { ok: false, diagnostic: "context_document_mismatch" };
  }
  if (context.incognito !== facts.extensionIncognito) return { ok: false, diagnostic: "incognito_mismatch" };
  return { ok: true, authoritativeDocumentId: context.documentId };
}

export function classifyOffscreenPortSender(facts: OffscreenPortSenderFacts): OffscreenPortSenderDiagnostic | null {
  const resolved = resolveOffscreenPortSenderIdentity(facts);
  return resolved.ok ? null : resolved.diagnostic;
}

/**
 * Frozen sender validation: every mismatch is `PORT_FORBIDDEN`.
 *   - extensionId must equal this extension;
 *   - sender.tab must be absent;
 *   - sender.url must equal the exact Offscreen document URL;
 *   - frameId must be absent or 0;
 *   - `runtime.getContexts` must return exactly one authoritative
 *     OFFSCREEN_DOCUMENT with exact URL/origin/incognito and non-empty ID;
 *   - a present sender documentId must match; an absent one is compatible.
 */
export function validateOffscreenPortSender(facts: OffscreenPortSenderFacts): RelayFailureCode | null {
  return classifyOffscreenPortSender(facts) ? RELAY_FAILURE_CODES.PORT_FORBIDDEN : null;
}

export type OffscreenAudioPortDependencies = {
  getContexts: (filter: chrome.runtime.ContextFilter) => Promise<chrome.runtime.ExtensionContext[]>;
  expectedSenderUrl: string;
  extensionIncognito: boolean;
  /** Test seam for the bounded Chrome context-registration wait. */
  waitForContext?: (milliseconds: number) => Promise<void>;
  onFailure?: (failureCode: RelayFailureCode) => void;
  /** A producer-initiated disconnect carries its reason. */
  onDisconnect?: (reason: "completed" | "cancelled" | "navigation" | "tab_closed") => void;
};

export class OffscreenAudioPort {
  readonly #deps: OffscreenAudioPortDependencies;
  readonly #transport: RuntimeCaptureTransport;
  #port: OffscreenPortLike | null = null;
  #boundDocumentId: string | null = null;
  #producerReady = false;
  #credit = 0;
  /** C1: guarantees the producer is aborted at most once per capture. */
  #abortNotified = false;
  #lastAcceptDiagnostic: OffscreenPortSenderDiagnostic = "not_attempted";

  constructor(dependencies: OffscreenAudioPortDependencies, transport: RuntimeCaptureTransport) {
    this.#deps = dependencies;
    this.#transport = transport;
  }

  get connected(): boolean {
    return this.#port !== null;
  }

  get producerReady(): boolean {
    return this.#producerReady;
  }

  /** Outstanding producer credit (1 while idle-ready, 0 while a chunk is in flight). */
  get credit(): number {
    return this.#credit;
  }

  get boundDocumentId(): string | null {
    return this.#boundDocumentId;
  }

  get lastAcceptDiagnostic(): OffscreenPortSenderDiagnostic {
    return this.#lastAcceptDiagnostic;
  }

  #post(message: BackgroundToOffscreenMessage) {
    try {
      this.#port?.postMessage(message);
    } catch {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.PORT_DISCONNECTED);
    }
  }

  /**
   * Accept a producer connection. The listener is registered synchronously
   * (before any await) so a producer that sends `ready` immediately cannot
   * lose it.
   */
  async accept(port: OffscreenPortLike): Promise<RelayResult> {
    this.#lastAcceptDiagnostic = "validating";
    if (port.name !== MEDIA_CAPTURE_AUDIO_PORT_NAME) {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
      port.disconnect();
      return { ok: false, failureCode: RELAY_FAILURE_CODES.PORT_FORBIDDEN };
    }
    if (this.#port) {
      // A replacement Port is refused; exactly one producer at a time.
      port.disconnect();
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.ALREADY_ACTIVE);
      return { ok: false, failureCode: RELAY_FAILURE_CODES.ALREADY_ACTIVE };
    }
    const sender = port.sender;
    if (!sender) {
      port.disconnect();
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
      return { ok: false, failureCode: RELAY_FAILURE_CODES.PORT_FORBIDDEN };
    }
    // Register listeners before awaiting Chrome, but do not allow an
    // unvalidated Port to mutate the capture state machine.
    let accepted = false;
    let preValidationActivity = false;
    port.onMessage.addListener((message) => {
      if (!accepted) {
        preValidationActivity = true;
        return;
      }
      this.#onMessage(message);
    });
    port.onDisconnect.addListener(() => {
      if (!accepted) {
        preValidationActivity = true;
        return;
      }
      this.#onDisconnect();
    });

    let contexts: chrome.runtime.ExtensionContext[] = [];
    let failureCode: RelayFailureCode | null = RELAY_FAILURE_CODES.PORT_FORBIDDEN;
    const waitForContext = this.#deps.waitForContext
      ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const staticSenderFactsValid = sender.id === chrome.runtime.id
      && !sender.tab
      && sender.url === this.#deps.expectedSenderUrl
      && (sender.frameId === undefined || sender.frameId === 0);
    const expectedUrl = new URL(this.#deps.expectedSenderUrl);
    const expectedExtensionOrigin = `${expectedUrl.protocol}//${expectedUrl.host}`;
    let authoritativeDocumentId: string | null = null;
    // Chrome can deliver runtime.onConnect before runtime.getContexts has
    // indexed the newly-created Offscreen document. An empty lookup is
    // therefore retried within the same bounded 1.5 s prepare window. Any
    // non-empty mismatch remains an immediate fail-closed rejection.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      let contextLookupFailed = false;
      try {
        contexts = await this.#deps.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
          documentUrls: [this.#deps.expectedSenderUrl]
        });
      } catch {
        contexts = [];
        contextLookupFailed = true;
      }
      const facts = {
        extensionId: sender.id,
        senderUrl: sender.url,
        hasSenderTab: Boolean(sender.tab),
        frameId: sender.frameId,
        documentId: sender.documentId,
        expectedExtensionId: chrome.runtime.id,
        expectedSenderUrl: this.#deps.expectedSenderUrl,
        expectedExtensionOrigin,
        extensionIncognito: this.#deps.extensionIncognito,
        contexts
      } satisfies OffscreenPortSenderFacts;
      const resolution = resolveOffscreenPortSenderIdentity(facts);
      const diagnostic = resolution.ok ? null : resolution.diagnostic;
      authoritativeDocumentId = resolution.ok ? resolution.authoritativeDocumentId : null;
      this.#lastAcceptDiagnostic = contextLookupFailed ? "context_lookup_failed" : diagnostic ?? "accepted";
      failureCode = diagnostic ? RELAY_FAILURE_CODES.PORT_FORBIDDEN : null;
      if (!failureCode || !staticSenderFactsValid || contexts.length > 0 || attempt === 29) break;
      await waitForContext(50);
    }
    if (failureCode || !authoritativeDocumentId || preValidationActivity) {
      port.disconnect();
      const rejected = failureCode ?? RELAY_FAILURE_CODES.PORT_FORBIDDEN;
      this.#deps.onFailure?.(rejected);
      return { ok: false, failureCode: rejected };
    }
    if (this.#boundDocumentId && this.#boundDocumentId !== authoritativeDocumentId) {
      port.disconnect();
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.BINDING_MISMATCH);
      return { ok: false, failureCode: RELAY_FAILURE_CODES.BINDING_MISMATCH };
    }
    this.#port = port;
    this.#boundDocumentId = authoritativeDocumentId;
    this.#producerReady = false;
    this.#credit = 0;
    this.#abortNotified = false;
    this.#lastAcceptDiagnostic = "accepted";
    accepted = true;
    return { ok: true };
  }

  /**
   * Background -> Offscreen: the one-shot streamId hand-off.
   *
   * The frozen two-stage binding is:
   *   `start` (carries captureSessionId) -> `ready` -> first `chunk_credit`.
   * So this only requires the Port to be CONNECTED; the first credit is
   * granted when `ready` arrives, not here. Requiring `ready` before
   * `start` would be the circular dependency R1-C2-01 removed.
   */
  sendStart(streamId: string): RelayResult {
    if (!this.#port) {
      return { ok: false, failureCode: RELAY_FAILURE_CODES.PORT_DISCONNECTED };
    }
    // Clear the credit BEFORE posting `start`: the producer may answer
    // `ready` synchronously, and the first credit is granted on `ready`.
    // Resetting afterwards would wipe that grant.
    this.#credit = 0;
    this.#post({
      type: PORT_MESSAGE.START,
      captureSessionId: this.#transport.captureSessionId,
      streamId,
      audioConfig: { sampleRateHz: 16_000, channels: 1, sampleWidthBytes: 2 }
    });
    return { ok: true };
  }

  /** Background -> Offscreen: stop producing new audio. */
  sendQuiesce(): void {
    this.#post({
      type: PORT_MESSAGE.QUIESCE,
      captureSessionId: this.#transport.captureSessionId,
      reason: "completed"
    });
  }

  /**
   * C1: the PORT-owned abort path. It fires AT MOST ONCE per capture so
   * a Port-owned failure (no credit, invalid message, producer
   * `capture_error`) notifies the producer exactly once and then asks the
   * Transport to abort. It is never used for a Transport-owned failure,
   * because the Transport has already closed out.
   */
  /**
   * C1 — THE single producer-abort owner.
   *
   * Every path that must tell the producer to stop funnels through here,
   * so the frozen `abort` message is emitted AT MOST ONCE per capture:
   *   - the Transport's fail-closed closeout (via `onCaptureAbort`);
   *   - Port-owned failures (no credit, malformed message, capture_error).
   *
   * `sendAbort()` stays public and unguarded for explicit external aborts
   * that are not part of a capture failure closeout.
   */
  notifyProducerAbortOnce(failureCode: RelayFailureCode): void {
    if (this.#abortNotified) return;
    this.#abortNotified = true;
    this.sendAbort(failureCode);
  }

  /** Background -> Offscreen: tear down immediately with a fixed code. */
  sendAbort(failureCode: RelayFailureCode): void {
    this.#post({
      type: PORT_MESSAGE.ABORT,
      captureSessionId: this.#transport.captureSessionId,
      failureCode: normalizeRelayFailureCode(failureCode, RELAY_FAILURE_CODES.PROTOCOL_INVALID)
    });
  }

  /**
   * R3: the Port owner's END-OF-CAPTURE release.
   *
   * `boundDocumentId` and `abortNotified` are capture-LOCAL facts, not
   * process-lifetime facts. Every capture creates a NEW Offscreen document
   * and a NEW Port, so both must be released here:
   *   - a stale `boundDocumentId` would make the second round's
   *     `accept()` fail closed with BINDING_MISMATCH (the document really
   *     is a different one), and
   *   - a stale `abortNotified` would suppress the second round's producer
   *     abort entirely.
   * Releasing here — not only in `accept()` — makes "abort at most once per
   * capture" hold for BOTH the preferred new-Port-per-capture strategy AND
   * any future Port reuse.
   */
  disconnect(): void {
    const port = this.#port;
    this.#port = null;
    this.#producerReady = false;
    this.#credit = 0;
    this.#boundDocumentId = null;
    this.#abortNotified = false;
    try {
      port?.disconnect();
    } catch {
      /* already gone */
    }
  }

  /**
   * Called by the Background wiring when the Runtime ACKed a chunk. This
   * is the ONLY producer of a `chunk_credit` after the initial one.
   */
  noteRuntimeAck(acknowledgedSequence: number): void {
    if (this.#credit >= 1) return;
    this.#credit = 1;
    this.#post(buildChunkCredit(this.#transport.captureSessionId, acknowledgedSequence));
  }

  #grantCredit(acknowledgedSequence: number) {
    // Credit is const 1 and is produced ONLY by a Runtime ACK path.
    if (this.#credit >= 1) return;
    this.#credit = 1;
    this.#post(
      buildChunkCredit(this.#transport.captureSessionId, acknowledgedSequence)
    );
  }

  #onMessage(raw: unknown) {
    if (!isOffscreenToBackgroundMessage(raw)) {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
      return;
    }
    const message = raw as OffscreenToBackgroundMessage;
    // R3-4: EVERY producer -> Background message must belong to THIS
    // capture. `ready` and `chunk` already enforced it, but `quiesced`,
    // `stopped` and `capture_error` did not — so a stale producer, or a
    // misrouted Port message left over from a previous session, could mark
    // the CURRENT capture drained or stopped and finalize it early.
    // The rule is identical to `validateChunkMessage`: a missing or
    // malformed session is a protocol violation, a well-formed foreign
    // session is a binding mismatch. Neither settles the capture.
    if (
      typeof message.captureSessionId !== "string"
      || !SESSION_ID_PATTERN.test(message.captureSessionId)
    ) {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
      return;
    }
    if (message.captureSessionId !== this.#transport.captureSessionId) {
      this.#deps.onFailure?.(RELAY_FAILURE_CODES.BINDING_MISMATCH);
      return;
    }
    switch (message.type) {
      case PORT_MESSAGE.READY: {
        this.#producerReady = true;
        // R3-5: the producer is live, so the `capturing` phase is published
        // at `ready` (frozen positive trace step 6-7), not at the first chunk.
        this.#transport.markProducerReady();
        // Frozen order: the FIRST credit follows `ready`.
        this.#grantCredit(-1);
        return;
      }
      case PORT_MESSAGE.CHUNK: {
        // PORT-OWNED failure: no credit outstanding. The producer is
        // notified once here; the Transport is then asked to abort.
        if (this.#credit <= 0) {
          this.notifyProducerAbortOnce(RELAY_FAILURE_CODES.BACKPRESSURE);
          this.#deps.onFailure?.(RELAY_FAILURE_CODES.BACKPRESSURE);
          return;
        }
        // TRANSPORT-OWNED failure (schema / sequence / capture bound /
        // admission): the Transport has ALREADY performed the single
        // fail-closed closeout, including one producer abort. C1: do not
        // send a second one.
        const offered = this.#transport.offerChunkMessage(message);
        if (!offered.ok) {
          if (!this.#transport.terminalReached) {
            this.notifyProducerAbortOnce(offered.failureCode);
          }
          this.#deps.onFailure?.(offered.failureCode);
          return;
        }
        // Consume the credit; the next credit is granted only after a
        // Runtime ACK.
        this.#credit -= 1;
        return;
      }
      case PORT_MESSAGE.QUIESCED: {
        this.#transport.markQuiesced();
        return;
      }
      case PORT_MESSAGE.STOPPED: {
        this.#transport.markOffscreenStopped();
        return;
      }
      case PORT_MESSAGE.CAPTURE_ERROR: {
        // PORT-OWNED failure: the producer reported its own error. Notify
        // the producer once (so it releases its resources) and ask the
        // Transport to abort. C1: once only.
        const failureCode = normalizeRelayFailureCode(
          message.failureCode,
          RELAY_FAILURE_CODES.PROTOCOL_INVALID
        );
        this.notifyProducerAbortOnce(failureCode);
        this.#deps.onFailure?.(failureCode);
        return;
      }
      default:
        // PORT-OWNED failure: an unknown / malformed Port message.
        this.notifyProducerAbortOnce(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
        this.#deps.onFailure?.(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
    }
  }

  #onDisconnect() {
    this.#port = null;
    this.#producerReady = false;
    this.#credit = 0;
    // R3: a producer-initiated disconnect ends this capture's Port binding
    // exactly like a Background-side `disconnect()` does, so the next
    // capture can accept a new document and abort its own producer once.
    this.#boundDocumentId = null;
    this.#abortNotified = false;
    // A Port disconnect is handled by the transport so an EXPECTED teardown
    // does not abort a finalizing capture, while an ABNORMAL one fails
    // closed.
    this.#deps.onDisconnect?.("completed");
  }
}
