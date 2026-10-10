import { useState } from "react";
import type { KnowledgeGraph } from "../../runtimeClient";

export function KnowledgeGraphCanvas({ graph, onRefresh }: { graph: KnowledgeGraph | null; onRefresh: () => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selected = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  return (
    <section className="route-panel graph-canvas-panel" data-testid="route-graph">
      <div className="route-heading"><div><p className="eyebrow">Knowledge Graph</p><h2>来源关系</h2></div><button onClick={onRefresh} type="button">刷新图谱</button></div>
      <div className="graph-canvas" role={graph?.nodes.length ? "list" : undefined} aria-label={graph?.nodes.length ? "Knowledge Graph 节点" : undefined}>
        {graph?.nodes.map((node) => <button aria-pressed={selectedNodeId === node.id} className={`graph-node graph-node-${node.type}`} key={node.id} onClick={() => setSelectedNodeId(node.id)} role="listitem" type="button"><strong>{node.label}</strong><small>{node.type}</small></button>)}
      </div>
      {!graph?.nodes.length ? <p className="empty-copy">暂无图谱节点。</p> : null}
      <footer className="graph-inspector"><span>{graph?.edges.length ?? 0} edges · {graph?.status ?? "empty"}</span>{selected ? <code>{selected.id}</code> : <small>选择节点查看 Runtime ID</small>}</footer>
    </section>
  );
}
