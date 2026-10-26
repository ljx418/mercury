export type FloatPlanarAudioFrame = {
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: "f32-planar" }): void;
  close(): void;
};

/** Convert a WebCodecs audio frame to mono without retaining frame storage. */
export function copyAudioFrameToMono(frame: FloatPlanarAudioFrame): Float32Array {
  const frames = Math.max(0, frame.numberOfFrames);
  const channels = Math.max(1, frame.numberOfChannels);
  const mono = new Float32Array(frames);
  for (let channel = 0; channel < channels; channel += 1) {
    const plane = new Float32Array(frames);
    frame.copyTo(plane, { planeIndex: channel, format: "f32-planar" });
    for (let index = 0; index < frames; index += 1) mono[index] += plane[index] / channels;
  }
  return mono;
}
