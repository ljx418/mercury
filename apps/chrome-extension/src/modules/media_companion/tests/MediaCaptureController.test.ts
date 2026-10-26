import { describe, expect, it, vi } from "vitest";
import { MediaCaptureController, MediaCaptureMessageRouter, type StartMediaCaptureMessage } from "../capture";

const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function startMessage(surface: "side_panel" | "workspace" = "side_panel"): Promise<StartMediaCaptureMessage> {
  return {
    type: "navia.mediaCapture",
    command: "arm",
    trustedClick: true,
    userActivation: true,
    ticket: "t".repeat(43),
    sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:cid:1",
    acquisitionRecordId: "mar_" + "8".repeat(32),
    grant: {
      grantId: "mcg_" + "1".repeat(32),
      taskId: "media_task_" + "2".repeat(32),
      adapterId: "bilibili",
      pageIdentitySha256: await digest("https://www.bilibili.com/video/BV1ZpYd66ELP"),
      tabIdSha256: await digest("7"),
      surface,
      issuedAt: "2026-10-07T00:00:00Z",
      expiresAt: "2026-10-07T00:00:30Z",
      oneShot: true,
      persisted: false,
      state: "issued"
    }
  };
}

/**
 * R1-C2-2: `relay` is a REQUIRED dependency. The default controller
 * injects a relay fake, and `sendOffscreenMessage` survives only for the
 * Background's stateless offscreen prewarm ping — it is never a capture
 * start/stop path.
 */
function relayFake(overrides: Record<string, unknown> = {}) {
  return {
    start: vi.fn(async () => ({ ok: true as const })),
    sendStart: vi.fn(() => ({ ok: true as const })),
    sendQuiesce: vi.fn(),
    beginStop: vi.fn(),
    abort: vi.fn(),
    stop: vi.fn(async () => ({ ok: true })),
    disconnect: vi.fn(),
    ...overrides
  };
}

function controller(overrides: Record<string, unknown> = {}) {
  const sendOffscreenMessage = vi.fn(async (_message: Record<string, unknown>) => ({ ok: true }));
  const relay = relayFake();
  return {
    sendOffscreenMessage,
    relay,
    value: new MediaCaptureController({
      queryTargetTab: async () => ({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }),
      hasPermission: async () => true,
      getMediaStreamId: async () => "private-stream-id",
      ensureOffscreenDocument: async () => undefined,
      sendOffscreenMessage,
      closeOffscreenDocument: async () => undefined,
      digest,
      relay,
      ...overrides
    } as never)
  };
}

describe("MediaCaptureController", () => {
  it("revalidates the active tab and keeps private capabilities out of the Offscreen message", async () => {
    const instance = controller();
    const message = await startMessage();
    expect(await instance.value.prepare()).toEqual({ ok: true, state: "prepared" });
    expect(instance.value.arm(message)).toEqual({ ok: true, state: "armed", grantId: "mcg_" + "1".repeat(32) });
    expect(await instance.value.startArmed({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }))
      .toEqual({ ok: true, state: "capturing", grantId: "mcg_" + "1".repeat(32) });
    // WP0 R1: the Offscreen is a pure PCM producer. It receives the
    // one-shot streamId and NOTHING else — the ticket, binding,
    // sourceIdentity and acquisitionRecordId belong to the Background-owned
    // Runtime transport.
    // R1-C2-2: the one-shot streamId leaves Background through the frozen
    // Port, never through runtime.onMessage. The private binding (ticket,
    // sourceIdentity, acquisitionRecordId) never reaches the Offscreen.
    expect(instance.sendOffscreenMessage).not.toHaveBeenCalled();
    expect(instance.relay.sendStart).toHaveBeenCalledTimes(1);
    expect(instance.relay.sendStart).toHaveBeenCalledWith("private-stream-id");
    // The Runtime transport is what receives the private capabilities.
    expect(instance.relay.start).toHaveBeenCalledWith(expect.objectContaining({
      ticket: "t".repeat(43),
      sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:cid:1"
    }));
    expect(instance.value.arm(await startMessage())).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
  });

  it("opens the Runtime transport before any streamId leaves Background", async () => {
    const order: string[] = [];
    const relay = {
      start: vi.fn(async () => {
        order.push("relay.start");
        return { ok: true as const };
      }),
      sendStart: vi.fn(() => {
        order.push("relay.sendStart");
        return { ok: true as const };
      }),
      sendQuiesce: vi.fn(),
      abort: vi.fn(),
      stop: vi.fn(async () => ({ ok: true })),
      disconnect: vi.fn()
    };
    const instance = controller({
      relay,
      getMediaStreamId: async () => {
        order.push("streamId");
        return "private-stream-id";
      }
    });
    const message = await startMessage();
    await instance.value.prepare();
    instance.value.arm(message);
    expect(await instance.value.startArmed({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }))
      .toEqual({ ok: true, state: "capturing", grantId: "mcg_" + "1".repeat(32) });
    // The Runtime handshake must complete BEFORE the streamId is resolved.
    expect(order).toEqual(["relay.start", "streamId", "relay.sendStart"]);
    // The transport receives the private binding; the producer does not.
    expect(relay.start).toHaveBeenCalledWith(expect.objectContaining({
      ticket: "t".repeat(43),
      sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:cid:1"
    }));
  });

  it("fails closed without handing out a streamId when Runtime never starts", async () => {
    const relay = {
      start: vi.fn(async () => ({ ok: false as const, failureCode: "V3_MEDIA_CAPTURE_TICKET_REPLAYED" as const })),
      sendStart: vi.fn(),
      sendQuiesce: vi.fn(),
      abort: vi.fn(),
      stop: vi.fn(async () => ({ ok: true })),
      disconnect: vi.fn()
    };
    const getMediaStreamId = vi.fn(async () => "private-stream-id");
    const instance = controller({ relay, getMediaStreamId });
    const message = await startMessage();
    await instance.value.prepare();
    instance.value.arm(message);
    expect(await instance.value.startArmed({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_TICKET_REPLAYED" });
    expect(getMediaStreamId).not.toHaveBeenCalled();
    expect(relay.sendStart).not.toHaveBeenCalled();
  });

  it("fails closed for wrong tab binding, background start, and missing permission", async () => {
    const wrong = await startMessage();
    wrong.grant.tabIdSha256 = "0".repeat(64);
    const wrongController = controller().value;
    await wrongController.prepare();
    expect(wrongController.arm(wrong)).toEqual({ ok: true, state: "armed", grantId: wrong.grant.grantId });
    expect(await wrongController.startArmed()).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
    const background = await startMessage();
    background.userActivation = false as true;
    expect(controller().value.arm(background)).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    const noPermission = controller({ hasPermission: async () => false }).value;
    await noPermission.prepare();
    expect(noPermission.arm(await startMessage())).toMatchObject({ ok: true, state: "armed" });
    expect(await noPermission.startArmed()).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PERMISSION_REQUIRED" });
  });

  it("does not allow an armed one-shot request to be replaced", async () => {
    const instance = controller().value;
    await instance.prepare();
    expect(instance.arm(await startMessage())).toMatchObject({ ok: true, state: "armed" });
    expect(instance.arm(await startMessage())).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
  });

  it("router accepts only exact extension surfaces and matching surface grants", async () => {
    const handler = {
      prepare: vi.fn(async () => ({ ok: true, state: "prepared" as const })),
      arm: vi.fn(() => ({ ok: true, state: "armed" as const })),
      status: vi.fn(() => ({ ok: true, state: "armed" as const })),
      stop: vi.fn()
    };
    const router = new MediaCaptureMessageRouter("a".repeat(32), `chrome-extension://${"a".repeat(32)}/`, handler as never);
    const message = await startMessage();
    expect(await router.handle({ type: "navia.mediaCapture", command: "prepare" }, {
      id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: false
    })).toEqual({ ok: true, state: "prepared" });
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: false })).toEqual({ ok: true, state: "armed" });
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/content.html`, hasTab: true })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    const mismatch = await startMessage("workspace");
    expect(await router.handle(mismatch, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: false })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
    expect(await router.handle(mismatch, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/workspace.html#/media/current`, hasTab: true })).toEqual({ ok: true, state: "armed" });
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: true })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
  });

  it("accepts trusted capture from the in-page Navia surface only on a registered portal", async () => {
    const handler = {
      prepare: vi.fn(async () => ({ ok: true, state: "prepared" as const })),
      arm: vi.fn(() => ({ ok: true, state: "armed" as const })),
      status: vi.fn(() => ({ ok: true, state: "armed" as const })),
      stop: vi.fn()
    };
    const router = new MediaCaptureMessageRouter(
      "a".repeat(32),
      `chrome-extension://${"a".repeat(32)}/`,
      handler as never,
      (url) => url.startsWith("https://www.bilibili.com/video/")
    );
    const message = await startMessage();
    const embeddedUrl = `chrome-extension://${"a".repeat(32)}/sidepanel.html?naviaInPage=1`;
    expect(await router.handle(message, {
      id: "a".repeat(32), url: embeddedUrl, hasTab: true, tabUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP"
    })).toEqual({ ok: true, state: "armed" });
    expect(await router.handle(message, {
      id: "a".repeat(32), url: embeddedUrl, hasTab: true, tabUrl: "https://example.com/"
    })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
  });

  it("returns the Runtime transcript task after completed capture and fails closed without it", async () => {
    const transcript = { taskId: "media_task_" + "2".repeat(32), state: "queued" };

    // Success: the transport terminal carries the transcript.
    const complete = controller({
      relay: relayFake({ stop: vi.fn(async () => ({ ok: true as const, transcript })) })
    });
    await complete.value.prepare();
    complete.value.arm(await startMessage());
    await complete.value.startArmed();
    expect(await complete.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: true, state: "transcribing", transcript });

    // Failure: a terminal without a transcript is FINALIZE_FAILED.
    const missing = controller({
      relay: relayFake({ stop: vi.fn(async () => ({ ok: true as const })) })
    });
    await missing.value.prepare();
    missing.value.arm(await startMessage());
    await missing.value.startArmed();
    expect(await missing.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_FINALIZE_FAILED" });

    // Failure: the transport reports a typed relay failure.
    const failed = controller({
      relay: relayFake({ stop: vi.fn(async () => ({ ok: false as const, failureCode: "V3_MEDIA_CAPTURE_EMPTY" as const })) })
    });
    await failed.value.prepare();
    failed.value.arm(await startMessage());
    await failed.value.startArmed();
    expect(await failed.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_EMPTY" });
  });

  it("has no legacy onMessage capture control plane", async () => {
    // R1-C2-2: capture start/stop never uses runtime.onMessage. The
    // prewarm ping is the only sendOffscreenMessage call.
    const instance = controller();
    await instance.value.prepare();
    instance.value.arm(await startMessage());
    await instance.value.startArmed();
    const startCalls = instance.relay.sendStart.mock.calls.length;
    expect(startCalls).toBe(1);
    const messageCalls = instance.sendOffscreenMessage.mock.calls;
    expect(messageCalls).toHaveLength(0);
    // ...and on stop the reason is frozen on the relay, not an onMessage stop.
    await instance.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "cancelled" });
    expect(instance.relay.beginStop).toHaveBeenCalledWith("cancelled");
    expect(instance.sendOffscreenMessage.mock.calls).toHaveLength(0);
  });

  it("prewarms before arming and closes the document when an idle or armed flow stops", async () => {
    const ensureOffscreenDocument = vi.fn(async () => undefined);
    const closeOffscreenDocument = vi.fn(async () => undefined);
    const instance = controller({ ensureOffscreenDocument, closeOffscreenDocument }).value;

    expect(instance.arm(await startMessage())).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PREPARE_REQUIRED" });
    expect(await instance.prepare()).toEqual({ ok: true, state: "prepared" });
    expect(ensureOffscreenDocument).toHaveBeenCalledTimes(1);
    expect(instance.arm(await startMessage())).toMatchObject({ ok: true, state: "armed" });
    expect(await instance.stop({ type: "navia.mediaCapture", command: "stop", reason: "timeout" }))
      .toEqual({ ok: true, state: "stopped" });
    expect(closeOffscreenDocument).toHaveBeenCalledTimes(1);
  });

  it("fails closed and cleans up when offscreen prewarm fails", async () => {
    const closeOffscreenDocument = vi.fn(async () => undefined);
    const reportDiagnostic = vi.fn();
    const instance = controller({
      ensureOffscreenDocument: async () => { throw new Error("cold start failed"); },
      closeOffscreenDocument,
      reportDiagnostic
    }).value;

    expect(await instance.prepare()).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PREPARE_FAILED" });
    expect(closeOffscreenDocument).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ stage: "offscreen_prepare" }));
  });
});
