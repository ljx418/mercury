import { MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE } from "../../src/modules/media_companion/capture";

const RUNTIME_WS_URL = "ws://127.0.0.1:17861/v1/media/capture-stream";
const MAX_CAPTURE_MS = 900_000;

type ActiveCapture = {
  socket: WebSocket;
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  timeout: number;
  completed: boolean;
};

let active: ActiveCapture | null = null;

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16_000): ArrayBuffer {
  if (outputRate > inputRate) throw new Error("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < Math.min(end, input.length); cursor += 1) sum += input[cursor];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output.buffer;
}

async function cleanup(reason: string, sendStop: boolean): Promise<Record<string, unknown> | null> {
  const current = active;
  if (!current) return null;
  active = null;
  clearTimeout(current.timeout);
  current.processor.disconnect();
  current.source.disconnect();
  current.silentGain.disconnect();
  current.stream.getTracks().forEach((track) => track.stop());
  let terminal: Record<string, unknown> | null = null;
  if (sendStop && current.socket.readyState === WebSocket.OPEN) {
    terminal = await new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED")), 120_000);
      const finish = (value: Record<string, unknown> | null) => { clearTimeout(timer); resolve(value); };
      current.socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const value = JSON.parse(event.data) as Record<string, unknown>;
        if (["completed", "cancelled", "failed"].includes(String(value.type))) finish(value);
      });
      current.socket.addEventListener("close", () => finish(null), { once: true });
      current.socket.addEventListener("error", () => reject(new Error("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED")), { once: true });
      current.socket.send(JSON.stringify({ type: "stop", reason }));
    });
  }
  if (current.socket.readyState < WebSocket.CLOSING) current.socket.close(1000);
  await current.context.close().catch(() => undefined);
  return terminal;
}

async function startCapture(message: Record<string, unknown>) {
  if (active) throw new Error("V3_MEDIA_CAPTURE_ALREADY_ACTIVE");
  if (typeof message.streamId !== "string" || !message.streamId || typeof message.ticket !== "string") {
    throw new Error("V3_MEDIA_CAPTURE_MESSAGE_INVALID");
  }
  const binding = message.binding as Record<string, unknown>;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: message.streamId
      }
    } as MediaTrackConstraints,
    video: false
  });
  const context = new AudioContext();
  await context.resume();
  if (context.state !== "running") throw new Error("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED");
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  source.connect(context.destination);
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);

  const socket = new WebSocket(RUNTIME_WS_URL);
  socket.binaryType = "arraybuffer";
  const started = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED")), 10_000);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "start",
        ticket: message.ticket,
        ...binding,
        sourceIdentity: message.sourceIdentity,
        acquisitionRecordId: message.acquisitionRecordId,
        sampleRateHz: 16_000,
        channels: 1,
        sampleWidthBytes: 2
      }));
    }, { once: true });
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const value = JSON.parse(event.data) as Record<string, unknown>;
      if (value.type === "started") { clearTimeout(timer); resolve(); }
      if (value.type === "failed") { clearTimeout(timer); reject(new Error(String(value.failureCode))); }
    });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED")); }, { once: true });
  });

  active = {
    socket, stream, context, source, processor, silentGain,
    timeout: window.setTimeout(() => void cleanup("timeout", true), MAX_CAPTURE_MS),
    completed: false
  };
  try {
    await started;
    processor.onaudioprocess = (event) => {
      if (!active || active.socket.readyState !== WebSocket.OPEN) return;
      const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), context.sampleRate);
      if (pcm.byteLength > 0) active.socket.send(pcm);
      event.outputBuffer.getChannelData(0).fill(0);
    };
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => void cleanup("tab_closed", true), { once: true });
    });
  } catch (error) {
    await cleanup("failed", false);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE) return false;
  if (sender.id !== chrome.runtime.id || sender.tab) {
    sendResponse({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    return false;
  }
  if (message.command === "ping") {
    sendResponse({ ok: true, state: "ready" });
    return false;
  }
  if (message.command === "start") {
    void startCapture(message)
      .then(() => sendResponse({ ok: true, state: "capturing" }))
      .catch((error) => sendResponse({ ok: false, failureCode: error instanceof Error ? error.message : "V3_MEDIA_CAPTURE_START_FAILED" }));
    return true;
  }
  if (message.command === "stop") {
    const reason = message.reason === "completed" ? "completed" : String(message.reason);
    void cleanup(reason, true)
      .then((result) => sendResponse({ ok: true, state: "stopped", result }))
      .catch(() => sendResponse({ ok: false, failureCode: "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE" }));
    return true;
  }
  sendResponse({ ok: false, failureCode: "V3_MEDIA_CAPTURE_MESSAGE_INVALID" });
  return false;
});

window.addEventListener("unload", () => { void cleanup("failed", false); });
