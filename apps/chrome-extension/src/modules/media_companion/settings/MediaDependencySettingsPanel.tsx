import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMediaDependencyClient,
  mediaDependencyRecoveryAdvice,
  MediaDependencyClientError,
  type MediaDependencyJob,
  type MediaDependencyStatus,
  type MediaDependencyTransport
} from "../MediaDependencyRuntimeClient";

/**
 * WP-A media dependency readiness panel.
 *
 * The component renders exactly what the Runtime reports. It never invents a
 * percentage, never hides a failure behind a generic message, and never offers
 * an action that the Runtime would refuse.
 */

const TERMINAL_STATES = new Set(["ready", "cancelled", "failed", "corrupt"]);

export type MediaDependencyPanelProps = {
  runtimeStatus: "online" | "offline" | "connecting" | "authentication_required";
  transport: MediaDependencyTransport;
  /** Injected so tests never poll on a real timer. */
  pollIntervalMs?: number;
};

function stateLabel(status: MediaDependencyStatus): string {
  if (status.overallState === "ready") return "已就绪";
  if (status.overallState === "installing") return "正在修复";
  if (status.overallState === "failed") return "修复失败";
  return "需要修复本机依赖";
}

const DEPENDENCY_LABELS: Record<string, string> = {
  "yt-dlp": "yt-dlp",
  ffmpeg: "ffmpeg",
  ffprobe: "ffprobe",
  sensevoice: "SenseVoice"
};

function dependencyLabel(dependencyId: string): string {
  return DEPENDENCY_LABELS[dependencyId] ?? dependencyId;
}

function stateTone(state: string): string {
  if (state === "ready") return "ready";
  if (state === "corrupt" || state === "failed") return "failed";
  return "pending";
}

export function MediaDependencySettingsPanel({ runtimeStatus, transport, pollIntervalMs = 500 }: MediaDependencyPanelProps) {
  const client = useMemo(() => createMediaDependencyClient(transport), [transport]);
  const [status, setStatus] = useState<MediaDependencyStatus | null>(null);
  const [job, setJob] = useState<MediaDependencyJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (runtimeStatus !== "online") return;
    try {
      setStatus(await client.status());
    } catch (error) {
      setMessage(error instanceof MediaDependencyClientError ? error.message : "依赖状态读取失败。");
    }
  }, [client, runtimeStatus]);

  // Entering Settings always re-reads status; an active job resumes polling.
  useEffect(() => {
    if (runtimeStatus !== "online") {
      setMessage("请先启动 Navia 本机伴侣。Runtime 恢复后会自动重新检查。");
      return;
    }
    void refresh();
  }, [refresh, runtimeStatus]);

  useEffect(() => {
    if (!status?.activeJobId || runtimeStatus !== "online") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await client.job(status.activeJobId as string);
        if (cancelled) return;
        setJob(next);
        // Terminal: stop polling and read the final status back.
        if (TERMINAL_STATES.has(next.state)) {
          setStatus(await client.status());
        }
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof MediaDependencyClientError ? error.message : "安装状态读取失败。");
      }
    };
    void tick();
    timerRef.current = window.setInterval(() => void tick(), pollIntervalMs);
    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [status?.activeJobId, runtimeStatus, client, pollIntervalMs]);

  // A completed repair remains useful context after leaving and re-entering
  // Settings. In particular, an old verified generation stays usable while a
  // newer repair failure is shown as non-blocking diagnostic information.
  useEffect(() => {
    if (!status?.latestJobId || status.activeJobId || runtimeStatus !== "online") return;
    let cancelled = false;
    void client.job(status.latestJobId).then((latest) => {
      if (!cancelled) setJob(latest);
    }).catch((error) => {
      if (!cancelled) setMessage(error instanceof MediaDependencyClientError ? error.message : "最近修复状态读取失败。");
    });
    return () => {
      cancelled = true;
    };
  }, [status?.latestJobId, status?.activeJobId, runtimeStatus, client]);

  async function repair() {
    setBusy(true);
    try {
      const next = await client.startInstall();
      setJob(next);
      setMessage("修复任务已由本机 Runtime 启动。");
    } catch (error) {
      setMessage(error instanceof MediaDependencyClientError ? error.message : "无法启动修复。");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job) return;
    setBusy(true);
    try {
      setJob(await client.cancel(job.jobId));
      setMessage("已请求取消修复。");
    } catch (error) {
      setMessage(error instanceof MediaDependencyClientError ? error.message : "取消失败。");
    } finally {
      setBusy(false);
    }
  }

  if (runtimeStatus !== "online") {
    return (
      <section className="media-dependency-panel" data-testid="media-dependency-panel" data-state="offline" aria-busy={false}>
        <h3>媒体分析依赖</h3>
        <p role="note" data-testid="media-dependency-offline">
          请先启动 Navia 本机伴侣。本机依赖状态将在 Runtime 恢复后自动重新检查。
        </p>
        <p className="muted" role="status" aria-live="polite">{message}</p>
      </section>
    );
  }

  const failures = (status?.dependencies ?? []).filter((entry) => entry.state !== "ready" && entry.failureCode);
  // A non-retryable failure is shown first: telling a user to "retry" when a
  // retry cannot possibly succeed would be the dishonest next step.
  const failedEntry =
    failures.find((entry) => !mediaDependencyRecoveryAdvice(entry.failureCode).retryable) ?? failures[0];
  const latestFailureCode = job?.state === "failed" ? job.failureCode : null;
  const advice = failedEntry
    ? mediaDependencyRecoveryAdvice(failedEntry.failureCode)
    : latestFailureCode
      ? mediaDependencyRecoveryAdvice(latestFailureCode)
      : null;
  // A ready snapshot stays usable even when the newest repair failed.
  const canRepair = Boolean(status) && status?.overallState !== "ready";
  const installing = status?.overallState === "installing" || (job !== null && !TERMINAL_STATES.has(job.state));

  return (
    <section className="media-dependency-panel" data-testid="media-dependency-panel" data-state={status?.overallState ?? "loading"} aria-busy={busy || installing}>
      <header>
        <h3>媒体分析依赖</h3>
        <span className="media-dependency-state" role="status" aria-live="polite">{status ? stateLabel(status) : "正在读取…"}</span>
      </header>

      {status?.generation ? <p data-testid="media-dependency-generation">已验证版本：{status.generation}</p> : null}

      <ul className="media-dependency-list">
        {(status?.dependencies ?? []).map((entry) => (
          <li key={entry.dependencyId} data-testid={`media-dependency-${entry.dependencyId}`} data-state={entry.state}>
            <span>{dependencyLabel(entry.dependencyId)}</span>
            <span className={`media-dependency-entry-state is-${stateTone(entry.state)}`}>{entry.state}</span>
            {entry.version ? <span className="muted">{entry.version}</span> : null}
          </li>
        ))}
      </ul>

      {installing && job ? (
        <div className="media-dependency-progress" data-testid="media-dependency-progress">
          <strong>{job.progress.stage}</strong>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(job.progress.percent)}
            aria-label="依赖修复进度"
          >
            <span style={{ width: `${Math.max(0, Math.min(job.progress.percent, 100))}%` }} />
          </div>
          {/* The percentage is exactly what the Runtime reported. */}
          <span>{job.progress.percent.toFixed(1)}%</span>
          {job.cancelable ? (
            <button type="button" className="danger" disabled={busy} data-testid="media-dependency-cancel" onClick={() => void cancel()}>
              取消修复
            </button>
          ) : null}
        </div>
      ) : null}

      {advice ? (
        <div className="media-dependency-recovery" role="alert" data-testid="media-dependency-recovery" data-category={advice.retryable ? "retryable" : "manual"}>
          <strong>{advice.title}</strong>
          <p>{advice.detail}</p>
        </div>
      ) : null}

      <div className="media-dependency-actions">
        <button type="button" data-testid="media-dependency-repair" disabled={!canRepair || busy || installing} onClick={() => void repair()}>
          修复本机依赖
        </button>
        <button type="button" className="secondary" data-testid="media-dependency-recheck" disabled={busy} onClick={() => void refresh()}>
          重新检查
        </button>
      </div>

      <p className="muted" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
