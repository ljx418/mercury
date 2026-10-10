import type { V3KnowledgeDraft } from "../../runtimeClient";

export function KnowledgeDraftCard({ draft, busy, error, canCreate, onCreate, onChange, onSaveEdits, onCancel, onConfirm }: {
  draft: V3KnowledgeDraft | null;
  busy: boolean;
  error: string | null;
  canCreate: boolean;
  onCreate: () => void;
  onChange: (draft: V3KnowledgeDraft) => void;
  onSaveEdits: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="knowledge-draft-panel" data-testid="v3-knowledge-draft">
      <div className="knowledge-panel-heading">
        <div><span>知识提取</span><h2>{draft ? "确认知识草稿" : "把当前内容提炼到 Know"}</h2></div>
        {draft ? <span className={`draft-state draft-state-${draft.state}`}>{draft.state}</span> : null}
      </div>
      {!draft ? (
        <button data-testid="create-knowledge-draft" disabled={!canCreate || busy} onClick={onCreate} type="button">提取知识</button>
      ) : draft.state === "editing" ? (
        <div className="knowledge-draft-fields">
          <label><span>标题</span><input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></label>
          <label><span>摘要</span><textarea rows={3} value={draft.summary} onChange={(event) => onChange({ ...draft, summary: event.target.value })} /></label>
          <label><span>正文</span><textarea rows={7} value={draft.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} /></label>
          <label><span>标签</span><input value={draft.tags.join(", ")} onChange={(event) => onChange({ ...draft, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="使用逗号分隔" /></label>
          <p className="knowledge-source-ref">来源：{draft.sourceRefs[0]?.url}</p>
          <div className="knowledge-draft-actions">
            <button disabled={busy} onClick={onCancel} type="button">取消</button>
            <button disabled={busy} onClick={onSaveEdits} type="button">更新草稿</button>
            <button data-testid="confirm-knowledge-draft" disabled={busy} onClick={onConfirm} type="button">保存到 Know</button>
          </div>
        </div>
      ) : <p>{draft.state === "saved" ? "已保存到 Know。" : "草稿已取消，未写入知识库。"}</p>}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  );
}
