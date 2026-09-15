import { useMemo, useState } from "react";
import type { ExtractedPageContext } from "../../pageContext";
import type {
  KnowledgeOperation,
  KnowledgeServiceStatus,
  KnowledgeSource,
  KnowledgeWorkspace,
  RuntimeStatus
} from "../../runtimeClient";
import type { WorkspaceRouteIntent } from "./workspaceRoutes";
import { SaveToKnowledgeCard } from "./SaveToKnowledgeCard";

export type QuickWorkspaceRequest = {
  origin: "view_source" | "open_workspace" | "open_in_workspace";
  routeIntent: WorkspaceRouteIntent;
  workspaceId: string;
  sourceId?: string;
};

type KnowledgeQuickSurfaceProps = {
  runtimeStatus: RuntimeStatus;
  pageContext: ExtractedPageContext | null;
  serviceStatus: KnowledgeServiceStatus | null;
  serviceLoading?: boolean;
  serviceError?: string | null;
  currentPageSource: KnowledgeSource | null;
  selectedSource: KnowledgeSource | null;
  operation: KnowledgeOperation | null;
  saving?: boolean;
  saveError?: string | null;
  workspaces: KnowledgeWorkspace[];
  selectedWorkspaceId: string;
  sourcesLoading?: boolean;
  sourcesError?: string | null;
  workspaceActionError?: string | null;
  onRefreshStatus: () => void;
  onRefreshSources: () => void;
  onSave: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenWorkspace: (request: QuickWorkspaceRequest) => void;
};

export function KnowledgeQuickSurface({
  runtimeStatus,
  pageContext,
  serviceStatus,
  serviceLoading = false,
  serviceError = null,
  currentPageSource,
  selectedSource,
  operation,
  saving = false,
  saveError = null,
  workspaces,
  selectedWorkspaceId,
  sourcesLoading = false,
  sourcesError = null,
  workspaceActionError = null,
  onRefreshStatus,
  onRefreshSources,
  onSave,
  onSelectWorkspace,
  onOpenWorkspace
}: KnowledgeQuickSurfaceProps) {
  const [traceExpanded, setTraceExpanded] = useState(false);
  const contextSource = selectedSource ?? currentPageSource;
  const sourceDetailContext = contextSource && contextSource.status !== "forgotten" ? contextSource : null;
  const traceSource = contextSource?.status === "trace_ready" ? contextSource : null;
  const evidenceRefs = useMemo(() => traceSource?.evidenceRefs ?? [], [traceSource]);

  const open = (request: Omit<QuickWorkspaceRequest, "workspaceId">) => {
    onOpenWorkspace({ ...request, workspaceId: selectedWorkspaceId });
  };

  return (
    <section className="knowledge-quick-surface" data-testid="v2-knowledge-quick-surface">
      <header className="knowledge-quick-header">
        <div>
          <p className="knowledge-eyebrow">Knowledge Quick Surface</p>
          <h2>当前页与当前空间</h2>
          <p>保存、状态和快捷入口留在侧栏；长期管理在独立工作台完成。</p>
        </div>
        <button
          className="primary-button"
          data-testid="open-in-workspace"
          onClick={() => open(sourceDetailContext
            ? { origin: "open_in_workspace", routeIntent: "source_detail", sourceId: sourceDetailContext.sourceId }
            : { origin: "open_in_workspace", routeIntent: "source_library" })}
          type="button"
        >
          在工作台中打开
        </button>
      </header>

      <SaveToKnowledgeCard
        runtimeStatus={runtimeStatus}
        pageContext={pageContext}
        serviceStatus={serviceStatus}
        serviceLoading={serviceLoading}
        serviceError={serviceError}
        source={currentPageSource}
        operation={operation}
        saving={saving}
        saveError={saveError}
        onRefreshStatus={onRefreshStatus}
        onSave={onSave}
      />

      <section className="knowledge-context-card" aria-label="当前 Knowledge 上下文">
        <div className="knowledge-context-heading">
          <label>
            <span>当前 Workspace</span>
            {workspaces.length ? (
              <select value={selectedWorkspaceId} onChange={(event) => onSelectWorkspace(event.target.value)}>
                {workspaces.map((workspace) => <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.name}</option>)}
              </select>
            ) : <code>{selectedWorkspaceId}</code>}
          </label>
          <button className="ghost-button" disabled={sourcesLoading} onClick={onRefreshSources} type="button">
            {sourcesLoading ? "刷新中" : "刷新来源"}
          </button>
        </div>
        <div className="knowledge-current-source" data-testid="quick-current-source">
          <span>当前 source</span>
          <strong>{contextSource?.title ?? "尚未选择来源"}</strong>
          <small data-testid="quick-source-identity">
            {contextSource
              ? `${contextSource.status} · ${contextSource.sourceId}${contextSource.operationId ? ` · ${contextSource.operationId}` : ""}`
              : "读取并保存当前页后可查看来源和 Trace"}
          </small>
        </div>
        {sourcesError || workspaceActionError ? <p className="knowledge-error" role="alert">{workspaceActionError ?? sourcesError}</p> : null}
      </section>

      <div className="knowledge-quick-actions" aria-label="Knowledge 快捷动作">
        {traceSource ? (
          <button
            data-testid="view-source"
            onClick={() => open({ origin: "view_source", routeIntent: "source_detail", sourceId: traceSource.sourceId })}
            type="button"
          >
            查看来源
          </button>
        ) : null}
        <button
          data-testid="open-workspace"
          onClick={() => open({ origin: "open_workspace", routeIntent: "source_library" })}
          type="button"
        >
          打开工作台
        </button>
        <button
          data-testid="ask-current-workspace"
          onClick={() => open({ origin: "open_in_workspace", routeIntent: "ask" })}
          type="button"
        >
          问当前空间
        </button>
        <button
          aria-expanded={traceExpanded}
          data-testid="toggle-trace"
          disabled={!traceSource || evidenceRefs.length === 0}
          onClick={() => setTraceExpanded((current) => !current)}
          type="button"
        >
          {traceExpanded ? "收起 Trace" : "查看 Trace"}
        </button>
      </div>

      {traceExpanded && traceSource ? (
        <section className="knowledge-trace-preview" data-testid="quick-trace-preview" aria-label="当前 source Trace">
          <header><strong>Evidence Trace</strong><code>{traceSource.sourceId}</code></header>
          {evidenceRefs.slice(0, 3).map((ref, index) => (
            <article key={`${traceSource.sourceId}-${index}`}>
              <span>{String(ref.locatorType ?? "evidence_ref")}</span>
              <p>{String(ref.textQuote ?? ref.fallbackText ?? ref.evidenceRefId ?? "EvidenceRef 未提供可显示文本")}</p>
            </article>
          ))}
          <small>这里只展示 Runtime 返回的 EvidenceRef，不推断 located 状态。</small>
        </section>
      ) : null}
    </section>
  );
}
