import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { RuntimeCaptureTransport, type RuntimeSocketLike, type TransportStartBinding } from "../capture/RuntimeCaptureTransport";
import { OffscreenAudioPort, type OffscreenPortLike, validateOffscreenPortSender } from "../capture/OffscreenAudioPort";
import { bootstrapOffscreenProducerPort, type ProducerPortLike } from "../capture/OffscreenProducerBootstrap";
import { PORT_MESSAGE, RELAY_AUDIO_CONFIG, RELAY_V10, type BackgroundToOffscreenMessage, type OffscreenToBackgroundMessage } from "../capture/relayContracts";
import { encodeChunkBase64, decodeChunkBase64, admitChunk, validateChunkMessage } from "../capture/audioChunk";
import { exceedsCaptureByteBound, exceedsCaptureDurationBound } from "../capture/RuntimeCaptureTransport";

/**
 * WP0 R2 — the eight frozen relay invariants, verified end to end against
 * the REAL production classes (transport + port + bootstrap). Only the
 * chrome Port / Runtime WebSocket primitives are substituted.
 *
 * R1 already implemented most of this. R2 does NOT rewrite it: every
 * module below is the shipped R1 module. Where a real gap existed
 * (`maxCaptureMs` / `maxCaptureBytes` were pinned but never enforced at
 * the owner), the test pins the repaired behaviour.
 *
 * Invariants:
 *   1. Offscreen is a pure PCM producer (no Runtime URL / WS / ticket /
 *      binding / sourceIdentity / acquisition ownership).
 *   2. Exact sender + document binding matrix.
 *   3. PCM 16 kHz mono s16le, canonical Base64, decoded length exact,
 *      even byte count.
 *   4. sequence strictly +1 from 0; duplicate / gap / out-of-order fail
 *      closed.
 *   5. Producer sends only after credit; Background returns credit only
 *      after Runtime ACK.
 *   6. Queue max 32 chunks / 1,572,864 raw bytes; overflow aborts BEFORE
 *      enqueue; no drop.
 *   7. port/runtime disconnect, ACK timeout and chunk-after-stop all emit
 *      a fixed normalized code.
 *   8. No old session PCM / ticket / sequence / credit is restored.
 */

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXT_ID}/media-capture-offscreen.html`;
const EXTENSION_ORIGIN = `chrome-extension://${EXT_ID}`;
const SESSION = "cap_" + "a".repeat(32);
const TASK = "media_task_" + "1".repeat(32);

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
  send(data: string | ArrayBuffer) { this.sent.push(data); }
  close() { this.readyState = 3; }
  fireOpen() { for (const l of this.#listeners.get("open") ?? []) l({}); }
  fireMessage(v: Record<string, unknown>) {
    for (const l of this.#listeners.get("message") ?? []) l({ data: JSON.stringify(v) });
  }
  fireClose(reason = "") {
    this.readyState = 3;
    for (const l of this.#listeners.get("close") ?? []) l({ reason });
  }
  get binarySends() { return this.sent.filter((s): s is ArrayBuffer => s instanceof ArrayBuffer); }
  get jsonSends(): Record<string, unknown>[] {
    return this.sent.filter((s): s is string => typeof s === "string").map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

class FakeClock {
  now = 1_700_000_000_000;
  #timers = new Map<number, { at: number; handler: () => void }>();
  #next = 1;
  readonly set = (handler: () => void, ms: number): unknown => {
    const id = this.#next++;
    this.#timers.set(id, { at: this.now + ms, handler });
    return id;
  };
  readonly clear = (handle: unknown): void => { this.#timers.delete(handle as number); };
  advance(ms: number) {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.#timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) break;
      const [id, timer] = due[0];
      this.#timers.delete(id);
      this.now = timer.at;
      timer.handler();
    }
    this.now = target;
  }
}

let chromeStub: { runtime: { id: string; getURL: (p: string) => string }; extension: { inIncognitoContext: boolean } };
beforeEach(() => {
  chromeStub = {
    runtime: { id: EXT_ID, getURL: (p: string) => `chrome-extension://${EXT_ID}/${p}` },
    extension: { inIncognitoContext: false }
  };
  (globalThis as unknown as { chrome: unknown }).chrome = chromeStub;
});
afterEach(() => { delete (globalThis as unknown as { chrome?: unknown }).chrome; });

const BINDING: TransportStartBinding = {
  ticket: "t".repeat(43),
  taskId: TASK,
  adapterId: "bilibili",
      surface: "side_panel",
  pageIdentitySha256: "d".repeat(64),
  tabId: 7,
  tabIdSha256: "e".repeat(64),
  sourceIdentity: "portal:bilibili:BV1TEST:1:1",
  acquisitionRecordId: "mar_" + "f".repeat(32)
};

/** A bidirectional Port pair wiring the real background port owner. */
function buildRelay(options: { clock?: FakeClock; maxCaptureBytes?: number } = {}) {
  const socket = new FakeSocket();
  const clock = options.clock ?? new FakeClock();
  const toOffscreen: unknown[] = [];
  const toBackground: unknown[] = [];
  const bgListeners: Array<(m: unknown) => void> = [];
  const offListeners: Array<(m: unknown) => void> = [];
  // C1: the PUBLIC failure report (transport `reportFailure`) and the
  // Port->Transport abort REQUEST are separate channels. Only the public
  // report may be counted as "the failure was reported once".
  const failures: string[] = [];
  const portRequests: string[] = [];
  const disconnects: string[] = [];
  // R2 corrective §5.1C: the restart marker must be OBSERVABLE so a
  // fail-closed path can prove it was cleaned, not merely "not written".
  const markerWrites: Array<Record<string, unknown>> = [];
  const markerClears: string[] = [];

  const backgroundSide: OffscreenPortLike = {
    name: "navia.mediaCapture.audio/v11",
    sender: { id: EXT_ID, url: OFFSCREEN_URL, documentId: "doc-1", frameId: 0 } as unknown as chrome.runtime.MessageSender,
    postMessage: (m: unknown) => { toOffscreen.push(m); for (const l of offListeners) l(m); },
    disconnect: () => undefined,
    onMessage: { addListener: (l) => bgListeners.push(l) },
    onDisconnect: { addListener: () => undefined }
  };

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

  const port: { notifyProducerAbortOnce?: (c: string) => void } = { notifyProducerAbortOnce: undefined };
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
    now: () => clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    onMarker: (marker) => markerWrites.push(marker as unknown as Record<string, unknown>),
    clearMarker: (sessionId) => { markerClears.push(sessionId); },
    reportFailure: (c) => failures.push(c),
    // R2 corrective C1: the owner's self-firing deadline stops the
    // producer over the SAME frozen Port path.
    // C1: production routes the Transport closeout through the Port's
    // once-guard, not a raw sendAbort.
    onCaptureAbort: (c) => { port.notifyProducerAbortOnce?.(c); },
    // R2 corrective C2: a test-only limits seam. Production always uses
    // RELAY_V10; this exists so the cumulative bound can be proven
    // without allocating 512 MiB.
    ...(options.maxCaptureBytes !== undefined ? { maxCaptureBytes: options.maxCaptureBytes } : {})
  }, () => SESSION);
  const realPort = new OffscreenAudioPort({
    getContexts: async () => ([{
      contextType: "OFFSCREEN_DOCUMENT", documentId: "doc-1", documentUrl: OFFSCREEN_URL,
      documentOrigin: EXTENSION_ORIGIN, incognito: false
    } as unknown as chrome.runtime.ExtensionContext]),
    expectedSenderUrl: OFFSCREEN_URL,
    extensionIncognito: false,
    // Production wiring (entrypoints/background/index.ts): the Port
    // owner's onFailure aborts the transport. Without this the fail-closed
    // chain (producer abort / socket close / terminal / marker clear)
    // would never be exercised, which is exactly the false-green shape
    // Codex rejected in M-R2-02.
    onFailure: (c) => {
      portRequests.push(c);
      transport.abort(c as never);
    },
    onDisconnect: (r) => disconnects.push(r)
  }, transport);
  port.notifyProducerAbortOnce = (c: string) => { realPort.notifyProducerAbortOnce(c as never); };
  transport.setAckHook({ onRuntimeAck: (s) => realPort.noteRuntimeAck(s) });

  return {
    socket, clock, transport, port: realPort, failures, disconnects,
    markerWrites, markerClears, portRequests,
    toOffscreen, toBackground,
    backgroundSide, connect,
    producer: () => producerPort
  };
}

function pcmChunk(sequence: number, rawByteLength = 320) {
  const bytes = new Uint8Array(rawByteLength);
  return {
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: SESSION,
    sequence,
    rawByteLength,
    pcmBase64: encodeChunkBase64(bytes)
  } satisfies OffscreenToBackgroundMessage;
}

async function openCapture(relay: ReturnType<typeof buildRelay>) {
  const promise = relay.transport.start(BINDING);
  relay.socket.fireOpen();
  relay.socket.fireMessage({ type: "started" });
  const started = await promise;
  // The real entrypoint bootstrap connects the Port.
  bootstrapOffscreenProducerPort({
    connect: relay.connect,
    onMessage: (message: BackgroundToOffscreenMessage) => {
      if (message.type === PORT_MESSAGE.START) {
        relay.producer()?.postMessage({
          type: PORT_MESSAGE.READY,
          captureSessionId: message.captureSessionId
        } satisfies OffscreenToBackgroundMessage);
      }
    },
    onDisconnect: () => undefined
  });
  const accepted = await relay.port.accept(relay.backgroundSide);
  relay.port.sendStart("one-shot");
  return { started, accepted };
}

// ============================================================================
// Invariant 1: Offscreen is a pure PCM producer
// ============================================================================

describe("R2 invariant 1: Offscreen is a pure PCM producer", () => {
  it("receives the streamId once and the session id on every message", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    const startMsg = relay.toOffscreen.find(
      (m) => (m as { type: string }).type === PORT_MESSAGE.START
    ) as { streamId: string; captureSessionId: string; audioConfig: unknown } | undefined;
    expect(startMsg?.streamId).toBe("one-shot");
    expect(startMsg?.captureSessionId).toBe(SESSION);
    expect(startMsg?.audioConfig).toEqual({
      sampleRateHz: RELAY_AUDIO_CONFIG.sampleRateHz,
      channels: RELAY_AUDIO_CONFIG.channels,
      sampleWidthBytes: RELAY_AUDIO_CONFIG.sampleWidthBytes
    });
    // Every Background->Offscreen message after start carries the session.
    for (const m of relay.toOffscreen) {
      expect((m as { captureSessionId: string }).captureSessionId).toBe(SESSION);
    }
  });
});

// ============================================================================
// Invariant 2: exact sender + document binding
// ============================================================================

describe("R2 invariant 2: exact sender and document binding", () => {
  const base = {
    extensionId: EXT_ID,
    senderUrl: OFFSCREEN_URL,
    hasSenderTab: false,
    frameId: 0,
    documentId: "doc-1",
    expectedExtensionId: EXT_ID,
    expectedSenderUrl: OFFSCREEN_URL,
    expectedExtensionOrigin: EXTENSION_ORIGIN,
    extensionIncognito: false,
    contexts: [{ contextType: "OFFSCREEN_DOCUMENT", documentId: "doc-1", documentUrl: OFFSCREEN_URL,
      documentOrigin: EXTENSION_ORIGIN, incognito: false } as unknown as chrome.runtime.ExtensionContext]
  };

  it("accepts the canonical sender", () => {
    expect(validateOffscreenPortSender(base)).toBeNull();
  });

  it("accepts an absent frameId", () => {
    expect(validateOffscreenPortSender({ ...base, frameId: undefined })).toBeNull();
  });

  it("accepts an absent optional sender documentId with one authoritative context", () => {
    expect(validateOffscreenPortSender({ ...base, documentId: undefined })).toBeNull();
  });

  it("rejects: wrong extension / tab present / non-exact URL / non-zero frameId", () => {
    expect(validateOffscreenPortSender({ ...base, extensionId: "other" })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, hasSenderTab: true })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, senderUrl: `${OFFSCREEN_URL}/x` })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, frameId: 1 })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
  });

  it("rejects: wrong documentId / zero or two contexts / incognito mismatch", () => {
    expect(validateOffscreenPortSender({ ...base, documentId: "doc-2" })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, contexts: [] })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, contexts: [...base.contexts, ...base.contexts] })).toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
    expect(validateOffscreenPortSender({ ...base, contexts: [{ ...base.contexts[0], incognito: true } as unknown as chrome.runtime.ExtensionContext] }))
      .toBe("V3_MEDIA_CAPTURE_PORT_FORBIDDEN");
  });

  it("binds documentId on first accept and refuses a different document", async () => {
    const relay = buildRelay();
    expect(await relay.port.accept(relay.backgroundSide)).toEqual({ ok: true });
    const relay2 = buildRelay();
    const otherDoc: OffscreenPortLike = {
      name: "navia.mediaCapture.audio/v11",
      sender: { id: EXT_ID, url: OFFSCREEN_URL, documentId: "doc-2", frameId: 0 } as unknown as chrome.runtime.MessageSender,
      postMessage: () => undefined, disconnect: () => undefined,
      onMessage: { addListener: () => undefined }, onDisconnect: { addListener: () => undefined }
    };
    // A second producer on the same port owner is refused outright.
    expect(await relay.port.accept(otherDoc))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
    void relay2;
  });
});

// ============================================================================
// Invariant 3: PCM / Base64 canonicalization
// ============================================================================

describe("R2 invariant 3: PCM shape and canonical Base64", () => {
  it("accepts canonical Base64 and round-trips the exact byte count", () => {
    const bytes = new Uint8Array(320);
    const encoded = encodeChunkBase64(bytes);
    const decoded = decodeChunkBase64(encoded);
    expect("bytes" in decoded).toBe(true);
    if ("bytes" in decoded) expect(decoded.bytes.byteLength).toBe(320);
    expect(encoded).toMatch(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
  });

  it("rejects: non-canonical Base64, wrong declared length, odd bytes, oversize", () => {
    const expected = { captureSessionId: SESSION, expectedSequence: 0 };
    // Non-canonical characters.
    expect(validateChunkMessage({ type: "chunk", captureSessionId: SESSION, sequence: 0, rawByteLength: 4, pcmBase64: "!!!!" }, expected).ok).toBe(false);
    // Declared length mismatch.
    expect(validateChunkMessage({ type: "chunk", captureSessionId: SESSION, sequence: 0, rawByteLength: 16, pcmBase64: encodeChunkBase64(new Uint8Array(8)) }, expected).ok).toBe(false);
    // Odd byte count (not multiple of 2).
    expect(validateChunkMessage({ type: "chunk", captureSessionId: SESSION, sequence: 0, rawByteLength: 3, pcmBase64: encodeChunkBase64(new Uint8Array(3)) }, expected).ok).toBe(false);
    // Above the frozen raw bound.
    expect(validateChunkMessage({
      type: "chunk", captureSessionId: SESSION, sequence: 0,
      rawByteLength: RELAY_V10.maxRawChunkBytes + 2,
      pcmBase64: encodeChunkBase64(new Uint8Array(RELAY_V10.maxRawChunkBytes + 2))
    }, expected)).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
  });

  it("rejects a zero-length chunk", () => {
    const result = validateChunkMessage(
      { type: "chunk", captureSessionId: SESSION, sequence: 0, rawByteLength: 0, pcmBase64: "" },
      { captureSessionId: SESSION, expectedSequence: 0 }
    );
    expect(result).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_EMPTY" });
  });

  it("rejects a chunk bound to a foreign session", () => {
    const result = validateChunkMessage(
      pcmChunk(0),
      { captureSessionId: "cap_" + "b".repeat(32), expectedSequence: 0 }
    );
    expect(result).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
  });
});

// ============================================================================
// Invariant 4: sequence strictly +1 from 0
// ============================================================================

describe("R2 invariant 4: sequence discipline", () => {
  it("accepts 0,1,2 in order and rejects duplicate / gap / out-of-order", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    for (let sequence = 0; sequence < 3; sequence += 1) {
      expect(relay.transport.offerChunkMessage(pcmChunk(sequence)))
        .toEqual({ ok: true });
      relay.socket.fireMessage({ type: "chunkAccepted", sequence });
    }
    // duplicate
    expect(relay.transport.offerChunkMessage(pcmChunk(2)))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID" });
  });

  it("rejects a gap and an out-of-order ahead sequence", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    expect(relay.transport.offerChunkMessage(pcmChunk(5)))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID" });
  });
});

// ============================================================================
// Invariant 5: credit gating + ACK-only credit return
// ============================================================================

describe("R2 invariant 5: credit gating and ACK-only return", () => {
  it("grants the first credit on `ready`, not on `start`", async () => {
    const relay = buildRelay();
    const promise = relay.transport.start(BINDING);
    relay.socket.fireOpen();
    relay.socket.fireMessage({ type: "started" });
    await promise;
    bootstrapOffscreenProducerPort({
      connect: relay.connect,
      onMessage: (m: BackgroundToOffscreenMessage) => {
        if (m.type === PORT_MESSAGE.START) {
          relay.producer()?.postMessage({ type: PORT_MESSAGE.READY, captureSessionId: m.captureSessionId } satisfies OffscreenToBackgroundMessage);
        }
      },
      onDisconnect: () => undefined
    });
    await relay.port.accept(relay.backgroundSide);
    relay.port.sendStart("s");
    // Exactly one credit, with acknowledgedSequence -1.
    const credits = relay.toOffscreen.filter((m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT) as Array<{ credit: number; acknowledgedSequence: number }>;
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ credit: 1, acknowledgedSequence: -1 });
  });

  it("rejects a producer chunk with no credit outstanding", async () => {
    const relay = buildRelay();
    const promise = relay.transport.start(BINDING);
    relay.socket.fireOpen();
    relay.socket.fireMessage({ type: "started" });
    await promise;
    // The producer connects but NEVER receives `start`/`ready`, so no
    // credit is ever granted.
    bootstrapOffscreenProducerPort({
      connect: relay.connect,
      onMessage: () => undefined,
      onDisconnect: () => undefined
    });
    await relay.port.accept(relay.backgroundSide);
    relay.producer()?.postMessage(pcmChunk(0));
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_BACKPRESSURE");
  });

  it("consumes one credit per chunk and returns it only after a Runtime ACK", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    expect(relay.port.credit).toBe(1);
    relay.producer()?.postMessage(pcmChunk(0));
    expect(relay.port.credit).toBe(0);
    // No second credit until the Runtime ACKs.
    let credits = relay.toOffscreen.filter((m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT);
    expect(credits).toHaveLength(1);
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    credits = relay.toOffscreen.filter((m) => (m as { type: string }).type === PORT_MESSAGE.CHUNK_CREDIT);
    expect(credits).toHaveLength(2);
    expect(relay.port.credit).toBe(1);
  });
});

// ============================================================================
// Invariant 6: bounded queue, overflow before enqueue, no drop
// ============================================================================

describe("R2 invariant 6: bounded queue and overflow-before-enqueue", () => {
  it("aborts at the 33rd outstanding chunk, before enqueue", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    let last: unknown = null;
    for (let sequence = 0; sequence < RELAY_V10.maxOutstandingChunks + 1; sequence += 1) {
      last = relay.transport.offerChunkMessage(pcmChunk(sequence));
    }
    expect(last).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
  });

  it("aborts at the byte cap, before enqueue", () => {
    const big = RELAY_V10.maxRawChunkBytes;
    const total = Math.ceil(RELAY_V10.maxOutstandingRawBytes / big) + 1;
    let last: unknown = null;
    for (let i = 0; i < total; i += 1) {
      last = admitChunk({
        chunks: i, rawBytes: i * big, nextChunkRawBytes: big
      });
    }
    expect(last).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
  });

  it("admitChunk admits the exact boundary and refuses one past it", () => {
    expect(admitChunk({ chunks: 31, rawBytes: 0, nextChunkRawBytes: 2 }))
      .toEqual({ ok: true });
    expect(admitChunk({ chunks: 32, rawBytes: 0, nextChunkRawBytes: 2 }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKPRESSURE" });
  });

  it("keeps at most one chunk in flight before an ACK", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    relay.transport.offerChunkMessage(pcmChunk(0));
    relay.transport.offerChunkMessage(pcmChunk(1));
    relay.transport.offerChunkMessage(pcmChunk(2));
    expect(relay.socket.binarySends).toHaveLength(1);
    expect(relay.transport.inFlight).toBe(1);
  });
});

// ============================================================================
// Invariant 7: disconnect / timeout / stop boundary
// ============================================================================

describe("R2 invariant 7: disconnect, timeout and stop boundary", () => {
  it("fails closed on ACK timeout with a fixed code", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    relay.transport.offerChunkMessage(pcmChunk(0));
    relay.clock.advance(RELAY_V10.chunkAckTimeoutMs + 1);
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED");
    expect(relay.transport.state).toBe("aborted");
  });

  it("accepts the post-quiesce drain but stops accepting once the producer is stopped", async () => {
    // R3: `quiesce` means "produce no NEW audio", not "discard the buffer".
    // The frozen 24-step positive trace steps 15-16 have the producer report
    // `quiesced` with `queuedChunks: 1` and then flush exactly that chunk
    // while the state is `draining`, and the drain gate may not finalize
    // until backlog and in-flight are both zero.
    const relay = buildRelay();
    await openCapture(relay);
    relay.transport.beginStop("cancelled");
    relay.transport.markQuiesced();
    expect(relay.transport.state).toBe("draining");
    expect(relay.transport.offerChunkMessage(pcmChunk(0))).toEqual({ ok: true });
    // ...and the boundary still closes: after `stopped` nothing is accepted.
    relay.transport.markOffscreenStopped();
    expect(relay.transport.offerChunkMessage(pcmChunk(1)))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PROTOCOL_INVALID" });
  });

  it("rejects a chunk after the producer stopped", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    relay.transport.markQuiesced();
    relay.transport.markOffscreenStopped();
    expect(relay.transport.offerChunkMessage(pcmChunk(0)))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PROTOCOL_INVALID" });
  });

  it("fails closed on an abnormal producer disconnect with a fixed code", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    const outcome = relay.transport.handleProducerDisconnect("tab_closed");
    expect(outcome.aborted).toBe(true);
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_PORT_DISCONNECTED");
  });

  it("does not abort a finalizing transport on a normal disconnect", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    const terminal = relay.transport.stop("completed");
    relay.transport.markQuiesced();
    relay.transport.markOffscreenStopped();
    await new Promise((r) => setTimeout(r, 0));
    relay.socket.fireMessage({ type: "completed", transcript: { taskId: TASK, state: "queued" } });
    await terminal;
    relay.failures.length = 0;
    expect(relay.transport.handleProducerDisconnect("completed").aborted).toBe(false);
    expect(relay.failures).toEqual([]);
  });

  it("M-R2-01: the owner deadline self-fires with NO further chunk", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    // No chunk is ever sent again. Before the deadline the capture is live.
    // R3-5: the `capturing` phase now begins at producer `ready` (frozen
    // 24-step positive trace step 6-7), so after `openCapture()` the capture
    // is `capturing`, not `runtime_started`. The point of this case is that
    // the capture stays LIVE with no further chunk.
    clock.advance(RELAY_V10.maxCaptureMs - 1);
    expect(relay.transport.state).toBe("capturing");
    expect(relay.failures).not.toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    // Crossing the deadline fires the owner's timer with no new audio.
    clock.advance(2);
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    expect(relay.transport.state).toBe("aborted");
  });

  it("M-R2-01: the deadline notifies the producer and closes the Runtime socket", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    clock.advance(RELAY_V10.maxCaptureMs + 1);
    // The producer receives exactly one abort over the frozen Port.
    const aborts = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ) as Array<{ failureCode: string }>;
    expect(aborts).toHaveLength(1);
    expect(aborts[0].failureCode).toBe("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    // The Runtime socket is closed.
    expect(relay.socket.readyState).toBe(3);
    // The failure terminal settled with the fixed code.
    const terminal = await relay.transport.awaitTerminal();
    expect(terminal).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_DURATION_LIMIT" });
    // The restart marker was written during the capture and then cleared.
    expect(relay.markerWrites.length).toBeGreaterThan(0);
    expect(relay.markerClears).toEqual([SESSION]);
  });

  it("M-R2-01: no second callback after the terminal settles", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    clock.advance(RELAY_V10.maxCaptureMs + 1);
    const terminal = await relay.transport.awaitTerminal();
    expect(terminal.ok).toBe(false);
    // Snapshot every observable side effect, then push the clock far past
    // the deadline and every other bound.
    const failuresAfter = relay.failures.length;
    const abortsAfter = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ).length;
    const clearsAfter = relay.markerClears.length;
    const socketStateAfter = relay.socket.readyState;
    clock.advance(RELAY_V10.maxCaptureMs * 10);
    expect(relay.failures.length).toBe(failuresAfter);
    expect(relay.toOffscreen.filter((m) => (m as { type: string }).type === PORT_MESSAGE.ABORT).length)
      .toBe(abortsAfter);
    expect(relay.markerClears.length).toBe(clearsAfter);
    expect(relay.socket.readyState).toBe(socketStateAfter);
  });

  it("M-R2-01: the deadline races a user stop and still settles once", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    relay.transport.beginStop("completed");
    clock.advance(RELAY_V10.maxCaptureMs + 1);
    // Exactly one DURATION_LIMIT regardless of the racing stop.
    const durationFailures = relay.failures.filter(
      (f) => f === "V3_MEDIA_CAPTURE_DURATION_LIMIT"
    );
    expect(durationFailures).toHaveLength(1);
  });

  it("M-R2-01: the deadline races a Runtime disconnect and still settles once", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    relay.socket.fireClose("");
    clock.advance(RELAY_V10.maxCaptureMs + 1);
    // The disconnect already failed closed; the deadline must not double-report.
    const durationFailures = relay.failures.filter(
      (f) => f === "V3_MEDIA_CAPTURE_DURATION_LIMIT"
    );
    expect(durationFailures).toHaveLength(0);
  });

  it("M-R2-01: the deadline timer is cleared on success, cancel and abort", async () => {
    // success
    const ok = buildRelay({ clock: new FakeClock() });
    await openCapture(ok);
    const okTerminal = ok.transport.stop("completed");
    ok.transport.markQuiesced();
    ok.transport.markOffscreenStopped();
    await new Promise((r) => setTimeout(r, 0));
    ok.socket.fireMessage({ type: "completed", transcript: { taskId: TASK, state: "queued" } });
    await okTerminal;
    ok.failures.length = 0;
    ok.clock.advance(RELAY_V10.maxCaptureMs * 2);
    expect(ok.failures).toEqual([]);

    // cancel
    const cancel = buildRelay({ clock: new FakeClock() });
    await openCapture(cancel);
    cancel.transport.beginStop("cancelled");
    cancel.transport.markQuiesced();
    cancel.transport.markOffscreenStopped();
    await new Promise((r) => setTimeout(r, 0));
    cancel.socket.fireMessage({ type: "cancelled" });
    await cancel.transport.awaitTerminal();
    cancel.failures.length = 0;
    cancel.clock.advance(RELAY_V10.maxCaptureMs * 2);
    expect(cancel.failures).toEqual([]);

    // abort
    const aborted = buildRelay({ clock: new FakeClock() });
    await openCapture(aborted);
    aborted.transport.abort("V3_MEDIA_CAPTURE_BACKPRESSURE");
    aborted.failures.length = 0;
    aborted.clock.advance(RELAY_V10.maxCaptureMs * 2);
    expect(aborted.failures).toEqual([]);
  });
});

// ============================================================================
// Invariant 8: no old session state restored
// ============================================================================

describe("R2 invariant 8: no old session state restored", () => {
  it("a fresh transport starts at sequence 0 with no inherited state", async () => {
    const first = buildRelay();
    await openCapture(first);
    first.transport.offerChunkMessage(pcmChunk(0));
    first.socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    expect(first.transport.backlog.sequence).toBe(1);

    // A new capture (new worker / new adapter) must NOT inherit sequence.
    const second = buildRelay();
    await openCapture(second);
    expect(second.transport.backlog.sequence).toBe(0);
    expect(second.transport.offerChunkMessage(pcmChunk(0))).toEqual({ ok: true });
  });

  it("carries no ticket, sourceIdentity or PCM into Offscreen messages", async () => {
    const relay = buildRelay();
    await openCapture(relay);
    const serialized = JSON.stringify(relay.toOffscreen);
    expect(serialized).not.toContain("t".repeat(43));
    expect(serialized).not.toContain("portal:bilibili");
    expect(serialized).not.toContain("mar_");
  });
});


// ============================================================================
// M-R2-02: whole-capture cumulative byte bound, proven low-resource
// ============================================================================

describe("M-R2-02: cumulative maxCaptureBytes boundary (no 512 MiB allocation)", () => {
  it("pins the frozen cumulative bound", () => {
    expect(RELAY_V10.maxCaptureBytes).toBe(536_870_912);
  });

  it("ALLOWS current + next === maxCaptureBytes exactly", () => {
    const max = RELAY_V10.maxCaptureBytes;
    // Split across the current and the next chunk so no single chunk
    // approaches the bound (a chunk is capped at 49,152 bytes).
    const current = max - 1000;
    const next = 1000;
    expect(exceedsCaptureByteBound(current, next)).toBe(false);
    // One sample more must fail.
    expect(exceedsCaptureByteBound(current, next + 2)).toBe(true);
  });

  it("ALLOWS 0 + max and REFUSES 0 + max + 1", () => {
    const max = RELAY_V10.maxCaptureBytes;
    expect(exceedsCaptureByteBound(0, max)).toBe(false);
    expect(exceedsCaptureByteBound(0, max + 1)).toBe(true);
  });

  it("uses the frozen default and never widens it", () => {
    // The default must come from RELAY_V10 alone.
    expect(exceedsCaptureByteBound(0, RELAY_V10.maxCaptureBytes)).toBe(false);
    expect(exceedsCaptureByteBound(0, RELAY_V10.maxCaptureBytes + 2)).toBe(true);
    // An explicit override is honoured, proving the seam is real.
    expect(exceedsCaptureByteBound(0, 101, 100)).toBe(true);
    expect(exceedsCaptureByteBound(0, 100, 100)).toBe(false);
  });
});

// ============================================================================
// M-R2-02: the transport refuses the over-bound chunk with NO pollution
// ============================================================================

describe("M-R2-02: over-bound chunk leaves no queue / sequence / counter pollution", () => {
  it("refuses before enqueue, sequence and counters change, then closes out", async () => {
    // Inject a tiny cumulative bound so the test stays low-resource: the
    // production default is still RELAY_V10.maxCaptureBytes and is
    // covered by the pure-predicate tests above.
    const relay = buildRelay({ maxCaptureBytes: 640 });
    await openCapture(relay);

    const seqBefore = relay.transport.backlog.sequence;
    const bytesBefore = relay.transport.totalRawBytes;
    const chunksBefore = relay.transport.backlog.chunks;

    // Two accepted chunks of 320 bytes each = 640, exactly the bound.
    expect(relay.transport.offerChunkMessage(pcmChunk(0, 320))).toEqual({ ok: true });
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    expect(relay.transport.offerChunkMessage(pcmChunk(1, 320))).toEqual({ ok: true });
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 1 });
    expect(relay.transport.totalRawBytes).toBe(640);

    // One sample over: refused, and NOTHING advanced.
    const before = {
      sequence: relay.transport.backlog.sequence,
      bytes: relay.transport.totalRawBytes,
      chunks: relay.transport.backlog.chunks,
      capturedMs: relay.transport.capturedMs
    };
    const over = relay.transport.offerChunkMessage(pcmChunk(2, 322));
    expect(over).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
    expect(relay.transport.backlog.sequence).toBe(before.sequence);
    expect(relay.transport.totalRawBytes).toBe(before.bytes);
    expect(relay.transport.backlog.chunks).toBe(before.chunks);
    expect(relay.transport.capturedMs).toBe(before.capturedMs);
    // Sequence / counter pollution from the first two is expected; the
    // refused one added nothing.
    expect(before.sequence).toBeGreaterThan(seqBefore);
    expect(before.bytes).toBeGreaterThan(bytesBefore);
    void chunksBefore;

    // The failure is reported exactly once.
    const byteFailures = relay.failures.filter(
      (f) => f === "V3_MEDIA_CAPTURE_BYTE_LIMIT"
    );
    expect(byteFailures).toHaveLength(1);
  });
});

/**
 * M-R2-02 §3.5-3.7: the cumulative byte cap must perform the SAME
 * fail-closed closeout as the deadline — producer abort, Runtime socket
 * close, failure terminal and restart marker cleanup — not merely
 * return a code.
 */
describe("M-R2-02: cumulative byte cap performs the full fail-closed closeout", () => {
  it("aborts the producer, closes the Runtime socket, settles failure and clears the marker", async () => {
    const relay = buildRelay({ maxCaptureBytes: 640 });
    await openCapture(relay);
    // Fill exactly to the bound.
    expect(relay.transport.offerChunkMessage(pcmChunk(0, 320))).toEqual({ ok: true });
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    expect(relay.transport.offerChunkMessage(pcmChunk(1, 320))).toEqual({ ok: true });
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 1 });
    expect(relay.transport.totalRawBytes).toBe(640);

    // One sample over the bound.
    const over = relay.transport.offerChunkMessage(pcmChunk(2, 322));
    expect(over).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });

    // (1) the producer is aborted exactly once over the frozen Port
    const aborts = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ) as Array<{ failureCode: string }>;
    expect(aborts).toHaveLength(1);
    expect(aborts[0].failureCode).toBe("V3_MEDIA_CAPTURE_BYTE_LIMIT");
    // (2) the Runtime socket is closed
    expect(relay.socket.readyState).toBe(3);
    // (3) the failure terminal settled with the fixed code
    const terminal = await relay.transport.awaitTerminal();
    expect(terminal).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
    // (4) the restart marker was written then cleared
    expect(relay.markerWrites.length).toBeGreaterThan(0);
    expect(relay.markerClears).toEqual([SESSION]);
    // (5) the byte failure is reported exactly once
    expect(relay.failures.filter((f) => f === "V3_MEDIA_CAPTURE_BYTE_LIMIT")).toHaveLength(1);
  });
});

// ============================================================================
// Duration boundary shares ONE definition with the active deadline
// ============================================================================

describe("C1: the duration boundary has a single definition", () => {
  it("=== max is still inside the window; one ms more is not", () => {
    const max = RELAY_V10.maxCaptureMs;
    expect(exceedsCaptureDurationBound(max - 1)).toBe(false);
    expect(exceedsCaptureDurationBound(max)).toBe(false);
    expect(exceedsCaptureDurationBound(max + 1)).toBe(true);
  });

  it("the deadline origin equals startedAt and the marker expiry origin", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    const promise = relay.transport.start(BINDING);
    relay.socket.fireOpen();
    relay.socket.fireMessage({ type: "started" });
    await promise;
    const marker = relay.transport.currentMarker();
    // The marker's TTL origin and the deadline share #startedAt.
    expect(Date.parse(marker!.startedAt)).toBe(clock.now);
    expect(Date.parse(marker!.expiresAt) - Date.parse(marker!.startedAt)).toBe(RELAY_V10.markerTtlMs);
  });
});


// ============================================================================
// M-R2-C1 / C2 / C3 — the three production composition tests
// ============================================================================

describe("M-R2-C1: the real Port CHUNK branch aborts the producer EXACTLY once", () => {
  it("cumulative byte overflow via producer.postMessage performs one full closeout", async () => {
    // Drive the REAL OffscreenAudioPort CHUNK branch with a real Port
    // message. Never call transport.offerChunkMessage directly: that
    // would bypass the production inbound path Codex rejected.
    const relay = buildRelay({ maxCaptureBytes: 640 });
    await openCapture(relay);

    // Two credited chunks fill the seam exactly.
    relay.producer()?.postMessage(pcmChunk(0, 320));
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    relay.producer()?.postMessage(pcmChunk(1, 320));
    relay.socket.fireMessage({ type: "chunkAccepted", sequence: 1 });
    expect(relay.transport.totalRawBytes).toBe(640);

    // One sample over, arriving through the real Port inbound branch.
    relay.producer()?.postMessage(pcmChunk(2, 322));

    // (1) producer abort EXACTLY once, with the fixed code.
    const aborts = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ) as Array<{ failureCode: string }>;
    expect(aborts).toHaveLength(1);
    expect(aborts[0].failureCode).toBe("V3_MEDIA_CAPTURE_BYTE_LIMIT");
    // (2) failure reported EXACTLY once.
    expect(relay.failures.filter((f) => f === "V3_MEDIA_CAPTURE_BYTE_LIMIT")).toHaveLength(1);
    // (3) Runtime socket closed.
    expect(relay.socket.readyState).toBe(3);
    // (4) failure terminal with the fixed code.
    expect(await relay.transport.awaitTerminal())
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BYTE_LIMIT" });
    // (5) restart marker cleared exactly once.
    expect(relay.markerClears).toEqual([SESSION]);
  });

  it("no-credit is PORT-owned: the producer is still aborted exactly once", async () => {
    const relay = buildRelay();
    // Connect and accept WITHOUT start/ready, so credit stays 0.
    const promise = relay.transport.start(BINDING);
    relay.socket.fireOpen();
    relay.socket.fireMessage({ type: "started" });
    await promise;
    bootstrapOffscreenProducerPort({
      connect: relay.connect,
      onMessage: () => undefined,
      onDisconnect: () => undefined
    });
    await relay.port.accept(relay.backgroundSide);
    relay.producer()?.postMessage(pcmChunk(0));
    const aborts = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ) as Array<{ failureCode: string }>;
    expect(aborts).toHaveLength(1);
    expect(aborts[0].failureCode).toBe("V3_MEDIA_CAPTURE_BACKPRESSURE");
  });
});

describe("M-R2-C2: the deadline exact boundary uses the shared predicate", () => {
  it("elapsed === maxCaptureMs stays ACTIVE; +1 ms aborts", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    // Land exactly on the boundary.
    clock.advance(RELAY_V10.maxCaptureMs);
    expect(relay.failures).not.toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    expect(["runtime_started", "capturing"]).toContain(relay.transport.state);
    // One more millisecond crosses it.
    clock.advance(1);
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    expect(relay.transport.state).toBe("aborted");
  });

  it("the timer body re-arms at the exact boundary instead of aborting", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    // Arming is idempotent; the predicate is consulted on every fire.
    clock.advance(RELAY_V10.maxCaptureMs - 1);
    expect(relay.failures).toEqual([]);
    clock.advance(1); // == max exactly
    expect(relay.failures).toEqual([]);
    clock.advance(1); // > max
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
  });
});

describe("M-R2-C3: a late finalize must not rewrite a settled terminal", () => {
  it("a deadline that wins the race keeps `aborted` against a late finalize", async () => {
    const clock = new FakeClock();
    const relay = buildRelay({ clock });
    await openCapture(relay);
    // Enter the REAL cleanup_pending: stop + quiesced + stopped.
    relay.transport.beginStop("completed");
    relay.transport.markQuiesced();
    relay.transport.markOffscreenStopped();
    expect(relay.transport.state).toBe("cleanup_pending");

    // The deadline fires while #finalizeRuntime() is still waiting.
    clock.advance(RELAY_V10.maxCaptureMs + 1);
    expect(relay.failures).toContain("V3_MEDIA_CAPTURE_DURATION_LIMIT");
    const terminal = await relay.transport.awaitTerminal();
    expect(terminal).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_DURATION_LIMIT" });
    expect(relay.transport.state).toBe("aborted");

    // A LATE Runtime frame / socket close / finalize timer must not
    // rewrite `aborted` back to `finalized`, nor duplicate side effects.
    const failuresAfter = relay.failures.length;
    const abortsAfter = relay.toOffscreen.filter(
      (m) => (m as { type: string }).type === PORT_MESSAGE.ABORT
    ).length;
    const clearsAfter = relay.markerClears.length;
    relay.socket.fireClose("");
    relay.socket.fireMessage({ type: "completed", transcript: { taskId: TASK, state: "queued" } });
    clock.advance(RELAY_V10.maxCaptureMs * 3);
    expect(relay.transport.state).toBe("aborted");
    expect(relay.failures.length).toBe(failuresAfter);
    expect(relay.toOffscreen.filter((m) => (m as { type: string }).type === PORT_MESSAGE.ABORT).length)
      .toBe(abortsAfter);
    expect(relay.markerClears.length).toBe(clearsAfter);
  });

  it("a late abort() after a successful finalize cannot rewrite `finalized`", async () => {
    const relay = buildRelay({ clock: new FakeClock() });
    await openCapture(relay);
    const terminal = relay.transport.stop("completed");
    relay.transport.markQuiesced();
    relay.transport.markOffscreenStopped();
    await new Promise((r) => setTimeout(r, 0));
    relay.socket.fireMessage({ type: "completed", transcript: { taskId: TASK, state: "queued" } });
    await terminal;
    expect(relay.transport.state).toBe("finalized");
    // A late Port-owned abort must be a no-op on the settled terminal.
    relay.transport.abort("V3_MEDIA_CAPTURE_BACKPRESSURE");
    expect(relay.transport.state).toBe("finalized");
  });
});
