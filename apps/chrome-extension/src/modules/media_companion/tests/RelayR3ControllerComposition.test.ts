/**
 * WP0 R3 — Controller / router / client production composition.
 *
 * R1 and R2 proved the OWNER's internals (transport bounds, Port sender
 * binding, single abort). R3 proves the ORCHESTRATION: that the real
 * `MediaCaptureController`, `MediaCaptureMessageRouter`,
 * `RuntimeCaptureTransport`, `OffscreenAudioPort` and the real Offscreen
 * bootstrap are wired exactly as `entrypoints/background/index.ts` wires
 * them, and that the frozen 24-step positive trace is reproduced step by
 * step — not compared as a fixed JSON blob.
 *
 * Only BROWSER and NETWORK primitives are substituted:
 *   - `WebSocket`                    -> FakeSocket
 *   - `setTimeout` / `clearTimeout`  -> FakeClock
 *   - `chrome.offscreen`             -> a document registry that really
 *                                       destroys its Port with the
 *                                       document, like Chrome does
 *   - `chrome.tabCapture`            -> getMediaStreamId stub
 *   - `chrome.runtime.getContexts`   -> context stub
 *
 * The classes under acceptance (Controller, router, transport, Port owner,
 * producer bootstrap and their state machines) are the SHIPPED production
 * classes. Nothing here plays audio and nothing opens a browser.
 */

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import relayFixtures from "../../../../../../docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json";
import {
  MediaCaptureController,
  type RelayTerminal,
  type RelayTransportPort
} from "../capture/MediaCaptureController";
import { MediaCaptureMessageRouter, type MediaCaptureSender } from "../capture/MediaCaptureMessageRouter";
import { RuntimeCaptureTransport, type RuntimeSocketLike } from "../capture/RuntimeCaptureTransport";
import { OffscreenAudioPort, type OffscreenPortLike } from "../capture/OffscreenAudioPort";
import { bootstrapOffscreenProducerPort } from "../capture/OffscreenProducerBootstrap";
import {
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  PORT_MESSAGE,
  RELAY_V10,
  RESTART_MARKER_FIELDS,
  SESSION_ID_PATTERN,
  type BackgroundToOffscreenMessage,
  type OffscreenToBackgroundMessage,
  type RelayRestartMarker
} from "../capture/relayContracts";
import { encodeChunkBase64 } from "../capture/audioChunk";

// ---------------------------------------------------------------------------
// Browser / network primitives
// ---------------------------------------------------------------------------

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXT_ID}/media-capture-offscreen.html`;
const SIDEPANEL_URL = `chrome-extension://${EXT_ID}/sidepanel.html`;
const TAB = { id: 7, active: true, url: "https://www.bilibili.com/video/BV1TEST" };
const TASK_ID = "media_task_" + "2".repeat(32);
const MAR_RECORD = "mar_" + "8".repeat(32);

const digest = async (value: string) => Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
).map((byte) => byte.toString(16).padStart(2, "0")).join("");

class FakeSocket implements RuntimeSocketLike {
  binaryType = "";
  readyState = 0;
  sent: Array<string | ArrayBuffer> = [];
  onSend: ((data: string | ArrayBuffer) => void) | null = null;
  #listeners = new Map<string, Array<(e: unknown) => void>>();

  addEventListener(type: string, listener: (e: unknown) => void) {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  send(data: string | ArrayBuffer) {
    this.sent.push(data);
    this.onSend?.(data);
  }

  close() { this.readyState = 3; }

  fireOpen() {
    this.readyState = 1;
    for (const listener of this.#listeners.get("open") ?? []) listener({});
  }

  fireMessage(value: Record<string, unknown>) {
    for (const listener of this.#listeners.get("message") ?? []) {
      listener({ data: JSON.stringify(value) });
    }
  }

  fireClose(reason = "") {
    this.readyState = 3;
    for (const listener of this.#listeners.get("close") ?? []) listener({ reason });
  }

  get binarySends(): ArrayBuffer[] {
    return this.sent.filter((value): value is ArrayBuffer => value instanceof ArrayBuffer);
  }

  get jsonSends(): Record<string, unknown>[] {
    return this.sent
      .filter((value): value is string => typeof value === "string")
      .map((value) => JSON.parse(value) as Record<string, unknown>);
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
      const due = [...this.#timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) break;
      const [id, timer] = due[0];
      this.#timers.delete(id);
      this.now = timer.at;
      timer.handler();
    }
    this.now = target;
  }
}

/** Let every already-resolved microtask and macrotask callback run. */
async function flush(rounds = 8) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// ---------------------------------------------------------------------------
// The chain under acceptance — production classes only
// ---------------------------------------------------------------------------

type ProducerDocument = {
  documentId: string;
  /** Background -> Offscreen messages, in the order Chrome delivered them. */
  received: BackgroundToOffscreenMessage[];
  live: boolean;
  backgroundDisconnected: boolean;
  /** Producer -> Background (`chrome.runtime.Port.postMessage`). */
  emit(message: OffscreenToBackgroundMessage): void;
  of(type: string): BackgroundToOffscreenMessage[];
  /** Chrome destroying the Offscreen document kills its Port too. */
  kill(): void;
  /** The Background half of the frozen Port, as `onConnect` receives it. */
  backgroundSide: OffscreenPortLike;
};

function buildChain() {
  const clock = new FakeClock();
  const sockets: FakeSocket[] = [];
  const markerWrites: RelayRestartMarker[] = [];
  const markerClears: string[] = [];
  const failures: string[] = [];
  const diagnostics: Array<{ stage: string; errorName: string; message: string }> = [];
  const streamIdCalls: number[] = [];
  const createdDocuments: ProducerDocument[] = [];
  const liveDocuments: ProducerDocument[] = [];
  const closeCount = { value: 0 };
  const finalizeBacklog: Array<{ chunks: number; rawBytes: number; inFlight: number }> = [];
  const sessionIds: string[] = [];
  let sessionSeq = 0;
  let permissionGranted = true;
  let streamId = "one-shot-stream-id";
  let refusePort = false;

  const portRef: { current: OffscreenAudioPort | null } = { current: null };

  const transport = new RuntimeCaptureTransport({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      // Snapshot the drain gate at the exact instant the Runtime `stop`
      // leaves Background, so "backlog and in-flight are zero before
      // finalize" is an observation, not a final state.
      socket.onSend = (data) => {
        if (typeof data !== "string") return;
        const value = JSON.parse(data) as Record<string, unknown>;
        if (value.type === "stop") finalizeBacklog.push({ ...transport.backlog });
      };
      return socket;
    },
    runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
    now: () => clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    onMarker: (marker) => { markerWrites.push({ ...marker }); },
    clearMarker: (id) => { markerClears.push(id); },
    reportFailure: (code) => { failures.push(code); },
    // Production: the Transport's fail-closed closeout goes through the
    // Port owner's once-guard, never through a raw `sendAbort`.
    onCaptureAbort: (code) => { portRef.current?.notifyProducerAbortOnce(code); }
  }, () => {
    sessionSeq += 1;
    const id = `cap_${String.fromCharCode(97 + sessionSeq - 1).repeat(32)}`;
    sessionIds.push(id);
    return id;
  });

  const port = new OffscreenAudioPort({
    getContexts: async (filter) => {
      const urls = filter.documentUrls ?? [];
      const types = filter.contextTypes ?? [];
      return liveDocuments
        .filter(() => urls.includes(OFFSCREEN_URL) && types.includes("OFFSCREEN_DOCUMENT"))
        .map((doc) => ({
          contextType: "OFFSCREEN_DOCUMENT",
          documentId: doc.documentId,
          documentUrl: OFFSCREEN_URL,
          documentOrigin: `chrome-extension://${EXT_ID}`,
          incognito: false
        } as unknown as chrome.runtime.ExtensionContext));
    },
    expectedSenderUrl: OFFSCREEN_URL,
    extensionIncognito: false,
    onFailure: (code) => { failures.push(code); transport.abort(code); },
    onDisconnect: (reason) => { transport.handleProducerDisconnect(reason); }
  }, transport);
  portRef.current = port;
  transport.setAckHook({ onRuntimeAck: (sequence) => port.noteRuntimeAck(sequence) });

  // --- chrome.offscreen: a document really owns its Port --------------------
  let pendingAccept: Promise<unknown> | null = null;
  function createDocument(): ProducerDocument {
    const documentId = `doc-${createdDocuments.length + 1}`;
    const backgroundListeners: Array<(message: unknown) => void> = [];
    const producerListeners: Array<(message: unknown) => void> = [];
    const backgroundDisconnects: Array<() => void> = [];
    const doc: ProducerDocument = {
      documentId,
      received: [],
      live: true,
      backgroundDisconnected: false,
      emit(message) {
        if (!doc.live || doc.backgroundDisconnected) return;
        for (const listener of backgroundListeners) listener(message);
      },
      of: (type) => doc.received.filter((message) => message.type === type) as BackgroundToOffscreenMessage[],
      kill() {
        if (!doc.live) return;
        doc.live = false;
        // Chrome fires the Port's onDisconnect on BOTH sides when the
        // document that owns them dies.
        for (const listener of backgroundDisconnects) listener();
        for (const listener of producerDisconnects) listener();
      },
      backgroundSide: null as unknown as OffscreenPortLike
    };

    const producerDisconnects: Array<() => void> = [];

    const backgroundSide: OffscreenPortLike = {
      name: MEDIA_CAPTURE_AUDIO_PORT_NAME,
      sender: {
        id: EXT_ID,
        url: OFFSCREEN_URL,
        documentId,
        frameId: 0
      } as unknown as chrome.runtime.MessageSender,
      postMessage: (message) => {
        if (!doc.live || doc.backgroundDisconnected) return;
        for (const listener of producerListeners) listener(message);
      },
      disconnect: () => {
        doc.backgroundDisconnected = true;
        // The producer side observes the Background dropping the Port.
        for (const listener of producerDisconnects) listener();
      },
      onMessage: { addListener: (listener) => backgroundListeners.push(listener) },
      onDisconnect: { addListener: (listener) => backgroundDisconnects.push(listener) }
    };

    // The real Offscreen bootstrap — entrypoints/media-capture-offscreen/
    // main.ts calls exactly this at document load.
    bootstrapOffscreenProducerPort({
      connect: () => ({
        name: MEDIA_CAPTURE_AUDIO_PORT_NAME,
        postMessage: (message) => {
          if (!doc.live || doc.backgroundDisconnected) return;
          for (const listener of backgroundListeners) listener(message);
        },
        disconnect: () => {
          if (!doc.live) return;
          doc.live = false;
          for (const listener of producerDisconnects) listener();
        },
        onMessage: { addListener: (listener) => producerListeners.push(listener) },
        onDisconnect: { addListener: (listener) => producerDisconnects.push(listener) }
      }),
      // The test drives every producer reply explicitly, step by step.
      onMessage: (message) => { doc.received.push(message); },
      onDisconnect: () => { doc.live = false; }
    });

    // Background side: chrome.runtime.onConnect -> offscreenAudioPort.accept.
    // The accept itself happens in `ensureOffscreenDocument`, AFTER the
    // document is registered, because `runtime.getContexts` must be able to
    // see the live Offscreen context.
    doc.backgroundSide = backgroundSide;
    return doc;
  }

  // The relay facade, byte for byte the one in entrypoints/background/index.ts.
  const relayFacade: RelayTransportPort = {
    start: (binding) => transport.start(binding),
    sendStart: (value) => port.sendStart(value),
    sendQuiesce: () => port.sendQuiesce(),
    beginStop: (reason) => { transport.beginStop(reason); },
    abort: (failureCode) => {
      port.notifyProducerAbortOnce(failureCode);
      transport.abort(failureCode);
    },
    stop: (reason): Promise<RelayTerminal> => transport.stop(reason),
    disconnect: () => port.disconnect()
  };

  const controller = new MediaCaptureController({
    queryTargetTab: async () => TAB,
    hasPermission: async () => permissionGranted,
    getMediaStreamId: async (tabId) => {
      streamIdCalls.push(tabId);
      return streamId;
    },
    ensureOffscreenDocument: async () => {
      if (liveDocuments.length > 0) return;
      const doc = createDocument();
      createdDocuments.push(doc);
      // chrome.offscreen.createDocument resolves once the document exists,
      // so its context is visible before the Port connects.
      liveDocuments.push(doc);
      const offered = refusePort
        ? { ...doc.backgroundSide, sender: undefined } as unknown as OffscreenPortLike
        : doc.backgroundSide;
      pendingAccept = port.accept(offered);
      // Production treats "the document is ready" as including the Port
      // handshake (it pings the document until it answers).
      await pendingAccept;
    },
    sendOffscreenMessage: async () => ({ ok: true, state: "ready" }),
    closeOffscreenDocument: async () => {
      closeCount.value += 1;
      liveDocuments.pop()?.kill();
    },
    digest,
    relay: relayFacade,
    reportDiagnostic: (diagnostic) => { diagnostics.push(diagnostic); }
  });

  const router = new MediaCaptureMessageRouter(EXT_ID, `chrome-extension://${EXT_ID}/`, controller);
  const sender: MediaCaptureSender = { id: EXT_ID, url: SIDEPANEL_URL, hasTab: false };

  return {
    clock,
    sockets,
    markerWrites,
    markerClears,
    failures,
    diagnostics,
    streamIdCalls,
    createdDocuments,
    closeCount,
    finalizeBacklog,
    sessionIds,
    transport,
    port,
    controller,
    router,
    sender,
    setPermission: (value: boolean) => { permissionGranted = value; },
    setStreamId: (value: string) => { streamId = value; },
    refuseNextPort: (value: boolean) => { refusePort = value; },
    liveDocument: () => liveDocuments[0],
    document: (index: number) => createdDocuments[index]
  };
}

type Chain = ReturnType<typeof buildChain>;

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: EXT_ID, getURL: (part: string) => `chrome-extension://${EXT_ID}/${part}` },
    extension: { inIncognitoContext: false }
  };
});
afterEach(() => { delete (globalThis as unknown as { chrome?: unknown }).chrome; });

// ---------------------------------------------------------------------------
// Helpers shared by the cases
// ---------------------------------------------------------------------------

async function grantMessage(suffix: string) {
  return {
    type: "navia.mediaCapture",
    command: "arm",
    trustedClick: true,
    userActivation: true,
    ticket: "t".repeat(43),
    sourceIdentity: "portal:bilibili:BV1TEST:cid:1",
    acquisitionRecordId: MAR_RECORD,
    grant: {
      grantId: "mcg_" + suffix.repeat(32),
      taskId: TASK_ID,
      adapterId: "bilibili",
      pageIdentitySha256: await digest(TAB.url),
      tabIdSha256: await digest(String(TAB.id)),
      surface: "side_panel",
      issuedAt: "2026-10-17T00:00:00Z",
      expiresAt: "2026-10-17T00:00:30Z",
      oneShot: true,
      persisted: false,
      state: "issued"
    }
  } as const;
}

function chunkMessage(sessionId: string, sequence: number, rawByteLength = 2) {
  return {
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: sessionId,
    sequence,
    rawByteLength,
    pcmBase64: encodeChunkBase64(new Uint8Array(rawByteLength))
  } satisfies OffscreenToBackgroundMessage;
}

/** Arm + start and drive the Runtime socket to `started`, exactly like Chrome. */
async function beginCapture(chain: Chain, suffix: string) {
  expect(await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender))
    .toEqual({ ok: true, state: "prepared" });
  expect(await chain.router.handle(await grantMessage(suffix), chain.sender))
    .toMatchObject({ ok: true, state: "armed" });
  const starting = chain.controller.startArmed(TAB);
  await flush();
  const socket = chain.sockets[chain.sockets.length - 1];
  socket.fireOpen();
  socket.fireMessage({ type: "started" });
  await flush();
  expect(await starting).toMatchObject({ ok: true, state: "capturing" });
  const doc = chain.liveDocument();
  const sessionId = chain.transport.captureSessionId;
  return { socket, doc, sessionId };
}

/** The `ready` handshake and the first credit. */
function handshake(chain: Chain, doc: ProducerDocument, sessionId: string) {
  doc.emit({ type: PORT_MESSAGE.READY, captureSessionId: sessionId });
  return doc.of(PORT_MESSAGE.CHUNK_CREDIT)[0] as
    | { acknowledgedSequence: number; credit: number; captureSessionId: string }
    | undefined;
}

// ===========================================================================
// R3-5 — the frozen 24-step positive trace, driven step by step
// ===========================================================================

describe("R3-5: the frozen 24-step positive trace reproduces on the production chain", () => {
  it("drives every step through the real Controller, router, transport and Port owner", async () => {
    const trace = relayFixtures.positiveTrace;
    expect(trace).toHaveLength(24);
    const observed: string[] = [];

    const chain = buildChain();
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    await chain.router.handle(await grantMessage("1"), chain.sender);
    const starting = chain.controller.startArmed(TAB);
    await flush();

    // --- step 1: background writes the restart marker (connecting) --------
    const socket = chain.sockets[0];
    expect(chain.markerWrites).toHaveLength(1);
    expect(chain.markerWrites[0].phase).toBe(trace[0].requiredState);
    expect(chain.markerWrites[0].captureSessionId).toMatch(SESSION_ID_PATTERN);
    observed.push(`1:${chain.markerWrites[0].phase}`);

    // --- step 2: background opens the Runtime capture stream --------------
    socket.fireOpen();
    expect(trace[1].message).toBe("runtime_start");
    expect(socket.jsonSends[0].type).toBe(PORT_MESSAGE.START);
    expect(socket.jsonSends[0].ticket).toBe("t".repeat(43));
    expect(socket.jsonSends[0].taskId).toBe(TASK_ID);
    observed.push(`2:${socket.jsonSends[0].type}`);

    // --- step 3: Runtime `started` ---------------------------------------
    socket.fireMessage({ type: "started" });
    expect(chain.transport.state).toBe(trace[2].requiredState);
    observed.push(`3:${chain.transport.state}`);

    // --- step 4: marker phase runtime_started ------------------------------
    await flush();
    expect(chain.markerWrites.at(-1)?.phase).toBe(trace[3].requiredState);
    observed.push(`4:${chain.markerWrites.at(-1)?.phase}`);

    // --- step 5: the one-shot streamId leaves Background ONCE -------------
    await flush();
    expect(await starting).toMatchObject({ ok: true, state: "capturing" });
    const doc = chain.liveDocument();
    const sessionId = chain.transport.captureSessionId;
    const startMessages = doc.of(PORT_MESSAGE.START);
    expect(startMessages).toHaveLength(1);
    expect((startMessages[0] as { streamId: string }).streamId).toBe("one-shot-stream-id");
    expect((startMessages[0] as { captureSessionId: string }).captureSessionId).toBe(sessionId);
    observed.push(`5:${startMessages[0].type}`);

    // --- step 6: producer `ready` -----------------------------------------
    const firstCredit = handshake(chain, doc, sessionId);
    expect(chain.transport.state).toBe(trace[5].requiredState);
    observed.push(`6:${chain.transport.state}`);

    // --- step 7: marker phase capturing -----------------------------------
    expect(chain.markerWrites.at(-1)?.phase).toBe(trace[6].requiredState);
    observed.push(`7:${chain.markerWrites.at(-1)?.phase}`);

    // --- step 8: the first credit follows `ready` -------------------------
    expect(trace[7].message).toBe("chunk_credit");
    expect(firstCredit).toMatchObject({
      type: PORT_MESSAGE.CHUNK_CREDIT,
      acknowledgedSequence: trace[7].acknowledgedSequence,
      credit: trace[7].credit,
      captureSessionId: sessionId
    });
    observed.push(`8:${firstCredit?.acknowledgedSequence}`);

    // --- step 9: the producer sends one bounded chunk ---------------------
    doc.emit(chunkMessage(sessionId, 0));
    expect(socket.binarySends).toHaveLength(1);
    expect(new Uint8Array(socket.binarySends[0]).byteLength).toBe(trace[8].rawByteLength);
    observed.push(`9:${trace[8].sequence}`);

    // --- step 10: Background streamed the raw PCM to Runtime --------------
    expect(chain.transport.backlog.inFlight).toBe(1);
    observed.push(`10:${chain.transport.backlog.inFlight}`);

    // --- step 11: Runtime acknowledges -------------------------------------
    socket.fireMessage({ type: "chunkAccepted", sequence: 0, rawByteLength: 2 });
    expect(chain.transport.backlog.inFlight).toBe(0);
    observed.push(`11:${chain.transport.acknowledgedSequence}`);

    // --- step 12: the ACK — and only the ACK — returns credit -------------
    expect(doc.of(PORT_MESSAGE.CHUNK_CREDIT)).toHaveLength(2);
    expect(doc.of(PORT_MESSAGE.CHUNK_CREDIT)[1]).toMatchObject({
      type: PORT_MESSAGE.CHUNK_CREDIT,
      acknowledgedSequence: trace[11].acknowledgedSequence,
      credit: trace[11].credit,
      captureSessionId: sessionId
    });
    observed.push(`12:${trace[11].acknowledgedSequence}`);

    // --- step 13: quiesce, AFTER the reason is frozen ----------------------
    const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" });
    await flush();
    const quiesce = doc.of(PORT_MESSAGE.QUIESCE)[0] as { type: string; captureSessionId: string };
    expect(trace[12].message).toBe("quiesce");
    expect(quiesce.type).toBe(PORT_MESSAGE.QUIESCE);
    expect(quiesce.captureSessionId).toBe(sessionId);
    expect(chain.transport.stopReason).toBe("completed");
    observed.push(`13:${quiesce.type}`);

    // --- step 14: marker phase draining -----------------------------------
    expect(chain.transport.state).toBe(trace[13].requiredState);
    expect(chain.markerWrites.at(-1)?.phase).toBe(trace[13].requiredState);
    observed.push(`14:${chain.markerWrites.at(-1)?.phase}`);

    // --- step 15: producer reports quiesced with one chunk still queued ---
    doc.emit({
      type: PORT_MESSAGE.QUIESCED,
      captureSessionId: sessionId,
      queuedChunks: trace[14].queuedChunks ?? 1,
      outstandingRawBytes: trace[14].outstandingRawBytes ?? 2,
      sourceStopped: true
    });
    observed.push(`15:${trace[14].queuedChunks}`);

    // --- step 16/17: the already-queued chunk flushes while draining -------
    doc.emit(chunkMessage(sessionId, 1));
    expect(chain.transport.state).toBe(trace[15].requiredState);
    expect(socket.binarySends).toHaveLength(2);
    observed.push(`16:${chain.transport.state}`);

    // --- step 18: Runtime acknowledges the drained chunk ------------------
    socket.fireMessage({ type: "chunkAccepted", sequence: 1, rawByteLength: 2 });
    observed.push(`17:${socket.binarySends.length}`);

    // --- step 19: credit after the drain ACK ------------------------------
    expect(doc.of(PORT_MESSAGE.CHUNK_CREDIT)).toHaveLength(3);
    expect(doc.of(PORT_MESSAGE.CHUNK_CREDIT)[2]).toMatchObject({
      type: PORT_MESSAGE.CHUNK_CREDIT,
      acknowledgedSequence: trace[18].acknowledgedSequence,
      credit: trace[18].credit,
      captureSessionId: sessionId
    });
    observed.push(`18:${chain.transport.acknowledgedSequence}`);

    // --- step 20: producer stopped ----------------------------------------
    doc.emit({
      type: PORT_MESSAGE.STOPPED,
      captureSessionId: sessionId,
      queuedChunks: 0,
      creditConsumed: 0,
      tracksStopped: true,
      contextClosed: true
    });
    observed.push(`19:${doc.of(PORT_MESSAGE.CHUNK_CREDIT).length}`);

    // --- step 21: marker phase cleanup_pending, then the Runtime stop -----
    await flush();
    expect(chain.markerWrites.at(-1)?.phase).toBe(trace[20].requiredState);
    expect(chain.transport.state).toBe(trace[20].requiredState);
    expect(socket.jsonSends.at(-1)).toEqual({ type: "stop", reason: "completed" });
    // The drain gate was satisfied: NOTHING was left queued or in flight.
    expect(chain.finalizeBacklog).toHaveLength(1);
    expect(chain.finalizeBacklog[0]).toMatchObject({ chunks: 0, rawBytes: 0, inFlight: 0 });
    observed.push(`20:${chain.markerWrites.at(-1)?.phase}`);

    // --- step 22: the Runtime `stop` is the last Runtime frame ------------
    expect(socket.jsonSends.map((m) => m.type)).toEqual(["start", "stop"]);
    observed.push(`21:${socket.jsonSends.map((m) => m.type).join(",")}`);

    // --- step 23: completed WITH the three cleanup counts -----------------
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: TASK_ID, state: "queued" },
      activeCaptureCount: trace[22].activeCaptureCount,
      residualRawAudioCount: trace[22].residualRawAudioCount,
      privateTempAudioCount: trace[22].privateTempAudioCount
    });
    const terminal = await stopping;
    expect(terminal).toEqual({
      ok: true,
      state: "transcribing",
      transcript: { taskId: TASK_ID, state: "queued" }
    });
    expect(chain.transport.state).toBe("finalized");
    observed.push(`22:${chain.transport.state}`);

    // --- step 24: the marker is cleared, once, and never republished ------
    expect(chain.markerClears).toEqual([sessionId]);
    const terminalWrites = chain.markerWrites.length;
    await flush();
    expect(chain.markerWrites).toHaveLength(terminalWrites);
    expect(chain.transport.currentMarker()).not.toBeNull();
    // The Port and the Offscreen document are released.
    expect(chain.port.connected).toBe(false);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.liveDocument()).toBeUndefined();
    observed.push(`23:${chain.markerClears.length}`);

    // ---- the five frozen phases were published, in order ----------------
    expect(chain.markerWrites.map((marker) => marker.phase)).toEqual([
      "connecting", "runtime_started", "capturing", "draining", "cleanup_pending"
    ]);
    // ---- every marker carries exactly the six frozen fields --------------
    for (const marker of chain.markerWrites) {
      expect(Object.keys(marker).sort()).toEqual([...RESTART_MARKER_FIELDS].sort());
    }
    // ---- and never once after a terminal ---------------------------------
    expect(observed).toHaveLength(23);
  });
});

// ===========================================================================
// R3-2 — start ordering
// ===========================================================================

describe("R3-2: nothing leaves Background before Runtime `started`", () => {
  it("resolves no streamId, opens no Offscreen document and accepts no chunk before `started`", async () => {
    const chain = buildChain();
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    await chain.router.handle(await grantMessage("1"), chain.sender);
    const starting = chain.controller.startArmed(TAB);
    await flush();

    const socket = chain.sockets[0];
    socket.fireOpen();
    await flush();

    expect(socket.jsonSends[0].type).toBe(PORT_MESSAGE.START);
    // The Offscreen document is PREWARMED by `prepare`, so it and its Port
    // already exist — that is a document, not a producer start. What the
    // frozen rule forbids before `started` is everything below.
    expect(chain.streamIdCalls).toHaveLength(0);
    expect(chain.createdDocuments).toHaveLength(1);
    expect(chain.document(0).received).toHaveLength(0);
    expect(chain.port.producerReady).toBe(false);
    expect(chain.port.credit).toBe(0);
    expect(chain.transport.state).toBe("connecting");
    // A producer chunk that somehow arrived early is refused by the owner.
    expect(chain.transport.offerChunkMessage(chunkMessage(chain.sessionIds[0], 0)))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PROTOCOL_INVALID" });

    socket.fireMessage({ type: "started" });
    await flush();
    expect(await starting).toMatchObject({ ok: true, state: "capturing" });
    // Exactly one streamId resolution and exactly one producer `start`.
    expect(chain.streamIdCalls).toEqual([TAB.id]);
    expect(chain.createdDocuments).toHaveLength(1);
    expect(chain.document(0).of(PORT_MESSAGE.START)).toHaveLength(1);
  });
});

// ===========================================================================
// R3-1 — a single orchestration owner
// ===========================================================================

describe("R3-1: one grant has exactly one capture owner", () => {
  it("refuses a duplicate start while the first is still awaiting Runtime", async () => {
    const chain = buildChain();
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    const grant = await grantMessage("1");
    await chain.router.handle(grant, chain.sender);

    const starting = chain.controller.startArmed(TAB);
    await flush();
    // A second action click / command / tab event mid-start.
    expect(await chain.controller.startArmed(TAB))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
    expect(await chain.router.handle(await grantMessage("2"), chain.sender))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
    expect(await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });

    const socket = chain.sockets[0];
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await flush();
    await starting;

    // ONE Runtime socket, ONE Offscreen document, ONE Port — for one grant.
    expect(chain.sockets).toHaveLength(1);
    expect(chain.createdDocuments).toHaveLength(1);
    expect(chain.document(0).of(PORT_MESSAGE.START)).toHaveLength(1);
    // And the capture is still refused once it is live.
    expect(await chain.router.handle(await grantMessage("3"), chain.sender))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
  });
});

// ===========================================================================
// R3-2 / R3-4 — every start failure releases what the capture owns
// ===========================================================================

describe("R3-2/R3-4: every start failure point closes what this capture owns", () => {
  async function arm(chain: Chain, suffix: string) {
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    await chain.router.handle(await grantMessage(suffix), chain.sender);
  }

  it("Runtime start failure closes the socket, the Port and the document", async () => {
    const chain = buildChain();
    await arm(chain, "1");
    const starting = chain.controller.startArmed(TAB);
    await flush();
    const socket = chain.sockets[0];
    socket.fireOpen();
    socket.fireMessage({ type: "failed", failureCode: "V3_MEDIA_CAPTURE_TICKET_EXPIRED" });
    expect(await starting).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_TICKET_EXPIRED" });
    expect(socket.readyState).toBe(3);
    expect(chain.streamIdCalls).toHaveLength(0);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.markerClears).toEqual([chain.sessionIds[0]]);
    expect(chain.failures).toEqual(["V3_MEDIA_CAPTURE_TICKET_EXPIRED"]);
    expect(chain.port.connected).toBe(false);
  });

  it("streamId failure closes the socket, the Port and the document", async () => {
    const chain = buildChain();
    chain.setStreamId("");
    await arm(chain, "1");
    const starting = chain.controller.startArmed(TAB);
    await flush();
    const socket = chain.sockets[0];
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    expect(await starting).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_START_FAILED" });
    expect(socket.readyState).toBe(3);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.markerClears).toEqual([chain.sessionIds[0]]);
    // The producer was told exactly once, over the frozen Port.
    expect(chain.port.connected).toBe(false);
  });

  it("a refused Port fails closed and still closes the document", async () => {
    const chain = buildChain();
    chain.refuseNextPort(true);
    await arm(chain, "1");
    const starting = chain.controller.startArmed(TAB);
    await flush();
    const socket = chain.sockets[0];
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    const response = await starting;
    expect(response.ok).toBe(false);
    expect(socket.readyState).toBe(3);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.markerClears).toEqual([chain.sessionIds[0]]);
  });

  it("a missing permission creates no socket at all but still closes the document", async () => {
    const chain = buildChain();
    chain.setPermission(false);
    await arm(chain, "1");
    expect(await chain.controller.startArmed(TAB))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PERMISSION_REQUIRED" });
    expect(chain.sockets).toHaveLength(0);
    expect(chain.streamIdCalls).toHaveLength(0);
    expect(chain.closeCount.value).toBe(1);
  });

  it("an invalid tab binding creates no socket and closes the prewarmed document", async () => {
    const chain = buildChain();
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    await chain.router.handle(await grantMessage("1"), chain.sender);
    expect(await chain.controller.startArmed({ id: 9, active: true, url: "https://example.com/" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_TAB_INVALID" });
    expect(chain.sockets).toHaveLength(0);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.diagnostics.at(-1)).toMatchObject({ stage: "tab_validation" });
  });
});

// ===========================================================================
// R3-3 — the two-phase stop
// ===========================================================================

describe("R3-3: quiesce -> drain -> stopped -> finalize", () => {
  it("freezes the reason before quiesce and never rewrites it as completed", async () => {
    for (const reason of ["cancelled", "navigation", "tab_closed", "consent_revoked"] as const) {
      const chain = buildChain();
      const { socket, doc, sessionId } = await beginCapture(chain, "1");
      handshake(chain, doc, sessionId);
      const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason });
      await flush();
      doc.emit({
        type: PORT_MESSAGE.QUIESCED,
        captureSessionId: sessionId,
        queuedChunks: 0,
        outstandingRawBytes: 0,
        sourceStopped: true
      });
      doc.emit({
        type: PORT_MESSAGE.STOPPED,
        captureSessionId: sessionId,
        queuedChunks: 0,
        creditConsumed: 0,
        tracksStopped: true,
        contextClosed: true
      });
      await flush();
      expect(socket.jsonSends.at(-1)).toEqual({ type: "stop", reason });
      socket.fireMessage({ type: "cancelled" });
      expect(await stopping).toEqual({ ok: true, state: "stopped" });
      expect(chain.closeCount.value).toBe(1);
    }
  });

  it("does not finalize while a chunk is still in flight", async () => {
    const chain = buildChain();
    const { socket, doc, sessionId } = await beginCapture(chain, "1");
    handshake(chain, doc, sessionId);
    doc.emit(chunkMessage(sessionId, 0));
    const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" });
    await flush();
    doc.emit({
      type: PORT_MESSAGE.QUIESCED, captureSessionId: sessionId,
      queuedChunks: 0, outstandingRawBytes: 2, sourceStopped: true
    });
    doc.emit({
      type: PORT_MESSAGE.STOPPED, captureSessionId: sessionId,
      queuedChunks: 0, creditConsumed: 0, tracksStopped: true, contextClosed: true
    });
    await flush();
    // The producer says `stopped`, but one chunk is still with Runtime.
    expect(socket.jsonSends.map((m) => m.type)).toEqual(["start"]);
    expect(chain.finalizeBacklog).toHaveLength(0);

    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    await flush();
    expect(socket.jsonSends.at(-1)).toEqual({ type: "stop", reason: "completed" });
    expect(chain.finalizeBacklog).toHaveLength(1);
    expect(chain.finalizeBacklog[0]).toMatchObject({ chunks: 0, rawBytes: 0, inFlight: 0 });
    socket.fireMessage({ type: "completed", transcript: { taskId: TASK_ID, state: "queued" } });
    await stopping;
  });

  it("refuses a chunk after the Runtime stop without polluting sequence or counters", async () => {
    const chain = buildChain();
    const { socket, doc, sessionId } = await beginCapture(chain, "1");
    handshake(chain, doc, sessionId);
    doc.emit(chunkMessage(sessionId, 0));
    const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" });
    await flush();
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    doc.emit({
      type: PORT_MESSAGE.QUIESCED, captureSessionId: sessionId,
      queuedChunks: 0, outstandingRawBytes: 0, sourceStopped: true
    });
    doc.emit({
      type: PORT_MESSAGE.STOPPED, captureSessionId: sessionId,
      queuedChunks: 0, creditConsumed: 0, tracksStopped: true, contextClosed: true
    });
    await flush();
    expect(chain.transport.state).toBe("cleanup_pending");

    const before = { ...chain.transport.backlog, totalRawBytes: chain.transport.totalRawBytes };
    doc.emit(chunkMessage(sessionId, 1));
    expect(chain.failures).toContain("V3_MEDIA_CAPTURE_PROTOCOL_INVALID");
    // Rejected BEFORE enqueue: the queue, the sequence and the byte counter
    // are exactly what they were.
    expect({ ...chain.transport.backlog, totalRawBytes: chain.transport.totalRawBytes }).toEqual(before);
    // A producer that contradicts its own `stopped` breaks the drain
    // guarantee, so the capture fails closed with the frozen code and the
    // marker is still cleared exactly once.
    expect(await stopping).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PROTOCOL_INVALID" });
    expect(chain.markerClears).toEqual([sessionId]);
    expect(chain.transport.state).toBe("aborted");
    expect(chain.closeCount.value).toBe(1);
  });

  it("terminates a stop whose producer never reports `stopped`", async () => {
    const chain = buildChain();
    const { socket } = await beginCapture(chain, "1");
    const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" });
    await flush();
    expect(socket.jsonSends.map((m) => m.type)).toEqual(["start"]);
    // The producer is gone: the frozen cleanup bound must still close the
    // capture, or the Offscreen document would never be released.
    chain.clock.advance(RELAY_V10.cleanupTimeoutMs + 1);
    expect(await stopping).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE" });
    expect(chain.transport.state).toBe("aborted");
    expect(socket.readyState).toBe(3);
    expect(chain.markerClears).toEqual([chain.sessionIds[0]]);
    expect(chain.closeCount.value).toBe(1);
  });

  it("is idempotent for a repeated stop and for late events", async () => {
    const chain = buildChain();
    const { socket, doc, sessionId } = await beginCapture(chain, "1");
    handshake(chain, doc, sessionId);
    const stopping = chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" });
    await flush();
    doc.emit({
      type: PORT_MESSAGE.QUIESCED, captureSessionId: sessionId,
      queuedChunks: 0, outstandingRawBytes: 0, sourceStopped: true
    });
    doc.emit({
      type: PORT_MESSAGE.STOPPED, captureSessionId: sessionId,
      queuedChunks: 0, creditConsumed: 0, tracksStopped: true, contextClosed: true
    });
    socket.fireMessage({ type: "completed", transcript: { taskId: TASK_ID, state: "queued" } });
    await stopping;

    const markerWrites = chain.markerWrites.length;
    expect(await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: true, state: "stopped" });
    await flush();
    // A repeated stop, a late close, a late frame and a late chunk change
    // nothing: no new marker, no new failure, no new marker clear.
    socket.fireClose("late");
    socket.fireMessage({ type: "completed", transcript: { taskId: TASK_ID, state: "queued" } });
    doc.emit(chunkMessage(sessionId, 9));
    await flush();
    expect(chain.markerWrites).toHaveLength(markerWrites);
    expect(chain.markerClears).toEqual([sessionId]);
    expect(chain.failures).toEqual([]);
    expect(chain.transport.state).toBe("finalized");
  });
});

// ===========================================================================
// R3-4 — every idle / error path closes the Offscreen document
// ===========================================================================

describe("R3-4: idle and error both return the Controller to an explainable state", () => {
  it("closes the Offscreen document on an idle stop", async () => {
    const chain = buildChain();
    await chain.router.handle({ type: "navia.mediaCapture", command: "prepare" }, chain.sender);
    expect(await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "timeout" }))
      .toEqual({ ok: true, state: "stopped" });
    expect(chain.closeCount.value).toBe(1);
    expect(chain.liveDocument()).toBeUndefined();
    expect(chain.controller.status()).toEqual({ ok: true, state: "stopped" });
  });

  it("closes the Offscreen document on a producer capture_error", async () => {
    const chain = buildChain();
    const { doc, sessionId } = await beginCapture(chain, "1");
    handshake(chain, doc, sessionId);
    doc.emit({
      type: PORT_MESSAGE.CAPTURE_ERROR,
      captureSessionId: sessionId,
      failureCode: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
    });
    await flush();
    const terminal = await chain.transport.awaitTerminal();
    expect(terminal).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID" });
    // The producer was aborted exactly once and the runtime capture is over.
    expect(doc.of(PORT_MESSAGE.ABORT)).toHaveLength(1);
    expect(chain.transport.state).toBe("aborted");
    expect(chain.markerClears).toEqual([sessionId]);
    await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "failed" });
    expect(chain.closeCount.value).toBe(1);
  });
});

// ===========================================================================
// R3-4 — two-round capture isolation
// ===========================================================================

describe("R3-4: two captures are fully isolated", () => {
  it("round two gets a new session, a new Port and a new document, and refuses round one's events", async () => {
    const chain = buildChain();

    // ---- round one: a producer `capture_error` fails closed, abort ONCE ---
    const first = await beginCapture(chain, "1");
    handshake(chain, first.doc, first.sessionId);
    expect(first.doc.of(PORT_MESSAGE.ABORT)).toHaveLength(0);
    first.doc.emit({
      type: PORT_MESSAGE.CAPTURE_ERROR, captureSessionId: first.sessionId,
      failureCode: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
    });
    await flush();
    expect(await chain.transport.awaitTerminal())
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID" });
    expect(first.doc.of(PORT_MESSAGE.ABORT)).toHaveLength(1);
    expect(chain.transport.captureSessionId).toBe(first.sessionId);
    // A LATE stop answers the terminal that already settled instead of
    // waiting for a second one, so the document is still released.
    await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "failed" });
    expect(first.doc.live).toBe(false);
    expect(chain.closeCount.value).toBe(1);
    expect(chain.markerClears).toEqual([first.sessionId]);

    // ---- round two: a NEW captureSessionId, a NEW Port, a NEW document ----
    const second = await beginCapture(chain, "2");
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(SESSION_ID_PATTERN.test(second.sessionId)).toBe(true);
    expect(second.doc.documentId).not.toBe(first.doc.documentId);
    expect(second.doc).not.toBe(first.doc);
    expect(chain.sockets).toHaveLength(2);
    expect(chain.createdDocuments).toHaveLength(2);
    expect(chain.closeCount.value).toBe(1);
    // Every marker round one published carries round one's session, and the
    // first marker of round two carries round two's — a terminal phase never
    // republishes, so round one contributes only its three live phases.
    const markerSessions = chain.markerWrites.map((marker) => marker.captureSessionId);
    const boundary = markerSessions.indexOf(second.sessionId);
    expect(boundary).toBeGreaterThan(0);
    expect(markerSessions.slice(0, boundary).every((id) => id === first.sessionId)).toBe(true);
    expect(markerSessions.slice(boundary).every((id) => id === second.sessionId)).toBe(true);

    // ---- round one's stale events cannot enter round two ------------------
    const backlogBefore = { ...chain.transport.backlog, totalRawBytes: chain.transport.totalRawBytes };
    const stale = [
      { type: PORT_MESSAGE.READY, captureSessionId: first.sessionId },
      chunkMessage(first.sessionId, 0),
      {
        type: PORT_MESSAGE.QUIESCED, captureSessionId: first.sessionId,
        queuedChunks: 0, outstandingRawBytes: 0, sourceStopped: true
      },
      {
        type: PORT_MESSAGE.STOPPED, captureSessionId: first.sessionId,
        queuedChunks: 0, creditConsumed: 0, tracksStopped: true, contextClosed: true
      }
    ];
    for (const message of stale) second.doc.emit(message as OffscreenToBackgroundMessage);

    // Each one is refused as a foreign session. The Port reports each
    // refusal; the owner records EXACTLY ONE normalized failure for the
    // capture, so a burst of stale events cannot rewrite the terminal twice.
    expect(chain.failures.filter((code) => code === "V3_MEDIA_CAPTURE_BINDING_MISMATCH")).toHaveLength(5);
    // And not one of them touched the queue, the sequence or the counters.
    expect({ ...chain.transport.backlog, totalRawBytes: chain.transport.totalRawBytes }).toEqual(backlogBefore);
    // The stale `stopped` never marked round two as drained or finalized it.
    expect(chain.transport.state).toBe("aborted");
    expect(second.doc.of(PORT_MESSAGE.CHUNK_CREDIT)).toHaveLength(0);
    expect(chain.sockets[1].jsonSends.map((m) => m.type)).toEqual([PORT_MESSAGE.START]);

    // ---- round two aborted exactly once, and only once -------------------
    expect(second.doc.of(PORT_MESSAGE.ABORT)).toHaveLength(1);
    expect(first.doc.of(PORT_MESSAGE.ABORT)).toHaveLength(1);
    expect(chain.markerClears).toEqual([first.sessionId, second.sessionId]);
    await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "failed" });
    expect(chain.closeCount.value).toBe(2);
    expect(chain.liveDocument()).toBeUndefined();
  });

  it("a stale Port from round one cannot replace round two's Port", async () => {
    const chain = buildChain();
    const first = await beginCapture(chain, "1");
    handshake(chain, first.doc, first.sessionId);
    first.doc.emit({
      type: PORT_MESSAGE.CAPTURE_ERROR, captureSessionId: first.sessionId,
      failureCode: "V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"
    });
    await flush();
    await chain.controller.stop({ type: "navia.mediaCapture", command: "stop", reason: "failed" });
    expect(first.doc.live).toBe(false);

    const second = await beginCapture(chain, "2");
    expect(chain.port.connected).toBe(true);
    expect(chain.port.boundDocumentId).toBe(second.doc.documentId);
    // Exactly one producer at a time: round one's Port is refused and cut.
    expect(await chain.port.accept(first.doc.backgroundSide))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
    expect(first.doc.backgroundDisconnected).toBe(true);
    // ...and round two's producer still holds the single credit.
    handshake(chain, second.doc, second.sessionId);
    expect(chain.port.credit).toBe(1);
  });
});
