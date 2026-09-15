import type { KnowledgeServiceStatus, RuntimeStatus } from "../../runtimeClient";

export function DataServiceStatusCard({ runtimeStatus, status }: { runtimeStatus: RuntimeStatus; status: KnowledgeServiceStatus | null }) {
  const offline = runtimeStatus === "offline";
  return <section className={`service-strip ${offline ? "offline" : ""}`} aria-label="后端服务状态" data-testid="workspace-service-status">
    <Status label="Runtime" value={runtimeStatus} />
    <Status label="Adapter" value={offline ? "unchecked" : status?.adapterStatus ?? "checking"} />
    <Status label="data_service" value={offline ? "unchecked" : status?.dataServiceStatus ?? "checking"} />
    <Status label="Source build" value={offline ? "unknown" : status?.sourceBuildStatus ?? "not_saved"} />
  </section>;
}

function Status({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
