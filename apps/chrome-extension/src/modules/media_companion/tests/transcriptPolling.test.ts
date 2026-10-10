import { describe, expect, it, vi } from "vitest";
import { waitForMediaTranscript } from "../acquisition";
import type { MediaTranscriptTask } from "../../../runtimeClient";

describe("waitForMediaTranscript", () => {
  it("waits for a real terminal task without treating queued as success", async () => {
    const tasks: MediaTranscriptTask[] = [
      { taskId: "media_task_1", state: "queued" },
      { taskId: "media_task_1", state: "transcribing" },
      { taskId: "media_task_1", state: "succeeded", result: { status: "succeeded", segmentCount: 3, failureCode: null } }
    ];
    const read = vi.fn(async () => ({ task: tasks.shift()! }));
    const task = await waitForMediaTranscript("media_task_1", { read, delay: async () => undefined });
    expect(task.state).toBe("succeeded");
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("fails on timeout instead of manufacturing a terminal result", async () => {
    const read = vi.fn(async () => ({ task: { taskId: "media_task_1", state: "queued" as const } }));
    await expect(waitForMediaTranscript("media_task_1", { read, delay: async () => undefined, maximumAttempts: 2 }))
      .rejects.toThrow("V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT");
  });
});
