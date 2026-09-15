import type { KnowledgeOperation, KnowledgeSource, KnowledgeServiceStatus } from "../../runtimeClient";

type KnowledgeBuildStatusProps = {
  source: KnowledgeSource | null;
  operation: KnowledgeOperation | null;
  status: KnowledgeServiceStatus | null;
};

export function KnowledgeBuildStatus({ source, operation }: KnowledgeBuildStatusProps) {
  const buildStatus = source?.status ?? "not_saved";
  return (
    <div className={`knowledge-build-status knowledge-build-status-${buildStatus}`} aria-label="V2 source build status">
      <span>{buildStatusLabel(buildStatus)}</span>
      {source ? <strong title={source.sourceId}>{source.sourceId}</strong> : <strong>尚未保存</strong>}
      {operation ? <small title={operation.operationId}>operation {operation.status}</small> : <small>等待用户主动保存</small>}
    </div>
  );
}

function buildStatusLabel(status: string): string {
  if (status === "trace_ready") return "Trace ready";
  if (status === "not_saved") return "Not saved";
  if (status === "failed") return "Build failed";
  if (status === "degraded") return "Degraded";
  if (status === "forgotten") return "Forgotten";
  return status;
}
