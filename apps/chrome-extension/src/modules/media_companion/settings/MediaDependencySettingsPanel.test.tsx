import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaDependencySettingsPanel } from "./MediaDependencySettingsPanel";
import type { MediaDependencyJob, MediaDependencyStatus, MediaDependencyTransport } from "../MediaDependencyRuntimeClient";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const READY_GENERATION = `depgen_${"a".repeat(64)}`;

function baseStatus(overrides: Partial<MediaDependencyStatus> = {}): MediaDependencyStatus {
  return {
    schemaVersion: "v3-media-dependency-status/v1",
    overallState: "action_required",
    generation: null,
    verifiedAt: null,
    activeJobId: null,
    latestJobId: null,
    routeReadiness: { credentialedMediaAsr: "blocked", failureCode: "V3_MEDIA_DEPENDENCY_NOT_READY" },
    dependencies: [
      { dependencyId: "yt-dlp", required: true, kind: "managed_tool", installMode: "managed_download", state: "missing", version: "2026.08.19", expectedSha256: "c".repeat(64), observedSha256: null, verifiedAt: null, storageScope: "windows_persistent", failureCode: "V3_MEDIA_DEPENDENCY_NOT_READY" },
      { dependencyId: "ffmpeg", required: true, kind: "system_tool", installMode: "system_verified", state: "ready", version: "6.1.1-3ubuntu5", expectedSha256: "a".repeat(64), observedSha256: "a".repeat(64), verifiedAt: "2026-10-19T00:00:00Z", storageScope: "runtime_system", failureCode: null },
      { dependencyId: "ffprobe", required: true, kind: "system_tool", installMode: "system_verified", state: "ready", version: null, expectedSha256: "b".repeat(64), observedSha256: "b".repeat(64), verifiedAt: "2026-10-19T00:00:00Z", storageScope: "runtime_system", failureCode: null },
      { dependencyId: "sensevoice", required: true, kind: "asr_model", installMode: "delegated_manager", state: "ready", version: "funasr-sensevoice-small-q8", expectedSha256: null, observedSha256: null, verifiedAt: "2026-10-19T00:00:00Z", storageScope: "asr_managed", failureCode: null }
    ],
    ...overrides
  };
}

function job(overrides: Partial<MediaDependencyJob> = {}): MediaDependencyJob {
  return {
    schemaVersion: "v3-media-dependency-installation/v1",
    jobId: `media_dep_job_${"b".repeat(32)}`,
    dependencyIds: ["yt-dlp"],
    state: "downloading",
    cancelable: true,
    progress: { stage: "downloading", percent: 42.5, bytesCompleted: 1024, bytesTotal: 4096 },
    failureCode: null,
    publishedGeneration: null,
    sequence: 3,
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:01Z",
    finishedAt: null,
    ...overrides
  };
}

function transportFor(handlers: Partial<MediaDependencyTransport>): MediaDependencyTransport {
  return {
    get: vi.fn(async (path: string) => {
      if (path.includes("/dependency-installations/")) return { job: job() };
      return baseStatus();
    }) as never,
    post: vi.fn(async () => ({ job: job() })) as never,
    delete: vi.fn(async () => ({ job: job({ state: "cancelled", cancelable: false, finishedAt: "2026-10-19T00:00:02Z" }) })) as never,
    ...handlers
  } as MediaDependencyTransport;
}

async function renderPanel(props: Partial<React.ComponentProps<typeof MediaDependencySettingsPanel>> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const element = (
    <MediaDependencySettingsPanel
      runtimeStatus="online"
      transport={transportFor({})}
      pollIntervalMs={10}
      {...props}
    />
  );
  await act(async () => {
    root.render(element);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("MediaDependencySettingsPanel", () => {
  it("A21 renders action_required with the exact recovery advice and enables repair", async () => {
    const { container, root } = await renderPanel();
    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("action_required");
    expect(container.textContent).toContain("需要修复本机依赖");
    const repair = container.querySelector("[data-testid='media-dependency-repair']") as HTMLButtonElement;
    expect(repair.disabled).toBe(false);
    // The advice names the actual class, not a generic "install failed".
    expect(container.querySelector("[data-testid='media-dependency-recovery']")?.textContent).toContain("依赖尚未就绪");
    await act(async () => root.unmount());
  });

  it("A21 renders ready with the verified generation and disables repair", async () => {
    const ready = baseStatus({
      overallState: "ready",
      generation: READY_GENERATION,
      verifiedAt: "2026-10-19T00:00:00Z",
      routeReadiness: { credentialedMediaAsr: "ready", failureCode: null },
      dependencies: baseStatus().dependencies.map((entry) => ({ ...entry, state: "ready" as const, failureCode: null, verifiedAt: entry.verifiedAt ?? "2026-10-19T00:00:00Z", observedSha256: entry.expectedSha256 }))
    });
    const { container, root } = await renderPanel({
      transport: transportFor({ get: vi.fn(async () => ready) as never })
    });
    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector("[data-testid='media-dependency-generation']")?.textContent).toContain(READY_GENERATION);
    expect((container.querySelector("[data-testid='media-dependency-repair']") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root.unmount());
  });

  it("A21 renders offline as a companion start action, not a failing button", async () => {
    const { container, root } = await renderPanel({ runtimeStatus: "offline" });
    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("offline");
    expect(container.querySelector("[data-testid='media-dependency-offline']")?.textContent).toContain("启动 Navia 本机伴侣");
    // No install affordance while the Runtime cannot verify anything.
    expect(container.querySelector("[data-testid='media-dependency-repair']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("A21 shows the Runtime's real progress and only offers cancel when cancelable", async () => {
    const installing = baseStatus({
      overallState: "installing",
      activeJobId: `media_dep_job_${"b".repeat(32)}`,
      latestJobId: `media_dep_job_${"b".repeat(32)}`
    });
    const { container, root } = await renderPanel({
      transport: transportFor({
        get: vi.fn(async (path: string) => (path.includes("dependency-installations/") ? { job: job() } : installing)) as never
      })
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const progress = container.querySelector("[data-testid='media-dependency-progress']");
    expect(progress).not.toBeNull();
    // No invented percentage: the bar reports exactly what the Runtime sent.
    expect(progress?.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("43");
    expect(progress?.textContent).toContain("42.5%");
    expect(container.querySelector("[data-testid='media-dependency-cancel']")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("A21 hides cancel inside the atomic commit window", async () => {
    const installing = baseStatus({
      overallState: "installing",
      activeJobId: `media_dep_job_${"b".repeat(32)}`
    });
    const { container, root } = await renderPanel({
      transport: transportFor({
        get: vi.fn(async (path: string) =>
          path.includes("dependency-installations/")
            ? { job: job({ state: "installing", cancelable: false, progress: { stage: "installing", percent: 100, bytesCompleted: 4096, bytesTotal: 4096 } }) }
            : installing) as never
      })
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(container.querySelector("[data-testid='media-dependency-progress']")).not.toBeNull();
    expect(container.querySelector("[data-testid='media-dependency-cancel']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("A21 renders a non-retryable system tool failure as a manual step", async () => {
    const blocked = baseStatus({
      overallState: "failed",
      dependencies: baseStatus().dependencies.map((entry) =>
        entry.dependencyId === "ffmpeg"
          ? { ...entry, state: "missing" as const, observedSha256: null, failureCode: "V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING" as const }
          : entry
      )
    });
    const { container, root } = await renderPanel({
      transport: transportFor({ get: vi.fn(async () => blocked) as never })
    });
    const recovery = container.querySelector("[data-testid='media-dependency-recovery']");
    expect(recovery?.getAttribute("data-category")).toBe("manual");
    expect(recovery?.textContent).toContain("缺少系统工具");
    expect(recovery?.textContent).toContain("管理员");
    await act(async () => root.unmount());
  });

  it("A22 resumes polling after Settings is left and re-entered", async () => {
    const activeJobId = `media_dep_job_${"b".repeat(32)}`;
    const installing = baseStatus({ overallState: "installing", activeJobId, latestJobId: activeJobId });
    const get = vi.fn(async (path: string) =>
      path.includes("dependency-installations/") ? { job: job({ jobId: activeJobId }) } : installing
    );
    const transport = transportFor({ get: get as never });

    const first = await renderPanel({ transport });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    await act(async () => first.root.unmount());

    const second = await renderPanel({ transport });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    expect(get.mock.calls.filter(([path]) => String(path).includes(activeJobId)).length).toBeGreaterThanOrEqual(2);
    expect(second.container.querySelector("[data-testid='media-dependency-progress']")).not.toBeNull();
    await act(async () => second.root.unmount());
  });

  it("A22 keeps an old ready generation usable while showing the latest repair failure", async () => {
    const latestJobId = `media_dep_job_${"c".repeat(32)}`;
    const ready = baseStatus({
      overallState: "ready",
      generation: READY_GENERATION,
      verifiedAt: "2026-10-19T00:00:00Z",
      latestJobId,
      routeReadiness: { credentialedMediaAsr: "ready", failureCode: null },
      dependencies: baseStatus().dependencies.map((entry) => ({ ...entry, state: "ready" as const, failureCode: null, observedSha256: entry.expectedSha256 }))
    });
    const transport = transportFor({
      get: vi.fn(async (path: string) => path.includes("dependency-installations/")
        ? { job: job({ jobId: latestJobId, state: "failed", cancelable: false, failureCode: "V3_MEDIA_DEPENDENCY_NETWORK_FAILED", finishedAt: "2026-10-19T00:00:02Z" }) }
        : ready) as never
    });
    const { container, root } = await renderPanel({ transport });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector("[data-testid='media-dependency-generation']")?.textContent).toContain(READY_GENERATION);
    expect(container.querySelector("[data-testid='media-dependency-recovery']")?.textContent).toContain("网络");
    expect((container.querySelector("[data-testid='media-dependency-repair']") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root.unmount());
  });

  it("A22 automatically rechecks when Runtime recovers without a manual click", async () => {
    const transport = transportFor({});
    const { container, root } = await renderPanel({ runtimeStatus: "offline", transport });
    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("offline");

    await act(async () => {
      root.render(<MediaDependencySettingsPanel runtimeStatus="online" transport={transport} pollIntervalMs={10} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transport.get).toHaveBeenCalledWith("/v1/media/dependencies");
    expect(container.querySelector("[data-testid='media-dependency-panel']")?.getAttribute("data-state")).toBe("action_required");
    await act(async () => root.unmount());
  });
});
