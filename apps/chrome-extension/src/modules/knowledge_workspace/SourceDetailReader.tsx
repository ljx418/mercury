import type { KnowledgeSource } from "../../runtimeClient";

export function SourceDetailReader({ source, onBack, onOpenTrace, onForget }: {
  source: KnowledgeSource;
  onBack: () => void;
  onOpenTrace: () => void;
  onForget: () => void;
}) {
  return (
    <section className="route-panel source-detail-reader" data-testid="route-source-detail">
      <button className="back-link" onClick={onBack} type="button">返回来源库</button>
      <div className="detail-command-row">
        <div><p className="eyebrow">Source Detail</p><h2>{source.title ?? source.sourceId}</h2><p className="source-origin">{source.originUrl ?? source.sourceType}</p></div>
        <div><button className="secondary-button" onClick={onOpenTrace} type="button">查看 Trace</button><button className="danger-button" onClick={onForget} type="button">遗忘来源</button></div>
      </div>
      <dl className="source-facts">
        <div><dt>Source ID</dt><dd><code>{source.sourceId}</code></dd></div>
        <div><dt>Operation ID</dt><dd><code data-testid="workspace-operation-id">{source.operationId ?? "not_available"}</code></dd></div>
        <div><dt>状态</dt><dd>{source.status}</dd></div>
        <div><dt>Revision</dt><dd>{source.revision}</dd></div>
      </dl>
      {source.contentSnapshot ? <section aria-label="已导入文件快照"><h3>文件内容</h3><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 480, overflow: "auto" }}>{source.contentSnapshot.text}</pre></section> : null}
      <section className="evidence-summary"><strong>Evidence refs</strong><span>{source.evidenceRefs?.length ?? 0}</span><p>证据来自 Runtime；Workspace 不补写定位状态。</p></section>
    </section>
  );
}
