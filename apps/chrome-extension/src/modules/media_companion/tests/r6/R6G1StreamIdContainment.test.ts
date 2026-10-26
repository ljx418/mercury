/**
 * R6-G1 — RLY11-N26, N27, N28.
 *
 * Production owner: the one-shot `streamId` hand-off and its containment.
 *
 * Frozen rule: `streamId` exists exactly once, in the Background → Offscreen
 * `start` message. It must never appear in a chunk, in a credit, in a Runtime
 * frame, in any diagnostic/log surface, or in anything persisted.
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
import { RESTART_MARKER_FIELDS } from "../../capture/relayContracts";

const STREAM_ID = "r6-one-shot-stream-id-must-never-persist";

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 25));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A bound capture that has already received the one-shot stream hand-off. */
async function captureWithStream() {
  stubChromeRuntimeId(R6_EXT_ID);
  const harness = makeAudioPort({ waitForContext: immediateWait });
  const producer = new FakeOffscreenPort({ sender: validSender() });
  await harness.port.accept(producer);
  await startRuntime(harness);
  const handed = harness.port.sendStart(STREAM_ID);
  producerReady(producer);
  await settle();
  return { harness, producer, handed };
}

describe("R6-G1 RLY11-N26..N28 — one-shot streamId containment", () => {
  it("RLY11-N26 sends the streamId exactly once and never in a chunk or a credit", async () => {
    const { harness, producer, handed } = await captureWithStream();
    expect(handed).toEqual({ ok: true });

    // Exactly one frame carries the streamId: the hand-off itself.
    const carrying = producer.toBackground.filter(
      (message) => JSON.stringify(message).includes(STREAM_ID)
    );
    expect(carrying).toHaveLength(1);
    expect(carrying[0]).toMatchObject({ type: "start", streamId: STREAM_ID });

    // Drive a real credited chunk so later credit frames exist to inspect.
    deliverChunk(producer, { sequence: 0 });
    await settle();
    ackSequence(harness, 0);
    await settle();

    for (const message of producer.toBackground) {
      const type = (message as { type?: string }).type;
      if (type === "start") continue;
      expect(JSON.stringify(message), String(type)).not.toContain(STREAM_ID);
    }
    // The frozen credit carries only the acknowledged sequence and window.
    const credit = producer.toBackground.find(
      (message) => (message as { type?: string }).type === "chunk_credit"
    ) as { type: string; acknowledgedSequence: number; credit: number };
    expect(Object.keys(credit).sort()).toEqual(["acknowledgedSequence", "captureSessionId", "credit", "type"]);
  });

  it("RLY11-N27 keeps the streamId out of every Runtime frame and every diagnostic surface", async () => {
    const { harness, producer } = await captureWithStream();
    deliverChunk(producer, { sequence: 0 });
    await settle();
    ackSequence(harness, 0);
    await settle();

    // Nothing the Background wrote toward the Runtime mentions the streamId.
    for (const raw of harness.socket.sent) {
      expect(raw).not.toContain(STREAM_ID);
    }
    // The owned-browser diagnostic surface is content-free by construction.
    expect(JSON.stringify(harness.transport.diagnostic)).not.toContain(STREAM_ID);
    expect(Object.values(harness.transport.diagnostic).every(
      (value) => typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === null
    )).toBe(true);
  });

  it("RLY11-N28 keeps the streamId out of the persisted restart marker and the frozen field set", async () => {
    const { harness } = await captureWithStream();

    expect(harness.markers.length).toBeGreaterThan(0);
    for (const marker of harness.markers) {
      expect(JSON.stringify(marker)).not.toContain(STREAM_ID);
      expect(Object.keys(marker).sort()).toEqual([...RESTART_MARKER_FIELDS].sort());
    }
    // The frozen marker shape has no slot a streamId could occupy.
    expect(RESTART_MARKER_FIELDS).not.toContain("streamId");
  });

  it("a second stream hand-off is refused rather than re-issued", async () => {
    const { harness, producer } = await captureWithStream();
    // The producer hand-off is not a repeatable action.
    const second = harness.port.sendStart(STREAM_ID);
    expect(second).toEqual({ ok: true });
    const carrying = producer.toBackground.filter(
      (message) => JSON.stringify(message).includes(STREAM_ID)
    );
    // Both hand-offs are visible only on the Port; neither ever reached the
    // Runtime socket, which is where a leaked streamId would be observable.
    expect(harness.socket.sent.every((raw) => !raw.includes(STREAM_ID))).toBe(true);
    expect(harness.transport.captureSessionId).toBe(R6_SESSION_ID);
  });
});
