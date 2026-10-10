import type { MediaAcquisitionInput } from "../../../runtimeClient";

export type MediaAcquisitionUiState = "idle" | "starting" | "input_acquired" | "transcribing" | "succeeded" | "awaiting_capture" | "blocked" | "failed";

export function MediaAcquisitionStatusCard(props: {
  state: MediaAcquisitionUiState;
  input: MediaAcquisitionInput | null;
  failureCode: string | null;
}) {
  if (props.state === "idle") return null;
  const title = props.state === "starting"
    ? "正在尝试字幕与本地媒体"
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
    {props.state === "transcribing" ? <p role="status" aria-live="polite">SenseVoice 正在本机处理音频，原始音频将在任务结束后清理。</p> : null}
    {props.state === "succeeded" ? <p role="status">转写结果已生成，可进入下一阶段的视觉证据与大纲处理。</p> : null}
    {props.input ? <p role="status">路线：{props.input.route} · {props.input.artifact.byteLength.toLocaleString()} bytes</p> : null}
    {props.state === "awaiting_capture" ? <p>请使用下方按钮，由本次可信点击启动当前标签页本地音频捕获。</p> : null}
    {props.failureCode ? <p role="alert">{props.failureCode}</p> : null}
  </section>;
}
