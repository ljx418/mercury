/**
 * Keep capture and restored tab playback on the same live graph.
 * A parallel processor branch whose output is always silent can be culled by
 * Chrome while the direct source branch keeps playing, leaving the Runtime
 * with zero chunks. Making the processor the only route to the destination
 * requires the callback to run and avoids duplicate playback.
 */
export function connectCaptureAudioGraph(
  source: MediaStreamAudioSourceNode,
  processor: ScriptProcessorNode,
  destination: AudioDestinationNode,
): void {
  source.connect(processor);
  processor.connect(destination);
}

/** Preserve the captured tab's playback after tabCapture takes ownership. */
export function copyCaptureInputToOutput(input: Float32Array, output: Float32Array): void {
  output.fill(0);
  output.set(input.subarray(0, output.length));
}

