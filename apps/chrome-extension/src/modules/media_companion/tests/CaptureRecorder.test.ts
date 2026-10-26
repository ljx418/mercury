import { describe, expect, it, vi } from "vitest";

import { selectCaptureRecorderMime, splitPcm16Bytes } from "../capture/captureRecorder";

describe("Offscreen MediaRecorder fallback", () => {
  it("prefers the explicit Opus container and falls back to WebM", () => {
    const supportsOpus = vi.fn(() => true);
    expect(selectCaptureRecorderMime(supportsOpus)).toBe("audio/webm;codecs=opus");
    expect(supportsOpus).toHaveBeenCalledTimes(1);

    expect(selectCaptureRecorderMime((mime) => mime === "audio/webm")).toBe("audio/webm");
    expect(selectCaptureRecorderMime(() => false)).toBeNull();
  });

  it("splits PCM16 on sample boundaries within the relay byte limit", () => {
    const chunks = splitPcm16Bytes(Uint8Array.from({ length: 22 }, (_, index) => index), 8);

    expect(chunks.map((chunk) => chunk.byteLength)).toEqual([8, 8, 6]);
    expect(Array.from(chunks.flatMap((chunk) => Array.from(chunk)))).toEqual(
      Array.from({ length: 22 }, (_, index) => index),
    );
  });

  it("fails closed when a relay limit cannot hold one PCM16 sample", () => {
    expect(() => splitPcm16Bytes(new Uint8Array(2), 1)).toThrow("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
    expect(() => splitPcm16Bytes(new Uint8Array(3), 8)).toThrow("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
  });
});
