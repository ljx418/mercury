import type { MediaTranscriptProjection } from "../../../runtimeClient";
import type { MediaAcquisitionUiState } from "./MediaAcquisitionStatusCard";

export type MediaActivity = {
  state: MediaAcquisitionUiState;
  label: string;
  tone: "ready" | "busy" | "error";
  running: boolean;
};

export function resolveMediaActivity(
  projection: MediaTranscriptProjection | null,
  outlineState: "idle" | "materializing" | "ready" | "failed",
  outlineTaskId: string | null,
  fallback: MediaAcquisitionUiState,
  failureCode: string | null = null,
): MediaActivity {
  if (projection?.state === "created" && fallback === "failed" && failureCode === "V3_MEDIA_TASK_AWAITING_START") {
    return { state: "failed", label: "任务尚未开始", tone: "error", running: false };
  }
  if (projection) {
    if (["blocked", "failed", "cancelled"].includes(projection.state)) {
      return { state: "failed", label: projection.state === "cancelled" ? "视频分析已取消" : "视频分析需要处理", tone: "error", running: false };
    }
    if (projection.state === "succeeded" || projection.state === "degraded") {
      if (outlineState === "ready" && outlineTaskId === projection.taskId) {
        return { state: "succeeded", label: "视频内容已就绪", tone: "ready", running: false };
      }
      if (outlineState === "failed") {
        return { state: "failed", label: "图文大纲生成失败", tone: "error", running: false };
      }
      return { state: "transcribing", label: outlineState === "materializing" ? "正在生成图文大纲" : "转写完成，正在准备大纲", tone: "busy", running: true };
    }
    const stage = projection.state === "transcribing" ? "正在转写视频"
      : projection.state === "validating" || projection.state === "cleaning" ? "正在校验与清理转写"
      : projection.state === "awaiting_trusted_capture" ? "等待当前标签页采集"
      : "正在获取视频内容";
    return { state: projection.state === "awaiting_trusted_capture" ? "awaiting_capture" : "transcribing", label: stage, tone: "busy", running: true };
  }
  if (outlineState === "ready" && outlineTaskId) {
    return { state: "succeeded", label: "视频内容已就绪", tone: "ready", running: false };
  }
  if (fallback === "published") return { state: "published", label: "正在恢复视频内容", tone: "busy", running: true };
  if (["starting", "attached", "input_acquired", "transcribing", "awaiting_capture"].includes(fallback)) {
    return { state: fallback, label: "正在准备视频分析", tone: "busy", running: true };
  }
  if (fallback === "failed" || fallback === "blocked") return { state: fallback, label: "视频分析需要处理", tone: "error", running: false };
  if (fallback === "succeeded") return { state: fallback, label: "视频转写已完成", tone: "ready", running: false };
  return { state: "idle", label: "Navia 已就绪", tone: "ready", running: false };
}
