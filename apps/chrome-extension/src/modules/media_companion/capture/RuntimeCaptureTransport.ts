/**
 * WP0 R1 — `RuntimeCaptureTransport`.
 *
 * The single Background owner of the Runtime capture WebSocket. It owns:
 *   - open / `start` JSON / `started` / binary chunk / Runtime ACK /
 *     `stop` / final receipt / close / every frozen timeout;
 *   - sequence (strictly increasing from 0);
 *   - the single-credit window: exactly one chunk in flight, and credit is
 *     produced ONLY by a Runtime `chunkAccepted`;
 *   - the bounded queue (32 chunks / 1,572,864 raw bytes) with
 *     abort-BEFORE-enqueue;
 *   - the atomic stop boundary: `beginStop(reason)` freezes the reason
 *     before quiesce is sent, so navigation / cancel / tab_close can never
 *     finalize as `completed`;
 *   - quiesce -> drain -> stopped -> finalize ordering;
 *   - the frozen restart marker lifecycle;
 *   - public FailureCode normalization.
 *
 * It performs no audio production and never keeps a ticket after `start`.
 */

import {
  PORT_MESSAGE,
  RELAY_FAILURE_CODES,
  RELAY_V10,
  RESTART_MARKER_FIELDS,
  RESTART_MARKER_SCHEMA_VERSION,
  RESTART_MARKER_TRANSITIONS,
  SESSION_ID_PATTERN,
  isRestartMarkerPhase,
  newCaptureSessionId,
  normalizeRelayFailureCode,
  type RelayFailureCode,
  type RelayResult,
  type RelayRestartMarker,
  type RestartMarkerPhase
} from "./relayContracts";
import {
  admitChunk,
  buildRuntimeStartPayload,
  validateChunkMessage
} from "./audioChunk";

export type RuntimeSocketLike = {
  binaryType: string;
  readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
};

export type TransportStartBinding = {
  ticket: string;
  taskId: string;
  adapterId: string;
  surface: "side_panel" | "workspace";
  pageIdentitySha256: string;
  tabId: number;
  tabIdSha256: string;
  sourceIdentity: string;
  acquisitionRecordId: string;
};

export type TransportState =
  | "idle"
  | "connecting"
  | "runtime_started"
  | "capturing"
  | "draining"
  | "cleanup_pending"
  | "finalized"
  | "aborted"
  | "failed";

export type TransportTerminal = {
  ok: boolean;
  failureCode?: RelayFailureCode;
  capture?: { chunks: number; capturedMs: number };
  transcript?: Record<string, unknown>;
};

export type CaptureStopReason =
  | "completed"
  | "cancelled"
  | "navigation"
  | "tab_closed"
  | "consent_revoked"
  | "runtime_disconnected"
  | "timeout"
  | "failed";

type QueuedChunk = { sequence: number; rawByteLength: number; bytes: Uint8Array };

export type RuntimeCaptureTransportDependencies = {
  createSocket: (url: string) => RuntimeSocketLike;
  runtimeWsUrl: string;
  now?: () => number;
  setTimer?: (handler: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Persist the frozen restart marker. */
  onMarker?: (marker: RelayRestartMarker) => void;
  /** Remove the persisted marker once the owner receipt + grace completed. */
  clearMarker?: (captureSessionId: string) => void;
  /** Receives a normalized relay failure exactly once per capture. */
  reportFailure?: (failureCode: RelayFailureCode) => void;
  /**
   * Invoked when a Runtime `chunkAccepted` returns credit. The Port owner
   * turns this into the single `chunk_credit` the producer is waiting for.
   */
  onRuntimeAck?: (acknowledgedSequence: number) => void;
  /**
   * R2 corrective C1: invoked when the OWNER self-fires the capture
   * deadline with no further chunk. The Background facade wires this to
   * the existing `OffscreenAudioPort.sendAbort()`, so the producer is told
   * to stop through the SAME frozen Port path — not a second control plane.
   */
  onCaptureAbort?: (failureCode: RelayFailureCode) => void;
  /**
   * R2 corrective C2 — INTERNAL TEST-ONLY limits seam. Production never
   * sets this, so the effective bound is always `RELAY_V10.maxCaptureBytes`.
   * It exists so the exact cumulative boundary can be proven without
   * allocating 512 MiB. It is never surfaced to the UI, to any Port
   * message, or to any public API.
   */
  maxCaptureBytes?: number;
};

const SOCKET_OPEN = 1;

/**
 * R2 corrective C2 — the whole-capture byte and duration boundaries as PURE
 * predicates with no allocation, no encoding and no side effects.
 *
 * These exist so the exact `maxCaptureBytes` / `maxCaptureMs` boundary can be
 * proven by a low-resource deterministic test: the 512 MiB constant is
 * compared as a NUMBER, never by building a 512 MiB buffer. The production
 * values still come only from `RELAY_V10`; these helpers never widen them.
 */

/**
 * Whole-capture cumulative byte bound. `current + next === max` is ALLOWED;
 * only `>` fails. Evaluated BEFORE enqueue, before the sequence increment and
 * before any counter is accumulated.
 */
export function exceedsCaptureByteBound(
  currentRawBytes: number,
  nextChunkRawBytes: number,
  maxCaptureBytes: number = RELAY_V10.maxCaptureBytes
): boolean {
  return currentRawBytes + nextChunkRawBytes > maxCaptureBytes;
}

/**
 * Whole-capture wall-clock bound. `elapsedMs === max` is still inside the
 * window; only `>` fails. This is the SAME single definition used by the
 * active deadline timer and by the enqueue-time guard, so the deadline
 * origin cannot drift from `startedAt` / the restart marker.
 */
export function exceedsCaptureDurationBound(
  elapsedMs: number,
  maxCaptureMs: number = RELAY_V10.maxCaptureMs
): boolean {
  return elapsedMs > maxCaptureMs;
}

export class RuntimeCaptureTransport {
  readonly #deps: RuntimeCaptureTransportDependencies;
  #state: TransportState = "idle";
  #socket: RuntimeSocketLike | null = null;
  #binding: TransportStartBinding | null = null;
  #captureSessionId = "";
  #expectedSequence = 0;
  #queue: QueuedChunk[] = [];
  #inFlight = 0;
  #inFlightSequence: number | null = null;
  #inFlightRawBytes = 0;
  #lastSentRawBytes = 0;
  #lastAcknowledgedSequence = -1;
  #chunkCount = 0;
  #capturedMs = 0;
  #totalRawBytes = 0;
  #sentChunkCount = 0;
  #acknowledgedChunkCount = 0;
  #startedAt = 0;
  #markerExpiry = 0;
  #markerCleared = false;
  #stopRequested = false;
  #stopReason: CaptureStopReason = "completed";
  #quiesced = false;
  #offscreenStopped = false;
  #terminalSettled = false;
  #failure: RelayFailureCode | null = null;
  #terminalResolve: ((value: TransportTerminal) => void) | null = null;
  #stopWaiter: Promise<TransportTerminal> | null = null;
  #pendingTerminal: TransportTerminal | null = null;
  /** R3: the settled terminal, retained so a late `stop()` can answer. */
  #settledTerminal: TransportTerminal | null = null;
  #ackTimer: unknown = null;
  #startTimer: unknown = null;
  #finalizeTimer: unknown = null;
  #deadlineTimer: unknown = null;
  #cleanupTimer: unknown = null;

  readonly #captureSessionIdFactory: () => string;
  /** R2 corrective C2: test-only; production always resolves to RELAY_V10. */
  readonly #maxCaptureBytes: number;

  constructor(
    dependencies: RuntimeCaptureTransportDependencies,
    captureSessionIdFactory: () => string = newCaptureSessionId
  ) {
    this.#deps = dependencies;
    this.#captureSessionIdFactory = captureSessionIdFactory;
    this.#maxCaptureBytes = dependencies.maxCaptureBytes ?? RELAY_V10.maxCaptureBytes;
  }

  get state(): TransportState {
    return this.#state;
  }

  get captureSessionId(): string {
    return this.#captureSessionId;
  }

  get active(): boolean {
    return this.#state !== "idle"
      && this.#state !== "finalized"
      && this.#state !== "aborted"
      && this.#state !== "failed";
  }

  /** Total raw PCM bytes accepted for this capture (frozen byte bound). */
  get totalRawBytes(): number {
    return this.#totalRawBytes;
  }

  get capturedMs(): number {
    return this.#capturedMs;
  }

  /** Content-free relay counters used by owned-browser acceptance diagnostics. */
  get diagnostic(): Record<string, number | string | boolean | null> {
    return {
      state: this.#state,
      captureSessionBound: this.#captureSessionId.length > 0,
      acceptedChunkCount: this.#chunkCount,
      sentChunkCount: this.#sentChunkCount,
      acknowledgedChunkCount: this.#acknowledgedChunkCount,
      queuedChunkCount: this.#queue.length,
      inFlightChunkCount: this.#inFlight,
      totalRawBytes: this.#totalRawBytes,
      capturedMs: this.#capturedMs,
      failureCode: this.#failure
    };
  }

  /**
   * C1: true once the owner has already performed its own fail-closed
   * closeout (producer abort + Runtime close + failure report + terminal +
   * marker). The Port uses this to avoid sending a SECOND abort for a
   * Transport-owned failure.
   */
  get terminalReached(): boolean {
    return this.#terminalSettled;
  }

  get stopReason(): CaptureStopReason {
    return this.#stopReason;
  }

  get stopRequested(): boolean {
    return this.#stopRequested;
  }

  get backlog(): { chunks: number; rawBytes: number; inFlight: number; sequence: number } {
    return {
      chunks: this.#queue.length,
      rawBytes: this.#queue.reduce((total, chunk) => total + chunk.rawByteLength, 0),
      inFlight: this.#inFlight,
      sequence: this.#expectedSequence
    };
  }

  #now(): number {
    return this.#deps.now ? this.#deps.now() : Date.now();
  }

  #setTimer(handler: () => void, ms: number): unknown {
    return this.#deps.setTimer ? this.#deps.setTimer(handler, ms) : setTimeout(handler, ms);
  }

  #clearTimer(handle: unknown): void {
    if (handle === null || handle === undefined) return;
    if (this.#deps.clearTimer) this.#deps.clearTimer(handle);
    else clearTimeout(handle as ReturnType<typeof setTimeout>);
  }

  // -------------------------------------------------------------------------
  // Restart marker (frozen)
  // -------------------------------------------------------------------------

  currentMarker(): RelayRestartMarker | null {
    if (!this.#captureSessionId || !this.#binding) return null;
    return {
      schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
      captureSessionId: this.#captureSessionId,
      taskId: this.#binding.taskId,
      startedAt: new Date(this.#startedAt).toISOString(),
      phase: isRestartMarkerPhase(this.#state) ? this.#state : "connecting",
      expiresAt: new Date(this.#markerExpiry).toISOString()
    };
  }

  #setState(next: TransportState) {
    this.#state = next;
    // Only the five frozen phases are persisted. Terminal states
    // (finalized / aborted / failed) must NOT republish a marker: doing so
    // would rewrite the stored phase to the "connecting" fallback and then
    // race the clear.
    if (!isRestartMarkerPhase(next)) return;
    const marker = this.currentMarker();
    if (marker) this.#deps.onMarker?.(marker);
  }

  /** The marker is cleared only after the owner receipt and cleanup grace. */
  clearRestartMarker(): void {
    if (this.#markerCleared || !this.#captureSessionId) return;
    this.#deps.clearMarker?.(this.#captureSessionId);
    this.#markerCleared = true;
  }

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  async start(binding: TransportStartBinding): Promise<RelayResult> {
    if (this.active) return { ok: false, failureCode: RELAY_FAILURE_CODES.ALREADY_ACTIVE };
    this.#reset(binding);
    this.#setState("connecting");

    const socket = this.#deps.createSocket(this.#deps.runtimeWsUrl);
    this.#socket = socket;
    this.#armStartTimeout();

    const started = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        this.#clearTimer(this.#startTimer);
        this.#startTimer = null;
        resolve(value);
      };
      socket.addEventListener("open", () => {
        try {
          socket.send(JSON.stringify(buildRuntimeStartPayload(binding)));
        } catch {
          this.#fail(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
          finish(false);
        }
      });
      socket.addEventListener("message", (event: unknown) => {
        const data = (event as { data?: unknown })?.data;
        if (typeof data !== "string") return;
        let value: Record<string, unknown>;
        try {
          value = JSON.parse(data) as Record<string, unknown>;
        } catch {
          this.#fail(RELAY_FAILURE_CODES.PROTOCOL_INVALID);
          finish(false);
          return;
        }
        if (value.type === "started") {
          this.#setState("runtime_started");
          finish(true);
          return;
        }
        if (value.type === "chunkAccepted") {
          this.#onRuntimeAck(value);
          return;
        }
        if (value.type === "failed") {
          this.#fail(normalizeRelayFailureCode(value.failureCode, RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED));
          finish(false);
        }
      });
      socket.addEventListener("close", (event: unknown) => {
        const reason = (event as { reason?: string })?.reason ?? null;
        // An abnormal close before a terminal is a fail-closed disconnect.
        if (!this.#terminalSettled) {
          this.#fail(normalizeRelayFailureCode(reason, RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED));
        }
        finish(false);
      });
      socket.addEventListener("error", () => undefined);
    });

    if (!started) {
      this.#closeSocket();
      if (!this.#failure) this.#fail(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
      const failureCode = this.#failure as RelayFailureCode;
      this.#setState("failed");
      this.#settleTerminal({ ok: false, failureCode });
      return { ok: false, failureCode };
    }
    return { ok: true };
  }

  /**
   * R2 corrective C1 — the OWNER's single wall-clock deadline handle.
   *
   * It is armed exactly once per capture from `#startedAt` (the same
   * origin used by the restart marker) and fires WITHOUT needing any
   * further chunk. On fire it performs the one and only closeout:
   *   1. produce `V3_MEDIA_CAPTURE_DURATION_LIMIT` exactly once
   *   2. notify the Offscreen producer abort (frozen Port path)
   *   3. close the Runtime WebSocket
   *   4. settle the failure terminal
   *   5. clear the restart marker
   *   6. clear the deadline, ACK, start and finalize timers
   */
  #armCaptureDeadline(): void {
    this.#clearCaptureDeadline();
    // C2: the boundary is inclusive, so the FIRST tick may legitimately
    // land exactly on `elapsed === maxCaptureMs`. Re-arming must still
    // make forward progress, so the delay is at least 1 ms — a zero
    // delay would re-schedule at the same instant and spin forever.
    const remaining = Math.max(1, RELAY_V10.maxCaptureMs - (this.#now() - this.#startedAt));
    this.#deadlineTimer = this.#setTimer(() => {
      this.#deadlineTimer = null;
      if (this.#terminalSettled) return;
      if (this.#state === "finalized" || this.#state === "aborted" || this.#state === "failed") return;
      // C2: the timer body uses the SAME predicate as the enqueue guard,
      // so `elapsed === maxCaptureMs` stays INSIDE the window and only
      // `elapsed > maxCaptureMs` fails. At the exact boundary the timer
      // re-arms the minimal remaining slice instead of aborting.
      if (!exceedsCaptureDurationBound(this.#now() - this.#startedAt)) {
        this.#armCaptureDeadline();
        return;
      }
      this.#failClosed(RELAY_FAILURE_CODES.DURATION_LIMIT);
    }, remaining);
  }

  /**
   * The ONE fail-closed closeout for an owner-detected bound violation.
   *
   * Used by BOTH the active wall-clock deadline and the enqueue-time
   * cumulative-byte / duration guards, so a capture can never report a
   * failure without also: notifying the producer abort over the frozen
   * Port, closing the Runtime WebSocket, settling the failure terminal and
   * clearing the restart marker + every timer.
   *
   * Idempotent: a capture that already failed or already reached a
   * terminal is left untouched, so the failure/terminal/marker happen at
   * most once.
   */
  #failClosed(failureCode: RelayFailureCode): void {
    if (this.#terminalSettled) return;
    if (this.#state === "finalized" || this.#state === "aborted" || this.#state === "failed") return;
    if (this.#failure) return;
    // (1) exactly one normalized failure
    this.#fail(failureCode);
    // (2) producer abort over the existing frozen Port
    this.#deps.onCaptureAbort?.(failureCode);
    // (3) close the Runtime socket
    this.#closeSocket();
    // (4) settle the failure terminal (clears the marker and timers)
    this.#setState("aborted");
    this.#settleTerminal({ ok: false, failureCode });
  }

  #clearCaptureDeadline(): void {
    this.#clearTimer(this.#deadlineTimer);
    this.#deadlineTimer = null;
  }

  #armStartTimeout() {
    this.#clearTimer(this.#startTimer);
    this.#startTimer = this.#setTimer(() => {
      if (this.#state !== "connecting") return;
      this.#failClosed(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
    }, RELAY_V10.runtimeStartTimeoutMs);
  }

  #armAckTimeout() {
    this.#clearTimer(this.#ackTimer);
    this.#ackTimer = this.#setTimer(() => {
      if (this.#inFlight <= 0) return;
      // C1: a single fail-closed closeout. Previously this called #fail()
      // and then abort(); with the C3 guard the second call short-circuited
      // and the capture was left `capturing` with a live socket.
      this.#failClosed(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
    }, RELAY_V10.chunkAckTimeoutMs);
  }

  #reset(binding: TransportStartBinding) {
    this.#binding = binding;
    this.#startedAt = this.#now();
    // TTL is set exactly once; phase updates never refresh it.
    this.#markerExpiry = this.#startedAt + RELAY_V10.markerTtlMs;
    this.#clearCaptureDeadline();
    this.#armCaptureDeadline();
    this.#markerCleared = false;
    this.#captureSessionId = this.#captureSessionIdFactory();
    this.#expectedSequence = 0;
    this.#lastAcknowledgedSequence = -1;
    this.#queue = [];
    this.#inFlight = 0;
    this.#inFlightSequence = null;
    this.#inFlightRawBytes = 0;
    this.#lastSentRawBytes = 0;
    this.#chunkCount = 0;
    this.#capturedMs = 0;
    this.#totalRawBytes = 0;
    this.#sentChunkCount = 0;
    this.#acknowledgedChunkCount = 0;
    this.#stopRequested = false;
    this.#stopReason = "completed";
    this.#quiesced = false;
    this.#offscreenStopped = false;
    this.#terminalSettled = false;
    this.#failure = null;
    this.#terminalResolve = null;
    this.#stopWaiter = null;
    this.#pendingTerminal = null;
    this.#settledTerminal = null;
  }

  // -------------------------------------------------------------------------
  // Chunks
  // -------------------------------------------------------------------------

  /**
   * Accept one `chunk` Port message from the credit-constrained producer.
   * Order: schema/session/sequence validation -> pre-enqueue admission ->
   * enqueue -> pump under the single-credit window.
   *
   * R3: chunks are accepted through `draining` on purpose. `quiesce` means
   * "produce NO NEW AUDIO", not "discard what you already buffered": the
   * frozen 24-step positive trace steps 15-16 have the producer report
   * `quiesced` with `queuedChunks: 1` and then flush exactly that one chunk
   * while the state is `draining`, and the drain gate may not finalize until
   * the backlog AND the in-flight window are both zero. The post-quiesce
   * stream stays bounded by the same single credit, the same sequence
   * discipline, the same outstanding caps and the same whole-capture
   * deadline, so accepting it cannot make the capture unbounded.
   */
  offerChunkMessage(message: unknown): RelayResult {
    if (this.#failure) return { ok: false, failureCode: this.#failure };
    if (
      this.#offscreenStopped
      || this.#state === "cleanup_pending"
      || this.#state === "finalized"
      || this.#state === "aborted"
      || this.#state === "failed"
    ) {
      // Past `stopped` the producer must have finished teardown: the Runtime
      // `stop` is already committed and a straggler chunk is refused without
      // touching the queue, the sequence or the byte counters.
      return { ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID };
    }
    if (
      this.#state !== "capturing"
      && this.#state !== "runtime_started"
      && this.#state !== "draining"
    ) {
      return { ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID };
    }
    const validated = validateChunkMessage(message, {
      captureSessionId: this.#captureSessionId,
      expectedSequence: this.#expectedSequence
    });
    if (!validated.ok) {
      // Transport-owned (schema / sequence): one fail-closed closeout.
      this.#failClosed(validated.failureCode);
      return { ok: false, failureCode: validated.failureCode };
    }
    const chunk = validated.chunk;
    // R2-5: the OWNER enforces the frozen capture bounds. R1-C2-1 removed
    // the Offscreen's local timer, and the transport accumulated
    // capturedMs/chunkCount without ever comparing them, so no duration or
    // byte limit was enforced anywhere. Both checks run BEFORE enqueue so
    // an over-limit capture aborts rather than being silently truncated.
    if (exceedsCaptureByteBound(this.#totalRawBytes, chunk.rawByteLength, this.#maxCaptureBytes)) {
      const failureCode = RELAY_FAILURE_CODES.BYTE_LIMIT;
      this.#failClosed(failureCode);
      return { ok: false, failureCode };
    }
    if (exceedsCaptureDurationBound(this.#now() - this.#startedAt)) {
      const failureCode = RELAY_FAILURE_CODES.DURATION_LIMIT;
      this.#failClosed(failureCode);
      return { ok: false, failureCode };
    }
    const admission = admitChunk({
      chunks: this.#queue.length + this.#inFlight,
      rawBytes:
        this.#queue.reduce((total, item) => total + item.rawByteLength, 0) + this.#inFlightRawBytes,
      nextChunkRawBytes: chunk.rawByteLength
    });
    if (!admission.ok) {
      // Abort BEFORE enqueue — never a silent drop. Transport-owned, so a
      // single fail-closed closeout.
      this.#failClosed(admission.failureCode);
      return { ok: false, failureCode: admission.failureCode };
    }
    this.#expectedSequence += 1;
    this.#chunkCount += 1;
    this.#capturedMs += Math.round(
      (chunk.rawByteLength / (16_000 * 1 * 2)) * 1000
    );
    this.#totalRawBytes += chunk.rawByteLength;
    this.#queue.push({
      sequence: chunk.sequence,
      rawByteLength: chunk.rawByteLength,
      bytes: chunk.bytes
    });
    if (this.#state === "runtime_started") this.#setState("capturing");
    this.#pump();
    return { ok: true };
  }

  #onRuntimeAck(message: Record<string, unknown>): RelayResult {
    if (this.#inFlight <= 0) {
      const failureCode = RELAY_FAILURE_CODES.PROTOCOL_INVALID;
      this.#fail(failureCode);
      return { ok: false, failureCode };
    }
    if (typeof message.sequence === "number" && message.sequence !== this.#inFlightSequence) {
      const failureCode = RELAY_FAILURE_CODES.CHUNK_SEQUENCE_INVALID;
      this.#fail(failureCode);
      return { ok: false, failureCode };
    }
    this.#inFlight -= 1;
    this.#inFlightSequence = null;
    this.#inFlightRawBytes = Math.max(0, this.#inFlightRawBytes - this.#lastSentRawBytes);
    this.#clearTimer(this.#ackTimer);
    this.#ackTimer = null;
    this.#lastAcknowledgedSequence =
      typeof message.sequence === "number" ? message.sequence : this.#lastAcknowledgedSequence;
    this.#acknowledgedChunkCount += 1;
    // Credit is returned to the producer ONLY by a Runtime ACK.
    this.#deps.onRuntimeAck?.(this.#lastAcknowledgedSequence);
    this.#pump();
    // The last ACK may complete the drain, so the finalize gate must be
    // re-evaluated here; otherwise a stop would never be sent to Runtime.
    void this.#maybeFinalize();
    return { ok: true };
  }

  /** The sequence the next `chunk_credit` acknowledges. */
  get acknowledgedSequence(): number {
    return this.#lastAcknowledgedSequence;
  }

  get inFlight(): number {
    return this.#inFlight;
  }

  #pump() {
    const socket = this.#socket;
    if (!socket || socket.readyState !== SOCKET_OPEN) return;
    while (this.#inFlight < RELAY_V10.runtimeMaxInFlightChunks && this.#queue.length > 0) {
      const next = this.#queue.shift();
      if (!next) return;
      this.#inFlight += 1;
      this.#inFlightSequence = next.sequence;
      this.#lastSentRawBytes = next.rawByteLength;
      this.#inFlightRawBytes += next.rawByteLength;
      try {
        socket.send(next.bytes.buffer.slice(
          next.bytes.byteOffset,
          next.bytes.byteOffset + next.bytes.byteLength
        ) as ArrayBuffer);
        this.#sentChunkCount += 1;
        this.#armAckTimeout();
      } catch {
        this.#fail(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stop / finalize
  // -------------------------------------------------------------------------

  /**
   * ATOMIC stop boundary (frozen requirement): the reason is frozen FIRST,
   * before any quiesce is sent. A producer-initiated `stopped` can never be
   * interpreted as `completed` afterwards.
   */
  beginStop(reason: CaptureStopReason): { ok: true; reason: CaptureStopReason } {
    if (this.#stopRequested) {
      return { ok: true, reason: this.#stopReason };
    }
    this.#stopRequested = true;
    this.#stopReason = reason;
    return { ok: true, reason };
  }

  /**
   * R3-5: the producer answered `ready`, so the capture is LIVE.
   *
   * The frozen 24-step positive trace requires the `capturing` phase to be
   * published at step 6-7 (`offscreen ready` -> `restart_marker_phase_
   * capturing`), i.e. at producer-ready — NOT at the first chunk, which is
   * step 9. Without this the marker stayed on `runtime_started` for the whole
   * handshake, so a worker restart during the handshake could not tell a
   * ready-but-silent producer from one that never started. The transition is
   * monotonic and only ever leaves `runtime_started`.
   */
  markProducerReady(): void {
    if (this.#state !== "runtime_started") return;
    this.#setState("capturing");
  }

  /** The producer confirmed the audio source stopped. */
  markQuiesced(): void {
    this.#quiesced = true;
    if (this.#state === "capturing" || this.#state === "runtime_started") {
      this.#setState("draining");
    }
  }

  /** The producer finished teardown. */
  markOffscreenStopped(): void {
    this.#offscreenStopped = true;
    if (this.#state === "capturing" || this.#state === "runtime_started") {
      this.#setState("draining");
    }
    void this.#maybeFinalize();
  }

  /**
   * Normal stop: freeze the reason, then quiesce -> drain -> stopped ->
   * finalize. The Runtime `stop` command is only sent after a stop has been
   * requested, the producer has stopped, and the backlog is fully drained.
   */
  async stop(reason: CaptureStopReason): Promise<TransportTerminal> {
    // R3-4: a capture that has ALREADY reached a terminal (a producer
    // `capture_error`, a byte/duration limit, an abnormal disconnect) must
    // still answer `stop()`. Otherwise a fresh, never-settled waiter is
    // created, `Controller.stop()` never returns, and the Offscreen
    // document is never closed — the capture would be stuck outside any
    // explainable idle/error state.
    if (this.#terminalSettled) {
      return this.#settledTerminal ?? {
        ok: false,
        failureCode: this.#failure ?? RELAY_FAILURE_CODES.FINALIZE_FAILED
      };
    }
    this.beginStop(reason);
    if (this.#state === "capturing" || this.#state === "runtime_started") this.#setState("draining");
    if (!this.#stopWaiter) {
      this.#stopWaiter = new Promise<TransportTerminal>((resolve) => {
        this.#terminalResolve = resolve;
      });
    }
    this.#armCleanupTimeout();
    void this.#maybeFinalize();
    return this.#stopWaiter;
  }

  /**
   * R3: a requested stop must ALWAYS terminate.
   *
   * quiesce -> drain -> `stopped` -> finalize is driven by the producer. If
   * the producer never reports `stopped` (a dead Offscreen document, a
   * dropped Port, a worker suspended mid-drain), `#maybeFinalize()` waits on
   * a flag that will never flip: `stop()` would never resolve, the
   * Controller would never reach an idle/error state, and the Offscreen
   * document would never be closed. R3-4 requires every idle/error path to
   * close the Offscreen, so the wait is bounded by the ALREADY FROZEN
   * `cleanupTimeoutMs` — no new threshold and no new failure code is
   * introduced.
   */
  #armCleanupTimeout(): void {
    this.#clearTimer(this.#cleanupTimer);
    this.#cleanupTimer = null;
    // Only the "waiting for the producer to report `stopped`" phase is
    // bounded. After `stopped`, `#finalizeRuntime()` has its own frozen
    // `finalizeTimeoutMs`.
    if (this.#terminalSettled || this.#offscreenStopped) return;
    this.#cleanupTimer = this.#setTimer(() => {
      this.#cleanupTimer = null;
      if (this.#terminalSettled || this.#offscreenStopped) return;
      // The producer is gone mid-drain: one fail-closed closeout so the
      // failure is normalized, the socket closes, the marker clears and the
      // terminal settles. The Controller still closes the document.
      this.#failClosed(RELAY_FAILURE_CODES.CLEANUP_INCOMPLETE);
    }, RELAY_V10.cleanupTimeoutMs);
  }

  async #maybeFinalize(): Promise<void> {
    if (this.#terminalSettled) return;
    // A producer may not finalize on its own: a stop must have been
    // requested first, so navigation / cancel can never become `completed`.
    if (!this.#stopRequested) return;
    if (!this.#offscreenStopped) return;
    if (this.#queue.length > 0 || this.#inFlight > 0) {
      if (this.#inFlight === 0) this.#pump();
      return;
    }
    this.#setState("cleanup_pending");
    await this.#finalizeRuntime();
  }

  async #finalizeRuntime(): Promise<void> {
    const socket = this.#socket;
    if (socket && socket.readyState === SOCKET_OPEN) {
      const terminal = await new Promise<Record<string, unknown> | null>((resolve) => {
        let settled = false;
        this.#finalizeTimer = this.#setTimer(() => {
          if (settled) return;
          settled = true;
          resolve(null);
        }, RELAY_V10.finalizeTimeoutMs);
        const finish = (value: Record<string, unknown> | null) => {
          if (settled) return;
          settled = true;
          this.#clearTimer(this.#finalizeTimer);
          this.#finalizeTimer = null;
          resolve(value);
        };
        socket.addEventListener("message", (event: unknown) => {
          const data = (event as { data?: unknown })?.data;
          if (typeof data !== "string") return;
          let value: Record<string, unknown>;
          try {
            value = JSON.parse(data) as Record<string, unknown>;
          } catch {
            finish(null);
            return;
          }
          if (
            value.type === "completed"
            || value.type === "cancelled"
            || value.type === "failed"
          ) {
            finish(value);
          }
        });
        socket.addEventListener("close", () => finish(null));
        try {
          socket.send(JSON.stringify({ type: "stop", reason: this.#stopReason }));
        } catch {
          finish(null);
        }
      });
      this.#closeSocket();
      this.#settle(terminal);
      return;
    }
    this.#closeSocket();
    this.#settle(null);
  }

  // -------------------------------------------------------------------------
  // Abort / disconnect classification
  // -------------------------------------------------------------------------

  /**
   * An EXPECTED disconnect (the producer finished or we are tearing down)
   * must not re-abort a transport that is already finalizing. An ABNORMAL
   * disconnect always fails closed.
   */
  handleProducerDisconnect(reason: CaptureStopReason): { aborted: boolean } {
    if (this.#terminalSettled || this.#state === "finalized") {
      // Normal disconnect after a terminal: nothing to abort.
      return { aborted: false };
    }
    this.beginStop(reason);
    if (this.#state === "draining" || this.#state === "cleanup_pending" || this.#offscreenStopped) {
      // Expected teardown: keep draining, do not abort — but the wait for a
      // producer that may never answer is still bounded.
      this.#armCleanupTimeout();
      void this.#maybeFinalize();
      return { aborted: false };
    }
    const failureCode =
      reason === "runtime_disconnected"
        ? RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED
        : RELAY_FAILURE_CODES.PORT_DISCONNECTED;
    this.abort(failureCode);
    return { aborted: true };
  }

  /**
   * Late-bind the Runtime-ACK hook. The Background wiring creates the
   * transport before the Port owner, so the hook is attached afterwards
   * rather than through the constructor.
   */
  setAckHook(hook: { onRuntimeAck: (acknowledgedSequence: number) => void }): void {
    this.#deps.onRuntimeAck = hook.onRuntimeAck;
  }

  abort(failureCode: RelayFailureCode): { ok: false, failureCode: RelayFailureCode } {
    // C3: route through the ONE guarded closeout. A late abort (for
    // example from a Port-owned failure arriving after a finalize) can no
    // longer rewrite an already settled `finalized` state to `aborted`.
    this.#failClosed(failureCode);
    const settled = (this.#failure ?? failureCode) as RelayFailureCode;
    return { ok: false, failureCode: settled };
  }

  #fail(failureCode: RelayFailureCode) {
    if (this.#failure) return;
    this.#failure = failureCode;
    this.#deps.reportFailure?.(failureCode);
  }

  #closeSocket() {
    const socket = this.#socket;
    this.#socket = null;
    this.#clearTimer(this.#ackTimer);
    this.#ackTimer = null;
    this.#clearCaptureDeadline();
    if (!socket) return;
    try {
      if (socket.readyState < 2) socket.close(1000);
    } catch {
      /* already closed */
    }
  }

  #settle(terminal: Record<string, unknown> | null) {
    // C3: if a terminal was ALREADY settled (for example a deadline that
    // won the race against this finalize), a late socket close / Runtime
    // frame / finalize timer must not rewrite that terminal state.
    if (!this.#terminalSettled) this.#setState("finalized");
    if (!terminal) {
      this.#settleTerminal({
        ok: false,
        failureCode: this.#failure ?? RELAY_FAILURE_CODES.FINALIZE_FAILED
      });
      return;
    }
    if (terminal.type === "failed") {
      const failureCode = normalizeRelayFailureCode(
        terminal.failureCode,
        RELAY_FAILURE_CODES.FINALIZE_FAILED
      );
      this.#fail(failureCode);
      this.#settleTerminal({ ok: false, failureCode });
      return;
    }
    if (terminal.type === "cancelled") {
      this.#settleTerminal({ ok: true, capture: this.#captureSummary() });
      return;
    }
    const transcript = terminal.transcript && typeof terminal.transcript === "object"
      ? terminal.transcript as Record<string, unknown>
      : null;
    if (!transcript || typeof transcript.taskId !== "string" || typeof transcript.state !== "string") {
      const failureCode = RELAY_FAILURE_CODES.FINALIZE_FAILED;
      this.#fail(failureCode);
      this.#settleTerminal({ ok: false, failureCode });
      return;
    }
    this.#settleTerminal({
      ok: true,
      capture: this.#captureSummary(),
      transcript
    });
  }

  #captureSummary() {
    return { chunks: this.#chunkCount, capturedMs: this.#capturedMs };
  }

  #settleTerminal(terminal: TransportTerminal) {
    if (this.#terminalSettled) return;
    this.#terminalSettled = true;
    // The settled terminal is retained for the whole capture so a LATE
    // `stop()` / `awaitTerminal()` answers with it instead of waiting for a
    // second terminal that can never arrive.
    this.#settledTerminal = terminal;
    // No terminal may leave a live deadline callback behind.
    this.#clearCaptureDeadline();
    // ...nor a live cleanup-stall callback.
    this.#clearTimer(this.#cleanupTimer);
    this.#cleanupTimer = null;
    // A completed capture releases the frozen marker.
    this.clearRestartMarker();
    const resolve = this.#terminalResolve;
    this.#terminalResolve = null;
    if (resolve) {
      resolve(terminal);
      return;
    }
    this.#pendingTerminal = terminal;
  }

  /** Resolves once a terminal (success or failure) has been reached. */
  async awaitTerminal(): Promise<TransportTerminal> {
    if (this.#terminalSettled && this.#settledTerminal) {
      this.#pendingTerminal = null;
      return this.#settledTerminal;
    }
    if (this.#pendingTerminal) {
      const value = this.#pendingTerminal;
      this.#pendingTerminal = null;
      return value;
    }
    if (!this.#stopWaiter) {
      this.#stopWaiter = new Promise<TransportTerminal>((resolve) => {
        this.#terminalResolve = resolve;
      });
    }
    return this.#stopWaiter;
  }
}

export { PORT_MESSAGE, SESSION_ID_PATTERN, RESTART_MARKER_FIELDS, RESTART_MARKER_TRANSITIONS };
export type { RelayRestartMarker, RestartMarkerPhase };
