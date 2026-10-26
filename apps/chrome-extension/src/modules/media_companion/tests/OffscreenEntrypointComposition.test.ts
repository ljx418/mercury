import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RuntimeCaptureTransport, type RuntimeSocketLike, type TransportStartBinding } from "../capture/RuntimeCaptureTransport";
import { OffscreenAudioPort, type OffscreenPortLike } from "../capture/OffscreenAudioPort";
import { PORT_MESSAGE, RELAY_V10, type BackgroundToOffscreenMessage, type OffscreenToBackgroundMessage } from "../capture/relayContracts";
import { encodeChunkBase64 } from "../capture/audioChunk";
import { bootstrapOffscreenProducerPort, type ProducerPortLike } from "../capture/OffscreenProducerBootstrap";

/**
 * WP0 R1-C2-1 / m-R1-C2-01 — REAL ENTRYPOINT COMPOSITION HARNESS.
 *
 * M-R1-C2-01 was a circular dependency the class-level harness could not
 * see: the Offscreen only called `ensurePort()` INSIDE `startCapture()`,
 * while `startCapture()` only ran after a Port `start` had been received —
 * so the first capture could never begin.
 *
 * This harness drives the REAL entrypoint bootstrap
 * (`bootstrapOffscreenProducerPort`) against the REAL
 * `OffscreenAudioPort.accept` + `RuntimeCaptureTransport.start`, and proves
 * the first connect is reachable with no manual step skipped:
 *
 *   Offscreen document load -> runtime.connect(Port)
 *     -> Background accept (listener already registered, no lost `ready`)
 *     -> Runtime start -> `start` (captureSessionId + one-shot streamId)
 *     -> `ready` -> first `chunk_credit`
 *
 * The `ready` message is produced by the entrypoint bootstrap path, not by
 * the test, so a regression that re-introduces the cycle fails here.
 */

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXT_ID}/media-capture-offscreen.html`;
const SESSION_ID = "cap_" + "a".repeat(32);

class FakeSocket implements RuntimeSocketLike {
  binaryType = "";
  readyState = 1;
  sent: Array<string | ArrayBuffer> = [];
  #listeners = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(type: string, listener: (e: unknown) => void) {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close() { this.readyState = 3; }
  fireOpen() { for (const l of this.#listeners.get("open") ?? []) l({}); }
  fireMessage(v: Record<string, unknown>) {
    for (const l of this.#listeners.get("message") ?? []) l({ data: JSON.stringify(v) });
  }
  get binarySends() { return this.sent.filter((s): s is ArrayBuffer => s instanceof ArrayBuffer); }
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

const BINDING: TransportStartBinding = {
  ticket: "t".repeat(43),
  taskId: "media_task_" + "b".repeat(32),
  adapterId: "bilibili",
  surface: "side_panel",
  pageIdentitySha256: "d".repeat(64),
  tabId: 7,
  tabIdSha256: "e".repeat(64),
  sourceIdentity: "portal:bilibili:BV1TEST:1:1",
  acquisitionRecordId: "mar_" + "f".repeat(32)
};

/** A fake chrome.runtime.connect the real entrypoint bootstrap can use. */
function makeConnectHarness() {
  const toOffscreen: unknown[] = [];
  const toBackground: unknown[] = [];
  const bgListeners: Array<(m: unknown) => void> = [];
  const offListeners: Array<(m: unknown) => void> = [];

  const backgroundSide: OffscreenPortLike = {
    name: "navia.mediaCapture.audio/v11",
    sender: {
      id: EXT_ID, url: OFFSCREEN_URL, documentId: "doc-1", frameId: 0
    } as unknown as chrome.runtime.MessageSender,
    postMessage: (m: unknown) => { toOffscreen.push(m); for (const l of offListeners) l(m); },
    disconnect: () => undefined,
    onMessage: { addListener: (l) => bgListeners.push(l) },
    onDisconnect: { addListener: () => undefined }
  };

  // The real entrypoint bootstrap is handed a `connect` that returns the
  // producer side. The producer side's onMessage listeners receive what
  // Background posts; its postMessage reaches the Background listeners.
  let producerPort: ProducerPortLike | null = null;
  const connect = (info: { name: string }): ProducerPortLike => {
    const side: ProducerPortLike = {
      name: info.name,
      postMessage: (m: unknown) => { toBackground.push(m); for (const l of bgListeners) l(m); },
      disconnect: () => undefined,
      onMessage: { addListener: (l) => offListeners.push(l) },
      onDisconnect: { addListener: () => undefined }
    };
    producerPort = side;
    return side;
  };

  return { backgroundSide, connect, toOffscreen, toBackground, getProducerPort: () => producerPort };
}

describe("offscreen entrypoint composition (R1-C2-1)", () => {
  it("returns from the AudioWorklet branch before ScriptProcessor wiring", () => {
    const source = readFileSync(
      resolve(process.cwd(), "entrypoints/media-capture-offscreen/main.ts"),
      "utf8",
    );
    const workletReturn = source.indexOf("if (worklet) return;");
    const scriptProcessorHandler = source.indexOf("processor!.onaudioprocess");

    expect(workletReturn).toBeGreaterThan(0);
    expect(scriptProcessorHandler).toBeGreaterThan(workletReturn);
  });

  it("uses the dominant input channel instead of cancellation-prone averaging", () => {
    const source = readFileSync(
      resolve(process.cwd(), "public/capture-audio-worklet.js"),
      "utf8",
    );

    expect(source).toContain("dominantEnergy");
    expect(source).toContain("dominantChannel[frame]");
    expect(source).not.toContain("mono += input[channel][frame] / input.length");
  });

  it("connects the Port at document load with no circular dependency", async () => {
    const harness = makeConnectHarness();
    let connectCalls = 0;

    // This is the REAL entrypoint bootstrap invoked as the document would.
    const producer = bootstrapOffscreenProducerPort({
      connect: (info) => {
        connectCalls += 1;
        return harness.connect(info);
      },
      onMessage: () => undefined,
      onDisconnect: () => undefined
    });

    // The document connected the frozen Port BEFORE any start message.
    expect(connectCalls).toBe(1);
    expect(producer.name).toBe("navia.mediaCapture.audio/v11");

    // The listener is registered synchronously by the bootstrap, so a
    // `ready` from the producer can never be lost by the Background owner.
    expect(harness.toBackground.length).toBe(0);
  });

  it("does not report a connected producer before sender validation completes", async () => {
    const socket = new FakeSocket();
    const harness = makeConnectHarness();
    let releaseContexts: ((contexts: chrome.runtime.ExtensionContext[]) => void) | undefined;
    const contexts = new Promise<chrome.runtime.ExtensionContext[]>((resolve) => {
      releaseContexts = resolve;
    });
    const transport = new RuntimeCaptureTransport({
      createSocket: () => socket,
      runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
      onMarker: () => undefined,
      clearMarker: () => undefined,
      reportFailure: () => undefined
    }, () => SESSION_ID);
    const port = new OffscreenAudioPort({
      getContexts: () => contexts,
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false
    }, transport);

    const accepting = port.accept(harness.backgroundSide);
    expect(port.connected).toBe(false);

    releaseContexts?.([{
      contextType: "OFFSCREEN_DOCUMENT",
      documentId: "doc-1",
      documentUrl: OFFSCREEN_URL,
      documentOrigin: `chrome-extension://${EXT_ID}`,
      incognito: false
    } as unknown as chrome.runtime.ExtensionContext]);
    expect(await accepting).toEqual({ ok: true });
    expect(port.connected).toBe(true);
  });

  it("retries a transient empty Chrome context lookup before binding the Port", async () => {
    const socket = new FakeSocket();
    const harness = makeConnectHarness();
    let contextCalls = 0;
    const contextFilters: chrome.runtime.ContextFilter[] = [];
    const transport = new RuntimeCaptureTransport({
      createSocket: () => socket,
      runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
      onMarker: () => undefined,
      clearMarker: () => undefined,
      reportFailure: () => undefined
    }, () => SESSION_ID);
    const port = new OffscreenAudioPort({
      getContexts: async (filter) => {
        contextFilters.push(filter);
        contextCalls += 1;
        if (contextCalls === 1) return [];
        return [{
          contextType: "OFFSCREEN_DOCUMENT",
          documentId: "doc-1",
          documentUrl: OFFSCREEN_URL,
          documentOrigin: `chrome-extension://${EXT_ID}`,
          incognito: false
        } as unknown as chrome.runtime.ExtensionContext];
      },
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      waitForContext: async () => undefined
    }, transport);

    expect(await port.accept(harness.backgroundSide)).toEqual({ ok: true });
    expect(contextCalls).toBe(2);
    expect(contextFilters).toEqual([
      { contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [OFFSCREEN_URL] },
      { contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [OFFSCREEN_URL] }
    ]);
    expect(port.connected).toBe(true);
  });

  it("reaches first capture: accept -> Runtime start -> start -> ready -> first credit", async () => {
    const socket = new FakeSocket();
    const harness = makeConnectHarness();
    const failures: string[] = [];

    const transport = new RuntimeCaptureTransport({
      createSocket: () => socket,
      runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
      onMarker: () => undefined,
      clearMarker: () => undefined,
      reportFailure: (c) => failures.push(c)
    }, () => SESSION_ID);
    const port = new OffscreenAudioPort({
      getContexts: async () => ([{
        contextType: "OFFSCREEN_DOCUMENT",
        documentId: "doc-1",
        documentUrl: OFFSCREEN_URL,
        documentOrigin: `chrome-extension://${EXT_ID}`,
        incognito: false
      } as unknown as chrome.runtime.ExtensionContext]),
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      onFailure: (c) => failures.push(c),
      onDisconnect: () => undefined
    }, transport);
    transport.setAckHook({ onRuntimeAck: (s) => port.noteRuntimeAck(s) });

    // 1. Entry point loads and connects the Port; the Background owner
    //    accepts it immediately (no start needed).
    let sessionBound: string | null = null;
    bootstrapOffscreenProducerPort({
      connect: harness.connect,
      onMessage: (message: BackgroundToOffscreenMessage) => {
        if (message.type === PORT_MESSAGE.START) {
          sessionBound = message.captureSessionId;
          // The producer echoes `ready` with the bound session.
          harness.getProducerPort()?.postMessage({
            type: PORT_MESSAGE.READY,
            captureSessionId: message.captureSessionId
          } satisfies OffscreenToBackgroundMessage);
        }
      },
      onDisconnect: () => undefined
    });
    expect(await port.accept(harness.backgroundSide)).toEqual({ ok: true });

    // 2. Runtime handshake.
    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    expect(await startedPromise).toEqual({ ok: true });

    // 3. Background hands the one-shot streamId over the Port.
    expect(port.sendStart("one-shot-stream")).toEqual({ ok: true });
    expect(sessionBound).toBe(SESSION_ID);

    // 4. The producer `ready` reached the owner and the FIRST credit was
    //    granted, bound to the same captureSessionId.
    expect(port.producerReady).toBe(true);
    const credits = harness.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT
    ) as Array<{ captureSessionId: string; credit: number; acknowledgedSequence: number }>;
    expect(credits).toHaveLength(1);
    expect(credits[0].credit).toBe(1);
    expect(credits[0].acknowledgedSequence).toBe(-1);
    expect(credits[0].captureSessionId).toBe(SESSION_ID);

    // 5. A credited chunk flows producer -> Background -> Runtime.
    const bytes = new Uint8Array(320);
    harness.getProducerPort()?.postMessage({
      type: PORT_MESSAGE.CHUNK,
      captureSessionId: SESSION_ID,
      sequence: 0,
      rawByteLength: 320,
      pcmBase64: encodeChunkBase64(bytes)
    } satisfies OffscreenToBackgroundMessage);
    expect(socket.binarySends).toHaveLength(1);
    expect(failures).toEqual([]);
  });

  it("emits exactly one capture_error when the producer START fails, normalized by Background", async () => {
    const socket = new FakeSocket();
    const harness = makeConnectHarness();
    const failures: string[] = [];

    const transport = new RuntimeCaptureTransport({
      createSocket: () => socket,
      runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
      onMarker: () => undefined,
      clearMarker: () => undefined,
      reportFailure: (c) => failures.push(c)
    }, () => SESSION_ID);
    const port = new OffscreenAudioPort({
      getContexts: async () => ([{
        contextType: "OFFSCREEN_DOCUMENT",
        documentId: "doc-1",
        documentUrl: OFFSCREEN_URL,
        documentOrigin: `chrome-extension://${EXT_ID}`,
        incognito: false
      } as unknown as chrome.runtime.ExtensionContext]),
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      onFailure: (c) => failures.push(c),
      onDisconnect: () => undefined
    }, transport);
    transport.setAckHook({ onRuntimeAck: (s) => port.noteRuntimeAck(s) });

    bootstrapOffscreenProducerPort({
      connect: harness.connect,
      onMessage: (message: BackgroundToOffscreenMessage) => {
        if (message.type === PORT_MESSAGE.START) {
          // Simulate a real START failure (user denied capture / AudioContext
          // suspended). The entrypoint contract is: clean up, then emit
          // exactly one capture_error carrying the bound session.
          void (async () => {
            await Promise.resolve();
            harness.getProducerPort()?.postMessage({
              type: PORT_MESSAGE.CAPTURE_ERROR,
              captureSessionId: message.captureSessionId,
              failureCode: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
            } satisfies OffscreenToBackgroundMessage);
          })();
        }
      },
      onDisconnect: () => undefined
    });
    await port.accept(harness.backgroundSide);

    const startedPromise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await startedPromise;
    port.sendStart("one-shot-stream");
    // The producer's capture_error is posted on a microtask.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const errors = harness.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ) as Array<{ failureCode: string; captureSessionId: string }>;
    // Exactly ONE abort reaches the producer with the NORMALIZED public code.
    expect(errors).toHaveLength(1);
    expect(errors[0].failureCode).toBe("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
    // The producer-internal code never crosses the boundary.
    expect(failures).not.toContain("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED");
    expect(failures).toContain("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
    expect(failures.every((c) => c.startsWith("V3_MEDIA_CAPTURE_"))).toBe(true);
  });
});
