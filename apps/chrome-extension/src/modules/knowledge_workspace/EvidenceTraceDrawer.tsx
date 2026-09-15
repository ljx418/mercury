import { useEffect, useRef } from "react";
import type { KnowledgeSource } from "../../runtimeClient";

export function EvidenceTraceDrawer({ source, open, onClose }: { source: KnowledgeSource | null; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);
  if (!open || !source) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside aria-label="Evidence Trace" className="trace-drawer" data-testid="evidence-trace-drawer">
        <header><div><p className="eyebrow">Evidence Trace</p><h2>{source.title ?? source.sourceId}</h2></div><button aria-label="关闭 Evidence Trace" ref={closeRef} onClick={onClose} type="button">关闭</button></header>
        <code>{source.sourceId}</code>
        <div className="trace-list">
          {(source.evidenceRefs ?? []).map((ref, index) => (
            <article key={`${source.sourceId}-${index}`}>
              <span>{String(ref.locatorType ?? "evidence_ref")}</span>
              <p>{String(ref.textQuote ?? ref.fallbackText ?? ref.evidenceRefId ?? "无可显示证据文本")}</p>
              <small>{String(ref.status ?? "status_not_provided")}</small>
            </article>
          ))}
          {!source.evidenceRefs?.length ? <p className="empty-copy">Runtime 没有返回 EvidenceRef。</p> : null}
        </div>
      </aside>
    </div>
  );
}
