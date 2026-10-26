import { describe, expect, it, vi } from "vitest";

import { copyAudioFrameToMono, type FloatPlanarAudioFrame } from "../capture/captureTrackReader";

describe("Offscreen capture track reader", () => {
  it("downmixes planar stereo frames to mono", () => {
    const planes = [new Float32Array([1, 0.5]), new Float32Array([-1, 0.5])];
    const frame: FloatPlanarAudioFrame = {
      numberOfFrames: 2,
      numberOfChannels: 2,
      sampleRate: 48_000,
      copyTo(destination, options) {
        destination.set(planes[options.planeIndex]);
      },
      close: vi.fn(),
    };

    expect(Array.from(copyAudioFrameToMono(frame))).toEqual([0, 0.5]);
    expect(frame.close).not.toHaveBeenCalled();
  });
});
