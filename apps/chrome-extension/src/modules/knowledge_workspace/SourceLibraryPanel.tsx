import { useMemo, useState } from "react";
import type { KnowledgeSource, KnowledgeWorkspace } from "../../runtimeClient";

export function SourceLibraryPanel({ workspace, sources, onSelectSource }: {
  workspace: KnowledgeWorkspace | null;
  sources: KnowledgeSource[];
  onSelectSource: (sourceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(() => sources.filter((source) => {
    const matchesQuery = `${source.title ?? ""} ${source.originUrl ?? ""} ${source.sourceId}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (status === "all" || source.status === status);
  }), [query, sources, status]);
  return (
    <section className="route-panel source-library-panel" data-testid="route-source-library">
      <div className="route-heading">
        <div><p className="eyebrow">Source Library</p><h2>已保存来源</h2></div>
        <span>{visible.length}/{sources.length} sources</span>
      </div>
      {workspace ? <div className="workspace-summary-line"><strong>{workspace.name}</strong><span>{workspace.pendingBuildCount} pending · trace {Math.round(workspace.traceCoverage * 100)}%</span></div> : null}
      <div className="library-controls">
        <label><span>搜索来源</span><input aria-label="搜索来源" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题、URL 或 Source ID" /></label>
        <label><span>构建状态</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部</option><option value="trace_ready">Trace ready</option><option value="building">Building</option><option value="failed">Failed</option><option value="degraded">Degraded</option></select></label>
      </div>
      <div className="source-table" role={visible.length ? "list" : undefined}>
        {visible.map((source) => (
          <button
            className="source-list-row"
            data-testid={`source-row-${source.sourceId}`}
            key={source.sourceId}
            onClick={() => onSelectSource(source.sourceId)}
            role="listitem"
            type="button"
          >
            <span><strong>{source.title ?? source.sourceId}</strong><small>{source.originUrl ?? source.sourceType}</small></span>
            <span className={`source-state source-state-${source.status}`}>{source.status}</span>
          </button>
        ))}
      </div>
      {!visible.length ? <p className="empty-copy">没有符合当前筛选条件的来源。</p> : null}
    </section>
  );
}
