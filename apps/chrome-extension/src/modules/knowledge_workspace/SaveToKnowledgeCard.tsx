import type { ExtractedPageContext } from "../../pageContext";
import type { KnowledgeOperation, KnowledgeServiceStatus, KnowledgeSource, RuntimeStatus } from "../../runtimeClient";
import { KnowledgeBuildStatus } from "./KnowledgeBuildStatus";
import { ServiceStatusBanner } from "./ServiceStatusBanner";

type SaveToKnowledgeCardProps = {
  runtimeStatus: RuntimeStatus;
  pageContext: ExtractedPageContext | null;
  serviceStatus: KnowledgeServiceStatus | null;
  serviceLoading?: boolean;
  serviceError?: string | null;
  source: KnowledgeSource | null;
  operation: KnowledgeOperation | null;
  saving?: boolean;
  saveError?: string | null;
  onRefreshStatus: () => void;
  onSave: () => void;
};

export function SaveToKnowledgeCard({
  runtimeStatus,
  pageContext,
  serviceStatus,
  serviceLoading = false,
  serviceError = null,
  source,
  operation,
  saving = false,
  saveError = null,
  onRefreshStatus,
  onSave
}: SaveToKnowledgeCardProps) {
  const canSave = runtimeStatus === "online" && Boolean(pageContext) && !saving;
  return (
    <section className="save-knowledge-card" data-testid="v2-save-to-knowledge-card" aria-label="Save current page to knowledge">
      <ServiceStatusBanner runtimeStatus={runtimeStatus} status={serviceStatus} loading={serviceLoading} error={serviceError} onRefresh={onRefreshStatus} />
      <div className="save-knowledge-main">
        <div>
          <p className="knowledge-eyebrow">V2 Memory</p>
          <h2>保存当前页到知识库</h2>
          <p>{pageContext ? pageContext.title : "请先读取当前页面。保存必须由用户主动触发。"}</p>
        </div>
        <button data-testid="save-current-source" disabled={!canSave} onClick={onSave} type="button">
          {saving ? "保存中" : source ? "重新保存" : "保存"}
        </button>
      </div>
      <KnowledgeBuildStatus source={source} operation={operation} status={serviceStatus} />
      <p className="knowledge-footnote">
        {serviceStatus?.dataServiceStatus === "connected"
          ? "真实 data_service 已连接；保存会导入当前页面快照并完成可追溯构建。"
          : "当前仅为 Mock 或未连接状态，不构成真实 data_service 持久化证据。"}
      </p>
      {saveError ? <p className="knowledge-error">{saveError}</p> : null}
    </section>
  );
}
