import type { MediaOutlineTask, MediaTranscriptProjection } from "../../../runtimeClient";
import { MediaAcquisitionProgress } from "./MediaAcquisitionProgress";

export function MediaTranscriptQuickCard(props: {
  projection: MediaTranscriptProjection;
  onOpenWorkspace(): void;
  onCancel?(): void;
  onRetry?(): void;
  actionState?: "cancelling" | "retrying" | null;
  credentialBinding?: string;
  outlineTask?: MediaOutlineTask | null;
  outlineState?: "idle" | "materializing" | "ready" | "failed";
  outlineError?: string | null;
  onRetryOutline?(): void;
}) {
  return <section
    className="media-transcript-quick-card"
    aria-labelledby="media-transcript-quick-title"
    data-testid="media-transcript-quick-card"
    data-task-id={props.projection.taskId}
    data-cleanup-status={props.projection.cleanupStatus}
    data-credential-binding={props.credentialBinding}
  >
    <div className="media-transcript-quick-heading">
      <div><span>当前视频任务</span><h3 id="media-transcript-quick-title">字幕与本地转写</h3></div>
      <button type="button" data-testid="media-transcript-open" disabled={!props.outlineTask} onClick={props.onOpenWorkspace}>查看完整大纲</button>
    </div>
    <MediaAcquisitionProgress projection={props.projection} />
    {props.projection.failureCode ? <p role="alert">{props.projection.failureCode}</p> : null}
    {props.projection.segments.length ? <p>{props.projection.segments[0].text}</p> : null}
    {props.outlineState === "materializing" ? <p role="status" data-testid="media-outline-materializing">正在生成可恢复的图文大纲…</p> : null}
    {props.outlineTask?.projections?.outline ? <div className="media-quick-outline" data-testid="media-quick-outline">
      <strong>{props.outlineTask.projections.outline.title}</strong>
      <p>{props.outlineTask.projections.outline.summary}</p>
      <small>{props.outlineTask.state === "degraded" ? "仅基于真实转写；画面证据尚不可用" : "转写与画面证据已闭合"}</small>
    </div> : null}
    {props.outlineState === "failed" ? <div role="alert"><p>{props.outlineError ?? "图文大纲生成失败"}</p>{props.onRetryOutline ? <button type="button" onClick={props.onRetryOutline}>重试生成大纲</button> : null}</div> : null}
    {props.actionState === "cancelling" ? <p role="status" data-testid="media-task-cleaning">正在停止并清理任务资源…</p> : null}
    {props.actionState === "retrying" ? <p role="status" data-testid="media-task-retrying">正在创建全新的分析任务…</p> : null}
    {props.projection.canCancel && props.onCancel ? <button type="button" data-testid="media-transcript-cancel" disabled={Boolean(props.actionState)} onClick={props.onCancel}>取消并清理</button> : null}
    {props.projection.canRetry && props.onRetry ? <button type="button" data-testid="media-transcript-retry" disabled={Boolean(props.actionState)} onClick={props.onRetry}>重新分析</button> : null}
  </section>;
}
