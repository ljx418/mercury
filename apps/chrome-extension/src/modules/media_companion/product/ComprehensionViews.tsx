import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import {
  downloadMediaEvidenceThumbnail,
  type MediaComprehensionChapter,
  type MediaComprehensionProjection,
  type MediaOutlineTask,
} from "../../../runtimeClient";
import { MediaJumpbackController, type MediaJumpbackOrigin, type MediaSeekReceipt } from "./MediaJumpbackController";


export function SemanticOutlineView({ task, projection }: { task: MediaOutlineTask; projection: MediaComprehensionProjection }) {
  return <section className="media-semantic-outline" data-testid="media-semantic-outline">
    <header className="media-view-intro">
      <div><p>STRUCTURED OUTLINE</p><h2>{projection.outline.title}</h2></div>
      <span>{projection.outline.chapters.length} 章 · {formatTime(projection.task.mediaDurationMs)}</span>
    </header>
    <p className="media-outline-summary">{projection.outline.summary}</p>
    <nav className="media-chapter-index" aria-label="章节目录">
      {projection.outline.chapters.map((chapter) => <a key={chapter.chapterId} href={`#${chapter.chapterId}`}><time>{formatTime(chapter.startMs)}</time>{chapter.title}</a>)}
    </nav>
    <div className="media-chapter-list">
      {projection.outline.chapters.map((chapter, index) => <details id={chapter.chapterId} key={chapter.chapterId} open={index === 0}>
        <summary><span>{String(index + 1).padStart(2, "0")}</span><div><time>{formatTime(chapter.startMs)} - {formatTime(chapter.endMs)}</time><strong>{chapter.title}</strong></div></summary>
        <div className="media-chapter-body">
          {chapter.representativeFrameEvidenceId ? <FrameCard task={task} projection={projection} evidenceId={chapter.representativeFrameEvidenceId} timestampMs={chapter.startMs} /> : <div className="media-frame-unavailable"><span>TEXT EVIDENCE</span><p>本章节没有可保留的代表画面，继续显示可追溯文字证据。</p></div>}
          <div className="media-chapter-copy"><p>{chapter.thesis}</p><ol>{chapter.keyPoints.map((point) => <li key={point}>{point}</li>)}</ol><div className="media-chapter-actions"><ComprehensionSeekButton task={task} timestampMs={chapter.startMs} origin="chapter" label="从本章播放" /><EvidenceLinks taskId={task.taskId} ids={chapter.evidenceIds} /></div></div>
        </div>
      </details>)}
    </div>
  </section>;
}


export function InteractiveTimelineView({ task, projection }: { task: MediaOutlineTask; projection: MediaComprehensionProjection }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cursorMs, setCursorMs] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const duration = Math.max(1, projection.task.mediaDurationMs);

  useEffect(() => {
    let cancelled = false;
    const controller = new MediaJumpbackController();
    const read = async () => {
      const value = await controller.read(task.sourceIdentity).catch(() => null);
      if (cancelled || !value) return;
      const next = Math.round(value.currentTimeSeconds * 1000);
      setCursorMs(next);
      setActiveChapterId(projection.outline.chapters.find((chapter) => chapter.startMs <= next && next <= chapter.endMs)?.chapterId ?? null);
    };
    void read();
    const timer = window.setInterval(() => void read(), 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [task.sourceIdentity, projection.task.outlineId]);

  const fit = () => { setZoom(1); if (viewport.current) viewport.current.scrollLeft = 0; };
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    const host = event.currentTarget;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const next = host.scrollLeft + delta;
    const canMove = (delta < 0 && host.scrollLeft > 0) || (delta > 0 && host.scrollLeft < host.scrollWidth - host.clientWidth);
    if (canMove) { event.preventDefault(); host.scrollLeft = next; }
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a")) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    delete event.currentTarget.dataset.dragging;
  };

  return <section className="media-interactive-timeline" data-testid="media-interactive-timeline">
    <header className="media-view-intro"><div><p>VIDEO TIMELINE</p><h2>章节时间线</h2></div><span>{formatTime(duration)} · {projection.timeline.moments.length} 个节点</span></header>
    <div className="media-timeline-toolbar" role="toolbar" aria-label="时间线控制">
      <button type="button" title="缩小时间线" aria-label="缩小时间线" onClick={() => setZoom((value) => Math.max(1, value - .5))}>−</button>
      <button type="button" title="放大时间线" aria-label="放大时间线" onClick={() => setZoom((value) => Math.min(6, value + .5))}>＋</button>
      <button type="button" onClick={fit}>适应全片</button>
      <output aria-live="polite">{zoom.toFixed(1)}×{cursorMs === null ? "" : ` · 播放 ${formatTime(cursorMs)}`}</output>
    </div>
    <div className="media-timeline-viewport" ref={viewport} tabIndex={0} aria-label="可滚轮横移和鼠标拖动的章节时间线" onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <div className="media-timeline-track" style={{ width: `${zoom * 100}%` }}>
        <TimeRuler durationMs={duration} />
        <div className="media-timeline-bands" aria-hidden="true">{projection.outline.chapters.map((chapter) => <span key={chapter.chapterId} className={activeChapterId === chapter.chapterId ? "active" : ""} style={{ left: percent(chapter.startMs, duration), width: percent(chapter.endMs - chapter.startMs, duration) }} />)}</div>
        {cursorMs !== null ? <span className="media-playback-cursor" style={{ left: percent(cursorMs, duration) }} aria-hidden="true" /> : null}
        <div className="media-timeline-moments">{projection.timeline.moments.map((moment, index) => <div className={`media-timeline-moment kind-${moment.kind}`} style={{ left: percent(moment.timestampMs, duration), top: `${48 + (index % 3) * 100}px` }} key={moment.momentId}>
          <ComprehensionSeekButton task={task} timestampMs={moment.timestampMs} origin={moment.kind === "frame" ? "frame" : "moment"} label={moment.title} compact />
          {moment.frameEvidenceId ? <FrameThumbnail taskId={task.taskId} evidenceId={moment.frameEvidenceId} alt={`${moment.title}代表画面`} /> : null}
          <time>{formatTime(moment.timestampMs)}</time>
        </div>)}</div>
      </div>
    </div>
    <p className="media-interaction-hint">在时间线内滚轮横移，按住空白处拖动；按钮、方向键滚动与“适应全片”提供等价操作。</p>
  </section>;
}


export function InteractiveMindmapView({ task, projection }: { task: MediaOutlineTask; projection: MediaComprehensionProjection }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number } | null>(null);
  const chapterNodes = projection.mindmap.nodes.filter((node) => node.kind === "chapter");
  const [expanded, setExpanded] = useState(() => new Set(chapterNodes.map((node) => node.nodeId)));
  const [zoom, setZoom] = useState(1);
  const children = useMemo(() => new Map(projection.mindmap.nodes.map((node) => [node.nodeId, projection.mindmap.nodes.filter((item) => item.parentNodeId === node.nodeId)])), [projection.mindmap.contentSha256]);
  const root = projection.mindmap.nodes.find((node) => node.kind === "root")!;
  const toggle = (id: string) => setExpanded((value) => { const next = new Set(value); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const fit = () => { setZoom(1); if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { if (event.button !== 0 || (event.target as HTMLElement).closest("button, a")) return; drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (!drag.current || drag.current.pointerId !== event.pointerId) return; event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.startX); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.startY); };
  const pointerEnd = () => { drag.current = null; };
  return <section className="media-interactive-mindmap" data-testid="media-interactive-mindmap">
    <header className="media-view-intro"><div><p>MEDIA MINDMAP</p><h2>章节逻辑导图</h2></div><span>主题 → 章节 → 关键点</span></header>
    <div className="media-timeline-toolbar" role="toolbar" aria-label="导图控制"><button type="button" aria-label="缩小导图" onClick={() => setZoom((value) => Math.max(.7, value - .1))}>−</button><button type="button" aria-label="放大导图" onClick={() => setZoom((value) => Math.min(1.6, value + .1))}>＋</button><button type="button" onClick={fit}>适应画布</button><output>{Math.round(zoom * 100)}%</output></div>
    <div className="media-mindmap-viewport" ref={viewport} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <div className="media-mindmap-canvas" style={{ transform: `scale(${zoom})` }}>
        <div className="media-mindmap-root"><strong>{root.label}</strong></div>
        <div className="media-mindmap-branches">{chapterNodes.map((chapter) => <article key={chapter.nodeId}>
          <header><button type="button" aria-expanded={expanded.has(chapter.nodeId)} onClick={() => toggle(chapter.nodeId)}>{expanded.has(chapter.nodeId) ? "−" : "+"}</button><strong>{chapter.label}</strong>{chapter.timestampMs !== null ? <ComprehensionSeekButton task={task} timestampMs={chapter.timestampMs} origin="mindmap_node" label={formatTime(chapter.timestampMs)} compact /> : null}</header>
          {expanded.has(chapter.nodeId) ? <ul>{(children.get(chapter.nodeId) ?? []).map((node) => <li key={node.nodeId}><span>{node.label}</span>{node.timestampMs !== null ? <ComprehensionSeekButton task={task} timestampMs={node.timestampMs} origin="mindmap_node" label="跳转" compact /> : null}</li>)}</ul> : null}
        </article>)}</div>
      </div>
    </div>
    <div className="media-mindmap-accessible" role="tree" aria-label="导图键盘视图"><div role="treeitem" aria-level={1} tabIndex={0}>{root.label}</div>{chapterNodes.map((chapter) => <div role="treeitem" aria-level={2} aria-expanded={expanded.has(chapter.nodeId)} tabIndex={0} key={`tree-${chapter.nodeId}`}><button type="button" onClick={() => toggle(chapter.nodeId)}>{chapter.label}</button>{expanded.has(chapter.nodeId) ? (children.get(chapter.nodeId) ?? []).map((node) => <div role="treeitem" aria-level={3} tabIndex={0} key={`tree-${node.nodeId}`}>{node.label}</div>) : null}</div>)}</div>
  </section>;
}


function TimeRuler({ durationMs }: { durationMs: number }) {
  const count = 8;
  return <div className="media-time-ruler" aria-hidden="true">{Array.from({ length: count + 1 }, (_, index) => { const value = Math.round(durationMs * index / count); return <span key={index} style={{ left: `${index * 100 / count}%` }}><i />{formatTime(value)}</span>; })}</div>;
}


function FrameCard({ task, projection, evidenceId, timestampMs }: { task: MediaOutlineTask; projection: MediaComprehensionProjection; evidenceId: string; timestampMs: number }) {
  const evidence = projection.evidenceCatalog.find((item) => item.evidenceId === evidenceId);
  return <figure className="media-frame-card"><FrameThumbnail taskId={task.taskId} evidenceId={evidenceId} alt={`代表画面 ${formatTime(evidence?.timestampStartMs ?? timestampMs)}`} /><figcaption><span>代表画面 · {formatTime(evidence?.timestampStartMs ?? timestampMs)}</span><ComprehensionSeekButton task={task} timestampMs={evidence?.timestampStartMs ?? timestampMs} origin="frame" label="跳到画面" compact /></figcaption></figure>;
}


function FrameThumbnail({ taskId, evidenceId, alt }: { taskId: string; evidenceId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    void downloadMediaEvidenceThumbnail(taskId, evidenceId).then((blob) => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (!disposed) setUrl(null); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [taskId, evidenceId]);
  return url ? <img src={url} alt={alt} /> : <div className="media-frame-placeholder" aria-label={`${alt}暂不可用`}><span>FRAME</span><small>私有缩略图不可用</small></div>;
}


function ComprehensionSeekButton({ task, timestampMs, origin, label, compact = false }: { task: MediaOutlineTask; timestampMs: number; origin: MediaJumpbackOrigin; label: string; compact?: boolean }) {
  const [receipt, setReceipt] = useState<MediaSeekReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const seek = async () => { setBusy(true); try { setReceipt(await new MediaJumpbackController().seek(task.sourceIdentity, timestampMs, origin)); } finally { setBusy(false); } };
  return <span className={`media-seek-control${compact ? " compact" : ""}`}><button type="button" data-seek-ms={timestampMs} data-seek-origin={origin} onClick={(event) => { event.stopPropagation(); void seek(); }} disabled={busy}>{busy ? "定位中…" : label}</button>{receipt ? <small role="status" data-seek-outcome={receipt.outcome}>{receipt.outcome === "located" ? `已定位 · ${receipt.deltaMs}ms` : `未定位 · ${receipt.failureCode}`}</small> : null}</span>;
}


function EvidenceLinks({ taskId, ids }: { taskId: string; ids: string[] }) {
  return <div className="media-evidence-links">{ids.map((id) => <a href={`#/media/tasks/${taskId}/evidence/${id}`} key={id}>证据 {id.slice(-6)}</a>)}</div>;
}


function percent(value: number, duration: number): string {
  return `${Math.max(0, Math.min(100, value * 100 / duration))}%`;
}


function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
