import { useState } from "react";
import type { KnowledgeQueryResult } from "../../runtimeClient";

export function AskWithSourcesPanel({ loading, error, result, onAsk }: {
  loading: boolean;
  error: string | null;
  result: KnowledgeQueryResult | null;
  onAsk: (question: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const supported = result?.status === "source_supported" && (result.evidenceRefs?.length ?? 0) > 0;
  return (
    <section className="route-panel ask-with-sources" data-testid="route-ask">
      <p className="eyebrow">Ask with Sources</p><h2>基于当前 Workspace 提问</h2>
      <label className="question-field"><span>问题</span><textarea aria-label="Ask with Sources 问题" rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="这些来源共同说明了什么？" /></label>
      <div className="ask-actions"><button disabled={loading || !question.trim()} onClick={() => onAsk(question.trim())} type="button">{loading ? "正在查询" : "提问"}</button></div>
      {error ? <p className="knowledge-error" role="alert">{error}</p> : null}
      {result ? <article className={`answer-panel ${supported ? "supported" : "degraded"}`} data-testid="knowledge-answer">
        <header><strong>{supported ? "Source-backed answer" : "Degraded answer"}</strong><span>{result.evidenceRefs.length} evidence refs</span></header>
        <p>{result.answer || result.degradedReason || "Runtime 未返回回答。"}</p>
        <div className="answer-evidence">{result.evidenceRefs.map((ref, index) => <code key={index}>{String(ref.evidenceRefId ?? ref.sourceId ?? `evidence-${index + 1}`)}</code>)}</div>
      </article> : null}
    </section>
  );
}
