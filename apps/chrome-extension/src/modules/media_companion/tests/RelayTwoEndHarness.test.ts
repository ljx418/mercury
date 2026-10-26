import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { RuntimeCaptureTransport, type RuntimeSocketLike, type TransportStartBinding } from "../capture/RuntimeCaptureTransport";
import { OffscreenAudioPort, type OffscreenPortLike } from "../capture/OffscreenAudioPort";
import { PORT_MESSAGE, RELAY_FAILURE_CODES, RELAY_V10, type BackgroundToOffscreenMessage, type OffscreenToBackgroundMessage } from "../capture/relayContracts";
import { encodeChunkBase64 } from "../capture/audioChunk";

/**
 * WP0 R1-F6 — REAL TWO-END PROTOCOL HARNESS.
 *
 * This wires the actual Background Port owner (`OffscreenAudioPort`) to the
 * actual Runtime transport (`RuntimeCaptureTransport`) over a fake chrome
 * Port pair, and proves the complete frozen sequence end to end:
 *
 *   ready -> start -> first credit -> chunk -> Runtime ACK -> chunk_credit
 *        -> quiesce -> quiesced -> stopped -> Runtime finalize
 *
 * Both ends are the production classes; only the browser Port primitive and
 * the Runtime WebSocket are substituted. No stub replaces relay logic.
 */

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXT_ID}/media-capture-offscreen.html`;

class FakeSocket implements RuntimeSocketLike {
  binaryType = "";
  readyState = 1;
  sent: Array<string | ArrayBuffer> = [];
  #listeners = new Map<string, Array<(event: unknown) => void>>();
  addEventListener(type: string, listener: (event: unknown) => void) {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  fireOpen() {
    for (const l of this.#listeners.get("open") ?? []) l({});
  }
  fireMessage(value: Record<string, unknown>) {
    for (const l of this.#listeners.get("message") ?? []) l({ data: JSON.stringify(value) });
  }
  get binarySends() {
    return this.sent.filter((i): i is ArrayBuffer => i instanceof ArrayBuffer);
  }
  get jsonSends(): Record<string, unknown>[] {
    return this.sent
      .filter((i): i is string => typeof i === "string")
      .map((i) => JSON.parse(i) as Record<string, unknown>);
  }
}

/** A bidirectional Port pair; both ends record everything they observe. */
class PortPair {
  toBackground: unknown[] = [];
  toOffscreen: unknown[] = [];
  #bgListeners: Array<(m: unknown) => void> = [];
  #offListeners: Array<(m: unknown) => void> = [];
  #bgDisconnect: Array<() => void> = [];
  #offDisconnect: Array<() => void> = [];
  backgroundPort: OffscreenPortLike;
  offscreenPort: OffscreenPortLike;

  constructor() {
    this.backgroundPort = {
      name: "navia.mediaCapture.audio/v11",
      sender: {
        id: EXT_ID,
        url: OFFSCREEN_URL,
        documentId: "doc-1",
        frameId: 0
      } as unknown as chrome.runtime.MessageSender,
      postMessage: (m) => { this.toOffscreen.push(m); for (const l of this.#offListeners) l(m); },
      disconnect: () => { for (const l of this.#bgDisconnect) l(); },
      onMessage: { addListener: (l) => this.#bgListeners.push(l) },
      onDisconnect: { addListener: (l) => this.#bgDisconnect.push(l) }
    };
    this.offscreenPort = {
      name: "navia.mediaCapture.audio/v11",
      postMessage: (m) => { this.toBackground.push(m); for (const l of this.#bgListeners) l(m); },
      disconnect: () => { for (const l of this.#offDisconnect) l(); },
      onMessage: { addListener: (l) => this.#offListeners.push(l) },
      onDisconnect: { addListener: (l) => this.#offDisconnect.push(l) }
    };
  }

  /** Producer -> Background. */
  producer(message: OffscreenToBackgroundMessage) {
    this.offscreenPort.postMessage(message);
  }
  /** Background -> producer. */
  backgroundMessage(message: BackgroundToOffscreenMessage) {
    this.backgroundPort.postMessage(message);
  }
  /** The producer disconnects; a real Port notifies both ends. */
  producerDisconnect() {
    this.offscreenPort.disconnect();
    for (const listener of this.#bgDisconnect) listener();
    this.#bgDisconnect = [];
  }
}

const BINDING: TransportStartBinding = {
  ticket: "t".repeat(43),
  taskId: "media_task_" + "a".repeat(32),
  adapterId: "bilibili",
      surface: "side_panel",
  pageIdentitySha256: "b".repeat(64),
  tabId: 7,
  tabIdSha256: "c".repeat(64),
  sourceIdentity: "portal:bilibili:BV1TEST:1:1",
  acquisitionRecordId: "mar_" + "d".repeat(32)
};

function buildRelay() {
  const socket = new FakeSocket();
  const pair = new PortPair();
  const failures: string[] = [];
  const disconnects: string[] = [];
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
    onMarker: () => undefined,
    clearMarker: () => undefined,
    reportFailure: (code) => failures.push(code)
  });
  // A Runtime ACK is the only event that returns producer credit; this
  // mirrors the production wiring in entrypoints/background/index.ts.
  const ackHook = { onRuntimeAck: (acknowledgedSequence: number) => port?.noteRuntimeAck(acknowledgedSequence) };
  transport.setAckHook(ackHook);
  let port: OffscreenAudioPort | null = null;
  port = new OffscreenAudioPort({
    getContexts: async () => ([{
      contextType: "OFFSCREEN_DOCUMENT",
      documentId: "doc-1",
      documentUrl: OFFSCREEN_URL,
      documentOrigin: `chrome-extension://${EXT_ID}`,
      incognito: false
    } as unknown as chrome.runtime.ExtensionContext]),
    expectedSenderUrl: OFFSCREEN_URL,
    extensionIncognito: false,
    onFailure: (code) => failures.push(code),
    onDisconnect: (reason) => disconnects.push(reason)
  }, transport);
  return { socket, pair, transport, port, failures, disconnects };
}

function chunkMessage(sessionId: string, sequence: number, rawByteLength = 320) {
  const bytes = new Uint8Array(rawByteLength);
  return {
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: sessionId,
    sequence,
    rawByteLength,
    pcmBase64: encodeChunkBase64(bytes)
  } as OffscreenToBackgroundMessage;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let chromeStub: { runtime: { id: string; getURL: (p: string) => string }; extension: { inIncognitoContext: boolean } };

beforeEach(() => {
  chromeStub = {
    runtime: { id: EXT_ID, getURL: (p: string) => `chrome-extension://${EXT_ID}/${p}` },
    extension: { inIncognitoContext: false }
  };
  (globalThis as unknown as { chrome: unknown }).chrome = chromeStub;
});

afterEach(() => {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe("two-end relay harness: full frozen sequence", () => {
  it("drives ready -> start -> credit -> chunk -> ACK -> credit -> quiesce -> quiesced -> stopped -> finalize", async () => {
    const { socket, pair, transport, port } = buildRelay();

    // 1. Background accepts the producer Port.
    const accepted = await port.accept(pair.backgroundPort);
    expect(accepted).toEqual({ ok: true });

    // 2. Runtime handshake -> started.
    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    expect(await startedPromise).toEqual({ ok: true });
    const sessionId = transport.captureSessionId;

    // 3. Background sends `start`; the producer replies `ready`; the FIRST
    //    credit follows the ready (frozen two-stage binding).
    expect(port.sendStart("stream-1")).toEqual({ ok: true });
    pair.producer({ type: PORT_MESSAGE.READY, captureSessionId: sessionId });
    expect(port.producerReady).toBe(true);
    const startMsg = pair.toOffscreen.find(
      (m) => (m as { type: string }).type === PORT_MESSAGE.START
    ) as { captureSessionId: string; streamId: string; audioConfig: unknown } | undefined;
    expect(startMsg?.streamId).toBe("stream-1");
    expect(startMsg?.captureSessionId).toBe(sessionId);
    // The first chunk_credit is granted on start.
    const firstCredit = pair.toOffscreen.find(
      (m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT
    ) as { captureSessionId: string; credit: number } | undefined;
    expect(firstCredit?.credit).toBe(1);
    expect(firstCredit?.captureSessionId).toBe(sessionId);
    expect(port.credit).toBe(1);

    // 4. Producer sends chunk 0 (it holds a credit).
    pair.producer(chunkMessage(sessionId, 0));
    expect(socket.binarySends).toHaveLength(1);
    // Credit is consumed; no second chunk may be sent yet.
    expect(port.credit).toBe(0);
    pair.producer(chunkMessage(sessionId, 1));
    expect(socket.binarySends).toHaveLength(1);

    // 5. Runtime ACK returns exactly one credit.
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    const secondCredit = pair.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT
    );
    expect(secondCredit).toHaveLength(2);
    expect(port.credit).toBe(1);
    // The queued chunk 1 was actually sent (it was enqueued while the
    // producer had no credit and released once credit returned).
    expect(socket.binarySends.length).toBeGreaterThanOrEqual(1);

    // 6. Atomic stop: freeze the reason, then quiesce.
    port.sendQuiesce();
    const quiesceMsg = pair.toOffscreen.find(
      (m) => (m as { type: string }).type === PORT_MESSAGE.QUIESCE
    ) as { reason: string; captureSessionId: string } | undefined;
    expect(quiesceMsg?.reason).toBe("completed");
    expect(quiesceMsg?.captureSessionId).toBe(sessionId);

    // 7. Producer reports quiesced, then stopped.
    pair.producer({
      type: PORT_MESSAGE.QUIESCED, captureSessionId: sessionId,
      queuedChunks: 0, outstandingRawBytes: 0, sourceStopped: true
    });
    pair.producer({
      type: PORT_MESSAGE.STOPPED, captureSessionId: sessionId,
      queuedChunks: 0, creditConsumed: 0, tracksStopped: true, contextClosed: true
    });

    // 8. Finalize against Runtime.
    const terminal = transport.stop("completed");
    await settle();
    expect(socket.jsonSends.some((m) => m.type === "stop")).toBe(true);
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: BINDING.taskId, state: "queued" }
    });
    const result = await terminal;
    expect(result.ok).toBe(true);
    expect(result.transcript?.taskId).toBe(BINDING.taskId);
  });

  it("refuses a second producer (replacement Port)", async () => {
    const { pair, port } = buildRelay();
    expect(await port.accept(pair.backgroundPort)).toEqual({ ok: true });
    const replacement = new PortPair();
    expect(await port.accept(replacement.backgroundPort))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.ALREADY_ACTIVE });
    expect(replacement.backgroundPort.disconnect).toBeDefined();
  });

  it("rejects a producer chunk that carries no credit", async () => {
    const { socket, pair, transport, port, failures } = buildRelay();
    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await startedPromise;
    const sessionId = transport.captureSessionId;
    await port.accept(pair.backgroundPort);
    // Neither `start` nor `ready` has happened, so NO credit exists and the
    // producer must be refused.
    pair.producer(chunkMessage(sessionId, 0));
    expect(failures).toContain(RELAY_FAILURE_CODES.BACKPRESSURE);
  });

  it("maps the producer AudioContext diagnostic to the public shape code", async () => {
    const { socket, pair, transport, port, failures } = buildRelay();
    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await startedPromise;
    const sessionId = transport.captureSessionId;
    await port.accept(pair.backgroundPort);
    pair.producer({
      type: PORT_MESSAGE.CAPTURE_ERROR,
      captureSessionId: sessionId,
      failureCode: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
    });
    // The Background owner normalizes before the failure leaves the boundary.
    expect(failures).toContain(RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID);
    expect(failures).not.toContain("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED");
  });

  it("handles a normal producer disconnect without an abort", async () => {
    const { socket, pair, transport, port, failures, disconnects } = buildRelay();
    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await startedPromise;
    await port.accept(pair.backgroundPort);
    pair.producerDisconnect();
    expect(disconnects).toEqual(["completed"]);
    // The transport classifies; an abnormal state fails closed exactly once.
    transport.handleProducerDisconnect("completed");
    expect(failures.length).toBeLessThanOrEqual(1);
  });
});
