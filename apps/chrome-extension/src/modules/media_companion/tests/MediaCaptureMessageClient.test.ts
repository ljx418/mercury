import { describe, expect, it, vi } from "vitest";
import { MediaCaptureMessageClient, type MediaCaptureResponse, type PublicMediaCaptureGrant } from "../capture";

const grant: PublicMediaCaptureGrant = {
  grantId: `mcg_${"1".repeat(32)}`,
  taskId: `media_task_${"2".repeat(32)}`,
  adapterId: "bilibili",
  pageIdentitySha256: "3".repeat(64),
  tabIdSha256: "4".repeat(64),
  surface: "workspace",
  issuedAt: "2026-10-07T00:00:00Z",
  expiresAt: "2026-10-07T00:00:30Z",
  oneShot: true,
  persisted: false,
  state: "issued"
};

describe("MediaCaptureMessageClient", () => {
  it("arms once and polls until the Chrome invocation starts capture", async () => {
    const responses: MediaCaptureResponse[] = [
      { ok: true, state: "armed", grantId: grant.grantId },
      { ok: true, state: "armed", grantId: grant.grantId },
      { ok: true, state: "capturing", grantId: grant.grantId }
    ];
    const sendMessage = vi.fn(async () => responses.shift());
    const client = new MediaCaptureMessageClient(sendMessage);

    await expect(client.start({
      trustedClick: true,
      userActivation: true,
      grant,
      ticket: "t".repeat(43),
      sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:cid:1",
      acquisitionRecordId: `mar_${"5".repeat(32)}`
    })).resolves.toEqual({ ok: true, state: "capturing", grantId: grant.grantId });

    expect(sendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ command: "arm" }));
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: "navia.mediaCapture", command: "status" });
    expect(sendMessage).toHaveBeenNthCalledWith(3, { type: "navia.mediaCapture", command: "status" });
  });

  it("fails before messaging without a trusted click", async () => {
    const sendMessage = vi.fn();
    const client = new MediaCaptureMessageClient(sendMessage);
    await expect(client.start({
      trustedClick: false,
      userActivation: true,
      grant,
      ticket: "t".repeat(43),
      sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:cid:1",
      acquisitionRecordId: `mar_${"5".repeat(32)}`
    })).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
