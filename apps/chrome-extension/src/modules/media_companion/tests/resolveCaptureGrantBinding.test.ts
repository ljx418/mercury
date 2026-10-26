import { describe, expect, it } from "vitest";
import { resolveCaptureGrantBinding } from "../capture";

const TASK = `media_task_${"a".repeat(32)}`;

describe("resolveCaptureGrantBinding", () => {
  it("uses the authoritative task and active portal for configured-session capture", () => {
    expect(resolveCaptureGrantBinding(null, TASK, "bilibili")).toEqual({
      taskId: TASK,
      adapterId: "bilibili",
    });
  });

  it("supports the browser credential lease route", () => {
    expect(resolveCaptureGrantBinding({ taskId: TASK, adapterId: "bilibili" }, null, null)).toEqual({
      taskId: TASK,
      adapterId: "bilibili",
    });
  });

  it("prefers current authority over a stale lease and rejects malformed bindings", () => {
    const current = `media_task_${"b".repeat(32)}`;
    expect(resolveCaptureGrantBinding({ taskId: TASK, adapterId: "youtube" }, current, "bilibili")).toEqual({
      taskId: current,
      adapterId: "bilibili",
    });
    expect(resolveCaptureGrantBinding(null, "bad-task", "bilibili")).toBeNull();
    expect(resolveCaptureGrantBinding(null, TASK, "Bad Adapter")).toBeNull();
  });
});
