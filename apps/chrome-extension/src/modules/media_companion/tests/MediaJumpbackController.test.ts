import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaJumpbackController } from "../product/MediaJumpbackController";

const SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:p1";

afterEach(() => vi.unstubAllGlobals());

describe("MediaJumpbackController", () => {
  it("validates identity, seeks through the portal bridge, and independently reads back", async () => {
    const sendMessage = vi.fn(async (_tabId: number, message: { type: string }) => {
      if (message.type === "navia.media.collectPageContext") return { ok: true, value: {
        mediaId: "BV1ZpYd66ELP", playbackUnitId: "41828944992", part: { index: 1 }, durationSeconds: 792,
      } };
      if (message.type === "navia.media.seek") return { ok: true, value: { currentTimeSeconds: 30, durationSeconds: 792, paused: false, observedAt: "2026-10-08T00:00:00Z" } };
      return { ok: true, value: { currentTimeSeconds: 30.12, durationSeconds: 792, paused: false, observedAt: "2026-10-08T00:00:01Z" } };
    });
    vi.stubGlobal("chrome", { tabs: { query: vi.fn(async () => [{ id: 7, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }]), sendMessage } });

    const receipt = await new MediaJumpbackController().seek(SOURCE, 30_000, "outline");

    expect(receipt).toMatchObject({ outcome: "located", requestedMs: 30_000, observedMs: 30_120, deltaMs: 120, pageIdentityMatched: true });
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it("blocks a different playback unit before sending seek", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: {
      mediaId: "BV1ZpYd66ELP", playbackUnitId: "different", part: { index: 1 }, durationSeconds: 792,
    } }));
    vi.stubGlobal("chrome", { tabs: { query: vi.fn(async () => [{ id: 7, url: "https://www.bilibili.com/video/BV1ZpYd66ELP" }]), sendMessage } });

    const receipt = await new MediaJumpbackController().seek(SOURCE, 30_000, "evidence_drawer");

    expect(receipt.outcome).toBe("blocked");
    expect(receipt.pageIdentityMatched).toBe(false);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
