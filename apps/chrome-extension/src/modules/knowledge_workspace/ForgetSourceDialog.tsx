import { useEffect, useRef, useState } from "react";
import { isForgetSourceVerified, type ForgetSourceResult, type KnowledgeSource } from "../../runtimeClient";

export function ForgetSourceDialog({ source, open, loading, error, result, onCancel, onConfirm }: {
  source: KnowledgeSource | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  result: ForgetSourceResult | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setConfirmation(""); inputRef.current?.focus(); } }, [open]);
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation"><section aria-modal="true" className="forget-dialog" data-testid="forget-source-dialog" role="dialog" onKeyDown={(event) => { if (event.key === "Escape" && !loading) onCancel(); }}>
    <p className="eyebrow">Forget Source</p><h2>遗忘这个来源？</h2><p>这会要求 Runtime 从 Library、Ask、Graph 和 Trace 中移除 <code>{source?.sourceId}</code>。输入 <strong>forget</strong> 继续。</p>
    <label><span>确认文本</span><input ref={inputRef} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    {error ? <p className="knowledge-error" role="alert">{error}</p> : null}
    {result ? <div className="forget-verification"><strong>Runtime verification</strong><span>Library {String(result.verification.libraryAbsent)}</span><span>Ask {String(result.verification.askAbsent)}</span><span>Graph {String(result.verification.graphAbsent)}</span><span>Trace {String(result.verification.traceAbsent)}</span>{!isForgetSourceVerified(result) ? <span className="knowledge-error" role="alert">遗忘未完成</span> : null}</div> : null}
    <div className="dialog-actions"><button className="secondary-button" disabled={loading} onClick={onCancel} type="button">取消</button><button className="danger-button" disabled={loading || confirmation !== "forget"} onClick={onConfirm} type="button">{loading ? "正在遗忘" : "确认遗忘"}</button></div>
  </section></div>;
}
