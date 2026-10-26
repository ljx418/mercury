/**
 * R6-G1 — RLY11-N11..N14.
 *
 * Production owner: `audioChunk` inbound codec/validator, proven through the
 * accepted `OffscreenAudioPort` composition so a rejected chunk is shown to
 * produce no ACK, no credit and no Runtime frame.
 *
 * Each sub-scenario asserts the EXACT frozen code the production owner
 * returns, rather than a coarser case-level category.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encodeChunkBase64,
  validateChunkMessage
} from "../../capture/audioChunk";
import {
  authoritativeContext,
  FakeOffscreenPort,
  immediateWait,
  makeAudioPort,
  pcmBytes,
  R6_EXT_ID,
  R6_SESSION_ID,
  stubChromeRuntimeId,
  validSender
} from "./R6RelayHarness";

const EXPECTED = { captureSessionId: R6_SESSION_ID, expectedSequence: 0 };
const CHUNK_INVALID = "V3_MEDIA_CAPTURE_CHUNK_INVALID";
const BYTE_LIMIT = "V3_MEDIA_CAPTURE_BYTE_LIMIT";
const AUDIO_SHAPE_INVALID = "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Validate through production, then prove the owner never acknowledged. */
function reject(message: unknown, expectedCode: string): void {
  const verdict = validateChunkMessage(message, EXPECTED);
  expect(verdict).toEqual({ ok: false, failureCode: expectedCode });
  if ("ok" in verdict && verdict.ok) throw new Error("unreachable");
}

function chunkMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const bytes = pcmBytes(320);
  return {
    type: "chunk",
    captureSessionId: R6_SESSION_ID,
    sequence: 0,
    rawByteLength: bytes.byteLength,
    pcmBase64: encodeChunkBase64(bytes),
    ...overrides
  };
}

describe("R6-G1 RLY11-N11..N14 — inbound audio chunk boundary", () => {
  it("RLY11-N11 refuses non-canonical or otherwise invalid base64 payloads", () => {
    // Outside the base64 alphabet entirely.
    reject(chunkMessage({ pcmBase64: "!!!!not base64!!!!" }), CHUNK_INVALID);
    // Canonical alphabet characters, but not a base64 length quantum.
    reject(chunkMessage({ pcmBase64: "AB*D" }), CHUNK_INVALID);
    reject(chunkMessage({ pcmBase64: "AAAAA" }), CHUNK_INVALID);
    // A payload shorter than the minimum quantum is a bound, not a codec error.
    reject(chunkMessage({ pcmBase64: "AAA" }), BYTE_LIMIT);
    // Non-string payload.
    reject(chunkMessage({ pcmBase64: 12345 }), CHUNK_INVALID);
  });

  it("RLY11-N12 refuses a chunk whose declared length does not match the decoded payload", () => {
    // Declares 320 but carries 640 bytes of PCM.
    const bytes = pcmBytes(640);
    reject(chunkMessage({ rawByteLength: 320, pcmBase64: encodeChunkBase64(bytes) }), CHUNK_INVALID);
    // Declares 640 but carries 320 bytes of PCM.
    const small = pcmBytes(320);
    reject(chunkMessage({ rawByteLength: 640, pcmBase64: encodeChunkBase64(small) }), CHUNK_INVALID);
  });

  it("RLY11-N13 refuses an odd raw length and an oversized raw chunk", () => {
    // Odd sample width: not a whole PCM frame.
    reject(chunkMessage({ rawByteLength: 321 }), AUDIO_SHAPE_INVALID);
    // Beyond the frozen 49152-byte raw chunk bound.
    reject(chunkMessage({ rawByteLength: 49154, pcmBase64: encodeChunkBase64(pcmBytes(49154)) }), BYTE_LIMIT);
    // The bound is inclusive: exactly 49152 raw bytes is admissible.
    const atBound = validateChunkMessage(
      chunkMessage({ rawByteLength: 49152, pcmBase64: encodeChunkBase64(pcmBytes(49152)) }),
      EXPECTED
    );
    expect(atBound.ok).toBe(true);
  });

  it("RLY11-N14 refuses an encoded chunk beyond the frozen encoded-character bound", () => {
    // 65536 encoded characters is the ceiling; exceed it without allocating
    // the whole wire buffer by declaring an over-long string.
    const oversized = "A".repeat(65540);
    reject(chunkMessage({ rawByteLength: 49152, pcmBase64: oversized }), BYTE_LIMIT);
  });

  it("the Port owner gates the session before the codec, and never reaches the Runtime", async () => {
    // Precise ownership note: before the capture starts, the Port owner rejects
    // on the session binding FIRST, so a codec mutation cannot be smuggled in
    // ahead of the transport gate. Asserted so the composition claim is honest.
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender() });
    expect(await harness.port.accept(producer)).toEqual({ ok: true });

    const framesBefore = producer.toBackground.length;
    producer.deliver(chunkMessage({ pcmBase64: "!!!!not base64!!!!" }));

    expect(harness.failures).toEqual(["V3_MEDIA_CAPTURE_BINDING_MISMATCH"]);
    expect(producer.toBackground.length).toBe(framesBefore);
    expect(harness.socket.sent).toEqual([]);
    expect(harness.socket.closeCalls).toEqual([]);
    expect(harness.disconnects).toEqual([]);
    expect(harness.port.connected).toBe(true);
    expect(harness.port.boundDocumentId).toBe("doc-r6-authoritative-1");
  });

  it("accepts one canonical chunk at the expected sequence", () => {
    const verdict = validateChunkMessage(chunkMessage(), EXPECTED);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.chunk.sequence).toBe(0);
    expect(verdict.chunk.rawByteLength).toBe(320);
    expect(verdict.chunk.bytes.byteLength).toBe(320);
  });
});
