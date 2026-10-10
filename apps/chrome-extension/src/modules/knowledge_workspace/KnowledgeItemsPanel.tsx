import type { V3KnowledgeItem } from "../../runtimeClient";

export function KnowledgeItemsPanel({ items, selected, sort, busy, error, onSort, onSelect, onChange, onSave, onDelete, onOpenSource }: {
  items: V3KnowledgeItem[];
  selected: V3KnowledgeItem | null;
  sort: string;
  busy: boolean;
  error: string | null;
  onSort: (value: string) => void;
  onSelect: (item: V3KnowledgeItem) => void;
  onChange: (item: V3KnowledgeItem) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenSource: () => void;
}) {
  return (
    <section className="knowledge-items-workspace" data-testid="v3-knowledge-items">
      <header className="knowledge-items-header">
        <div><span>KNOW</span><h2>本地知识</h2></div>
        <label><span>排序</span><select value={sort} onChange={(event) => onSort(event.target.value)}>
          <option value="updated_desc">最近更新</option><option value="created_desc">最近创建</option>
          <option value="title_asc">标题</option><option value="priority_desc">优先级</option>
        </select></label>
      </header>
      <div className="knowledge-items-layout">
        <div className="knowledge-item-list" role="list">
          {items.map((item) => <button className={selected?.itemId === item.itemId ? "selected" : ""} key={item.itemId} onClick={() => onSelect(item)} role="listitem" type="button">
            <strong>{item.title}</strong><span>{item.lifecycleState} · P{item.priority}</span><small>{item.summary || item.body.slice(0, 80)}</small>
          </button>)}
          {!items.length ? <p>尚未保存知识。请在 Chat 中提取并确认。</p> : null}
        </div>
        {selected ? <div className="knowledge-item-editor">
          <label><span>标题</span><input value={selected.title} onChange={(event) => onChange({ ...selected, title: event.target.value })} /></label>
          <label><span>摘要</span><textarea rows={3} value={selected.summary} onChange={(event) => onChange({ ...selected, summary: event.target.value })} /></label>
          <label><span>正文</span><textarea rows={8} value={selected.body} onChange={(event) => onChange({ ...selected, body: event.target.value })} /></label>
          <label><span>标签</span><input value={selected.tags.join(", ")} onChange={(event) => onChange({ ...selected, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label>
          <div className="knowledge-item-options">
            <label><span>优先级</span><input max="100" min="0" type="number" value={selected.priority} onChange={(event) => onChange({ ...selected, priority: Number(event.target.value) })} /></label>
            <label><span>状态</span><select value={selected.lifecycleState} onChange={(event) => onChange({ ...selected, lifecycleState: event.target.value as V3KnowledgeItem["lifecycleState"] })}><option value="active">Active</option><option value="aging">Aging</option><option value="archived">Archived</option></select></label>
          </div>
          <div className="knowledge-item-actions"><button onClick={onOpenSource} type="button">打开来源</button><button disabled={busy} onClick={onDelete} type="button">删除本地条目</button><button disabled={busy} onClick={onSave} type="button">保存修改</button></div>
        </div> : <p className="knowledge-item-placeholder">选择一个条目查看和编辑。</p>}
      </div>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  );
}
