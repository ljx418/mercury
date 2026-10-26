/**
 * R6-G1 shared harness.
 *
 * Every driver here composes PRODUCTION classes — `OffscreenAudioPort`,
 * `RuntimeCaptureTransport`, `MediaCaptureController`, `audioChunk`,
 * `OffscreenProducerBootstrap`, `RelayRestartReconciler`. Only the browser
 * and socket primitives are controllable fakes, because those are the
 * boundaries the frozen contract is written against; the owner under test is
 * never replaced by a stub.
 */

import { vi } from "vitest";
import {
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  type BackgroundToOffscreenMessage
} from "../../capture/relayContracts";
import { OffscreenAudioPort, type OffscreenPortLike } from "../../capture/OffscreenAudioPort";
import { RuntimeCaptureTransport, type RuntimeSocketLike } from "../../capture/RuntimeCaptureTransport";

export const R6_EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
export const R6_OFFSCREEN_URL = `chrome-extension://${R6_EXT_ID}/offscreen.html`;
export const R6_OFFSCREEN_ORIGIN = `chrome-extension://${R6_EXT_ID}`;
// Frozen capture-session id shape: `cap_` + exactly 32 permitted characters.
export const R6_SESSION_ID = `cap_r6fixed${"0".repeat(25)}`;
export const R6_RUNTIME_WS = "ws://127.0.0.1:17861/v1/media/capture-stream";
export const R6_RUNTIME_HTTP = "http://127.0.0.1:17861";
export const R6_TASK_ID = "media_task_r6fixed000000000000001";
export const R6_TICKET = "cap_r6fixed000000000000000000000000000001";
export const R6_GRANT_ID = "mcg_r6fixed000000000000000001";

/** Frames the Background sent to the producer, in order. */
export class FakeSocket implements RuntimeSocketLike {
  readonly sent: string[] = [];
  closeCalls: { code?: number; reason?: string }[] = [];
  readyState = 1;
  binaryType = "arraybuffer";
  #listeners = new Map<string, ((event: unknown) => void)[]>();

  send(data: string | ArrayBuffer): void {
    this.sent.push(typeof data === "string" ? data : new TextDecoder().decode(data));
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }

  /**
   * JSON control frames only. Raw PCM chunks are stored decoded as text but
   * are binary, so they are skipped rather than parsed.
   */
  frames(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const raw of this.sent) {
      try {
        out.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        // binary PCM chunk
      }
    }
    return out;
  }
}

export type FakePortInit = {
  sender?: chrome.runtime.MessageSender;
  name?: string;
};

export class FakeOffscreenPort implements OffscreenPortLike {
  readonly toBackground: BackgroundToOffscreenMessage[] = [];
  disconnectCount = 0;
  #messageListeners: ((message: unknown) => void)[] = [];
  #disconnectListeners: (() => void)[] = [];

  constructor(init: FakePortInit = {}) {
    this.name = init.name ?? MEDIA_CAPTURE_AUDIO_PORT_NAME;
    if (init.sender !== undefined) this.sender = init.sender;
  }

  name: string;
  sender?: chrome.runtime.MessageSender;

  postMessage(message: unknown): void {
    this.toBackground.push(message as BackgroundToOffscreenMessage);
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.#messageListeners.push(listener);
    }
  };

  onDisconnect = {
    addListener: (listener: () => void) => {
      this.#disconnectListeners.push(listener);
    }
  };

  /** Deliver a producer→Background message exactly as Chrome would. */
  deliver(message: unknown): void {
    for (const listener of this.#messageListeners) listener(message);
  }

  deliverDisconnect(): void {
    for (const listener of this.#disconnectListeners) listener();
  }
}

/** The one authoritative OFFSCREEN_DOCUMENT context, as Chrome would report it. */
export function authoritativeContext(overrides: Partial<chrome.runtime.ExtensionContext> = {}): chrome.runtime.ExtensionContext {
  return {
    contextType: "OFFSCREEN_DOCUMENT",
    documentId: "doc-r6-authoritative-1",
    documentUrl: R6_OFFSCREEN_URL,
    documentOrigin: R6_OFFSCREEN_ORIGIN,
    incognito: false,
    ...overrides
  } as unknown as chrome.runtime.ExtensionContext;
}

export function validSender(overrides: Partial<chrome.runtime.MessageSender> = {}): chrome.runtime.MessageSender {
  return {
    id: R6_EXT_ID,
    url: R6_OFFSCREEN_URL,
    frameId: 0,
    documentId: "doc-r6-authoritative-1",
    ...overrides
  } as unknown as chrome.runtime.MessageSender;
}

/**
 * `chrome` is a browser primitive, not the owner under test. Only the pieces
 * the production code actually reads are provided.
 */
export function stubChromeRuntimeId(id: string = R6_EXT_ID): void {
  vi.stubGlobal("chrome", {
    runtime: { id, getContexts: vi.fn(async () => [authoritativeContext()]) }
  });
}

export type TransportHarness = {
  transport: RuntimeCaptureTransport;
  socket: FakeSocket;
  markers: unknown[];
  failures: string[];
};

function unrefTimer(handler: () => void, ms: number): ReturnType<typeof setTimeout> {
  const handle = setTimeout(handler, ms);
  handle.unref?.();
  return handle;
}

export function makeTransport(overrides: Partial<ConstructorParameters<typeof RuntimeCaptureTransport>[0]> = {}): TransportHarness {
  const socket = new FakeSocket();
  const markers: unknown[] = [];
  const failures: string[] = [];
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: R6_RUNTIME_WS,
    onMarker: (marker) => markers.push(marker),
    clearMarker: () => undefined,
    reportFailure: (code) => failures.push(code),
    setTimer: unrefTimer,
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    ...overrides
  }, () => R6_SESSION_ID);
  return { transport, socket, markers, failures };
}

export type PortHarness = {
  port: OffscreenAudioPort;
  transport: RuntimeCaptureTransport;
  socket: FakeSocket;
  markers: Record<string, unknown>[];
  failures: string[];
  disconnects: string[];
  contextFilters: chrome.runtime.ContextFilter[];
};

export function makeAudioPort(options: {
  contexts?: (filter: chrome.runtime.ContextFilter) => Promise<chrome.runtime.ExtensionContext[]>;
  waitForContext?: (ms: number) => Promise<void>;
  /** Transport timer seams, so a frozen bound can be crossed deterministically. */
  transport?: Partial<ConstructorParameters<typeof RuntimeCaptureTransport>[0]>;
} = {}): PortHarness {
  const { socket, failures } = makeTransport();
  const disconnects: string[] = [];
  const contextFilters: chrome.runtime.ContextFilter[] = [];
  // Late-bound so the transport's ACK/abort callbacks reach the real Port owner.
  let owner: OffscreenAudioPort | null = null;
  const markers: Record<string, unknown>[] = [];
  const transport = new RuntimeCaptureTransport({
    createSocket: () => socket,
    runtimeWsUrl: R6_RUNTIME_WS,
    onMarker: (marker) => markers.push(marker as unknown as Record<string, unknown>),
    clearMarker: () => undefined,
    reportFailure: (code) => failures.push(code),
    onRuntimeAck: (acknowledgedSequence) => owner?.noteRuntimeAck(acknowledgedSequence),
    onCaptureAbort: (code) => owner?.sendAbort(code),
    setTimer: unrefTimer,
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    ...options.transport
  }, () => R6_SESSION_ID);
  const port = new OffscreenAudioPort({
    getContexts: options.contexts ?? (async () => [authoritativeContext()]),
    expectedSenderUrl: R6_OFFSCREEN_URL,
    extensionIncognito: false,
    waitForContext: options.waitForContext,
    onFailure: (code) => failures.push(code),
    // Production Background wiring: a producer disconnect is classified by the
    // Transport, which decides expected teardown vs fail-closed abort.
    onDisconnect: (reason) => {
      disconnects.push(reason);
      transport.handleProducerDisconnect(reason);
    }
  }, transport);
  owner = port;
  return { port, transport, socket, markers, failures, disconnects, contextFilters };
}

/** Silence the bounded context wait so cases stay fast and deterministic. */
export const immediateWait = async (): Promise<void> => undefined;

/** A single decoded PCM frame of `byteLength` raw bytes. */
export function pcmBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < byteLength; index += 1) bytes[index] = (index % 251) + 1;
  return bytes;
}

// ---------------------------------------------------------------------------
// R6-G1 scenario runner
//
// `startRuntime` drives the REAL transport start handshake through the fake
// socket: the socket opens, the Background writes the frozen `start` payload,
// and the Runtime answers `started`. From that point the capture session is
// bound and producer chunks are validated against the real sequence
// discipline.
// ---------------------------------------------------------------------------

export const R6_BINDING = Object.freeze({
  ticket: R6_TICKET,
  taskId: R6_TASK_ID,
  adapterId: "bilibili",
  surface: "side_panel" as const,
  pageIdentitySha256: "a".repeat(64),
  tabId: 7,
  tabIdSha256: "b".repeat(64),
  sourceIdentity: "bilibili:BV1fixed0000000000:p1",
  acquisitionRecordId: "mar_r6fixed000000000000001"
});

/** Complete the frozen Runtime start handshake on the fake socket. */
export async function startRuntime(harness: PortHarness): Promise<unknown> {
  const started = harness.transport.start(R6_BINDING);
  harness.socket.emit("open");
  harness.socket.emit("message", {
    data: JSON.stringify({ type: "started", grant: { grantId: R6_GRANT_ID, ticket: R6_TICKET } })
  });
  return started;
}

/** Answer the in-flight chunk with the frozen `chunkAccepted` ACK. */
export function ackSequence(harness: PortHarness, sequence: number): void {
  harness.socket.emit("message", {
    data: JSON.stringify({ type: "chunkAccepted", sequence })
  });
}

/** Deliver a producer→Background chunk exactly as Chrome would deliver it. */
export function deliverChunk(
  producer: FakeOffscreenPort,
  options: { sequence?: number; byteLength?: number; captureSessionId?: string } = {}
): void {
  const byteLength = options.byteLength ?? 320;
  producer.deliver({
    type: "chunk",
    captureSessionId: options.captureSessionId ?? R6_SESSION_ID,
    sequence: options.sequence ?? 0,
    rawByteLength: byteLength,
    pcmBase64: btoa(String.fromCharCode(...pcmBytes(byteLength)))
  });
}

/**
 * The frozen positive order: the producer announces `ready` FIRST, and only
 * then does the Background grant the single initial `chunk_credit`. A chunk
 * that arrives before this is refused as backpressure by the Port owner.
 */
export function producerReady(producer: FakeOffscreenPort, captureSessionId: string = R6_SESSION_ID): void {
  producer.deliver({ type: "ready", captureSessionId });
}
