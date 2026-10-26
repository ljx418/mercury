/**
 * R6-G1 — RLY11-N07..N10, N15, N21.
 *
 * Production owner: `RuntimeCaptureTransport` sequence/credit/stop discipline
 * composed with the real `OffscreenAudioPort` owner, driven through the frozen
 * start handshake and the frozen producer `ready` step on the fake socket.
 *
 * Every assertion below is the EXACT code/state the production owner produced,
 * observed on the real classes — not a restatement of the fixture label.
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

const PROTOCOL_INVALID = "V3_MEDIA_CAPTURE_PROTOCOL_INVALID";
const SEQUENCE_INVALID = "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID";
const BACKPRESSURE = "V3_MEDIA_CAPTURE_BACKPRESSURE";

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 25));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Bind a producer and complete the frozen Runtime start + `ready` handshake. */
async function boundCapture() {
  stubChromeRuntimeId(R6_EXT_ID);
  const harness = makeAudioPort({ waitForContext: immediateWait });
  const producer = new FakeOffscreenPort({ sender: validSender() });
  await harness.port.accept(producer);
  await startRuntime(harness);
  producerReady(producer);
  await settle();
  return { harness, producer };
}

/** The sequence owner fails closed on both ends; neither reaches the Runtime. */
function expectSequenceFailClosed(harness: ReturnType<typeof makeAudioPort>): void {
  // The Transport raises it once, and the Port owner surfaces it once.
  expect(harness.failures).toEqual([SEQUENCE_INVALID, SEQUENCE_INVALID]);
  expect(harness.transport.state).toBe("aborted");
  // Only the frozen `start` frame ever reached the Runtime — no PCM.
  expect(harness.socket.frames().map((frame) => frame.type)).toEqual(["start"]);
}

describe("R6-G1 RLY11-N07..N10, N15, N21 — transport sequence, credit and stop discipline", () => {
  it("RLY11-N07 refuses a producer chunk before the Runtime reports started", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender() });
    await harness.port.accept(producer);

    // Start owns and binds the capture session synchronously, but deliberately
    // withhold the Runtime `started` frame. Driving the transport owner here is
    // necessary: the composed Port correctly has no credit before `started`,
    // so a Port-delivered chunk would prove BACKPRESSURE instead of this
    // transport-specific started gate.
    void harness.transport.start({
      ticket: "t".repeat(43),
      taskId: "media_task_" + "7".repeat(32),
      adapterId: "bilibili",
      surface: "side_panel",
      pageIdentitySha256: "a".repeat(64),
      tabId: 7,
      tabIdSha256: "b".repeat(64),
      sourceIdentity: "portal:bilibili:BV1R6G2:cid:7",
      acquisitionRecordId: "mar_" + "7".repeat(32)
    });
    harness.socket.emit("open");
    const response = harness.transport.offerChunkMessage({
      type: "chunk",
      captureSessionId: harness.transport.captureSessionId,
      sequence: 0,
      rawByteLength: 320,
      pcmBase64: btoa(String.fromCharCode(...new Uint8Array(320)))
    });
    await settle();

    expect(response).toEqual({ ok: false, failureCode: PROTOCOL_INVALID });
    expect(harness.failures).toEqual([]);
    expect(harness.transport.state).toBe("connecting");
    expect(harness.socket.frames().map((frame) => frame.type)).toEqual(["start"]);
    expect(producer.disconnectCount).toBe(0);
    // Release the pending start/deadline handles owned by this deliberately
    // incomplete handshake so the test process has no live capture timer.
    harness.transport.abort(PROTOCOL_INVALID);
  });

  it("RLY11-N08 refuses a first chunk whose sequence is one instead of zero", async () => {
    const { harness, producer } = await boundCapture();
    deliverChunk(producer, { sequence: 1 });
    await settle();
    expectSequenceFailClosed(harness);
  });

  it("RLY11-N09 refuses a duplicate sequence after an acknowledged first chunk", async () => {
    const { harness, producer } = await boundCapture();
    deliverChunk(producer, { sequence: 0 });
    await settle();
    ackSequence(harness, 0);
    await settle();
    expect(harness.failures).toEqual([]);
    expect(harness.port.credit).toBe(1);

    // Sequence 0 was already consumed; a repeat is a duplicate, never a resume.
    deliverChunk(producer, { sequence: 0 });
    await settle();
    expectSequenceFailClosed(harness);
  });

  it("RLY11-N10 refuses a sequence gap after an acknowledged first chunk", async () => {
    const { harness, producer } = await boundCapture();
    deliverChunk(producer, { sequence: 0 });
    await settle();
    ackSequence(harness, 0);
    await settle();

    deliverChunk(producer, { sequence: 2 });
    await settle();
    expectSequenceFailClosed(harness);
  });

  it("RLY11-N15 refuses a producer chunk when no Runtime credit is outstanding", async () => {
    const { harness, producer } = await boundCapture();
    expect(harness.port.credit).toBe(1);
    deliverChunk(producer, { sequence: 0 });
    await settle();
    // Credit is const 1 and is fully consumed by the in-flight chunk.
    expect(harness.port.credit).toBe(0);

    deliverChunk(producer, { sequence: 1 });
    await settle();

    expect(harness.failures).toEqual([BACKPRESSURE]);
    // The over-credit chunk never reached the Runtime.
    expect(harness.socket.frames().map((frame) => frame.type)).toEqual(["start"]);
  });

  it("RLY11-N21 refuses a producer chunk once the Runtime stop has been sent", async () => {
    const { harness, producer } = await boundCapture();
    deliverChunk(producer, { sequence: 0 });
    await settle();
    ackSequence(harness, 0);
    await settle();

    harness.transport.beginStop("completed");
    // The producer acknowledges the quiesce, which advances the stop.
    producer.deliver({ type: "stopped", captureSessionId: R6_SESSION_ID, reason: "completed" });
    await settle();
    expect(harness.transport.state).toBe("cleanup_pending");
    expect(harness.socket.frames().map((frame) => frame.type)).toContain("stop");

    deliverChunk(producer, { sequence: 1 });
    await settle();

    expect(harness.failures).toEqual([PROTOCOL_INVALID]);
  });

  it("positive control: one credited chunk flows through the frozen ACK window", async () => {
    const { harness, producer } = await boundCapture();
    deliverChunk(producer, { sequence: 0 });
    await settle();

    expect(harness.failures).toEqual([]);
    expect(harness.port.credit).toBe(0);
    expect(harness.transport.diagnostic.sentChunkCount).toBe(1);
    expect(harness.transport.state).toBe("capturing");

    ackSequence(harness, 0);
    await settle();

    // Credit is produced by exactly two paths and nothing else: the frozen
    // initial credit at `ready` (acknowledgedSequence -1), then one credit per
    // Runtime ACK. Each carries the frozen window of 1.
    expect(harness.port.credit).toBe(1);
    const credits = producer.toBackground.filter(
      (message) => (message as { type?: string }).type === "chunk_credit"
    );
    expect(credits).toHaveLength(2);
    expect(credits[0]).toMatchObject({ acknowledgedSequence: -1, credit: 1 });
    expect(credits[1]).toMatchObject({ acknowledgedSequence: 0, credit: 1 });
  });
});
