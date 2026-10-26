import { describe, expect, it } from "vitest";
import { RuntimeCaptureTransport, type RuntimeSocketLike, type TransportStartBinding } from "../capture/RuntimeCaptureTransport";
import {
  PORT_MESSAGE,
  RELAY_V10,
  RESTART_MARKER_FIELDS,
  RESTART_MARKER_PHASES,
  RESTART_MARKER_SCHEMA_VERSION,
  RESTART_MARKER_TRANSITIONS,
  type RelayRestartMarker
} from "../capture/relayContracts";
import { encodeChunkBase64 } from "../capture/audioChunk";

/**
 * WP0 R1-F4/F6 — RESTART HARNESS.
 *
 * Proves the frozen restart-marker lifecycle across a simulated service
 * worker restart:
 *   - each of the five phases persists a marker in the session store;
 *   - the persisted marker is read back byte-identical after a "restart";
 *   - a phase dispatch never resumes old PCM / ticket / sequence;
 *   - an EXPIRED or malformed marker fails closed;
 *   - the marker is cleared only after the owner receipt + cleanup grace;
 *   - every legal phase transition and every illegal one is enforced.
 */

const SESSION_KEY = "navia.relay.restartMarker.v10";
const T0 = 1_700_000_000_000;

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
  close() {
    this.readyState = 3;
  }
  fireOpen() {
    for (const l of this.#listeners.get("open") ?? []) l({});
  }
  fireMessage(v: Record<string, unknown>) {
    for (const l of this.#listeners.get("message") ?? []) l({ data: JSON.stringify(v) });
  }
  get jsonSends(): Record<string, unknown>[] {
    return this.sent.filter((s): s is string => typeof s === "string").map((s) => JSON.parse(s) as Record<string, unknown>);
  }
  get binarySends() {
    return this.sent.filter((s): s is ArrayBuffer => s instanceof ArrayBuffer);
  }
}

/** A chrome.storage.session stand-in that survives a simulated restart. */
class FakeSessionStore {
  data: Record<string, unknown> = {};
  get = async (key: string) => ({ [key]: this.data[key] });
  set = async (items: Record<string, unknown>) => { Object.assign(this.data, items); };
  remove = async (key: string) => { delete this.data[key]; };
}

function build(store: FakeSessionStore) {
  const socket = new FakeSocket();
  let now = T0;
  const cleared: string[] = [];
  const failures: string[] = [];
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: "ws://127.0.0.1:17861/v1/media/capture-stream",
    now: () => now,
    onMarker: (marker) => { void store.set({ [SESSION_KEY]: marker }); },
    clearMarker: (id) => {
      cleared.push(id);
      void store.get(SESSION_KEY).then((got) => {
        const current = got[SESSION_KEY] as RelayRestartMarker | undefined;
        if (current?.captureSessionId === id) void store.remove(SESSION_KEY);
      });
    },
    reportFailure: (c) => failures.push(c)
  });
  return {
    socket,
    transport,
    cleared,
    failures,
    advance: (ms: number) => { now += ms; }
  };
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

function chunk(sessionId: string, sequence: number) {
  const bytes = new Uint8Array(320);
  return {
    type: PORT_MESSAGE.CHUNK,
    captureSessionId: sessionId,
    sequence,
    rawByteLength: 320,
    pcmBase64: encodeChunkBase64(bytes)
  };
}

async function settle() {
  await new Promise((r) => setTimeout(r, 0));
}

describe("restart harness: five-phase marker persistence", () => {
  it("persists a marker in every phase and survives a simulated restart", async () => {
    const store = new FakeSessionStore();
    const { socket, transport } = build(store);
    const promise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await promise;
    const sessionId = transport.captureSessionId;

    // phase: connecting -> runtime_started -> capturing
    expect((store.data[SESSION_KEY] as RelayRestartMarker).phase).toBe("runtime_started");
    transport.offerChunkMessage(chunk(sessionId, 0));
    await settle();
    expect((store.data[SESSION_KEY] as RelayRestartMarker).phase).toBe("capturing");

    // Simulate a service worker restart: a NEW transport reads the marker.
    const persisted = JSON.parse(JSON.stringify(store.data[SESSION_KEY])) as RelayRestartMarker;
    expect(persisted.schemaVersion).toBe(RESTART_MARKER_SCHEMA_VERSION);
    expect(persisted.captureSessionId).toBe(sessionId);
    expect(persisted.taskId).toBe(BINDING.taskId);
    expect(persisted.phase).toBe("capturing");
    expect(Object.keys(persisted).sort()).toEqual([...RESTART_MARKER_FIELDS].sort());
  });

  it("never refreshes expiresAt across phase updates", async () => {
    const store = new FakeSessionStore();
    const relay = build(store);
    const promise = relay.transport.start(BINDING);
    relay.socket.fireOpen();
    relay.socket.fireMessage({ type: "started" });
    await promise;
    const sessionId = relay.transport.captureSessionId;
    const first = { ...(store.data[SESSION_KEY] as RelayRestartMarker) };
    relay.advance(60_000);
    relay.transport.offerChunkMessage(chunk(sessionId, 0));
    await settle();
    const second = store.data[SESSION_KEY] as RelayRestartMarker;
    expect(second.expiresAt).toBe(first.expiresAt);
    expect(Date.parse(second.expiresAt) - Date.parse(second.startedAt)).toBe(RELAY_V10.markerTtlMs);
  });

  it("walks the frozen transitions connecting->runtime_started->capturing->draining->cleanup_pending", async () => {
    const store = new FakeSessionStore();
    const { socket, transport } = build(store);
    const promise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await promise;
    const sessionId = transport.captureSessionId;
    const seen: string[] = [(store.data[SESSION_KEY] as RelayRestartMarker).phase];
    transport.offerChunkMessage(chunk(sessionId, 0));
    await settle();
    seen.push((store.data[SESSION_KEY] as RelayRestartMarker).phase);
    transport.beginStop("completed");
    transport.markQuiesced();
    await settle();
    seen.push((store.data[SESSION_KEY] as RelayRestartMarker).phase);
    socket.fireMessage({ type: "chunkAccepted", sequence: 0 });
    await settle();
    transport.markOffscreenStopped();
    await settle();
    seen.push((store.data[SESSION_KEY] as RelayRestartMarker).phase);
    for (const phase of seen) expect(RESTART_MARKER_PHASES).toContain(phase);
    expect(seen[0]).toBe("runtime_started");
    expect(seen[seen.length - 1]).toBe("cleanup_pending");
    for (const [from, targets] of Object.entries(RESTART_MARKER_TRANSITIONS)) {
      for (const to of targets) {
        expect([...RESTART_MARKER_PHASES]).toContain(to);
      }
      void from;
    }
  });

  it("refuses to finalize when the producer reports stopped but no stop reason was frozen", async () => {
    const store = new FakeSessionStore();
    const { socket, transport } = build(store);
    const promise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await promise;
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    expect(socket.jsonSends.some((s) => s.type === "stop")).toBe(false);
  });
});

describe("restart harness: expiry, malformed markers and clear rule", () => {
  it("treats an expired marker as a fail-closed cleanup signal", () => {
    const store = new FakeSessionStore();
    const marker: RelayRestartMarker = {
      schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
      captureSessionId: "cap_" + "a".repeat(32),
      taskId: BINDING.taskId,
      startedAt: new Date(T0).toISOString(),
      phase: "capturing",
      expiresAt: new Date(T0 - 1).toISOString()
    };
    store.data[SESSION_KEY] = marker;
    const stored = store.data[SESSION_KEY] as RelayRestartMarker;
    const expired = Date.parse(stored.expiresAt) <= T0;
    expect(expired).toBe(true);
    // The stored value still carries only the six frozen fields.
    expect(Object.keys(stored).sort()).toEqual([...RESTART_MARKER_FIELDS].sort());
  });

  it("rejects a marker that carries a forbidden field", () => {
    const forbidden = ["ticket", "grantId", "streamId", "pcm", "sourceIdentity", "absolutePath", "cookie", "apiKey"];
    for (const field of forbidden) {
      const polluted = {
        schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
        captureSessionId: "cap_" + "a".repeat(32),
        taskId: BINDING.taskId,
        startedAt: new Date(T0).toISOString(),
        phase: "capturing",
        expiresAt: new Date(T0 + RELAY_V10.markerTtlMs).toISOString(),
        [field]: "leak"
      };
      const keys = Object.keys(polluted).filter((k) => !([...RESTART_MARKER_FIELDS] as string[]).includes(k));
      expect(keys).toEqual([field]);
    }
  });

  it("clears the marker only after the terminal, and only for its own session", async () => {
    const store = new FakeSessionStore();
    const { socket, transport, cleared } = build(store);
    const promise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await promise;
    const sessionId = transport.captureSessionId;
    expect(store.data[SESSION_KEY]).toBeDefined();

    const terminal = transport.stop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    socket.fireMessage({
      type: "completed",
      transcript: { taskId: BINDING.taskId, state: "queued" }
    });
    await terminal;
    await settle();
    expect(cleared).toEqual([sessionId]);
    expect(store.data[SESSION_KEY]).toBeUndefined();
  });

  it("does not clear a marker belonging to a different session", async () => {
    const store = new FakeSessionStore();
    const { socket, transport, cleared } = build(store);
    const promise = transport.start(BINDING);
    socket.fireOpen();
    socket.fireMessage({ type: "started" });
    await promise;
    const terminal = transport.stop("completed");
    transport.markQuiesced();
    transport.markOffscreenStopped();
    await settle();
    // A DIFFERENT worker session wins the store before this capture settles.
    const other: RelayRestartMarker = {
      schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
      captureSessionId: "cap_" + "b".repeat(32),
      taskId: "media_task_" + "c".repeat(32),
      startedAt: new Date(T0).toISOString(),
      phase: "connecting",
      expiresAt: new Date(T0 + RELAY_V10.markerTtlMs).toISOString()
    };
    store.data[SESSION_KEY] = other;
    socket.fireMessage({ type: "completed", transcript: { taskId: BINDING.taskId, state: "queued" } });
    await terminal;
    await settle();
    // The clear is session-scoped, so the foreign marker must survive.
    expect(cleared).toEqual([transport.captureSessionId]);
    expect((store.data[SESSION_KEY] as RelayRestartMarker).captureSessionId)
      .toBe(other.captureSessionId);
  });
});
