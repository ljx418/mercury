import { describe, expect, it, vi } from "vitest";

import { connectCaptureAudioGraph, copyCaptureInputToOutput } from "../capture/captureAudioGraph";

describe("Offscreen capture audio graph", () => {
  it("uses the processor as the only route to the destination", () => {
    const destination = {} as AudioDestinationNode;
    const processor = { connect: vi.fn() } as unknown as ScriptProcessorNode;
    const source = { connect: vi.fn() } as unknown as MediaStreamAudioSourceNode;

    connectCaptureAudioGraph(source, processor, destination);

    expect(source.connect).toHaveBeenCalledExactlyOnceWith(processor);
    expect(processor.connect).toHaveBeenCalledExactlyOnceWith(destination);
  });

  it("copies captured input to the sole output branch without amplification", () => {
    const input = new Float32Array([0.25, -0.5, 1]);
    const output = new Float32Array(5).fill(9);

    copyCaptureInputToOutput(input, output);

    expect(Array.from(output)).toEqual([0.25, -0.5, 1, 0, 0]);
  });
});

