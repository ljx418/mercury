import type { LocalRuntimeAccessState } from "../knowledge_workspace/LocalRuntimeAccess";
import type { MediaAcquisitionUiState } from "./acquisition";
import type { MediaConsentScopeItem } from "./MediaConsentCard";
import type { MediaCredentialLeaseUiState } from "./MediaCredentialLeaseCard";
import type { MediaConsentPolicyRecord, PortalSessionCapability } from "./session/contracts";

export type MediaCompanionLaunchCardProps = {
  portalLabel: string;
  policy: MediaConsentPolicyRecord | null;
  capability: PortalSessionCapability | null;
  scopes: readonly MediaConsentScopeItem[];
  sessionBusy: boolean;
  sessionError: string | null;
  runtimeStatus: LocalRuntimeAccessState;
  runtimeError: string | null;
  credentialState: MediaCredentialLeaseUiState;
  credentialError: string | null;
  acquisitionState: MediaAcquisitionUiState;
  acquisitionError: string | null;
  onEnable: () => void;
  onRetry: () => void;
  onRevoke: () => void;
};

function friendlyFailure(code: string | null) {
  if (!code) return null;
  if (code === "V3_MEDIA_POLICY_NOT_GRANTED") return "授权状态已变化，请重新启用当前视频伴读。";
  if (code === "V3_MEDIA_SESSION_COOKIE_MISSING") return "未检测到可用的 B站登录会话，请先在当前浏览器登录 B站。";
  if (code === "V3_MEDIA_TEMP_FILE_MODE_INVALID") {
    return "本机媒体临时目录不满足私有权限要求，请重启 Navia 本机伴侣后重试。";
  }
  if (code === "V3_COMPANION_NOT_CONFIGURED" || code === "V3_COMPANION_ORIGIN_MISMATCH") {
    return "本机伴侣与当前 Navia 版本未绑定，请重新运行桌面的 Navia 启动图标。";
  }
  if (code.includes("fetch") || code.includes("offline") || code.includes("未启动")) {
    return "Navia 本机伴侣未启动，请先运行桌面的 Navia 启动图标。";
  }
  return "当前视频准备失败，可以重新尝试；诊断信息已保留在下方设置中。";
}

function launchStatus(props: MediaCompanionLaunchCardProps) {
  if (!props.policy || props.sessionBusy) return { label: "正在检查", detail: "正在读取当前页面与授权状态。", tone: "neutral" };
  if (props.policy.status !== "granted") return { label: "首次启用", detail: "一次授权后，Navia 会自动连接本机伴侣并分析当前视频。", tone: "action" };
  if (props.runtimeStatus === "connecting") return { label: "正在连接", detail: "正在自动连接 Navia 本机伴侣。", tone: "progress" };
  if (props.runtimeStatus !== "connected") return { label: "需要本机伴侣", detail: friendlyFailure(props.runtimeError) ?? "请先启动 Navia 本机伴侣。", tone: "error" };
  if (props.credentialState === "failed") return { label: "准备失败", detail: friendlyFailure(props.credentialError), tone: "error" };
  if (props.acquisitionState === "failed" || props.acquisitionState === "blocked") return { label: "分析受阻", detail: friendlyFailure(props.acquisitionError), tone: "error" };
  if (props.acquisitionState === "succeeded") return { label: "视频已就绪", detail: "当前视频内容已准备完成，可以继续伴读和提问。", tone: "success" };
  if (props.acquisitionState === "awaiting_capture") return { label: "需要一次音频确认", detail: "该视频没有可用字幕，请使用下方出现的浏览器音频按钮继续。", tone: "action" };
  if (props.credentialState === "establishing" || props.acquisitionState !== "idle") return { label: "正在分析", detail: "已自动建立安全会话，正在准备字幕与本地媒体。", tone: "progress" };
  if (props.capability?.status !== "available") return { label: "正在检查", detail: "正在确认当前浏览器中的 B站会话。", tone: "neutral" };
  return { label: "正在准备", detail: "授权有效，Navia 将自动开始分析当前视频。", tone: "progress" };
}

export function MediaCompanionLaunchCard(props: MediaCompanionLaunchCardProps) {
  const status = launchStatus(props);
  const granted = props.policy?.status === "granted";
  const failed = props.runtimeStatus === "offline"
    || props.runtimeStatus === "authentication_required"
    || props.credentialState === "failed"
    || props.acquisitionState === "failed"
    || props.acquisitionState === "blocked";
  const technicalError = props.sessionError ?? props.runtimeError ?? props.credentialError ?? props.acquisitionError;

  return <section className={`media-launch-card is-${status.tone}`} data-testid="media-companion-launch" aria-labelledby="media-launch-title">
    <div className="media-launch-heading">
      <div>
        <span className="media-consent-kicker">视频伴读</span>
        <h2 id="media-launch-title">{props.portalLabel} 当前视频</h2>
      </div>
      <span className={`media-launch-status is-${status.tone}`} role="status" aria-live="polite">{status.label}</span>
    </div>
    <p className="media-launch-detail">{status.detail}</p>

    {!granted ? <button className="media-launch-primary" data-testid="media-companion-enable" type="button" disabled={props.sessionBusy} onClick={props.onEnable}>
      {props.sessionBusy ? "正在启用" : "启用并分析当前视频"}
    </button> : null}
    {granted && failed ? <button className="media-launch-primary" data-testid="media-companion-retry" type="button" onClick={props.onRetry}>重新尝试</button> : null}

    <details className="media-launch-settings" data-testid="media-connection-settings">
      <summary>连接与隐私设置</summary>
      <div className="media-launch-settings-body">
        <p>Cookie 仅通过任务级一次性通道使用，不会在此显示或保存。</p>
        <dl>
          <div><dt>站点授权</dt><dd>{granted ? "已启用" : "未启用"}</dd></div>
          <div><dt>本机伴侣</dt><dd>{props.runtimeStatus === "connected" ? "已连接" : "未连接"}</dd></div>
          <div><dt>安全会话</dt><dd>{props.credentialState === "ready" ? "已建立" : props.credentialState === "establishing" ? "建立中" : "未建立"}</dd></div>
        </dl>
        <ul aria-label="授权用途">
          {props.scopes.map((scope) => <li key={scope.scopeId}><strong>{scope.label}</strong><span>{scope.description}</span></li>)}
        </ul>
        {technicalError ? <p className="media-launch-diagnostic">诊断：{technicalError}</p> : null}
        {granted ? <button className="media-launch-revoke" data-testid="media-consent-revoke" type="button" disabled={props.sessionBusy} onClick={props.onRevoke}>撤销 B站视频授权</button> : null}
      </div>
    </details>
  </section>;
}

