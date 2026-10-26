/**
 * WP0 R1 — Offscreen capture document: a credit-constrained pure PCM producer.
 *
 * The frozen ownership invariant (`02-target-architecture-and-boundaries.md`
 * §3) makes the Background service worker the ONLY owner of the Runtime
 * capture WebSocket. This document therefore keeps exactly four duties:
 *   1. getUserMedia against the one-shot tab streamId (only after `start`);
 *   2. MediaStreamTrackProcessor, with ScriptProcessorNode compatibility fallback;
 *   3. downsample to pcm_s16le / 16 kHz / mono and Base64-encode;
 *   4. producer cleanup.
 *
 * It must NOT hold a Runtime URL, a ticket, a binding, a sourceIdentity, an
 * acquisitionRecordId, or a WebSocket, and there is NO direct-to-Runtime
 * fallback. Control arrives only over the frozen Port
 * `navia.mediaCapture.audio/v11`:
 *   start | chunk_credit | quiesce | abort   (from Background)
 *   ready | chunk | quiesced | stopped | capture_error   (to Background)
 *
 * The streamId arrives exactly once in `start` and is released as soon as
 * getUserMedia settles; it never appears in a chunk, credit, log, storage,
 * restart marker, or public evidence.
 */

import { MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE } from "../../src/modules/media_companion/capture";
import {
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  PORT_MESSAGE,
  PRODUCER_INTERNAL_CODES,
  RELAY_AUDIO_CONFIG,
  RELAY_V10,
  QUIESCE_REASON,
  SESSION_ID_PATTERN,
  type BackgroundToOffscreenMessage
} from "../../src/modules/media_companion/capture/relayContracts";
import { bootstrapOffscreenProducerPort } from "../../src/modules/media_companion/capture/OffscreenProducerBootstrap";
import {
  connectCaptureAudioGraph,
  copyCaptureInputToOutput
} from "../../src/modules/media_companion/capture/captureAudioGraph";
import {
  copyAudioFrameToMono,
  type FloatPlanarAudioFrame
} from "../../src/modules/media_companion/capture/captureTrackReader";
import {
  selectCaptureRecorderMime,
  splitPcm16Bytes
} from "../../src/modules/media_companion/capture/captureRecorder";

type AudioTrackReader = ReadableStreamDefaultReader<FloatPlanarAudioFrame>;
type AudioTrackProcessorConstructor = new (options: { track: MediaStreamTrack }) => {
  readable: ReadableStream<FloatPlanarAudioFrame>;
};

type ActiveCapture = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode | null;
  worklet: AudioWorkletNode | null;
  workletQueue: Float32Array[];
  trackReader: AudioTrackReader | null;
  recorder: MediaRecorder | null;
  recordedBlobs: Blob[];
  wakeCredit: (() => void) | null;
  sequence: number;
  capturedMs: number;
  chunkCount: number;
  queuedChunks: number;
  outstandingRawBytes: number;
  quiescing: boolean;
};

let active: ActiveCapture | null = null;
let port: chrome.runtime.Port | null = null;
let captureSessionId: string | null = null;
let credit = 0;
let started = false;

type CaptureDiagnostic = {
  strategy: "none" | "audio_worklet" | "media_recorder" | "track_processor" | "script_processor";
  trackMuted: boolean | null;
  contextState: AudioContextState | null;
  recorderState: RecordingState | null;
  recordedBlobCount: number;
  recordedByteLength: number;
  workletChunkCount: number;
  workletQueueLength: number;
  workletPeakAbsSample: number;
  workletNonZeroSampleCount: number;
};

function publishDiagnostic(update: Partial<CaptureDiagnostic> = {}): void {
  const host = globalThis as typeof globalThis & { __naviaCaptureDiagnostic?: CaptureDiagnostic };
  host.__naviaCaptureDiagnostic = {
    strategy: "none",
    trackMuted: null,
    contextState: null,
    recorderState: null,
    recordedBlobCount: 0,
    recordedByteLength: 0,
    workletChunkCount: 0,
    workletQueueLength: 0,
    workletPeakAbsSample: 0,
    workletNonZeroSampleCount: 0,
    ...host.__naviaCaptureDiagnostic,
    ...update
  };
}

function downsampleToPcm16(
  input: Float32Array,
  inputRate: number,
  outputRate: number = RELAY_AUDIO_CONFIG.sampleRateHz
): ArrayBuffer {
  if (outputRate > inputRate) throw new Error(PRODUCER_INTERNAL_CODES.AUDIO_CONTEXT_SUSPENDED);
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

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function post(message: unknown) {
  try {
    port?.postMessage(message);
  } catch {
    /* Background observes the disconnect and classifies it. */
  }
}

function session(): string {
  return captureSessionId ?? "cap_" + "0".repeat(32);
}

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  port = bootstrapOffscreenProducerPort({
    connect: (info) => chrome.runtime.connect(info),
    onMessage: handleBackgroundMessage,
    onDisconnect: () => {
      port = null;
      void teardown();
    }
  }) as unknown as chrome.runtime.Port;
  return port;
}

/** Report readiness, echoing the captureSessionId bound by `start`. */
function reportReady() {
  post({ type: PORT_MESSAGE.READY, captureSessionId: session() });
}

/** Tear down every audio resource. Never touches the Runtime. */
async function teardown(): Promise<void> {
  const current = active;
  active = null;
  if (!current) return;
  current.quiescing = true;
  current.wakeCredit?.();
  current.wakeCredit = null;
  await current.trackReader?.cancel().catch(() => undefined);
  if (current.recorder) {
    current.recorder.ondataavailable = null;
    current.recorder.onerror = null;
    current.recorder.onstop = null;
    if (current.recorder.state !== "inactive") current.recorder.stop();
  }
  if (current.processor) {
    current.processor.onaudioprocess = null;
    current.processor.disconnect();
  }
  if (current.worklet) {
    current.worklet.port.onmessage = null;
    current.worklet.disconnect();
  }
  current.source.disconnect();
  current.stream.getTracks().forEach((track) => track.stop());
  await current.context.close().catch(() => undefined);
  post({
    type: PORT_MESSAGE.STOPPED,
    captureSessionId: session(),
    queuedChunks: 0,
    creditConsumed: 0,
    tracksStopped: true,
    contextClosed: true
  });
  started = false;
  credit = 0;
}

/**
 * R1-C2-4: every START failure is caught, resources are released, and
 * exactly ONE `capture_error` carrying the bound captureSessionId is
 * emitted. The failure string is a producer-internal code; the Background
 * owner normalizes it into the closed public 20-code set, so no exception
 * text, path or private value can leave the boundary.
 */
async function handleBackgroundMessage(message: BackgroundToOffscreenMessage): Promise<void> {
  if (typeof message.captureSessionId === "string" && SESSION_ID_PATTERN.test(message.captureSessionId)) {
    captureSessionId = message.captureSessionId;
  }
  switch (message.type) {
    case PORT_MESSAGE.START:
      try {
        await startCapture(message.streamId);
      } catch (error) {
        const internal = error instanceof Error ? error.message : "V3_MEDIA_CAPTURE_STREAM_INVALID";
        await teardown();
        started = false;
        credit = 0;
        // Exactly one capture_error, bound to this session.
        post({ type: PORT_MESSAGE.CAPTURE_ERROR, captureSessionId: session(), failureCode: internal });
        closePort();
      }
      return;
    case PORT_MESSAGE.CHUNK_CREDIT:
      // Credit is const 1 in the frozen schema.
      credit = Math.max(credit, message.credit);
      active?.wakeCredit?.();
      if (active) active.wakeCredit = null;
      if (active) void drainWorkletQueue(active);
      return;
    case PORT_MESSAGE.QUIESCE:
      await quiesce(message.reason);
      return;
    case PORT_MESSAGE.ABORT:
      await teardown();
      closePort();
      return;
    default:
      return;
  }
}

async function startCapture(streamId: string): Promise<void> {
  if (started || active) throw new Error("V3_MEDIA_CAPTURE_ALREADY_ACTIVE");
  if (typeof streamId !== "string" || !streamId) throw new Error("V3_MEDIA_CAPTURE_STREAM_INVALID");
  ensurePort();
  reportReady();
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      } as MediaTrackConstraints,
      video: false
    });
  } finally {
    // The one-shot streamId is released as soon as getUserMedia settles.
    void streamId;
  }
  try {
    const audioContext = new AudioContext();
    context = audioContext;
    await audioContext.resume();
    if (audioContext.state !== "running") {
      // Producer-internal diagnostic; Background normalizes it to the public
      // V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID.
      throw new Error(PRODUCER_INTERNAL_CODES.AUDIO_CONTEXT_SUSPENDED);
    }
    const source = audioContext.createMediaStreamSource(stream);
    let worklet: AudioWorkletNode | null = null;
    try {
      await audioContext.audioWorklet.addModule(chrome.runtime.getURL("capture-audio-worklet.js"));
      worklet = new AudioWorkletNode(audioContext, "navia-capture-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
    } catch {
      worklet = null;
    }
    const TrackProcessor = (globalThis as typeof globalThis & {
      MediaStreamTrackProcessor?: AudioTrackProcessorConstructor;
    }).MediaStreamTrackProcessor;
    const track = stream.getAudioTracks()[0];
    const recorderMime = typeof MediaRecorder === "function"
      ? selectCaptureRecorderMime((mimeType) => MediaRecorder.isTypeSupported(mimeType))
      : null;
    const recorder = !worklet && recorderMime ? new MediaRecorder(stream, { mimeType: recorderMime }) : null;
    const recordedBlobs: Blob[] = [];
    if (recorder) recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedBlobs.push(event.data);
      publishDiagnostic({
        recorderState: recorder.state,
        recordedBlobCount: recordedBlobs.length,
        recordedByteLength: recordedBlobs.reduce((total, blob) => total + blob.size, 0)
      });
    };
    const trackReader = !worklet && !recorder && TrackProcessor && track
      ? new TrackProcessor({ track }).readable.getReader()
      : null;
    const processor = worklet || recorder || trackReader ? null : audioContext.createScriptProcessor(4096, 1, 1);
    // Restore the captured tab's playback for normal users. Automated Chrome
    // remains explicitly --mute-audio; that environment is expected to expose
    // an all-zero tabCapture stream and must not be used as a positive-audio
    // acceptance oracle.
    if (worklet) source.connect(worklet).connect(audioContext.destination);
    else if (processor) connectCaptureAudioGraph(source, processor, audioContext.destination);
    else source.connect(audioContext.destination);
    const capture: ActiveCapture = {
      stream, context: audioContext, source, processor, worklet, workletQueue: [],
      trackReader, recorder, recordedBlobs, wakeCredit: null,
      sequence: 0, capturedMs: 0, chunkCount: 0, queuedChunks: 0,
      outstandingRawBytes: 0, quiescing: false
    };
    active = capture;
    started = true;
    if (worklet) {
      worklet.port.onmessage = (event: MessageEvent<{
        samples?: Float32Array;
        sampleRate?: number;
        peakAbsSample?: number;
        nonZeroSampleCount?: number;
      }>) => {
        const samples = event.data?.samples;
        const rate = event.data?.sampleRate;
        if (!(samples instanceof Float32Array) || typeof rate !== "number" || active !== capture || capture.quiescing) return;
        if (capture.workletQueue.length >= RELAY_V10.maxOutstandingChunks) {
          post({ type: PORT_MESSAGE.CAPTURE_ERROR, captureSessionId: session(), failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
          void teardown();
          return;
        }
        capture.workletQueue.push(samples);
        publishDiagnostic({
          workletChunkCount: capture.chunkCount + capture.workletQueue.length,
          workletQueueLength: capture.workletQueue.length,
          workletPeakAbsSample: Math.max(
            Number(event.data?.peakAbsSample) || 0,
            Number((globalThis as typeof globalThis & { __naviaCaptureDiagnostic?: CaptureDiagnostic })
              .__naviaCaptureDiagnostic?.workletPeakAbsSample) || 0
          ),
          workletNonZeroSampleCount:
            (Number((globalThis as typeof globalThis & { __naviaCaptureDiagnostic?: CaptureDiagnostic })
              .__naviaCaptureDiagnostic?.workletNonZeroSampleCount) || 0)
            + (Number(event.data?.nonZeroSampleCount) || 0)
        });
        void drainWorkletQueue(capture, rate);
      };
    }
    publishDiagnostic({
      strategy: worklet ? "audio_worklet" : recorder ? "media_recorder" : trackReader ? "track_processor" : "script_processor",
      trackMuted: track?.muted ?? null,
      contextState: audioContext.state,
      recorderState: recorder?.state ?? null
    });
    if (worklet) return;
    if (recorder) {
      // A bounded timeslice makes encoded data observable before shutdown.
      // Some Windows Chrome audio pipelines otherwise defer the sole
      // dataavailable event long enough to hit the frozen cleanup timeout.
      recorder.start(1_000);
      publishDiagnostic({ recorderState: recorder.state });
      return;
    }
    if (trackReader) {
      void pumpTrackFrames(capture).catch(async () => {
        if (active !== capture || capture.quiescing) return;
        post({
          type: PORT_MESSAGE.CAPTURE_ERROR,
          captureSessionId: session(),
          failureCode: "V3_MEDIA_CAPTURE_STREAM_INVALID"
        });
        await teardown();
        closePort();
      });
      return;
    }
    processor!.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      copyCaptureInputToOutput(input, event.outputBuffer.getChannelData(0));
      const current = active;
      if (!current || current.quiescing) return;
      // A producer without credit MUST NOT send.
      if (credit <= 0) return;
      publishPcm(current, input, audioContext.sampleRate);
    };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (context) await context.close().catch(() => undefined);
    throw error;
  }
}

function publishPcm(current: ActiveCapture, input: Float32Array, inputRate: number): void {
  const pcm = downsampleToPcm16(input, inputRate);
  if (pcm.byteLength <= 0) return;
  publishPcmBytes(current, new Uint8Array(pcm));
}

function publishPcmBytes(current: ActiveCapture, bytes: Uint8Array): void {
  if (bytes.byteLength > RELAY_V10.maxRawChunkBytes) {
    post({
      type: PORT_MESSAGE.CAPTURE_ERROR,
      captureSessionId: session(),
      failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT"
    });
    void teardown();
    return;
  }
  post({
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: session(),
    sequence: current.sequence,
    rawByteLength: bytes.byteLength,
    pcmBase64: encodeBase64(bytes)
  });
  credit -= 1;
  current.sequence += 1;
  current.chunkCount += 1;
  current.capturedMs += Math.round(
    (bytes.byteLength / (RELAY_AUDIO_CONFIG.sampleRateHz * RELAY_AUDIO_CONFIG.channels * RELAY_AUDIO_CONFIG.sampleWidthBytes)) * 1000
  );
}

async function drainWorkletQueue(current: ActiveCapture, inputRate = current.context.sampleRate): Promise<void> {
  while (active === current && credit > 0 && current.workletQueue.length > 0) {
    const samples = current.workletQueue.shift();
    if (!samples) return;
    publishPcm(current, samples, inputRate);
    publishDiagnostic({ workletQueueLength: current.workletQueue.length });
  }
}

async function waitForCredit(current: ActiveCapture, allowDrain = false): Promise<void> {
  while (active === current && (allowDrain || !current.quiescing) && credit <= 0) {
    await new Promise<void>((resolve) => {
      current.wakeCredit = resolve;
      if (credit > 0 || active !== current || (!allowDrain && current.quiescing)) {
        current.wakeCredit = null;
        resolve();
      }
    });
  }
}

async function stopRecorderAndPublish(current: ActiveCapture): Promise<void> {
  const recorder = current.recorder;
  if (!recorder) return;
  if (recorder.state !== "inactive") {
    await new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("V3_MEDIA_CAPTURE_STREAM_INVALID"));
      recorder.requestData();
      recorder.stop();
    });
  }
  if (current.recordedBlobs.length === 0) return;
  const encoded = await new Blob(current.recordedBlobs, { type: recorder.mimeType }).arrayBuffer();
  const decoded = await current.context.decodeAudioData(encoded.slice(0));
  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const input = decoded.getChannelData(channel);
    for (let index = 0; index < input.length; index += 1) mono[index] += input[index] / decoded.numberOfChannels;
  }
  const pcm = new Uint8Array(downsampleToPcm16(mono, decoded.sampleRate));
  for (const chunk of splitPcm16Bytes(pcm, RELAY_V10.maxRawChunkBytes)) {
    await waitForCredit(current, true);
    if (active !== current) return;
    publishPcmBytes(current, chunk);
  }
}

async function pumpTrackFrames(current: ActiveCapture): Promise<void> {
  const reader = current.trackReader;
  if (!reader) return;
  while (active === current && !current.quiescing) {
    await waitForCredit(current);
    if (active !== current || current.quiescing) return;
    const result = await reader.read();
    if (result.done || !result.value) throw new Error("V3_MEDIA_CAPTURE_STREAM_INVALID");
    const frame = result.value;
    try {
      publishPcm(current, copyAudioFrameToMono(frame), frame.sampleRate);
    } finally {
      frame.close();
    }
  }
}

async function quiesce(_reason: string): Promise<void> {
  const current = active;
  if (!current) {
    post({ type: PORT_MESSAGE.QUIESCED, captureSessionId: session(), queuedChunks: 0, outstandingRawBytes: 0, sourceStopped: true });
    return;
  }
  current.quiescing = true;
  // Stop the audio source, then report the boundary.
  current.worklet?.port.postMessage("flush");
  await new Promise((resolve) => setTimeout(resolve, 100));
  current.source.disconnect();
  current.worklet?.disconnect();
  while (current.workletQueue.length > 0 && active === current) {
    await waitForCredit(current, true);
    await drainWorkletQueue(current);
  }
  try {
    await stopRecorderAndPublish(current);
  } catch {
    post({
      type: PORT_MESSAGE.CAPTURE_ERROR,
      captureSessionId: session(),
      failureCode: "V3_MEDIA_CAPTURE_STREAM_INVALID"
    });
    await teardown();
    closePort();
    return;
  }
  post({
    type: PORT_MESSAGE.QUIESCED,
    captureSessionId: session(),
    queuedChunks: 0,
    outstandingRawBytes: 0,
    sourceStopped: true
  });
  // Then finish teardown and report stopped.
  await teardown();
}

function closePort() {
  const current = port;
  port = null;
  try {
    current?.disconnect();
  } catch {
    /* already gone */
  }
}

/**
 * R1-C2-1: connect the frozen Port as soon as the document loads so the
 * Background owner can reach `start` without waiting for a Port that only
 * exists after a start. The `ready` reply is still sent AFTER the
 * Background `start` binds the captureSessionId.
 */
ensurePort();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE) return false;
  if (sender.id !== chrome.runtime.id || sender.tab) {
    sendResponse({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    return false;
  }
  // Stateless ping only: all control flows over the Port, not onMessage.
  if (message.command === "ping") {
    sendResponse({ ok: true, state: "ready" });
    return false;
  }
  sendResponse({ ok: false, failureCode: "V3_MEDIA_CAPTURE_MESSAGE_INVALID" });
  return false;
});

window.addEventListener("unload", () => { void teardown(); });
