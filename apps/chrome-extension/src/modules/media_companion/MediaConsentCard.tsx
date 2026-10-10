import { useEffect, useRef } from "react";
import type { MediaConsentPolicyRecord, PortalSessionCapability } from "./session/contracts";

export type MediaConsentScopeItem = {
  scopeId: string;
  label: string;
  description: string;
};

export type MediaConsentCardProps = {
  portalLabel: string;
  policy: MediaConsentPolicyRecord | null;
  capability: PortalSessionCapability | null;
  scopes: readonly MediaConsentScopeItem[];
  busy: boolean;
  error: string | null;
  onAuthorize: () => void;
  onDeny: () => void;
  onRevoke: () => void;
  onRefresh: () => void;
};

function statusCopy(policy: MediaConsentPolicyRecord | null, capability: PortalSessionCapability | null) {
  if (!policy) return { label: "正在读取", tone: "neutral" };
  if (policy.status === "denied") return { label: "已暂缓授权", tone: "warning" };
  if (policy.status === "revoked") return { label: "已撤销", tone: "neutral" };
  if (policy.status !== "granted") return { label: "需要授权", tone: "warning" };
  if (capability?.status === "available") return { label: "已检测会话候选", tone: "success" };
  if (capability?.status === "unavailable") return { label: "未检测到会话候选", tone: "warning" };
  if (capability?.status === "revoked") return { label: "浏览器权限已移除", tone: "warning" };
  if (capability?.status === "unknown") return { label: "暂时无法检查", tone: "warning" };
  return { label: "已授权，等待检查", tone: "neutral" };
}

export function MediaConsentCard(props: MediaConsentCardProps) {
  const status = statusCopy(props.policy, props.capability);
  const granted = props.policy?.status === "granted";
  const previousStatus = useRef(props.policy?.status ?? null);
  const pendingFocus = useRef<"authorize" | "deny" | "refresh" | null>(null);
  const authorizeRef = useRef<HTMLButtonElement>(null);
  const denyRef = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const nextStatus = props.policy?.status ?? null;
    if (previousStatus.current !== nextStatus) {
      pendingFocus.current = nextStatus === "granted"
        ? "refresh"
        : nextStatus === "denied"
          ? "deny"
          : nextStatus === "revoked"
            ? "authorize"
            : null;
      previousStatus.current = nextStatus;
    }
    if (props.busy || !pendingFocus.current) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "refresh") refreshRef.current?.focus();
    if (target === "deny") denyRef.current?.focus();
    if (target === "authorize") authorizeRef.current?.focus();
  }, [props.busy, props.policy?.status]);

  return (
    <section className="media-consent-card" aria-labelledby="media-consent-title" data-testid="media-consent-card">
      <div className="media-consent-header">
        <div>
          <span className="media-consent-kicker">V3 MEDIA</span>
          <h2 id="media-consent-title">{props.portalLabel} 视频理解授权</h2>
        </div>
        <span className={`media-consent-status media-consent-status-${status.tone}`} role="status" aria-live="polite">
          {status.label}
        </span>
      </div>

      <p className="media-consent-boundary">
        Navia 只检测当前浏览器中的会话候选。本阶段不验证服务端登录，不向 Runtime 发送会话数据，也不开始下载。
      </p>

      <ul className="media-consent-scopes" aria-label="授权用途">
        {props.scopes.map((scope) => {
          const scopeGranted = props.policy?.scopeGrants.find((grant) => grant.scopeId === scope.scopeId)?.granted === true;
          return (
            <li key={scope.scopeId}>
              <span className={`media-scope-check ${scopeGranted ? "is-granted" : ""}`} aria-hidden="true">
                {scopeGranted ? "✓" : ""}
              </span>
              <span>
                <strong>{scope.label}</strong>
                <small>{scope.description}</small>
              </span>
            </li>
          );
        })}
      </ul>

      {props.error ? <p className="media-consent-error" role="alert">{props.error}</p> : null}

      <div className="media-consent-actions">
        {!granted ? (
          <>
            <button ref={authorizeRef} type="button" data-testid="media-consent-authorize" disabled={props.busy} onClick={props.onAuthorize}>
              授权并继续
            </button>
            <button ref={denyRef} type="button" className="media-consent-secondary" data-testid="media-consent-deny" disabled={props.busy} onClick={props.onDeny}>
              暂不授权
            </button>
          </>
        ) : (
          <>
            <button ref={refreshRef} type="button" data-testid="media-consent-refresh" disabled={props.busy} onClick={props.onRefresh}>
              刷新状态
            </button>
            <button type="button" className="media-consent-danger" data-testid="media-consent-revoke" disabled={props.busy} onClick={props.onRevoke}>
              撤销授权
            </button>
          </>
        )}
      </div>
    </section>
  );
}
