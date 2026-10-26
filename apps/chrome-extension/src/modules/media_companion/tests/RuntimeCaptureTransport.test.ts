import { describe, expect, it } from "vitest";
import {
  RuntimeCaptureTransport,
  type RuntimeSocketLike,
  type TransportStartBinding
} from "../capture/RuntimeCaptureTransport";
import { PORT_MESSAGE, RELAY_FAILURE_CODES, RELAY_V10, newCaptureSessionId } from "../capture/relayContracts";
import { encodeChunkBase64 } from "../capture/audioChunk";

/**
 * WP0 R1 — the Background Runtime transport. Drives the real transport
 * against a fake socket and a controllable clock/timer pair, proving:
 * started-gating, session binding, sequence discipline, the single-credit
 * window, pre-enqueue backpressure, the atomic stop boundary, ACK timeout,
 * disconnect classification, and the frozen restart marker lifecycle.
 */

class FakeSocket implements RuntimeSocketLike {
  binaryType = "";
  readyState = 1;
  sent: Array<string | ArrayBuffer> = [];
  closed: { code?: number; reason?: string } | null = null;
  #listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void) {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }
  #emit(type: string, event: unknown) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close(code?: number, reason?: string) {
    this.closed = { code, reason };
    this.readyState = 3;
  }
  fireOpen() {
    this.#emit("open", {});
  }
  fireMessage(value: Record<string, unknown>) {
    this.#emit("message", { data: JSON.stringify(value) });
  }
  fireClose(reason = "") {
    this.readyState = 3;
    this.#emit("close", { reason });
  }
  get jsonSends(): Record<string, unknown>[] {
    return this.sent
      .filter((item): item is string => typeof item === "string")
      .map((item) => JSON.parse(item) as Record<string, unknown>);
  }
  get binarySends(): ArrayBuffer[] {
    return this.sent.filter((item): item is ArrayBuffer => item instanceof ArrayBuffer);
  }
}

/** Controllable clock + timer queue so timeouts are deterministic. */
class FakeClock {
  now = 1_700_000_000_000;
  #timers = new Map<number, { at: number; handler: () => void }>();
  #next = 1;
  readonly set = (handler: () => void, ms: number): unknown => {
    const id = this.#next++;
    this.#timers.set(id, { at: this.now + ms, handler });
    return id;
  };
  readonly clear = (handle: unknown): void => {
    this.#timers.delete(handle as number);
  };
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

type RelayMarker = {
  schemaVersion: string;
  captureSessionId: string;
  taskId: string;
  startedAt: string;
  phase: string;
  expiresAt: string;
};

function makeBinding(): TransportStartBinding {
  return {
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
}

function build() {
  const socket = new FakeSocket();
  const clock = new FakeClock();
  const markers: RelayMarker[] = [];
  const cleared: string[] = [];
  const failures: string[] = [];
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
    now: () => clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    onMarker: (marker) => markers.push(marker as RelayMarker),
    clearMarker: (id) => cleared.push(id),
    reportFailure: (code) => failures.push(code)
  });
  return { socket, clock, transport, markers, cleared, failures };
}

async function start(transport: RuntimeCaptureTransport, socket: FakeSocket) {
  const promise = transport.start(makeBinding());
  socket.fireOpen();
  socket.fireMessage({ type: "started" });
  return promise;
}

function chunk(transport: RuntimeCaptureTransport, sequence: number, rawByteLength = 320) {
  const bytes = new Uint8Array(rawByteLength);
  for (let index = 0; index < rawByteLength; index += 1) bytes[index] = index % 251;
  return {
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: transport.captureSessionId,
    sequence,
    rawByteLength,
    pcmBase64: encodeChunkBase64(bytes)
  };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ============================================================================

describe("started gating and session identity", () => {
  it("sends the exact Runtime start binding including surface", async () => {
    const { socket, transport } = build();
    const binding = makeBinding();
    const promise = transport.start(binding);
    socket.fireOpen();

    expect(socket.jsonSends[0]).toEqual({
      type: PORT_MESSAGE.START,
      ...binding,
      sampleRateHz: 16_000,
      channels: 1,
      sampleWidthBytes: 2
    });

    socket.fireMessage({ type: "started" });
    await promise;
  });

  it("rejects chunks before Runtime `started`", async () => {
    const { socket, transport } = build();
    const promise = transport.start(makeBinding());
    socket.fireOpen();
    await settle();
    expect(transport.state).toBe("connecting");
    expect(transport.offerChunkMessage(chunk(transport, 0)))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID });
    socket.fireMessage({ type: "started" });
    await promise;
  });

  it("generates a frozen captureSessionId per capture", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    expect(transport.captureSessionId).toMatch(/^cap_[A-Za-z0-9_-]{32}$/);
  });

  it("rejects a chunk bound to a different captureSessionId", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    const foreign = { ...chunk(transport, 0), captureSessionId: newCaptureSessionId() };
    expect(transport.offerChunkMessage(foreign))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.BINDING_MISMATCH });
  });

  it("normalizes an unknown Runtime failure string", async () => {
    const { socket, transport } = build();
    const promise = transport.start(makeBinding());
    socket.fireOpen();
    await settle();
    socket.fireMessage({ type: "failed", failureCode: "/home/user/secret" });
    await settle();
    expect(await promise).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED });
  });

  it("refuses a second concurrent start", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    expect(await transport.start(makeBinding()))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.ALREADY_ACTIVE });
  });
});

describe("chunk validation against the frozen schema bounds", () => {
  it("accepts strictly increasing sequences from 0", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    for (let sequence = 0; sequence < 3; sequence += 1) {
      expect(transport.offerChunkMessage(chunk(transport, sequence))).toEqual({ ok: true });
      socket.fireMessage({ type: "chunkAccepted", sequence });
    }
  });

  it("rejects duplicate, out-of-order, negative and non-integer sequences", async () => {
    for (const bad of [1, 5, -1, 0.5]) {
      const { socket, transport } = build();
      await start(transport, socket);
      expect(transport.offerChunkMessage(chunk(transport, bad)))
        .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_SEQUENCE_INVALID });
    }
  });

  it("rejects a raw length below the frozen minimum of 2", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    const message = { ...chunk(transport, 0), rawByteLength: 0, pcmBase64: "" };
    expect(transport.offerChunkMessage(message))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.EMPTY });
  });

  it("rejects a raw length above the frozen maximum of 49152", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    const bytes = new Uint8Array(RELAY_V10.maxRawChunkBytes + 2);
    expect(transport.offerChunkMessage({
      type: PORT_MESSAGE.CHUNK,
      captureSessionId: transport.captureSessionId,
      sequence: 0,
      rawByteLength: bytes.byteLength,
      pcmBase64: encodeChunkBase64(bytes)
    })).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.BYTE_LIMIT });
  });

  it("rejects an odd sample width", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    const bytes = new Uint8Array(3);
    expect(transport.offerChunkMessage({
      type: PORT_MESSAGE.CHUNK,
      captureSessionId: transport.captureSessionId,
      sequence: 0,
      rawByteLength: 3,
      pcmBase64: encodeChunkBase64(bytes)
    })).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID });
  });

  it("rejects invalid Base64 and a declared-length mismatch", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    expect(transport.offerChunkMessage({
      type: PORT_MESSAGE.CHUNK, captureSessionId: transport.captureSessionId,
      sequence: 0, rawByteLength: 4, pcmBase64: "!!!!"
    })).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID });
    const bytes = new Uint8Array(8);
    expect(transport.offerChunkMessage({
      type: PORT_MESSAGE.CHUNK, captureSessionId: transport.captureSessionId,
      sequence: 0, rawByteLength: 16, pcmBase64: encodeChunkBase64(bytes)
    })).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.CHUNK_INVALID });
  });
});

describe("single-credit window and pre-enqueue backpressure", () => {
  it("keeps at most one chunk in flight before a Runtime ACK", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    transport.offerChunkMessage(chunk(transport, 1));
    transport.offerChunkMessage(chunk(transport, 2));
    expect(socket.binarySends).toHaveLength(1);
    expect(transport.inFlight).toBe(1);
  });

  it("returns the credit only after a Runtime chunkAccepted", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    transport.offerChunkMessage(chunk(transport, 1));
    expect(socket.binarySends).toHaveLength(1);
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    expect(socket.binarySends).toHaveLength(2);
    expect(transport.acknowledgedSequence).toBe(0);
  });

  it("rejects an ACK whose sequence is not the in-flight one", async () => {
    const { socket, transport, failures } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    transport.offerChunkMessage(chunk(transport, 1));
    socket.fireMessage({ type: "chunkAccepted", sequence: 1 });
    expect(failures).toContain(RELAY_FAILURE_CODES.CHUNK_SEQUENCE_INVALID);
  });

  it("aborts BEFORE enqueue when the outstanding chunk cap is exceeded", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    let last: unknown = null;
    for (let sequence = 0; sequence < RELAY_V10.maxOutstandingChunks + 1; sequence += 1) {
      last = transport.offerChunkMessage(chunk(transport, sequence));
    }
    expect(last).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.BACKPRESSURE });
  });

  it("aborts BEFORE enqueue when the outstanding byte cap is exceeded", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    let last: unknown = null;
    const total = Math.ceil(RELAY_V10.maxOutstandingRawBytes / RELAY_V10.maxRawChunkBytes) + 1;
    for (let sequence = 0; sequence < total; sequence += 1) {
      last = transport.offerChunkMessage(chunk(transport, sequence, RELAY_V10.maxRawChunkBytes));
    }
    expect(last).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.BACKPRESSURE });
  });

  it("fails closed on an ACK timeout while a chunk is in flight", async () => {
    const { socket, transport, clock, failures } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    expect(socket.binarySends).toHaveLength(1);
    clock.advance(RELAY_V10.chunkAckTimeoutMs + 1);
    expect(failures.length).toBeGreaterThan(0);
    expect(transport.state).toBe("aborted");
  });
});

describe("atomic stop boundary", () => {
  it("freezes the reason before quiesce and never defaults a producer stop to completed", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    transport.beginStop("navigation");
    expect(transport.stopRequested).toBe(true);
    expect(transport.stopReason).toBe("navigation");
    // Once the reason is frozen, a producer-reported `stopped` may complete
    // the drain -- but the Runtime stop MUST carry the FROZEN reason, never
    // the `completed` default.
    transport.markOffscreenStopped();
    await settle();
    const stopMessage = socket.jsonSends.find((item) => item.type === "stop");
    expect(stopMessage).toBeDefined();
    expect(stopMessage?.reason).toBe("navigation");
    expect(stopMessage?.reason).not.toBe("completed");
    const terminal = transport.awaitTerminal();
    socket.fireMessage({ type: "cancelled" });
    expect((await terminal).ok).toBe(true);
  });

  it("refuses to finalize when no stop reason was ever requested", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    // A producer that reports `stopped` on its own must NOT finalize.
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    expect(socket.jsonSends.some((item) => item.type === "stop")).toBe(false);
  });

  it("keeps the first frozen reason when stop is called twice", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    transport.beginStop("tab_closed");
    transport.beginStop("completed");
    expect(transport.stopReason).toBe("tab_closed");
  });

  it("holds the Runtime stop until the backlog has drained", async () => {
    const { socket, transport } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    const terminal = transport.stop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    // Still in flight: no Runtime stop yet.
    expect(socket.jsonSends.some((item) => item.type === "stop")).toBe(false);
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    await settle();
    expect(socket.jsonSends.some((item) => item.type === "stop")).toBe(true);
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: "media_task_" + "a".repeat(32), state: "queued" }
    });
    const result = await terminal;
    expect(result.ok).toBe(true);
    expect(result.transcript).toBeDefined();
  });

  it("accepts the post-quiesce drain but rejects chunks after `stopped`", async () => {
    // R3: `quiesce` means "produce no NEW audio", not "discard the buffer".
    // The frozen 24-step positive trace steps 15-16 flush one already-queued
    // chunk while the state is `draining`, and the drain gate may not
    // finalize until backlog and in-flight are both zero.
    const draining = build();
    await start(draining.transport, draining.socket);
    draining.transport.beginStop("cancelled");
    draining.transport.markQuiesced();
    expect(draining.transport.state).toBe("draining");
    expect(draining.transport.offerChunkMessage(chunk(draining.transport, 0)))
      .toEqual({ ok: true });

    // Past `stopped` the Runtime `stop` is committed: a straggler chunk is
    // refused and must not touch the queue, sequence or byte counters.
    const stopped = build();
    await start(stopped.transport, stopped.socket);
    const terminal = stopped.transport.stop("cancelled");
    stopped.transport.markQuiesced();
    stopped.transport.markOffscreenStopped();
    await settle();
    expect(stopped.transport.state).toBe("cleanup_pending");
    const before = { ...stopped.transport.backlog, totalRawBytes: stopped.transport.totalRawBytes };
    expect(stopped.transport.offerChunkMessage(chunk(stopped.transport, 0)))
      .toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.PROTOCOL_INVALID });
    expect({ ...stopped.transport.backlog, totalRawBytes: stopped.transport.totalRawBytes }).toEqual(before);
    stopped.socket.fireMessage({ type: "cancelled" });
    await terminal;
  });

  it("maps a Runtime finalize failure and a transcript-less completion", async () => {
    const first = build();
    await start(first.transport, first.socket);
    const a = first.transport.stop("completed");
    first.transport.markQuiesced();
    first.transport.markOffscreenStopped();
    await settle();
    first.socket.fireMessage({ type: "failed", failureCode: RELAY_FAILURE_CODES.FINALIZE_FAILED });
    expect(await a).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.FINALIZE_FAILED });

    const second = build();
    await start(second.transport, second.socket);
    const b = second.transport.stop("completed");
    second.transport.markQuiesced();
    second.transport.markOffscreenStopped();
    await settle();
    second.socket.fireMessage({ type: "completed" });
    expect(await b).toEqual({ ok: false, failureCode: RELAY_FAILURE_CODES.FINALIZE_FAILED });
  });
});

describe("disconnect classification", () => {
  it("does not abort an already finalized transport on a normal disconnect", async () => {
    const { socket, transport, failures } = build();
    await start(transport, socket);
    const terminal = transport.stop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: "media_task_" + "a".repeat(32), state: "queued" }
    });
    await terminal;
    failures.length = 0;
    const outcome = transport.handleProducerDisconnect("completed");
    expect(outcome.aborted).toBe(false);
    expect(failures).toEqual([]);
  });

  it("fails closed on an abnormal producer disconnect", async () => {
    const { socket, transport, failures } = build();
    await start(transport, socket);
    const outcome = transport.handleProducerDisconnect("tab_closed");
    expect(outcome.aborted).toBe(true);
    expect(failures).toContain(RELAY_FAILURE_CODES.PORT_DISCONNECTED);
  });

  it("preserves a relay failure code carried by the Runtime close reason", async () => {
    const { socket, transport, failures } = build();
    await start(transport, socket);
    socket.fireClose(RELAY_FAILURE_CODES.CLEANUP_INCOMPLETE);
    expect(failures).toContain(RELAY_FAILURE_CODES.CLEANUP_INCOMPLETE);
  });

  it("maps a bare Runtime close to RUNTIME_DISCONNECTED", async () => {
    const { socket, transport, failures } = build();
    await start(transport, socket);
    socket.fireClose("");
    expect(failures).toContain(RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED);
  });
});

describe("frozen restart marker lifecycle", () => {
  it("publishes the frozen phases and never refreshes expiresAt", async () => {
    const { socket, transport, markers } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    transport.beginStop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    const expiries = new Set(markers.map((marker) => marker.expiresAt));
    expect(expiries.size).toBe(1);
    const phases = markers.map((marker) => marker.phase);
    expect(phases).toContain("connecting");
    expect(phases).toContain("runtime_started");
    expect(phases).toContain("capturing");
    expect(phases).toContain("draining");
    expect(phases).toContain("cleanup_pending");
    const [marker] = markers;
    expect(marker.schemaVersion).toBe("v3-media-capture-restart-marker/v10");
    const startedAt = Date.parse(marker.startedAt);
    const expiresAt = Date.parse(marker.expiresAt);
    expect(expiresAt - startedAt).toBe(RELAY_V10.markerTtlMs);
  });

  it("carries only the six frozen fields and no secrets", async () => {
    const { socket, transport, markers } = build();
    await start(transport, socket);
    transport.offerChunkMessage(chunk(transport, 0));
    for (const marker of markers) {
      expect(Object.keys(marker).sort()).toEqual([
        "captureSessionId", "expiresAt", "phase", "schemaVersion", "startedAt", "taskId"
      ]);
      const serialized = JSON.stringify(marker);
      for (const forbidden of ["ticket", "grantId", "streamId", "pcm", "SESSDATA", "/tmp/"]) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it("clears the marker once the capture reaches a terminal", async () => {
    const { socket, transport, cleared } = build();
    await start(transport, socket);
    const terminal = transport.stop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: "media_task_" + "a".repeat(32), state: "queued" }
    });
    await terminal;
    expect(cleared).toEqual([transport.captureSessionId]);
  });
});
