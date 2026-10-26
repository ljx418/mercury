/**
 * R6-G3 — RLY11-N18.
 *
 * Production owner: `RuntimeCaptureTransport` ACK deadline.
 * Driver: the production transport with its timer seam injected, so the
 * already-frozen `chunkAckTimeoutMs` bound is crossed deterministically and the
 * REAL closeout runs (socket close, marker clear, terminal settle).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ackSequence,
  deliverChunk,
  FakeOffscreenPort,
  immediateWait,
  makeAudioPort,
  producerReady,
  R6_EXT_ID,
  startRuntime,
  stubChromeRuntimeId,
  validSender
} from "./R6RelayHarness";
import { RELAY_V10 } from "../../capture/relayContracts";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R6-G3 RLY11-N18 — Runtime ACK deadline", () => {
  it("fails the capture closed when an in-flight chunk is never acknowledged", async () => {
    const armed: Array<{ handler: () => void; ms: number }> = [];
    let nextHandle = 1;

    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({
      waitForContext: immediateWait,
      transport: {
        setTimer: (handler: () => void, ms: number) => {
          armed.push({ handler, ms });
          return nextHandle++;
        },
        clearTimer: () => undefined
      }
    });
    const producer = new FakeOffscreenPort({ sender: validSender() });
    await harness.port.accept(producer);
    await startRuntime(harness);
    producerReady(producer);
    await wait(30);

    armed.length = 0;
    deliverChunk(producer, { sequence: 0 });
    await wait(30);

    // One chunk is in flight and the frozen ACK deadline is armed for it.
    expect(harness.transport.inFlight).toBe(1);
    const ackTimer = armed.find((entry) => entry.ms === RELAY_V10.chunkAckTimeoutMs);
    expect(ackTimer, "the frozen ACK deadline was not armed").toBeDefined();
    expect(harness.transport.state).toBe("capturing");

    // The Runtime never answers. Crossing the frozen bound performs the single
    // fail-closed closeout: one normalized failure, socket closed, no terminal
    // success claimed.
    ackTimer!.handler();
    await wait(30);

    expect(harness.failures).toEqual(["V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED"]);
    expect(harness.transport.state).toBe("aborted");
    expect(harness.transport.active).toBe(false);
    expect(harness.socket.closeCalls.length).toBeGreaterThan(0);
  });

  it("does not arm the ACK deadline once the chunk is acknowledged", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender() });
    await harness.port.accept(producer);
    await startRuntime(harness);
    producerReady(producer);
    await wait(30);

    deliverChunk(producer, { sequence: 0 });
    await wait(30);
    expect(harness.transport.inFlight).toBe(1);

    ackSequence(harness, 0);
    await wait(30);

    expect(harness.failures).toEqual([]);
    expect(harness.transport.inFlight).toBe(0);
    expect(harness.transport.state).toBe("capturing");
    expect(harness.transport.active).toBe(true);
  });
});
