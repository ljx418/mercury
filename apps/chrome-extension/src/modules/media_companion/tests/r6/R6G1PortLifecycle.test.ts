/**
 * R6-G1 — RLY11-N19, N22, N29.
 *
 * Production owner: the disconnect and bounded-cleanup closeout, wired exactly
 * as `entrypoints/background/index.ts` wires it:
 *
 *   port.onDisconnect -> transport.handleProducerDisconnect(reason)
 *   transport.onCaptureAbort -> port.notifyProducerAbortOnce(code)
 *
 * The timer seams are injected so the frozen `cleanupTimeoutMs` bound can be
 * crossed deterministically without waiting for wall-clock time.
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
  R6_SESSION_ID,
  startRuntime,
  stubChromeRuntimeId,
  validSender
} from "./R6RelayHarness";
import { RELAY_V10 } from "../../capture/relayContracts";

const PORT_DISCONNECTED = "V3_MEDIA_CAPTURE_PORT_DISCONNECTED";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Harness = ReturnType<typeof makeAudioPort>;

async function bound(overrides: Parameters<typeof makeAudioPort>[0] = {}): Promise<{ harness: Harness; producer: FakeOffscreenPort }> {
  stubChromeRuntimeId(R6_EXT_ID);
  const harness = makeAudioPort({ waitForContext: immediateWait, ...overrides });
  const producer = new FakeOffscreenPort({ sender: validSender() });
  await harness.port.accept(producer);
  await startRuntime(harness);
  producerReady(producer);
  await wait(30);
  return { harness, producer };
}

describe("R6-G1 RLY11-N19, N22, N29 — disconnect and bounded cleanup", () => {
  it("RLY11-N19 fails a capture closed when the producer Port disconnects mid-capture", async () => {
    const { harness, producer } = await bound();
    deliverChunk(producer, { sequence: 0 });
    await wait(30);
    ackSequence(harness, 0);
    await wait(30);
    expect(harness.transport.state).toBe("capturing");

    producer.deliverDisconnect();
    await wait(60);

    // Exactly one normalized failure, the capture is aborted, and the Port
    // binding is released so a later document can bind.
    expect(harness.failures).toEqual([PORT_DISCONNECTED]);
    expect(harness.transport.state).toBe("aborted");
    expect(harness.disconnects).toEqual(["completed"]);
    expect(harness.port.connected).toBe(false);
    expect(harness.port.boundDocumentId).toBeNull();
    expect(harness.port.credit).toBe(0);
    expect(harness.port.producerReady).toBe(false);
  });

  it("RLY11-N22 fails closed when the producer misses the frozen cleanup deadline", async () => {
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
    deliverChunk(producer, { sequence: 0 });
    await wait(30);
    ackSequence(harness, 0);
    await wait(30);

    // Frozen values, straight from the relay contract.
    expect(RELAY_V10.cleanupTimeoutMs).toBe(10_000);
    expect(RELAY_V10.finalizeTimeoutMs).toBe(120_000);

    armed.length = 0;
    const stopping = harness.transport.stop("completed");
    await wait(30);

    expect(armed.map((entry) => entry.ms)).toEqual([RELAY_V10.cleanupTimeoutMs]);
    armed[0].handler();
    await wait(40);
    const terminal = await stopping;

    expect(harness.failures).toEqual(["V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE"]);
    expect(terminal).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE" });
    expect(harness.transport.state).toBe("aborted");
    expect(harness.transport.active).toBe(false);
  });

  it("RLY11-N29 notifies the producer abort at most once, even after a disconnect", async () => {
    const { harness, producer } = await bound();
    deliverChunk(producer, { sequence: 0 });
    await wait(30);
    ackSequence(harness, 0);
    await wait(30);

    producer.deliverDisconnect();
    await wait(30);

    // The Port is gone, so the abort receipt cannot be delivered — and must not
    // be retried into a second terminal or a success claim.
    const aborts = producer.toBackground.filter(
      (message) => (message as { type?: string }).type === "capture_error"
    );
    expect(aborts).toHaveLength(0);
    expect(harness.failures).toEqual([PORT_DISCONNECTED]);
    expect(harness.transport.state).toBe("aborted");

    // The exactly-once guard survives a second disconnect notification.
    harness.port.notifyProducerAbortOnce(PORT_DISCONNECTED);
    expect(harness.failures).toEqual([PORT_DISCONNECTED]);
    expect(harness.transport.state).toBe("aborted");
    expect(harness.transport.captureSessionId).toBe(R6_SESSION_ID);
  });
});
