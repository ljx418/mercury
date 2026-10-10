import type { MouseEvent } from "react";
import { captureFallbackEligible, type CaptureRouteFailure } from "./contracts";

export type TrustedTabCaptureCardProps = {
  failures: readonly CaptureRouteFailure[];
  state: "awaiting_user" | "starting" | "capturing" | "stopping" | "transcribing" | "succeeded" | "failed";
  error?: string | null;
  onStart(event: MouseEvent<HTMLButtonElement>): void;
  onFinish(): void;
  onCancel(): void;
};

export function TrustedTabCaptureCard(props: TrustedTabCaptureCardProps) {
  if (!captureFallbackEligible(props.failures)) return null;
  const active = props.state === "capturing";
  return (
    <section className="media-capture-card" data-testid="media-capture-card" aria-labelledby="media-capture-title">
      <div>
        <span className="media-capture-kicker">最终本地回退</span>
        <h3 id="media-capture-title">捕获当前标签页音频</h3>
        <p>前三种获取方式均不可用。只有点击后才捕获当前 B站标签页，音频仅发送到本机 Runtime，并在任务结束后清理。</p>
      </div>
      <ol aria-label="已失败的媒体获取路径">
        {props.failures.map((failure) => <li key={failure.route}>{failure.route}：{failure.failureCode}</li>)}
      </ol>
      {props.error ? <p role="alert">{props.error}</p> : null}
      {props.state === "awaiting_user" || props.state === "failed" ? (
        <button type="button" data-testid="media-capture-start" onClick={props.onStart}>捕获当前标签页</button>
      ) : null}
      {props.state === "starting" ? <p role="status">Chrome 要求当前页先获得一次扩展调用授权。请点击浏览器工具栏中的 Navia 图标，随后会自动开始捕获。</p> : null}
      {active ? (
        <div className="media-capture-actions">
          <span role="status">正在捕获，本页声音会继续播放</span>
          <button type="button" data-testid="media-capture-finish" onClick={props.onFinish}>完成并转写</button>
          <button type="button" data-testid="media-capture-cancel" onClick={props.onCancel}>取消</button>
        </div>
      ) : null}
      {props.state === "stopping" ? <span role="status">正在停止并清理…</span> : null}
      {props.state === "transcribing" ? <span role="status">音频捕获已结束，SenseVoice 正在本机转写…</span> : null}
      {props.state === "succeeded" ? <span role="status">本机转写已完成。</span> : null}
    </section>
  );
}
