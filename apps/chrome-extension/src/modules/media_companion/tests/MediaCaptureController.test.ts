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

function controller(overrides = {}) {
  const sendOffscreenMessage = vi.fn(async (_message: Record<string, unknown>) => ({ ok: true }));
  return {
    sendOffscreenMessage,
    value: new MediaCaptureController({
      queryTargetTab: async () => ({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }),
      hasPermission: async () => true,
      getMediaStreamId: async () => "private-stream-id",
      ensureOffscreenDocument: async () => undefined,
      sendOffscreenMessage,
      closeOffscreenDocument: async () => undefined,
      digest,
      ...overrides
    })
  };
}

describe("MediaCaptureController", () => {
  it("revalidates the active tab and sends private capabilities only to offscreen", async () => {
    const instance = controller();
    const message = await startMessage();
    expect(instance.value.arm(message)).toEqual({ ok: true, state: "armed", grantId: "mcg_" + "1".repeat(32) });
    expect(await instance.value.startArmed({ id: 7, active: true, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }))
      .toEqual({ ok: true, state: "capturing", grantId: "mcg_" + "1".repeat(32) });
    const privateMessage = instance.sendOffscreenMessage.mock.calls[0][0];
    expect(privateMessage.streamId).toBe("private-stream-id");
    expect(privateMessage.ticket).toBe("t".repeat(43));
    expect(instance.value.arm(await startMessage())).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
  });

  it("fails closed for wrong tab binding, background start, and missing permission", async () => {
    const wrong = await startMessage();
    wrong.grant.tabIdSha256 = "0".repeat(64);
    const wrongController = controller().value;
    expect(wrongController.arm(wrong)).toEqual({ ok: true, state: "armed", grantId: wrong.grant.grantId });
    expect(await wrongController.startArmed()).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
    const background = await startMessage();
    background.userActivation = false as true;
    expect(controller().value.arm(background)).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    const noPermission = controller({ hasPermission: async () => false }).value;
    expect(noPermission.arm(await startMessage())).toMatchObject({ ok: true, state: "armed" });
    expect(await noPermission.startArmed()).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_PERMISSION_REQUIRED" });
  });

  it("does not allow an armed one-shot request to be replaced", async () => {
    const instance = controller().value;
    expect(instance.arm(await startMessage())).toMatchObject({ ok: true, state: "armed" });
    expect(instance.arm(await startMessage())).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE" });
  });

  it("router accepts only exact extension surfaces and matching surface grants", async () => {
    const handler = {
      arm: vi.fn(() => ({ ok: true, state: "armed" as const })),
      status: vi.fn(() => ({ ok: true, state: "armed" as const })),
      stop: vi.fn()
    };
    const router = new MediaCaptureMessageRouter("a".repeat(32), `chrome-extension://${"a".repeat(32)}/`, handler as never);
    const message = await startMessage();
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: false })).toEqual({ ok: true, state: "armed" });
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/content.html`, hasTab: true })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    const mismatch = await startMessage("workspace");
    expect(await router.handle(mismatch, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: false })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" });
    expect(await router.handle(mismatch, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/workspace.html#/media/current`, hasTab: true })).toEqual({ ok: true, state: "armed" });
    expect(await router.handle(message, { id: "a".repeat(32), url: `chrome-extension://${"a".repeat(32)}/sidepanel.html`, hasTab: true })).toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
  });

  it("accepts trusted capture from the in-page Navia surface only on a registered portal", async () => {
    const handler = {
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
    const complete = controller({
      sendOffscreenMessage: vi.fn(async (message: Record<string, unknown>) => message.command === "start"
        ? { ok: true }
        : { ok: true, state: "stopped", result: { type: "completed", transcript } })
    });
    complete.value.arm(await startMessage());
    await complete.value.startArmed();
    expect(await complete.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: true, state: "transcribing", transcript });

    const missing = controller({
      sendOffscreenMessage: vi.fn(async () => ({ ok: true, state: "stopped", result: null }))
    });
    missing.value.arm(await startMessage());
    await missing.value.startArmed();
    expect(await missing.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_FINALIZE_FAILED" });

    const failed = controller({
      sendOffscreenMessage: vi.fn(async (message: Record<string, unknown>) => message.command === "start"
        ? { ok: true }
        : { ok: true, state: "stopped", result: { type: "failed", failureCode: "V3_MEDIA_CAPTURE_EMPTY" } })
    });
    failed.value.arm(await startMessage());
    await failed.value.startArmed();
    expect(await failed.value.stop({ type: "navia.mediaCapture", command: "stop", reason: "completed" }))
      .toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_EMPTY" });
  });
});
