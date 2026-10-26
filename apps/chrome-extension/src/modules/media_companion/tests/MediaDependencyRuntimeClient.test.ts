import { describe, expect, it, vi } from "vitest";
import {
  createMediaDependencyClient,
  INSTALLABLE_DEPENDENCY_IDS,
  MediaDependencyClientError,
  mediaDependencyRecoveryAdvice,
  type MediaDependencyJob,
  type MediaDependencyStatus,
  type MediaDependencyTransport
} from "../MediaDependencyRuntimeClient";

const status: MediaDependencyStatus = {
  schemaVersion: "v3-media-dependency-status/v1",
  overallState: "action_required",
  generation: null,
  verifiedAt: null,
  activeJobId: null,
  latestJobId: null,
  routeReadiness: { credentialedMediaAsr: "blocked", failureCode: "V3_MEDIA_DEPENDENCY_NOT_READY" },
  dependencies: [
    {
      dependencyId: "yt-dlp",
      required: true,
      kind: "managed_tool",
      installMode: "managed_download",
      state: "missing",
      version: "2026.08.19",
      expectedSha256: "1fa6733c37ea6fb51c99ad8fe785b7b7e5f3246c9b980230329d4fb72ed8d4d6",
      observedSha256: null,
      verifiedAt: null,
      storageScope: "windows_persistent",
      failureCode: "V3_MEDIA_DEPENDENCY_NOT_READY"
    },
    { dependencyId: "ffmpeg", required: true, kind: "system_tool", installMode: "system_verified", state: "ready", version: "6.1.1-3ubuntu5", expectedSha256: "a".repeat(64), observedSha256: "a".repeat(64), verifiedAt: "2026-10-19T00:00:00Z", storageScope: "runtime_system", failureCode: null },
    { dependencyId: "ffprobe", required: true, kind: "system_tool", installMode: "system_verified", state: "ready", version: null, expectedSha256: "b".repeat(64), observedSha256: "b".repeat(64), verifiedAt: "2026-10-19T00:00:00Z", storageScope: "runtime_system", failureCode: null },
    { dependencyId: "sensevoice", required: true, kind: "asr_model", installMode: "delegated_manager", state: "ready", version: "funasr-sensevoice-small-q8", expectedSha256: null, observedSha256: null, verifiedAt: "2026-10-19T00:00:00Z", storageScope: "asr_managed", failureCode: null }
  ]
};

const job: MediaDependencyJob = {
  schemaVersion: "v3-media-dependency-installation/v1",
  jobId: `media_dep_job_${"a".repeat(32)}`,
  dependencyIds: ["yt-dlp"],
  state: "downloading",
  cancelable: true,
  progress: { stage: "downloading", percent: 42, bytesCompleted: 1024, bytesTotal: 4096 },
  failureCode: null,
  publishedGeneration: null,
  sequence: 3,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:01Z",
  finishedAt: null
};

function makeTransport(
  overrides: Partial<MediaDependencyTransport> = {}
): MediaDependencyTransport {
  return {
    get: vi.fn(async () => status) as unknown as MediaDependencyTransport["get"],
    post: vi.fn(async () => ({ job })) as unknown as MediaDependencyTransport["post"],
    delete: vi.fn(async () => ({ job })) as unknown as MediaDependencyTransport["delete"],
    ...overrides
  };
}

describe("MediaDependencyRuntimeClient", () => {
  it("reads the status and rejects an incomplete or duplicated dependency set", async () => {
    const client = createMediaDependencyClient(makeTransport());
    await expect(client.status()).resolves.toMatchObject({ overallState: "action_required" });

    const broken = { ...status, dependencies: status.dependencies.slice(0, 3) };
    const brokenClient = createMediaDependencyClient(
      makeTransport({ get: vi.fn(async () => broken) as unknown as MediaDependencyTransport["get"] })
    );
    await expect(brokenClient.status()).rejects.toBeInstanceOf(MediaDependencyClientError);

    const duplicated = { ...status, dependencies: [status.dependencies[0], status.dependencies[0], status.dependencies[2], status.dependencies[3]] };
    const duplicatedClient = createMediaDependencyClient(
      makeTransport({ get: vi.fn(async () => duplicated) as unknown as MediaDependencyTransport["get"] })
    );
    await expect(duplicatedClient.status()).rejects.toBeInstanceOf(MediaDependencyClientError);
  });

  it("sends exactly the frozen install body and never a url, path or hash", async () => {
    const transport = makeTransport();
    const client = createMediaDependencyClient(transport);
    await client.startInstall();

    const [path, body] = (transport.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe("/v1/media/dependency-installations");
    expect(body).toEqual({ dependencyIds: ["yt-dlp"] });
    expect(JSON.stringify(body)).not.toMatch(/https?:|sha256|path/i);
  });

  it("refuses to install anything but the single installable dependency", async () => {
    const client = createMediaDependencyClient(makeTransport());
    await expect(client.startInstall(["ffmpeg"])).rejects.toBeInstanceOf(MediaDependencyClientError);
    expect(INSTALLABLE_DEPENDENCY_IDS).toEqual(["yt-dlp"]);
  });

  it("refuses a malformed job id before touching the transport", async () => {
    const transport = makeTransport();
    const client = createMediaDependencyClient(transport);
    await expect(client.job("not-a-job")).rejects.toBeInstanceOf(MediaDependencyClientError);
    await expect(client.cancel("media_dep_job_short")).rejects.toBeInstanceOf(MediaDependencyClientError);
    expect(transport.get).not.toHaveBeenCalled();
    expect(transport.delete).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range progress and a negative sequence", async () => {
    const overProgress = { ...job, progress: { ...job.progress, percent: 140 } };
    const badProgress = createMediaDependencyClient(makeTransport({ get: vi.fn(async () => ({ job: overProgress })) as never }));
    await expect(badProgress.job(job.jobId)).rejects.toBeInstanceOf(MediaDependencyClientError);

    const negativeSequence = { ...job, sequence: -1 };
    const badSequence = createMediaDependencyClient(makeTransport({ get: vi.fn(async () => ({ job: negativeSequence })) as never }));
    await expect(badSequence.job(job.jobId)).rejects.toBeInstanceOf(MediaDependencyClientError);
  });

  it("gives each frozen failure class its own honest next step", () => {
    const network = mediaDependencyRecoveryAdvice("V3_MEDIA_DEPENDENCY_NETWORK_FAILED");
    const space = mediaDependencyRecoveryAdvice("V3_MEDIA_DEPENDENCY_DISK_SPACE_LOW");
    const hash = mediaDependencyRecoveryAdvice("V3_MEDIA_DEPENDENCY_HASH_MISMATCH");
    const system = mediaDependencyRecoveryAdvice("V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING");
    const selfTest = mediaDependencyRecoveryAdvice("V3_MEDIA_DEPENDENCY_SELF_TEST_FAILED");

    expect(network.title).not.toBe(space.title);
    expect(hash.title).not.toBe(system.title);
    expect(selfTest.title).not.toBe(hash.title);
    expect(system.retryable).toBe(false);
    expect(network.retryable).toBe(true);
    // No advice may leak a path, a URL or a command line.
    for (const advice of [network, space, hash, system, selfTest]) {
      expect(advice.detail).not.toMatch(/https?:|\/[a-z]+\/|--/);
    }
  });
});
