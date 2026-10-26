import type { MediaAcquisitionInput } from "../../../runtimeClient";

export type MediaAcquisitionUiState = "idle" | "starting" | "attached" | "published" | "input_acquired" | "transcribing" | "succeeded" | "awaiting_capture" | "blocked" | "failed";

const recoveryMessages: Record<string, string> = {
  V3_MEDIA_TASK_AWAITING_START: "当前授权下的新任务已创建，但尚未开始。点击重试继续同一任务。",
  V3_MEDIA_SOURCE_TASK_ACTIVE: "另一个本机 Runtime 正在处理此视频。请关闭重复启动的服务后重试。",
  V3_MEDIA_AUTHORITY_OWNERSHIP_UNCERTAIN: "无法确认旧任务是否仍在运行；为避免重复处理，当前视频暂不重试。",
  V3_MEDIA_CANCELLATION_IN_PROGRESS: "正在清理上一次分析的临时内容，完成后才能重试。",
  V3_MEDIA_CLEANUP_INCOMPLETE: "旧任务清理未完成。排除文件占用并重启本机伴侣后，点击重试以核验并清理；核验通过前不会创建新任务。"
};

export function MediaAcquisitionStatusCard(props: {
  state: MediaAcquisitionUiState;
  input: MediaAcquisitionInput | null;
  failureCode: string | null;
}) {
  if (props.state === "idle") return null;
  const title = props.state === "starting"
    ? "正在尝试字幕与本地媒体"
    : props.state === "attached"
      ? "已连接到此视频的分析任务"
      : props.state === "published"
        ? "此视频已有分析结果"
    : props.state === "input_acquired"
      ? "已取得当前视频输入"
      : props.state === "transcribing"
        ? "正在本机转写"
        : props.state === "succeeded"
          ? "本机转写已完成"
      : props.state === "awaiting_capture"
        ? "前三种方式不可用"
        : props.state === "blocked"
          ? "当前路线已阻塞"
          : "媒体任务启动失败";
  return <section className={`media-acquisition-status is-${props.state}`} aria-labelledby="media-acquisition-status-title">
    <span className="media-consent-kicker">V3-2 MEDIA ACQUISITION</span>
    <h3 id="media-acquisition-status-title">{title}</h3>
    {props.state === "starting" ? <p role="status" aria-live="polite">按顺序检查凭据字幕、当前分 P 媒体和公开字幕…</p> : null}
    {props.state === "attached" ? <p role="status">另一 Navia 界面已在处理同一视频；这里同步显示同一任务进度。</p> : null}
    {props.state === "published" ? <p role="status">正在恢复本机已发布的视频内容。</p> : null}
    {props.state === "transcribing" ? <p role="status" aria-live="polite">SenseVoice 正在本机处理音频，原始音频将在任务结束后清理。</p> : null}
    {props.state === "succeeded" ? <p role="status">转写结果已生成，可进入下一阶段的视觉证据与大纲处理。</p> : null}
    {props.input ? <p role="status">路线：{props.input.route} · {props.input.artifact.byteLength.toLocaleString()} bytes</p> : null}
    {props.state === "awaiting_capture" ? <p>请使用下方按钮，由本次可信点击启动当前标签页本地音频捕获。</p> : null}
    {props.failureCode ? <p role="alert">{recoveryMessages[props.failureCode] ?? props.failureCode}</p> : null}
  </section>;
}
