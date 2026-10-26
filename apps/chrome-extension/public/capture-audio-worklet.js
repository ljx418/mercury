class NaviaCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data !== "flush" || this.offset === 0) return;
      const finalChunk = this.buffer.slice(0, this.offset);
      this.offset = 0;
      this.port.postMessage({ samples: finalChunk, sampleRate }, [finalChunk.buffer]);
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    const frameCount = input[0]?.length ?? 0;
    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[Math.min(channel, input.length - 1)];
      if (source) output[channel].set(source);
    }
    let dominantChannel = input[0];
    let dominantEnergy = -1;
    for (let channel = 0; channel < input.length; channel += 1) {
      const samples = input[channel];
      let energy = 0;
      for (let frame = 0; frame < frameCount; frame += 1) energy += samples[frame] * samples[frame];
      if (energy > dominantEnergy) {
        dominantEnergy = energy;
        dominantChannel = samples;
      }
    }
    for (let frame = 0; frame < frameCount; frame += 1) {
      this.buffer[this.offset++] = dominantChannel[frame];
      if (this.offset === this.buffer.length) {
        const chunk = this.buffer;
        let peakAbsSample = 0;
        let nonZeroSampleCount = 0;
        for (let index = 0; index < chunk.length; index += 1) {
          const absolute = Math.abs(chunk[index]);
          if (absolute > 0) nonZeroSampleCount += 1;
          if (absolute > peakAbsSample) peakAbsSample = absolute;
        }
        this.buffer = new Float32Array(4096);
        this.offset = 0;
        this.port.postMessage({ samples: chunk, sampleRate, peakAbsSample, nonZeroSampleCount }, [chunk.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("navia-capture-processor", NaviaCaptureProcessor);
