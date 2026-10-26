/**
 * R6-G1 — RLY11-N16, N17.
 *
 * Production owner: the frozen pre-enqueue admission predicate the Port/Transport
 * composition uses, proven at its EXACT boundary (inclusive limit passes, one
 * past fails) and proven to abort rather than silently drop.
 */

import { describe, expect, it } from "vitest";
import { admitChunk } from "../../capture/audioChunk";
import { RELAY_V10 } from "../../capture/relayContracts";

const MAX_OUTSTANDING_CHUNKS = 32;
const MAX_OUTSTANDING_RAW_BYTES = 1_572_864;
const CHUNK_BYTES = 320;

describe("R6-G1 RLY11-N16, N17 — outstanding backpressure boundary", () => {
  it("RLY11-N16 admits exactly 32 outstanding chunks and refuses the thirty-third", () => {
    expect(RELAY_V10.maxOutstandingChunks).toBe(MAX_OUTSTANDING_CHUNKS);

    // One below the limit is still admissible.
    expect(admitChunk({ chunks: MAX_OUTSTANDING_CHUNKS - 1, rawBytes: 0, nextChunkRawBytes: CHUNK_BYTES }))
      .toEqual({ ok: true });
    // Exactly at the limit: `chunks + 1 === 32` is allowed.
    expect(admitChunk({ chunks: MAX_OUTSTANDING_CHUNKS - 1 + 1, rawBytes: 0, nextChunkRawBytes: CHUNK_BYTES }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
    // One past the limit is a backpressure abort, never a silent drop.
    expect(admitChunk({ chunks: MAX_OUTSTANDING_CHUNKS, rawBytes: 0, nextChunkRawBytes: CHUNK_BYTES }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
  });

  it("RLY11-N17 admits exactly 1572864 outstanding raw bytes and refuses one more", () => {
    expect(RELAY_V10.maxOutstandingRawBytes).toBe(MAX_OUTSTANDING_RAW_BYTES);

    // Exactly at the byte ceiling is admissible.
    expect(admitChunk({
      chunks: 0,
      rawBytes: MAX_OUTSTANDING_RAW_BYTES - CHUNK_BYTES,
      nextChunkRawBytes: CHUNK_BYTES
    })).toEqual({ ok: true });

    // One byte past the ceiling fails closed as backpressure.
    expect(admitChunk({
      chunks: 0,
      rawBytes: MAX_OUTSTANDING_RAW_BYTES - CHUNK_BYTES + 1,
      nextChunkRawBytes: CHUNK_BYTES
    })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
  });

  it("the raw-chunk byte bound is checked before the outstanding backpressure bound", () => {
    // An over-sized chunk is a BYTE_LIMIT, never reported as backpressure: the
    // two frozen bounds must stay distinguishable.
    expect(admitChunk({
      chunks: MAX_OUTSTANDING_CHUNKS,
      rawBytes: MAX_OUTSTANDING_RAW_BYTES,
      nextChunkRawBytes: RELAY_V10.maxRawChunkBytes + 2
    })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
  });
});
