import { useEffect, useRef } from "react";
import type { PortalCredentialLease } from "./session/credential";

export type MediaCredentialLeaseUiState = "idle" | "establishing" | "ready" | "failed";

export function MediaCredentialLeaseCard(props: {
  portalLabel: string;
  state: MediaCredentialLeaseUiState;
  lease: PortalCredentialLease | null;
  error: string | null;
  disabled: boolean;
  disabledReason?: string | null;
  onStart: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  const previousState = useRef(props.state);

  useEffect(() => {
    if (previousState.current === "establishing" && (props.state === "ready" || props.state === "failed")) {
      startRef.current?.focus();
    }
    previousState.current = props.state;
  }, [props.state]);

  const status = props.state === "establishing"
    ? "正在建立本机安全会话"
    : props.state === "ready"
      ? "会话租约已就绪"
      : props.state === "failed"
        ? "安全会话建立失败"
        : "等待开始";

  return (
    <section className="media-credential-card" aria-labelledby="media-credential-title" data-testid="media-credential-card">
      <div className="media-credential-heading">
        <div>
          <span className="media-consent-kicker">V3-1.3 SECURE SESSION</span>
          <h2 id="media-credential-title">{props.portalLabel} 本机安全会话</h2>
        </div>
        <span className={`media-credential-status is-${props.state}`} role="status" aria-live="polite" data-testid="media-credential-status">
          {status}
        </span>
      </div>
      <p>开始后仅建立当前任务的一次性凭据通道和短期内存租约。Cookie 不会显示或保存。</p>
      {props.state === "ready" && props.lease ? (
        <div className="media-credential-ready" data-testid="media-credential-ready">
          <strong>安全通道可用于当前任务</strong>
          <span>最长 60 秒 · 仅 Runtime 进程内 · 未执行平台服务端验证</span>
          <span>正在准备当前视频的字幕与本地媒体路线</span>
        </div>
      ) : null}
      {props.state === "failed" && props.error ? <p className="media-consent-error" role="alert">{props.error}</p> : null}
      {props.disabled && props.disabledReason ? <p className="media-credential-disabled">{props.disabledReason}</p> : null}
      <div className="media-consent-actions">
        <button
          ref={startRef}
          type="button"
          data-testid="media-credential-start"
          disabled={props.disabled || props.state === "establishing"}
          onClick={props.onStart}
        >
          {props.state === "establishing" ? "正在建立" : props.state === "ready" ? "重新建立会话" : "开始分析"}
        </button>
      </div>
    </section>
  );
}
