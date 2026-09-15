import type { KnowledgeServiceStatus, RuntimeStatus } from "../../runtimeClient";

type ServiceStatusBannerProps = {
  runtimeStatus: RuntimeStatus;
  status: KnowledgeServiceStatus | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

export function ServiceStatusBanner({ runtimeStatus, status, loading = false, error = null, onRefresh }: ServiceStatusBannerProps) {
  const runtimeLabel = runtimeStatus === "online" ? "Runtime online" : runtimeStatus === "checking" ? "Runtime checking" : "Runtime offline";
  const adapterLabel = status?.adapterStatus ?? "not_configured";
  const dataServiceLabel = status?.dataServiceStatus ?? "unchecked";
  return (
    <section className={`knowledge-service-banner knowledge-service-banner-${runtimeStatus}`} aria-label="V2 knowledge service status">
      <div>
        <strong>Knowledge service</strong>
        <span>{error ?? status?.message ?? "Runtime、Adapter 与 data_service 状态分别显示。"}</span>
      </div>
      <div className="knowledge-status-pills">
        <span>{runtimeLabel}</span>
        <span>Adapter {adapterLabel}</span>
        <span>data_service {dataServiceLabel}</span>
      </div>
      {onRefresh ? (
        <button className="knowledge-mini-button" disabled={loading} onClick={onRefresh} type="button">
          {loading ? "刷新中" : "刷新"}
        </button>
      ) : null}
    </section>
  );
}
