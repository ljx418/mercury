import { describe, expect, it, vi } from "vitest";
import { MediaAcquisitionClient, mediaSourceIdentity, selectCurrentMediaTab } from "../acquisition";
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
  it("selects the active Bilibili video when other video tabs are open", () => {
    expect(selectCurrentMediaTab([
      { id: 10, active: false, url: "https://www.bilibili.com/video/BV1old" },
      { id: 11, active: true, url: "https://www.bilibili.com/video/BV1current" },
      { id: 12, active: false, url: "https://example.com/" }
    ])).toMatchObject({ id: 11 });
  });

  it("keeps fail-closed ambiguity when no video candidate is active", () => {
    expect(() => selectCurrentMediaTab([
      { id: 10, active: false, url: "https://www.bilibili.com/video/BV1old" },
      { id: 11, active: false, url: "https://www.bilibili.com/video/BV1other" }
    ])).toThrow("V3_MEDIA_PORTAL_AMBIGUOUS");
  });

  it("uses portal-neutral identity and unlocks capture only after the third real failure", async () => {
    const resolve = vi.fn().mockResolvedValue({ disposition: "created", authoritativeTaskId: lease.taskId, task: execution().task });
    const execute = vi.fn().mockResolvedValue(execution());
    const record = vi.fn().mockResolvedValue({
      taskId: lease.taskId,
      failures: [...execution().failures, { route: "public_or_page_subtitle", failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" }],
      captureFallbackEligible: true
    });
    const client = new MediaAcquisitionClient({ collectCurrentContext: async () => context, resolve, execute, recordPublicSubtitleFailure: record });
    const result = await client.start(lease, { policyId: lease.policyId, policyRevision: 1 });
    expect(result.status).toBe("awaiting_capture");
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
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
      resolve: vi.fn().mockResolvedValue({ disposition: "created", authoritativeTaskId: lease.taskId, task: execution().task }),
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
      resolve: vi.fn(),
      execute: vi.fn(),
      recordPublicSubtitleFailure: vi.fn()
    });
    await expect(client.start({ ...lease, adapterId: "youtube" }, { policyId: lease.policyId, policyRevision: 1 }))
      .rejects.toThrow("V3_MEDIA_LEASE_TASK_MISMATCH");
  });

  it("starts from a configured Runtime session without creating a browser credential lease", async () => {
    const resolve = vi.fn().mockResolvedValue({ disposition: "created", authoritativeTaskId: "media_task_" + "9".repeat(32), task: execution().task });
    const execute = vi.fn().mockResolvedValue({
      ...execution(), outcome: "input_acquired", input: {
        route: "credentialed_subtitle", artifact: { artifactId: "a", kind: "subtitle", byteLength: 1, sha256: "0".repeat(64) },
        fallbackReasonCodes: [], subtitleDiscovery: null
      }, transcript: null
    });
    const client = new MediaAcquisitionClient({
      collectCurrentContext: async () => context,
      resolve,
      execute,
      recordPublicSubtitleFailure: vi.fn()
    });
    const taskId = "media_task_" + "9".repeat(32);
    const result = await client.startConfigured(taskId, "bilibili", { policyId: lease.policyId, policyRevision: 1 });
    expect(result.status).toBe("input_acquired");
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ taskId, adapterId: "bilibili" }));
  });

  it("attaches another surface to the authoritative task without executing", async () => {
    const authoritativeTaskId = "media_task_" + "8".repeat(32);
    const execute = vi.fn();
    const client = new MediaAcquisitionClient({
      collectCurrentContext: async () => context,
      resolve: vi.fn().mockResolvedValue({
        disposition: "attached", authoritativeTaskId,
        task: { ...execution().task, taskId: authoritativeTaskId },
      }),
      execute,
      recordPublicSubtitleFailure: vi.fn(),
    });
    const result = await client.startConfigured(lease.taskId, "bilibili", { policyId: lease.policyId, policyRevision: 1 });
    expect(result).toMatchObject({ taskId: authoritativeTaskId, disposition: "attached", status: "attached", execution: null });
    expect(execute).not.toHaveBeenCalled();
  });
});
