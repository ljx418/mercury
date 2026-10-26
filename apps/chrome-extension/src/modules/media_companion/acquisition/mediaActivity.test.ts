import { describe, expect, it } from "vitest";
import type { MediaTranscriptProjection } from "../../../runtimeClient";
import { resolveMediaActivity } from "./mediaActivity";

const taskId = `media_task_${"a".repeat(32)}`;
const projection = (state: MediaTranscriptProjection["state"]): MediaTranscriptProjection => ({
  schemaVersion: "v3-media-transcript-projection/v1", taskId, sourceIdentity: "bilibili:video:BVtest", adapterId: "bilibili", revision: 2,
  updatedAt: "2026-10-12T00:00:00Z", state, route: "credentialed_media_asr", progressPercent: 100,
  failureCode: null, terminal: state === "succeeded" || state === "failed", cleanupStatus: "complete", canCancel: false, canRetry: false,
  failures: [], segments: [],
});

describe("resolveMediaActivity", () => {
  it("uses the task projection instead of stale local transcribing state", () => {
    expect(resolveMediaActivity(projection("succeeded"), "ready", taskId, "transcribing")).toMatchObject({ label: "视频内容已就绪", tone: "ready", running: false });
  });
  it("keeps transcript complete separate from outline publication", () => {
    expect(resolveMediaActivity(projection("succeeded"), "materializing", null, "transcribing")).toMatchObject({ label: "正在生成图文大纲", tone: "busy" });
  });
  it("does not accept another task's outline as current", () => {
    expect(resolveMediaActivity(projection("succeeded"), "ready", `media_task_${"b".repeat(32)}`, "succeeded")).toMatchObject({ tone: "busy" });
  });
  it("reports authoritative failure", () => {
    expect(resolveMediaActivity(projection("failed"), "ready", taskId, "succeeded")).toMatchObject({ tone: "error", running: false });
  });
  it("restores a published outline after its temporary transcript task was cleaned", () => {
    expect(resolveMediaActivity(null, "ready", taskId, "idle")).toMatchObject({ label: "视频内容已就绪", tone: "ready" });
  });
  it("surfaces a created-task watchdog only while the same task has not advanced", () => {
    expect(resolveMediaActivity(projection("created"), "idle", null, "failed", "V3_MEDIA_TASK_AWAITING_START"))
      .toMatchObject({ label: "任务尚未开始", tone: "error", running: false });
    expect(resolveMediaActivity(projection("transcribing"), "idle", null, "failed", "V3_MEDIA_TASK_AWAITING_START"))
      .toMatchObject({ tone: "busy", running: true });
  });
});
