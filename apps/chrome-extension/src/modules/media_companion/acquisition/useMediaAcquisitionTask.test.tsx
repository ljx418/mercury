import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeRequestError, type MediaTranscriptProjection } from "../../../runtimeClient";
import { useMediaAcquisitionTask } from "./useMediaAcquisitionTask";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getProjection = vi.fn<(requestedTaskId: string) => Promise<MediaTranscriptProjection>>();
const getLatestProjection = vi.fn<(sourceIdentity: string) => Promise<MediaTranscriptProjection | null>>();
vi.mock("../../../runtimeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../runtimeClient")>()),
  getMediaTranscriptProjection: (requestedTaskId: string) => getProjection(requestedTaskId),
  getLatestMediaTranscriptProjection: (sourceIdentity: string) => getLatestProjection(sourceIdentity),
}));

const taskId = `media_task_${"a".repeat(32)}`;
const sourceIdentity = "portal:bilibili:BV1CURRENT:cid:1";
const projection = {
  taskId,
  sourceIdentity,
  revision: 1,
  terminal: true,
} as MediaTranscriptProjection;

function Probe({
  selectedTaskId = taskId,
  selectedSourceIdentity = sourceIdentity
}: {
  selectedTaskId?: string | null;
  selectedSourceIdentity?: string | null;
}) {
  const task = useMediaAcquisitionTask({ taskId: selectedTaskId, sourceIdentity: selectedSourceIdentity }, { intervalMs: 100 });
  return <div data-testid="projection-state" data-state={task.projection?.state ?? "none"}>
    <span>{task.projection?.taskId ?? (task.loading ? "waiting" : task.error ?? "empty")}</span>
    <button type="button" onClick={() => task.acceptProjection({ ...projection, revision: 2, state: "cancelled" })}>Apply cancel</button>
  </div>;
}

describe("useMediaAcquisitionTask", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    getProjection.mockReset();
    getLatestProjection.mockReset();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    vi.useRealTimers();
  });

  it("keeps polling a newly created task after an initial 404", async () => {
    getProjection
      .mockRejectedValueOnce(new RuntimeRequestError({ kind: "api", httpStatus: 404, code: "V3_MEDIA_TASK_INVALID", message: "not found" }))
      .mockResolvedValueOnce(projection);
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("span")?.textContent).toBe("waiting");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(getProjection).toHaveBeenCalledTimes(2);
    expect(host.querySelector("span")?.textContent).toBe(taskId);
    await act(async () => root.unmount());
  });

  it("does not treat authentication errors as a creation race", async () => {
    getProjection.mockRejectedValue(new RuntimeRequestError({ kind: "authentication", httpStatus: 401, code: "SESSION_INVALID", message: "not authorized" }));
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("span")?.textContent).toBe("not authorized");
    await act(async () => root.unmount());
  });

  it("applies the cancellation response after terminal transcript polling has stopped", async () => {
    getProjection.mockResolvedValue({ ...projection, state: "succeeded", canCancel: false });
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("succeeded");
    await act(async () => { host.querySelector("button")?.click(); });
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("cancelled");
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(getProjection).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it("continues polling a cancellable success until source authority cancels it", async () => {
    getProjection
      .mockResolvedValueOnce({ ...projection, state: "succeeded", canCancel: true })
      .mockResolvedValueOnce({ ...projection, state: "cancelled", canCancel: false, revision: 2 });
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("succeeded");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("cancelled");
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(getProjection).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it("does not apply a late cancellation response after switching to another task", async () => {
    const otherTaskId = `media_task_${"b".repeat(32)}`;
    getProjection.mockImplementation(async (requestedTaskId) => ({
      ...projection, taskId: requestedTaskId, state: requestedTaskId === taskId ? "succeeded" : "created"
    }));
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    await act(async () => { root.render(<Probe selectedTaskId={otherTaskId} />); await Promise.resolve(); });
    expect(host.querySelector("span")?.textContent).toBe(otherTaskId);
    await act(async () => { host.querySelector("button")?.click(); });
    expect(host.querySelector("span")?.textContent).toBe(otherTaskId);
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("created");
    await act(async () => root.unmount());
  });

  it("does not expose the previous task while navigation has no current authority", async () => {
    getProjection.mockResolvedValue({ ...projection, state: "succeeded" });
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("span")?.textContent).toBe(taskId);

    await act(async () => {
      root.render(<Probe selectedTaskId={null} selectedSourceIdentity={null} />);
      await Promise.resolve();
    });
    expect(host.querySelector("span")?.textContent).toBe("empty");
    await act(async () => root.unmount());
  });

  it("rejects a task lookup result whose source identity belongs to the previous page", async () => {
    const nextSourceIdentity = "portal:bilibili:BV1NEXT:cid:1";
    getProjection.mockResolvedValue({ ...projection, state: "succeeded" });
    const root = createRoot(host);
    await act(async () => {
      root.render(<Probe selectedSourceIdentity={nextSourceIdentity} />);
      await Promise.resolve();
    });

    expect(host.querySelector("span")?.textContent).toBe("waiting");
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("none");
    await act(async () => root.unmount());
  });

  it("hides a prior projection synchronously when only the source authority changes", async () => {
    getProjection.mockResolvedValue({ ...projection, state: "succeeded" });
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); await Promise.resolve(); });
    expect(host.querySelector("span")?.textContent).toBe(taskId);

    getLatestProjection.mockImplementation(() => new Promise(() => undefined));
    await act(async () => {
      root.render(<Probe selectedTaskId={null} selectedSourceIdentity="portal:bilibili:BV1NEXT:cid:1" />);
      await Promise.resolve();
    });
    expect(host.querySelector("span")?.textContent).toBe("waiting");
    expect(host.querySelector("[data-testid='projection-state']")?.getAttribute("data-state")).toBe("none");
    await act(async () => root.unmount());
  });
});
