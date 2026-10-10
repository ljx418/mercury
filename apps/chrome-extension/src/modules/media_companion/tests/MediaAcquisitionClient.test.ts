import { describe, expect, it, vi } from "vitest";
import { MediaAcquisitionClient, mediaSourceIdentity } from "../acquisition";
import type { MediaPageContext } from "../contracts";
import type { PortalCredentialLease } from "../session";

const context: MediaPageContext = {
  platform: "bilibili",
  adapterId: "bilibili",
  adapterRevision: 1,
  canonicalUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP",
  mediaId: "BV1ZpYd66ELP",
  playbackUnitId: "41828944992",
  part: { id: "1", index: 1, count: 1, label: null },
  title: "real page",
  author: "author",
  durationSeconds: 792,
  currentTimeSeconds: 0,
  transcriptAvailability: "unavailable",
  observedAt: "2026-10-07T00:00:00Z"
};

const lease = {
  schemaVersion: "portal-credential-lease/v1",
  leaseId: "pcl_" + "1".repeat(32),
  envelopeId: "pce_" + "2".repeat(32),
  taskId: "media_task_" + "3".repeat(32),
  adapterId: "bilibili",
  policyId: "bilibili-media-consent/v1",
  policyRevision: 1,
  browserSessionBindingSha256: "4".repeat(64),
  credentialNameSetSha256: "5".repeat(64),
  credentialCount: 1,
  transportMode: "one_shot_envelope",
  secretStorage: "runtime_process_memory_only",
  serverValidationStatus: "not_performed",
  issuedAt: "2026-10-07T00:00:00Z",
  expiresAt: "2026-10-07T00:01:00Z",
  state: "active",
  failureCode: null
} as PortalCredentialLease;

function execution() {
  return {
    task: {
      schemaVersion: "media-acquisition-task/v1" as const,
      taskId: lease.taskId,
      sourceIdentity: mediaSourceIdentity(context),
      adapterId: "bilibili",
      mediaId: context.mediaId,
      playbackUnitId: context.playbackUnitId,
      partId: "1",
      state: "acquiring" as const,
      consentPolicyId: lease.policyId,
      consentPolicyRevision: 1,
      failureCode: null
    },
    outcome: "awaiting_public_subtitle" as const,
    input: null,
    failures: [
      { route: "credentialed_subtitle" as const, failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" },
      { route: "credentialed_media_asr" as const, failureCode: "V3_MEDIA_RUNTIME_OFFLINE" }
    ]
  };
}

describe("MediaAcquisitionClient", () => {
  it("uses portal-neutral identity and unlocks capture only after the third real failure", async () => {
    const create = vi.fn().mockResolvedValue({ task: execution().task });
    const execute = vi.fn().mockResolvedValue(execution());
    const record = vi.fn().mockResolvedValue({
      taskId: lease.taskId,
      failures: [...execution().failures, { route: "public_or_page_subtitle", failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" }],
      captureFallbackEligible: true
    });
    const client = new MediaAcquisitionClient({ collectCurrentContext: async () => context, create, execute, recordPublicSubtitleFailure: record });
    const result = await client.start(lease, { policyId: lease.policyId, policyRevision: 1 });
    expect(result.status).toBe("awaiting_capture");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      sourceIdentity: "portal:bilibili:BV1ZpYd66ELP:41828944992:1",
      mediaId: "BV1ZpYd66ELP",
      playbackUnitId: "41828944992"
    }));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("does not turn an available page transcript into a capture failure", async () => {
    const record = vi.fn();
    const client = new MediaAcquisitionClient({
      collectCurrentContext: async () => ({ ...context, transcriptAvailability: "available" }),
      create: vi.fn().mockResolvedValue({ task: execution().task }),
      execute: vi.fn().mockResolvedValue(execution()),
      recordPublicSubtitleFailure: record
    });
    const result = await client.start(lease, { policyId: lease.policyId, policyRevision: 1 });
    expect(result).toMatchObject({ status: "blocked", failureCode: "V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE" });
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects a lease from another portal", async () => {
    const client = new MediaAcquisitionClient({
      collectCurrentContext: async () => context,
      create: vi.fn(),
      execute: vi.fn(),
      recordPublicSubtitleFailure: vi.fn()
    });
    await expect(client.start({ ...lease, adapterId: "youtube" }, { policyId: lease.policyId, policyRevision: 1 }))
      .rejects.toThrow("V3_MEDIA_LEASE_TASK_MISMATCH");
  });
});
