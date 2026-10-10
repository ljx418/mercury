import { useState } from "react";
import { cancelMediaTranscriptProjection } from "../../../runtimeClient";
import { LocalRuntimeAccess } from "../../knowledge_workspace/LocalRuntimeAccess";
import { MediaCaptureMessageClient } from "../capture";
import { MediaAcquisitionProgress } from "./MediaAcquisitionProgress";
import { MediaTranscriptViewer } from "./MediaTranscriptViewer";
import { useMediaAcquisitionTask } from "./useMediaAcquisitionTask";

export function MediaTranscriptWorkspacePage({ taskId }: { taskId: string }) {
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const { projection, error, loading } = useMediaAcquisitionTask({ taskId: runtimeConnected ? taskId : null });
  async function cancel() {
    if (actionBusy) return;
    const startedAt = Date.now();
    setActionBusy(true);
    setActionError(null);
    try {
      if (projection?.state === "capturing") {
        const response = await new MediaCaptureMessageClient((message) => chrome.runtime.sendMessage(message)).stop("cancelled");
        if (!response.ok) throw new Error(response.failureCode);
      }
      await cancelMediaTranscriptProjection(taskId);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "V3_MEDIA_TASK_CANCEL_FAILED");
    } finally {
      const remaining = 600 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setActionBusy(false);
    }
  }
  return <main className="media-workspace-shell" data-testid="media-transcript-workspace">
    <header className="media-workspace-header">
      <div><span>V3 TRANSCRIPT</span><h1>当前视频转写</h1></div>
      <a href="#/media/current">返回当前视频</a>
    </header>
    <div className="media-workspace-content">
      <LocalRuntimeAccess title="本机 Runtime 安全会话" onChange={(change) => setRuntimeConnected(change.status === "connected")} />
      {loading ? <p role="status">正在从本机 Runtime 读取任务…</p> : null}
      {error ? <section className="media-workspace-empty" role="alert"><h2>无法读取该任务</h2><p>{error}</p><a href="#/media/current">返回媒体首页</a></section> : null}
      {projection ? <>
        <section className="media-transcript-summary">
          <MediaAcquisitionProgress projection={projection} />
          {projection.failureCode ? <p role="alert">{projection.failureCode}</p> : null}
          {actionError ? <p role="alert">{actionError}</p> : null}
          {actionBusy ? <p role="status">正在停止并清理任务资源…</p> : null}
          {projection.canCancel ? <button type="button" data-testid="media-transcript-cancel" disabled={actionBusy} onClick={() => void cancel()}>取消并清理</button> : null}
          {projection.canRetry ? <a href="#/media/current">返回当前视频重新分析</a> : null}
        </section>
        <section className="media-transcript-document" aria-labelledby="media-transcript-document-title">
          <h2 id="media-transcript-document-title">完整转写</h2>
          <MediaTranscriptViewer segments={projection.segments} />
        </section>
      </> : null}
    </div>
  </main>;
}
