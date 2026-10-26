/**
 * WP0 R5-B — frozen v11 relay contracts.
 *
 * Every value here mirrors
 * `docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json`.
 * Nothing in this file may be tuned: the schema is the authority and Codex
 * owns it. This module only *describes* it in typed form.
 *
 * Ownership (frozen, `02-target-architecture-and-boundaries.md` §3):
 *   - Background service worker: the single Runtime capture WebSocket owner,
 *     sequence, credit window, queue/byte caps, ACK, quiesce/drain,
 *     stop/finalize, restart marker, public FailureCode normalization.
 *   - Offscreen document: a credit-constrained pure PCM producer.
 */

/** Frozen Port name. */
export const MEDIA_CAPTURE_AUDIO_PORT_NAME = "navia.mediaCapture.audio/v11" as const;

/**
 * The nine frozen Port message types. Direction is frozen:
 *   Background -> Offscreen: start, chunk_credit, quiesce, abort
 *   Offscreen -> Background: ready, chunk, quiesced, stopped, capture_error
 */
export const PORT_MESSAGE = Object.freeze({
  // Background -> Offscreen
  START: "start",
  CHUNK_CREDIT: "chunk_credit",
  QUIESCE: "quiesce",
  ABORT: "abort",
  // Offscreen -> Background
  READY: "ready",
  CHUNK: "chunk",
  QUIESCED: "quiesced",
  STOPPED: "stopped",
  CAPTURE_ERROR: "capture_error"
} as const);

export const BACKGROUND_TO_OFFSCREEN_MESSAGE_TYPES = Object.freeze([
  PORT_MESSAGE.START,
  PORT_MESSAGE.CHUNK_CREDIT,
  PORT_MESSAGE.QUIESCE,
  PORT_MESSAGE.ABORT
] as const);

export const OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES = Object.freeze([
  PORT_MESSAGE.READY,
  PORT_MESSAGE.CHUNK,
  PORT_MESSAGE.QUIESCED,
  PORT_MESSAGE.STOPPED,
  PORT_MESSAGE.CAPTURE_ERROR
] as const);

/** Frozen audio shape and transport limits. */
export const RELAY_V10 = Object.freeze({
  maxRawChunkBytes: 49_152,
  maxEncodedChunkChars: 65_536,
  creditWindowChunks: 1,
  runtimeMaxInFlightChunks: 1,
  maxOutstandingChunks: 32,
  maxOutstandingRawBytes: 1_572_864,
  portConnectTimeoutMs: 5_000,
  runtimeStartTimeoutMs: 10_000,
  chunkAckTimeoutMs: 10_000,
  cleanupTimeoutMs: 10_000,
  finalizeTimeoutMs: 120_000,
  maxCaptureMs: 900_000,
  maxCaptureBytes: 536_870_912,
  markerTtlMs: 1_080_000
} as const);

/** The frozen audio configuration carried by `start`. */
export const RELAY_AUDIO_CONFIG = Object.freeze({
  sampleRateHz: 16_000,
  channels: 1,
  sampleWidthBytes: 2
} as const);

/** Frozen session id format: `cap_` + 32 base64url chars (192 random bits). */
export const SESSION_ID_PATTERN = /^cap_[A-Za-z0-9_-]{32}$/;

/** The single frozen `quiesce` reason. */
export const QUIESCE_REASON = "completed" as const;

/**
 * Producer-internal diagnostics. These are NOT part of the public 20-code
 * relay inventory; Background normalizes them onto the public set before
 * they cross the boundary. `AUDIO_CONTEXT_SUSPENDED` is retained here (and
 * in the source inventory) precisely because it is a precise producer
 * diagnostic.
 */
export const PRODUCER_INTERNAL_CODES = Object.freeze({
  AUDIO_CONTEXT_SUSPENDED: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
} as const);

/** Producer-internal -> public relay normalization (frozen mapping). */
const PRODUCER_CODE_NORMALIZATION: Readonly<Record<string, string>> = Object.freeze({
  [PRODUCER_INTERNAL_CODES.AUDIO_CONTEXT_SUSPENDED]: "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID"
});

/** The frozen 20-code public relay inventory. */
export const RELAY_FAILURE_CODES = Object.freeze({
  PORT_FORBIDDEN: "V3_MEDIA_CAPTURE_PORT_FORBIDDEN",
  PORT_DISCONNECTED: "V3_MEDIA_CAPTURE_PORT_DISCONNECTED",
  PROTOCOL_INVALID: "V3_MEDIA_CAPTURE_PROTOCOL_INVALID",
  BACKPRESSURE: "V3_MEDIA_CAPTURE_BACKPRESSURE",
  WORKER_RESTARTED: "V3_MEDIA_CAPTURE_WORKER_RESTARTED",
  RUNTIME_DISCONNECTED: "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED",
  CLEANUP_INCOMPLETE: "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE",
  AUDIO_SHAPE_INVALID: "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID",
  CHUNK_INVALID: "V3_MEDIA_CAPTURE_CHUNK_INVALID",
  CHUNK_SEQUENCE_INVALID: "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
  BYTE_LIMIT: "V3_MEDIA_CAPTURE_BYTE_LIMIT",
  DURATION_LIMIT: "V3_MEDIA_CAPTURE_DURATION_LIMIT",
  EMPTY: "V3_MEDIA_CAPTURE_EMPTY",
  STREAM_INVALID: "V3_MEDIA_CAPTURE_STREAM_INVALID",
  TICKET_INVALID: "V3_MEDIA_CAPTURE_TICKET_INVALID",
  TICKET_EXPIRED: "V3_MEDIA_CAPTURE_TICKET_EXPIRED",
  TICKET_REPLAYED: "V3_MEDIA_CAPTURE_TICKET_REPLAYED",
  BINDING_MISMATCH: "V3_MEDIA_CAPTURE_BINDING_MISMATCH",
  ALREADY_ACTIVE: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE",
  FINALIZE_FAILED: "V3_MEDIA_CAPTURE_FINALIZE_FAILED"
} as const);

export type RelayFailureCode =
  (typeof RELAY_FAILURE_CODES)[keyof typeof RELAY_FAILURE_CODES];

/**
 * The shared `{ ok }` result shape used by the transport and port APIs.
 * Naming the union (rather than inlining it in every signature) keeps the
 * declarations readable and the parser unambiguous.
 */
export type RelayResult = { ok: true } | { ok: false, failureCode: RelayFailureCode };

const RELAY_FAILURE_SET: ReadonlySet<string> = new Set(Object.values(RELAY_FAILURE_CODES));

export function isRelayFailureCode(value: unknown): value is RelayFailureCode {
  return typeof value === "string" && RELAY_FAILURE_SET.has(value);
}

/** True for a producer-internal code that must never cross the boundary. */
export function isProducerInternalCode(value: unknown): boolean {
  return typeof value === "string" && value in PRODUCER_CODE_NORMALIZATION;
}

/**
 * Normalize any inbound / close-reason / producer diagnostic onto the closed
 * public 20-code relay set. Producer-internal codes use the frozen mapping;
 * anything unknown collapses to a fixed generic code so an arbitrary Runtime
 * or producer string can never leak across the public boundary.
 */
export function normalizeRelayFailureCode(
  value: unknown,
  fallback: RelayFailureCode
): RelayFailureCode {
  if (isRelayFailureCode(value)) return value;
  if (typeof value === "string" && value in PRODUCER_CODE_NORMALIZATION) {
    return PRODUCER_CODE_NORMALIZATION[value] as RelayFailureCode;
  }
  return fallback;
}

// ============================================================================
// Frozen message shapes
// ============================================================================

/** Background -> Offscreen: the one-shot streamId hand-off. */
export type StartMessage = {
  type: typeof PORT_MESSAGE.START;
  captureSessionId: string;
  streamId: string;
  audioConfig: typeof RELAY_AUDIO_CONFIG;
};

/** Background -> Offscreen: exactly one credit, returned only by a Runtime ACK. */
export type ChunkCreditMessage = {
  type: typeof PORT_MESSAGE.CHUNK_CREDIT;
  captureSessionId: string;
  acknowledgedSequence: number;
  credit: 1;
};

/** Background -> Offscreen: stop producing new audio. */
export type QuiesceMessage = {
  type: typeof PORT_MESSAGE.QUIESCE;
  captureSessionId: string;
  reason: typeof QUIESCE_REASON;
};

/** Background -> Offscreen: fail closed now. */
export type AbortMessage = {
  type: typeof PORT_MESSAGE.ABORT;
  captureSessionId: string;
  failureCode: RelayFailureCode;
};

export type BackgroundToOffscreenMessage =
  | StartMessage
  | ChunkCreditMessage
  | QuiesceMessage
  | AbortMessage;

/** Offscreen -> Background: the producer is alive. */
export type ReadyMessage = {
  type: typeof PORT_MESSAGE.READY;
  captureSessionId: string;
};

/** Offscreen -> Background: one bounded PCM chunk (only when credited). */
export type ChunkMessage = {
  type: typeof PORT_MESSAGE.CHUNK;
  captureSessionId: string;
  sequence: number;
  rawByteLength: number;
  pcmBase64: string;
};

/** Offscreen -> Background: the audio source has stopped. */
export type QuiescedMessage = {
  type: typeof PORT_MESSAGE.QUIESCED;
  captureSessionId: string;
  queuedChunks: number;
  outstandingRawBytes: number;
  sourceStopped: true;
};

/** Offscreen -> Background: teardown is complete. */
export type StoppedMessage = {
  type: typeof PORT_MESSAGE.STOPPED;
  captureSessionId: string;
  queuedChunks: 0;
  creditConsumed: 0;
  tracksStopped: true;
  contextClosed: true;
};

/** Offscreen -> Background: a producer failure. */
export type CaptureErrorMessage = {
  type: typeof PORT_MESSAGE.CAPTURE_ERROR;
  captureSessionId: string;
  failureCode: string;
};

export type OffscreenToBackgroundMessage =
  | ReadyMessage
  | ChunkMessage
  | QuiescedMessage
  | StoppedMessage
  | CaptureErrorMessage;

export type RelayPortMessage = BackgroundToOffscreenMessage | OffscreenToBackgroundMessage;

export function isBackgroundToOffscreenMessage(value: unknown): value is BackgroundToOffscreenMessage {
  return (
    !!value
    && typeof value === "object"
    && typeof (value as { type?: unknown }).type === "string"
    && (BACKGROUND_TO_OFFSCREEN_MESSAGE_TYPES as readonly string[])
      .includes((value as { type: string }).type)
  );
}

export function isOffscreenToBackgroundMessage(value: unknown): value is OffscreenToBackgroundMessage {
  return (
    !!value
    && typeof value === "object"
    && typeof (value as { type?: unknown }).type === "string"
    && (OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES as readonly string[])
      .includes((value as { type: string }).type)
  );
}

// ============================================================================
// Restart marker (frozen)
// ============================================================================

export const RESTART_MARKER_SCHEMA_VERSION = "v3-media-capture-restart-marker/v10" as const;
export const RESTART_MARKER_STORAGE = "chrome.storage.session" as const;
export const RESTART_MARKER_ACCESS_LEVEL = "TRUSTED_CONTEXTS" as const;

export const RESTART_MARKER_PHASES = Object.freeze([
  "connecting",
  "runtime_started",
  "capturing",
  "draining",
  "cleanup_pending"
] as const);

export type RestartMarkerPhase = (typeof RESTART_MARKER_PHASES)[number];

/** The only legal phase transitions (frozen). */
export const RESTART_MARKER_TRANSITIONS: Readonly<Record<RestartMarkerPhase, readonly RestartMarkerPhase[]>> =
  Object.freeze({
    connecting: ["runtime_started"],
    runtime_started: ["capturing"],
    capturing: ["draining"],
    draining: ["cleanup_pending"],
    cleanup_pending: []
  });

/**
 * The frozen marker fields, in order. No ticket / grantId / streamId / pcm /
 * sourceIdentity / absolutePath / cookie / apiKey may appear.
 */
export const RESTART_MARKER_FIELDS = Object.freeze([
  "schemaVersion",
  "captureSessionId",
  "taskId",
  "startedAt",
  "phase",
  "expiresAt"
] as const);

export type RelayRestartMarker = {
  schemaVersion: typeof RESTART_MARKER_SCHEMA_VERSION;
  captureSessionId: string;
  taskId: string;
  startedAt: string;
  phase: RestartMarkerPhase;
  expiresAt: string;
};

export function isRestartMarkerPhase(value: unknown): value is RestartMarkerPhase {
  return typeof value === "string"
    && (RESTART_MARKER_PHASES as readonly string[]).includes(value);
}

/** Generate a frozen-format `cap_` + 32 base64url capture session id. */
export function newCaptureSessionId(): string {
  const bytes = new Uint8Array(24); // 192 random bits
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64url = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `cap_${base64url}`;
}
