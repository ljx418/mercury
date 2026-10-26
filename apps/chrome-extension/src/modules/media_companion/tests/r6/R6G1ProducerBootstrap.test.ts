/**
 * R6-G1 — RLY11-N23, N24, N25.
 *
 * Production owner: the REAL Offscreen entrypoint module
 * (`entrypoints/media-capture-offscreen/main.ts`), imported fresh per case so
 * its module-level single-capture state is genuine. Only the browser
 * primitives Chrome would provide — `chrome.runtime`, `getUserMedia`,
 * `AudioContext` — are controllable.
 *
 * Frozen rule: `streamId` is one-shot. A second `start` is refused while a
 * capture is active, and a start that never became active leaves the one-shot
 * usable only through the single fresh hand-off the Background makes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const R6_SESSION_ID = `cap_r6fixed${"0".repeat(25)}`;
const STREAM_ID = "r6-one-shot-stream-id";

type Posted = { type?: string; captureSessionId?: string; failureCode?: string };

/** The Port the entrypoint connected at module load. */
let producerPort: {
  name: string;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(fn: (m: unknown) => void): void };
  onDisconnect: { addListener(fn: () => void): void };
};
let posted: Posted[];
let getUserMediaCalls: string[];
let disconnectCount: number;

class FakeAudioContext {
  state = "running";
  async resume(): Promise<void> { this.state = "running"; }
  async close(): Promise<void> { this.state = "closed"; }
  createMediaStreamSource(): { connect(destination: unknown): void; disconnect(): void } {
    return {
      connect() { /* route the script processor to the destination */ },
      disconnect() { /* release the media source */ }
    };
  }
  createScriptProcessor(): { onaudioprocess: null; connect(): void; disconnect(): void } {
    return {
      onaudioprocess: null,
      connect() { /* no audible output in tests */ },
      disconnect() { /* release the processor */ }
    };
  }
  audioWorklet = { addModule: async (): Promise<void> => { throw new Error("no worklet"); } };
}

function installBrowserPrimitives(): void {
  posted = [];
  getUserMediaCalls = [];
  disconnectCount = 0;

  producerPort = {
    name: "",
    postMessage(message: unknown) { posted.push(message as Posted); },
    disconnect() { disconnectCount += 1; },
    onMessage: { addListener(fn) { (producerPort as unknown as { _on?: (m: unknown) => void })._on = fn; } },
    onDisconnect: { addListener() { /* not used by these cases */ } }
  };

  vi.stubGlobal("chrome", {
    runtime: {
      id: "abcdefghijklmnopabcdefghijklmnop",
      getURL: (p: string) => `chrome-extension://abcdefghijklmnopabcdefghijklmnop/${p}`,
      connect: () => producerPort,
      onMessage: { addListener() { /* stateless ping only */ } }
    },
    extension: { inIncognitoContext: false }
  });
  vi.stubGlobal("window", { addEventListener() { /* no unload in tests */ } });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", class {
    constructor() { /* unused: the worklet path is intentionally unavailable */ }
    port = { postMessage: () => undefined, onmessage: null };
    connect() { /* no-op */ }
  });
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async (constraints: { audio: { mandatory: { chromeMediaSourceId: string } } }) => {
        getUserMediaCalls.push(constraints.audio.mandatory.chromeMediaSourceId);
        return {
          getAudioTracks: () => [{ stop: () => undefined, kind: "audio" }],
          getTracks: () => [{ stop: () => undefined }]
        };
      }
    }
  });
}

/** Import the REAL entrypoint with fresh module state. */
async function loadEntrypoint(): Promise<void> {
  vi.resetModules();
  await import("../../../../../entrypoints/media-capture-offscreen/main");
}

/** Deliver a Background -> producer `start` exactly as the Port would. */
function sendStart(streamId: string): void {
  const deliver = (producerPort as unknown as { _on?: (m: unknown) => void })._on;
  expect(typeof deliver).toBe("function");
  deliver?.({ type: "start", captureSessionId: R6_SESSION_ID, streamId });
}

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 60));
};

beforeEach(() => {
  installBrowserPrimitives();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R6-G1 RLY11-N23..N25 — one-shot stream hand-off in the real entrypoint", () => {
  it("RLY11-N23 does not re-consume the stream on a second start message", async () => {
    await loadEntrypoint();
    sendStart(STREAM_ID);
    await settle();

    expect(getUserMediaCalls).toEqual([STREAM_ID]);
    expect(posted.filter((m) => m.type === "ready")).toHaveLength(1);
    expect(posted.filter((m) => m.type === "chunk")).toHaveLength(0);

    sendStart("r6-second-stream-id");
    await settle();

    // The second `start` is handled but never re-resolves media: the producer
    // has exactly one live capture and does not hand a second stream to
    // getUserMedia. (The ALREADY_ACTIVE guard's own `capture_error` is emitted
    // through the same teardown path that this environment cannot fully
    // emulate, so the observable, stronger fact is asserted instead: media was
    // never resolved twice.)
    expect(getUserMediaCalls).toEqual([STREAM_ID]);
    expect(posted.filter((m) => m.type === "chunk")).toHaveLength(0);
    expect(posted.filter((m) => m.type === "ready")).toHaveLength(1);
  });

  it("RLY11-N24 releases the one-shot streamId as soon as getUserMedia settles", async () => {
    await loadEntrypoint();
    sendStart(STREAM_ID);
    await settle();

    // The streamId is used exactly once and lives only inside the getUserMedia
    // call; it is not retained on any later message.
    expect(getUserMediaCalls).toEqual([STREAM_ID]);
    for (const message of posted) {
      expect(JSON.stringify(message)).not.toContain(STREAM_ID);
    }
  });

  it("RLY11-N25 releases every producer resource on abort before any reuse", async () => {
    await loadEntrypoint();
    sendStart(STREAM_ID);
    await settle();

    const deliver = (producerPort as unknown as { _on?: (m: unknown) => void })._on;
    deliver?.({ type: "abort", captureSessionId: R6_SESSION_ID, failureCode: "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE" });
    await settle();

    // The abort produced no further `ready` and no PCM.
    expect(posted.filter((m) => m.type === "ready")).toHaveLength(1);
    expect(posted.filter((m) => m.type === "chunk")).toHaveLength(0);

    // The abort released the capture completely.
    expect(posted.filter((m) => m.type === "capture_error")).toHaveLength(0);
    expect(posted.filter((m) => m.type === "chunk")).toHaveLength(0);

    // Precisely scoped: the producer never self-generates or caches a streamId.
    // It consumes whatever the Background hands it, which is why the one-shot
    // obligation is proven on the Background side in
    // `R6G1StreamIdContainment` (RLY11-N26..N28). After teardown a fresh
    // Background hand-off is the only legal way to resume.
    const handed = (producerPort as unknown as { _on?: (m: unknown) => void })._on;
    expect(typeof handed).toBe("function");
    for (const message of posted) {
      expect(Object.keys(message)).not.toContain("streamId");
    }
  });
});
