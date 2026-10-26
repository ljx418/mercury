/**
 * WP0 R1 — shared PCM chunk codec.
 *
 * Mirrors the frozen `chunk` / `chunk_credit` schema bounds:
 *   rawByteLength: 2 .. 49152, multipleOf 2
 *   pcmBase64: 4 .. 65536, canonical Base64 pattern
 *
 * Every rejection maps onto a closed public relay failure code. There is no
 * silent drop anywhere in this module, and the pre-enqueue admission check
 * exists so an over-limit chunk aborts instead of being dropped.
 */

import {
  PORT_MESSAGE,
  RELAY_AUDIO_CONFIG,
  RELAY_FAILURE_CODES,
  RELAY_V10,
  SESSION_ID_PATTERN,
  type ChunkCreditMessage,
  type ChunkMessage,
  type RelayFailureCode,
  type RelayResult
} from "./relayContracts";

/** The frozen canonical Base64 pattern from the schema. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type DecodedChunk = { sequence: number; rawByteLength: number; bytes: Uint8Array };

export function encodeChunkBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeChunkBase64(
  value: unknown
): { bytes: Uint8Array } | { failureCode: RelayFailureCode } {
  if (typeof value !== "string") return { failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID };
  if (value.length < 4 || value.length > RELAY_V10.maxEncodedChunkChars) {
    return { failureCode: RELAY_FAILURE_CODES.BYTE_LIMIT };
  }
  if (value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    return { failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID };
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return { failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID };
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
  return { bytes };
}

/**
 * Validate an inbound `chunk` against the frozen schema bounds plus the
 * local sequence discipline. `captureSessionId` must match the session the
 * port is bound to.
 */
export function validateChunkMessage(
  message: unknown,
  expected: { captureSessionId: string; expectedSequence: number }
): { ok: true, chunk: DecodedChunk } | { ok: false, failureCode: RelayFailureCode } {
  if (!message || typeof message !== "object") {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID };
  }
  const value = message as Partial<ChunkMessage>;
  if (value.type !== PORT_MESSAGE.CHUNK) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID };
  }
  // Every Port message carries and is checked against the same session.
  if (typeof value.captureSessionId !== "string" || !SESSION_ID_PATTERN.test(value.captureSessionId)) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID };
  }
  if (value.captureSessionId !== expected.captureSessionId) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.BINDING_MISMATCH };
  }
  const { sequence, rawByteLength, pcmBase64 } = value;
  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_SEQUENCE_INVALID };
  }
  if (sequence !== expected.expectedSequence) {
    // Duplicate (behind) and out-of-order (ahead) both fail closed.
    return { ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_SEQUENCE_INVALID };
  }
  if (typeof rawByteLength !== "number" || !Number.isInteger(rawByteLength)) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID };
  }
  if (rawByteLength < 2) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.EMPTY };
  }
  if (rawByteLength > RELAY_V10.maxRawChunkBytes) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.BYTE_LIMIT };
  }
  if (rawByteLength % RELAY_AUDIO_CONFIG.sampleWidthBytes !== 0) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID };
  }
  const decoded = decodeChunkBase64(pcmBase64);
  if ("failureCode" in decoded) return { ok: false, failureCode: decoded.failureCode };
  if (decoded.bytes.byteLength !== rawByteLength) {
    // Declared length must match the decoded payload exactly.
    return { ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID };
  }
  return { ok: true, chunk: { sequence, rawByteLength, bytes: decoded.bytes } };
}

/**
 * Pre-enqueue admission (frozen outstanding limits). Runs BEFORE the queue
 * so an over-limit chunk aborts rather than being dropped.
 */
export function admitChunk(backlog: {
  chunks: number;
  rawBytes: number;
  nextChunkRawBytes: number;
}): RelayResult {
  if (backlog.nextChunkRawBytes > RELAY_V10.maxRawChunkBytes) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.BYTE_LIMIT };
  }
  if (backlog.chunks + 1 > RELAY_V10.maxOutstandingChunks) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.BACKPRESSURE };
  }
  if (backlog.rawBytes + backlog.nextChunkRawBytes > RELAY_V10.maxOutstandingRawBytes) {
    return { ok: false, failureCode: RELAY_FAILURE_CODES.BACKPRESSURE };
  }
  return { ok: true };
}

/**
 * Build the single `chunk_credit` for an acknowledged sequence. Credit is
 * const 1 in the frozen schema and is produced ONLY by a Runtime ACK.
 */
export function buildChunkCredit(
  captureSessionId: string,
  acknowledgedSequence: number
): ChunkCreditMessage {
  return {
    type: PORT_MESSAGE.CHUNK_CREDIT,
    captureSessionId,
    acknowledgedSequence,
    credit: RELAY_V10.creditWindowChunks
  };
}

/** Build the frozen Runtime `start` payload. */
export function buildRuntimeStartPayload(input: {
  ticket: string;
  taskId: string;
  adapterId: string;
  surface: "side_panel" | "workspace";
  pageIdentitySha256: string;
  tabId: number;
  tabIdSha256: string;
  sourceIdentity: string;
  acquisitionRecordId: string;
}): Record<string, unknown> {
  return {
    type: PORT_MESSAGE.START,
    ticket: input.ticket,
    taskId: input.taskId,
    adapterId: input.adapterId,
    surface: input.surface,
    pageIdentitySha256: input.pageIdentitySha256,
    tabId: input.tabId,
    tabIdSha256: input.tabIdSha256,
    sourceIdentity: input.sourceIdentity,
    acquisitionRecordId: input.acquisitionRecordId,
    sampleRateHz: RELAY_AUDIO_CONFIG.sampleRateHz,
    channels: RELAY_AUDIO_CONFIG.channels,
    sampleWidthBytes: RELAY_AUDIO_CONFIG.sampleWidthBytes
  };
}
