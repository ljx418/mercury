import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react";
import { DataSet } from "vis-data";
import { Timeline } from "vis-timeline";
import "@xyflow/react/dist/style.css";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import {
  downloadMediaEvidenceThumbnail,
  type MediaComprehensionChapter,
  type MediaComprehensionProjection,
  type MediaOutlineTask,
} from "../../../runtimeClient";
import { MediaJumpbackController, type MediaJumpbackOrigin, type MediaSeekReceipt } from "./MediaJumpbackController";
import { mediaChapterPath, mediaTaskPath } from "./MediaWorkspaceRouter";
import { recordEvidenceReturn } from "./evidenceReturn";


export function SemanticOutlineView({ task, projection, selectedChapterId = null }: { task: MediaOutlineTask; projection: MediaComprehensionProjection; selectedChapterId?: string | null }) {
  const [presentation, setPresentation] = useState<"video" | "article" | "note" | "column">("video");
  const recoveryFocusPending = useRef(false);
  const frameCount = projection.evidenceCatalog.filter((item) => item.kind === "frame").length;
  const chapterUnavailable = Boolean(selectedChapterId && !projection.outline.chapters.some((item) => item.chapterId === selectedChapterId));
  useEffect(() => {
    if (selectedChapterId || !recoveryFocusPending.current) return;
    recoveryFocusPending.current = false;
    document.querySelector<HTMLAnchorElement>(".media-semantic-outline .media-chapter-index a")?.focus();
  }, [selectedChapterId]);
  useEffect(() => {
    if (!selectedChapterId || !projection.outline.chapters.some((item) => item.chapterId === selectedChapterId)) return;
    setPresentation("video");
    const timer = window.setTimeout(() => {
      const chapter = document.getElementById(selectedChapterId);
      if (chapter instanceof HTMLDetailsElement) chapter.open = true;
      chapter?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedChapterId, projection.outline.contentSha256]);
  return <section className="media-semantic-outline" data-testid="media-semantic-outline">
    <header className="media-view-intro">
      <div><p>STRUCTURED OUTLINE</p><h2>{projection.outline.title}</h2></div>
      <span>{projection.outline.chapters.length} 章 · {formatTime(projection.task.mediaDurationMs)}</span>
    </header>
    {chapterUnavailable ? <p role="alert" className="media-chapter-unavailable">该章节不属于当前视频任务。<a href={mediaTaskPath(task.taskId, "outline")} onClick={() => { recoveryFocusPending.current = true; }}>返回本任务大纲</a></p> : null}
    <div className="media-outline-presentation" role="group" aria-label="大纲呈现方式">
      <button className={presentation === "video" ? "active" : ""} onClick={() => setPresentation("video")} type="button">视频章节</button>
      <button className={presentation === "article" ? "active" : ""} onClick={() => setPresentation("article")} type="button">知识长文</button>
      <button className={presentation === "note" ? "active" : ""} onClick={() => setPresentation("note")} type="button">图文笔记</button>
      <button className={presentation === "column" ? "active" : ""} onClick={() => setPresentation("column")} type="button">深度专栏</button>
    </div>
    <article className={`media-editorial-lead presentation-${presentation}`}>
      <p className="media-editorial-kicker">{presentationLabel(presentation)}</p>
      <h3>{projection.outline.title}</h3>
      <p>{projection.outline.summary}</p>
      <FrameStack task={task} projection={projection} evidenceIds={projection.evidenceCatalog.filter((item) => item.kind === "frame").slice(0, 4).map((item) => item.evidenceId)} originKey={`lead-${presentation}`} compact />
    </article>
    {frameCount === 0 ? <VisualEvidenceNotice /> : null}
  <OutlinePresentationContent task={task} projection={projection} presentation={presentation} />
  </section>;
}


function OutlinePresentationContent({ task, projection, presentation }: { task: MediaOutlineTask; projection: MediaComprehensionProjection; presentation: "video" | "article" | "note" | "column" }) {
  const chapters = projection.outline.chapters;
  if (presentation === "video") return <div data-outline-layout="video">
    <nav className="media-chapter-index" aria-label="章节目录">
      {chapters.map((chapter) => <a key={chapter.chapterId} href={mediaChapterPath(task.taskId, chapter.chapterId)}><time>{formatTime(chapter.startMs)}</time><span><strong>{chapter.title}</strong><small>{chapter.thesis}</small></span></a>)}
    </nav>
    <div className="media-chapter-list">
      {chapters.map((chapter, index) => <details id={chapter.chapterId} key={chapter.chapterId} open={index === 0}>
        <summary><span>{String(index + 1).padStart(2, "0")}</span><div><time>{formatTime(chapter.startMs)} - {formatTime(chapter.endMs)}</time><strong>{chapter.title}</strong></div></summary>
        <div className="media-chapter-body"><ChapterFrameStack task={task} projection={projection} chapter={chapter} /><ChapterCopy task={task} chapter={chapter} /></div>
      </details>)}
    </div>
  </div>;
  if (presentation === "article") return <div className="media-knowledge-article" data-outline-layout="article">
    {chapters.map((chapter, index) => <article key={chapter.chapterId}>
      <header><span>{String(index + 1).padStart(2, "0")}</span><div><time>{formatTime(chapter.startMs)}</time><h3>{chapter.title}</h3></div></header>
      <div className="media-knowledge-article-body"><ChapterFrameStack task={task} projection={projection} chapter={chapter} compact /><div><p className="media-article-thesis">{chapter.thesis}</p>{chapter.keyPoints.map((point) => <p key={point}>{point}</p>)}<ComprehensionSeekButton task={task} timestampMs={chapter.startMs} origin="chapter" label="回到原片核对" compact /></div></div>
    </article>)}
  </div>;
  if (presentation === "note") return <div className="media-visual-notes" data-outline-layout="note">
    {chapters.map((chapter, index) => <article key={chapter.chapterId}>
      <ChapterFrameStack task={task} projection={projection} chapter={chapter} compact />
      <div><span className="media-note-index">NOTE {String(index + 1).padStart(2, "0")}</span><h3>{chapter.title}</h3><p>{chapter.thesis}</p><ul>{chapter.keyPoints.slice(0, 3).map((point) => <li key={point}>{point}</li>)}</ul><ComprehensionSeekButton task={task} timestampMs={chapter.startMs} origin="chapter" label={formatTime(chapter.startMs)} compact /></div>
    </article>)}
  </div>;
  return <div className="media-deep-column" data-outline-layout="column">
    <aside><strong>本期论述路径</strong>{chapters.map((chapter, index) => <a href={`#column-${chapter.chapterId}`} key={chapter.chapterId}><span>{index + 1}</span>{chapter.title}</a>)}</aside>
    <div>{chapters.map((chapter, index) => <section id={`column-${chapter.chapterId}`} key={chapter.chapterId}><header><span>SECTION {String(index + 1).padStart(2, "0")}</span><time>{formatTime(chapter.startMs)}–{formatTime(chapter.endMs)}</time></header><h3>{chapter.title}</h3><p className="media-column-thesis">{chapter.thesis}</p><ChapterFrameStack task={task} projection={projection} chapter={chapter} compact /><ol>{chapter.keyPoints.map((point) => <li key={point}>{point}</li>)}</ol>{chapter.evidenceNote ? <blockquote>{chapter.evidenceNote}</blockquote> : null}</section>)}</div>
  </div>;
}


function ChapterCopy({ task, chapter }: { task: MediaOutlineTask; chapter: MediaComprehensionChapter }) {
  return <div className="media-chapter-copy"><p>{chapter.thesis}</p><ol>{chapter.keyPoints.map((point) => <li key={point}>{point}</li>)}</ol>{chapter.evidenceNote ? <p className="media-evidence-note"><strong>证据校核</strong>{chapter.evidenceNote}</p> : null}<div className="media-chapter-actions"><ComprehensionSeekButton task={task} timestampMs={chapter.startMs} origin="chapter" label="从本章播放" /><EvidenceLinks taskId={task.taskId} ids={chapter.evidenceIds} originKey={`chapter-${chapter.chapterId}`} /></div></div>;
}


function VisualEvidenceNotice() {
  return <div className="media-visual-evidence-notice" role="status"><strong>本轮只完成了文字分析</strong><p>本次任务在视频下载、抽帧或画面理解阶段未能发布截图；“高质量图文大纲”不会补造画面。请先在 Settings / 媒体与语音确认“B站登录态下载”已启用且验证通过，再从侧边栏重新分析当前视频。新任务会复用一次下载的本地缓存并重新抽帧。</p></div>;
}


export function InteractiveTimelineView({ task, projection }: { task: MediaOutlineTask; projection: MediaComprehensionProjection }) {
  const viewport = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const [cursorMs, setCursorMs] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [seekReceipt, setSeekReceipt] = useState<MediaSeekReceipt | null>(null);
  const duration = Math.max(1, projection.task.mediaDurationMs);
  const hasFrames = projection.evidenceCatalog.some((item) => item.kind === "frame");
  const thumbnailUrls = useFrameThumbnailUrls(task.taskId, projection);

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

  useEffect(() => {
    if (!viewport.current) return;
    const base = Date.UTC(2020, 0, 1);
    const groups = new DataSet(projection.outline.chapters.map((chapter, index) => ({ id: chapter.chapterId, content: `${String(index + 1).padStart(2, "0")} ${chapter.title}` })));
    const items = new DataSet(projection.timeline.moments.map((moment) => {
      const frameId = timelineFrameEvidenceId(moment.chapterId, moment.frameEvidenceId ?? null, projection);
      const thumbnail = frameId ? thumbnailUrls.get(frameId) : null;
      return {
        id: moment.momentId,
        group: moment.chapterId,
        start: new Date(base + moment.timestampMs),
        content: moment.title,
        kind: moment.kind,
        timestampMs: moment.timestampMs,
        thumbnail,
        title: `${formatTime(moment.timestampMs)} ${moment.title}`,
        className: `media-vis-item kind-${moment.kind}${thumbnail ? " has-frame" : ""}`,
      };
    }));
    const timeline = new Timeline(viewport.current, items, groups, {
      start: new Date(base), end: new Date(base + duration), min: new Date(base), max: new Date(base + duration),
      stack: true, zoomMin: 15_000, zoomMax: Math.max(duration * 1.2, 60_000), horizontalScroll: true,
      verticalScroll: true, zoomKey: "ctrlKey", orientation: { axis: "top", item: "top" }, showCurrentTime: false,
      tooltip: { followMouse: true, overflowMethod: "cap" }, margin: { item: 10, axis: 12 },
      template: (item: unknown) => {
        const value = item as { kind: string; content: string; timestampMs: number; thumbnail?: string | null };
        return timelineItemContent(value.kind, value.content, value.timestampMs, value.thumbnail ?? null);
      },
    });
    timeline.addCustomTime(new Date(base), "playback");
    timeline.on("select", (properties) => {
      const selected = projection.timeline.moments.find((moment) => moment.momentId === String(properties.items[0] ?? ""));
      if (selected) void new MediaJumpbackController()
        .seek(task.sourceIdentity, selected.timestampMs, selected.kind === "frame" ? "frame" : "moment")
        .then(setSeekReceipt)
        .catch(() => setSeekReceipt({ origin: selected.kind === "frame" ? "frame" : "moment", requestedMs: selected.timestampMs, observedMs: 0, deltaMs: selected.timestampMs, outcome: "blocked", pageIdentityMatched: false, observedAt: new Date().toISOString(), failureCode: "V3_MEDIA_PORTAL_UNSUPPORTED" }));
    });
    timelineRef.current = timeline;
    return () => { timeline.destroy(); timelineRef.current = null; };
  }, [projection.timeline.contentSha256, projection.outline.contentSha256, task.sourceIdentity, duration, thumbnailUrls]);

  useEffect(() => {
    if (cursorMs === null || !timelineRef.current) return;
    const base = Date.UTC(2020, 0, 1);
    timelineRef.current.setCustomTime(new Date(base + cursorMs), "playback");
  }, [cursorMs]);

  return <section className="media-interactive-timeline" data-testid="media-interactive-timeline">
    <header className="media-view-intro"><div><p>VIDEO TIMELINE</p><h2>章节时间线</h2></div><span>{formatTime(duration)} · {projection.timeline.moments.length} 个节点</span></header>
    {!hasFrames ? <VisualEvidenceNotice /> : null}
    <nav className="media-chapter-storyboard media-frame-storyboard" aria-label="章节画面导航">
      {projection.outline.chapters.map((chapter, index) => <article className={activeChapterId === chapter.chapterId ? "active" : ""} key={chapter.chapterId}>
        <ChapterFrameStack task={task} projection={projection} chapter={chapter} compact />
        <div><small>{formatTime(chapter.startMs)}–{formatTime(chapter.endMs)}</small><ComprehensionSeekButton task={task} timestampMs={chapter.startMs} origin="chapter" label={chapter.title} compact /></div>
      </article>)}
    </nav>
    <div className="media-timeline-toolbar" role="toolbar" aria-label="时间线控制">
      <button type="button" title="缩小时间线" aria-label="缩小时间线" onClick={() => timelineRef.current?.zoomOut(.35)}>−</button>
      <button type="button" title="放大时间线" aria-label="放大时间线" onClick={() => timelineRef.current?.zoomIn(.35)}>＋</button>
      <button type="button" onClick={() => timelineRef.current?.fit({ animation: true })}>适应全片</button>
      <output aria-live="polite">{cursorMs === null ? "拖动或滚轮浏览" : `播放 ${formatTime(cursorMs)}`}</output>
    </div>
    <div className="media-vis-timeline" ref={viewport} tabIndex={0} role="region" aria-label="可缩放、拖动并按章节分组的视频时间线" />
    {seekReceipt ? <p role="status" data-seek-outcome={seekReceipt.outcome}>{seekReceipt.outcome === "located" ? `已定位到 ${formatTime(seekReceipt.observedMs)}` : `未定位到视频：${seekReceipt.failureCode ?? seekReceipt.outcome}`}</p> : null}
    <p className="media-interaction-hint">拖动时间轴平移，滚轮纵向浏览，Ctrl + 滚轮缩放；点击节点即可跳回视频。</p>
  </section>;
}

export function layoutTimelineMoments(timestamps: number[], durationMs: number): {
  widthPx: number;
  trackHeightPx: number;
  positions: Array<{ leftPx: number; topPx: number; lane: number }>;
} {
  const cardWidth = 172;
  let widthPx = Math.max(900, timestamps.length * 90);
  let lanes: number[] = [];
  let assigned: number[] = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    lanes = [];
    assigned = [];
    for (const timestamp of timestamps) {
      const left = Math.max(0, Math.min(widthPx - cardWidth, timestamp * widthPx / Math.max(1, durationMs)));
      let lane = lanes.findIndex((lastLeft) => left - lastLeft >= cardWidth);
      if (lane < 0) { lane = lanes.length; lanes.push(left); }
      else lanes[lane] = left;
      assigned.push(lane);
    }
    if (lanes.length <= 3) break;
    widthPx = Math.ceil(widthPx * 1.35);
  }
  const laneCount = Math.max(1, lanes.length);
  return {
    widthPx,
    trackHeightPx: 58 + laneCount * 100,
    positions: timestamps.map((timestamp, index) => ({
      leftPx: Math.max(0, Math.min(widthPx - cardWidth, timestamp * widthPx / Math.max(1, durationMs))),
      topPx: 48 + assigned[index] * 100,
      lane: assigned[index],
    })),
  };
}


export function InteractiveMindmapView({ task, projection }: { task: MediaOutlineTask; projection: MediaComprehensionProjection }) {
  const chapterNodes = projection.mindmap.nodes.filter((node) => node.kind === "chapter");
  const [expanded, setExpanded] = useState(() => new Set(chapterNodes.map((node) => node.nodeId)));
  const [focusedNodeId, setFocusedNodeId] = useState(() => projection.mindmap.nodes.find((node) => node.kind === "root")!.nodeId);
  const treeRef = useRef<HTMLDivElement>(null);
  const children = useMemo(() => new Map(projection.mindmap.nodes.map((node) => [node.nodeId, projection.mindmap.nodes.filter((item) => item.parentNodeId === node.nodeId)])), [projection.mindmap.contentSha256]);
  const root = projection.mindmap.nodes.find((node) => node.kind === "root")!;
  useEffect(() => {
    setExpanded(new Set(chapterNodes.map((node) => node.nodeId)));
    setFocusedNodeId(root.nodeId);
  }, [task.taskId, projection.mindmap.contentSha256]);
  const flow = useMemo(() => mindmapFlow(projection), [projection.mindmap.contentSha256]);
  const [graphSeekReceipt, setGraphSeekReceipt] = useState<MediaSeekReceipt | null>(null);
  const [graphSeekError, setGraphSeekError] = useState<string | null>(null);
  const handleNodeClick: NodeMouseHandler = (_, node) => {
    const timestamp = node.data.timestampMs;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return;
    setGraphSeekReceipt(null);
    setGraphSeekError(null);
    void new MediaJumpbackController().seek(task.sourceIdentity, timestamp, "mindmap_node")
      .then(setGraphSeekReceipt)
      .catch((error) => setGraphSeekError(error instanceof Error ? error.message : "播放器定位失败"));
  };
  const toggle = (id: string) => {
    const chapter = Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-tree-node-id]") ?? []).find((item) => item.dataset.treeNodeId === id);
    const childGroup = chapter?.querySelector<HTMLElement>(":scope > [role='group']");
    if (expanded.has(id)) {
      if ((children.get(id) ?? []).some((node) => node.nodeId === focusedNodeId)) setFocusedNodeId(id);
      if (childGroup?.contains(document.activeElement)) chapter?.focus();
    }
    setExpanded((value) => { const next = new Set(value); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const treeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>("[role='treeitem']");
    if (!item) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role='treeitem']"));
    const index = items.indexOf(item);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = items[index + 1];
    else if (event.key === "ArrowUp") next = items[index - 1];
    else if (event.key === "Home") next = items[0];
    else if (event.key === "End") next = items.at(-1);
    if (next) {
      event.preventDefault();
      setFocusedNodeId(next.dataset.treeNodeId ?? root.nodeId);
      next.focus();
      return;
    }
    const nodeId = item.dataset.treeNodeId;
    if (nodeId && event.key === "ArrowRight" && !expanded.has(nodeId)) {
      event.preventDefault();
      toggle(nodeId);
    } else if (nodeId && event.key === "ArrowLeft" && expanded.has(nodeId)) {
      event.preventDefault();
      toggle(nodeId);
    }
  };
  return <section className="media-interactive-mindmap" data-testid="media-interactive-mindmap">
    <header className="media-view-intro"><div><p>MEDIA MINDMAP</p><h2>章节逻辑导图</h2></div><span>主题 → 章节 → 关键点</span></header>
    <div className="media-flow-canvas" aria-label="可缩放拖动的章节逻辑导图">
      <ReactFlow nodes={flow.nodes} edges={flow.edges} defaultViewport={{ x: 36, y: 52, zoom: .72 }} minZoom={.35} maxZoom={1.8} nodesDraggable nodesConnectable={false} elementsSelectable onNodeClick={handleNodeClick}>
        <MiniMap pannable zoomable nodeColor={(node) => String(node.style?.background ?? "#dcece7")} />
        <Controls showInteractive={false} />
        <Background gap={22} size={1} color="#dce6e3" />
      </ReactFlow>
    </div>
    {graphSeekReceipt ? <p role="status" data-testid="media-mindmap-seek-status" data-seek-outcome={graphSeekReceipt.outcome}>{graphSeekReceipt.outcome === "located" ? `已定位到 ${formatTime(graphSeekReceipt.observedMs)}` : `未定位到视频：${graphSeekReceipt.failureCode ?? graphSeekReceipt.outcome}`}</p> : null}
    {graphSeekError ? <p role="alert" data-testid="media-mindmap-seek-status">定位失败：{graphSeekError}</p> : null}
    <div className="media-mindmap-accessible" role="tree" aria-label="导图键盘视图" onKeyDown={treeKeyDown} ref={treeRef}>
      <div role="treeitem" aria-level={1} tabIndex={focusedNodeId === root.nodeId ? 0 : -1} data-tree-node-id={root.nodeId} onFocus={(event) => { if (event.target === event.currentTarget) setFocusedNodeId(root.nodeId); }}>{root.label}</div>
      {chapterNodes.map((chapter) => <div role="treeitem" aria-level={2} aria-expanded={expanded.has(chapter.nodeId)} tabIndex={focusedNodeId === chapter.nodeId ? 0 : -1} data-tree-node-id={chapter.nodeId} onFocus={(event) => { if (event.target === event.currentTarget) setFocusedNodeId(chapter.nodeId); }} key={`tree-${chapter.nodeId}`}>
        <button type="button" aria-label={`${expanded.has(chapter.nodeId) ? "折叠" : "展开"}${chapter.label}`} onClick={() => toggle(chapter.nodeId)}>{chapter.label}</button>
        {chapter.timestampMs !== null ? <ComprehensionSeekButton task={task} timestampMs={chapter.timestampMs} origin="mindmap_node" label="定位章节" compact /> : null}
        {expanded.has(chapter.nodeId) ? <div role="group">{(children.get(chapter.nodeId) ?? []).map((node) => <div role="treeitem" aria-level={3} tabIndex={focusedNodeId === node.nodeId ? 0 : -1} data-tree-node-id={node.nodeId} onFocus={(event) => { if (event.target === event.currentTarget) setFocusedNodeId(node.nodeId); }} key={`tree-${node.nodeId}`}>
          <span>{node.label}</span>
          {node.timestampMs !== null ? <ComprehensionSeekButton task={task} timestampMs={node.timestampMs} origin="mindmap_node" label="定位关键点" compact /> : null}
        </div>)}</div> : null}
      </div>)}
    </div>
  </section>;
}


export function FrameThumbnail({ taskId, evidenceId, alt, retryable = true }: { taskId: string; evidenceId: string; alt: string; retryable?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setState("loading");
    void downloadMediaEvidenceThumbnail(taskId, evidenceId).then((blob) => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setState("ready");
    }).catch(() => { if (!disposed) { setUrl(null); setState("failed"); } });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [taskId, evidenceId, attempt]);
  return url ? <img src={url} alt={alt} /> : <div className="media-frame-placeholder" data-frame-state={state} aria-label={`${alt}${state === "loading" ? "加载中" : "暂不可用"}`}><span>{state === "loading" ? "LOADING" : "FRAME"}</span><small>{state === "loading" ? "正在读取私有缩略图" : "缩略图读取失败"}</small>{state === "failed" && retryable ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button> : null}</div>;
}

function FrameStack({ task, projection, evidenceIds, originKey, compact = false, proximityFallback = false }: { task: MediaOutlineTask; projection: MediaComprehensionProjection; evidenceIds: string[]; originKey: string; compact?: boolean; proximityFallback?: boolean }) {
  const ids = evidenceIds.slice(0, compact ? 4 : 3);
  if (!ids.length) return <div className="media-frame-unavailable"><span>TEXT EVIDENCE</span><p>本章节没有可保留的代表画面，继续显示可追溯文字证据。</p></div>;
  return <div className={`media-frame-stack${compact ? " compact" : ""}`} aria-label={`${ids.length} 张章节视频证据${proximityFallback ? "，来自章节边界附近" : ""}，聚焦后展开`}>
    {proximityFallback ? <span className="media-frame-proximity">邻近画面</span> : null}
    {ids.map((id, index) => { const evidence = projection.evidenceCatalog.find((item) => item.evidenceId === id); const triggerKey = `${originKey}-${id}`; return <figure key={id} style={{ "--frame-index": index } as React.CSSProperties}>
      <a href={`#/media/tasks/${task.taskId}/evidence/${id}`} data-evidence-return-id={id} data-evidence-return-key={triggerKey} onClick={() => recordEvidenceReturn(task.taskId, id, triggerKey)} aria-label={`查看 ${formatTime(evidence?.timestampStartMs ?? 0)} 视频画面证据`}>
        <FrameThumbnail taskId={task.taskId} evidenceId={id} alt={`视频证据 ${formatTime(evidence?.timestampStartMs ?? 0)}`} retryable={false} />
      </a>
      <figcaption>{formatTime(evidence?.timestampStartMs ?? 0)}</figcaption>
    </figure>; })}
  </div>;
}

function ChapterFrameStack({ task, projection, chapter, compact = false }: { task: MediaOutlineTask; projection: MediaComprehensionProjection; chapter: MediaComprehensionChapter; compact?: boolean }) {
  const selection = chapterFrameSelection(chapter, projection);
  return <FrameStack task={task} projection={projection} evidenceIds={selection.evidenceIds} originKey={`frame-${chapter.chapterId}-${compact ? "compact" : "full"}`} compact={compact} proximityFallback={selection.proximityFallback} />;
}

function chapterFrameSelection(chapter: MediaComprehensionChapter, projection: MediaComprehensionProjection): { evidenceIds: string[]; proximityFallback: boolean } {
  const frames = projection.evidenceCatalog.filter((item) => item.kind === "frame");
  const direct = frames.filter((item) => item.timestampStartMs >= chapter.startMs && item.timestampStartMs <= chapter.endMs).map((item) => item.evidenceId);
  if (direct.length) return { evidenceIds: direct, proximityFallback: false };
  if (chapter.representativeFrameEvidenceId) return { evidenceIds: [chapter.representativeFrameEvidenceId], proximityFallback: false };
  const midpoint = chapter.startMs + (chapter.endMs - chapter.startMs) / 2;
  const nearest = [...frames].sort((left, right) => Math.abs(left.timestampStartMs - midpoint) - Math.abs(right.timestampStartMs - midpoint))[0];
  return { evidenceIds: nearest ? [nearest.evidenceId] : [], proximityFallback: Boolean(nearest) };
}

function useFrameThumbnailUrls(taskId: string, projection: MediaComprehensionProjection): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const frameKey = projection.evidenceCatalog.filter((item) => item.kind === "frame").map((item) => item.evidenceId).join(":");
  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    const frames = projection.evidenceCatalog.filter((item) => item.kind === "frame");
    void Promise.all(frames.map(async (frame) => {
      try {
        const blob = await downloadMediaEvidenceThumbnail(taskId, frame.evidenceId);
        if (disposed) return null;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        return [frame.evidenceId, url] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!disposed) setUrls(new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    });
    return () => { disposed = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [taskId, frameKey]);
  return urls;
}

function timelineFrameEvidenceId(chapterId: string, explicitFrameId: string | null, projection: MediaComprehensionProjection): string | null {
  const frames = projection.evidenceCatalog.filter((item) => item.kind === "frame");
  if (explicitFrameId && frames.some((item) => item.evidenceId === explicitFrameId)) return explicitFrameId;
  const chapter = projection.outline.chapters.find((item) => item.chapterId === chapterId);
  if (!chapter) return null;
  return chapterFrameSelection(chapter, projection).evidenceIds[0] ?? null;
}

function mindmapFlow(projection: MediaComprehensionProjection): { nodes: Node[]; edges: Edge[] } {
  const root = projection.mindmap.nodes.find((node) => node.kind === "root");
  const chapters = projection.mindmap.nodes.filter((node) => node.kind === "chapter");
  const children = projection.mindmap.nodes.filter((node) => node.kind !== "root" && node.kind !== "chapter");
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (root) nodes.push({ id: root.nodeId, position: { x: 0, y: 80 }, data: { label: root.label }, style: flowNodeStyle("root") });
  chapters.forEach((chapter, index) => {
    const relation = projection.outline.chapters.find((item) => item.chapterId === chapter.chapterId)?.relationToPrevious;
    nodes.push({ id: chapter.nodeId, position: { x: 330, y: index * 220 }, data: { label: `${String(index + 1).padStart(2, "0")}  ${chapter.label}`, timestampMs: chapter.timestampMs }, style: flowNodeStyle("chapter") });
    const previous = chapters[index - 1];
    const source = previous?.nodeId ?? root?.nodeId;
    if (source) edges.push({ id: `${source}-${chapter.nodeId}`, source, target: chapter.nodeId, animated: relation === "contrast" || relation === "cause_effect", label: index === 0 ? "主题展开" : relationLabel(relation) || "继续论述", type: "smoothstep", style: { strokeWidth: 2, stroke: index === 0 ? "#0b765f" : "#829b94" } });
    children.filter((node) => node.parentNodeId === chapter.nodeId).forEach((child, childIndex) => {
      nodes.push({ id: child.nodeId, position: { x: 720, y: index * 220 + childIndex * 66 }, data: { label: child.label, timestampMs: child.timestampMs }, style: flowNodeStyle("point") });
      edges.push({ id: `${chapter.nodeId}-${child.nodeId}`, source: chapter.nodeId, target: child.nodeId, type: "smoothstep", style: { stroke: "#aec1bc" } });
    });
  });
  return { nodes, edges };
}

function flowNodeStyle(kind: "root" | "chapter" | "point"): React.CSSProperties {
  if (kind === "root") return { width: 220, padding: 16, border: "2px solid #075d4d", borderRadius: 6, background: "#075d4d", color: "#fff", fontWeight: 800 };
  if (kind === "chapter") return { width: 250, padding: 13, border: "1px solid #9fc2b8", borderLeft: "5px solid #ad7115", borderRadius: 6, background: "#fff", color: "#173a33", fontWeight: 800 };
  return { width: 280, padding: 10, border: "1px solid #bed0cb", borderRadius: 5, background: "#f5f9f8", color: "#42534e", fontSize: 12 };
}

function presentationLabel(value: "video" | "article" | "note" | "column") {
  return value === "video" ? "视频章节综述" : value === "article" ? "知识长文式综述" : value === "note" ? "图文笔记式速览" : "深度专栏式导读";
}

function timelineKindLabel(kind: string) { return kind === "frame" ? "画面" : kind === "chapter" ? "章节" : kind === "quote" ? "引述" : "要点"; }
function relationLabel(value: string | undefined) { return value === "contrast" ? "对照" : value === "cause_effect" ? "因果" : value === "example" ? "例证" : value === "conclusion" ? "归纳" : ""; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }

function timelineItemContent(kind: string, title: string, timestampMs: number, thumbnail: string | null): HTMLElement {
  const host = document.createElement("div");
  if (thumbnail) {
    const image = document.createElement("img");
    image.className = "media-vis-thumbnail";
    image.src = thumbnail;
    image.alt = "";
    host.append(image);
  }
  const badge = document.createElement("span");
  badge.className = "media-vis-kind";
  badge.textContent = timelineKindLabel(kind);
  const heading = document.createElement("strong");
  heading.textContent = title;
  const time = document.createElement("small");
  time.textContent = formatTime(timestampMs);
  host.append(badge, heading, time);
  return host;
}


function ComprehensionSeekButton({ task, timestampMs, origin, label, compact = false }: { task: MediaOutlineTask; timestampMs: number; origin: MediaJumpbackOrigin; label: string; compact?: boolean }) {
  const [receipt, setReceipt] = useState<MediaSeekReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seek = async () => {
    setBusy(true);
    setError(null);
    setReceipt(null);
    try { setReceipt(await new MediaJumpbackController().seek(task.sourceIdentity, timestampMs, origin)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "播放器定位失败"); }
    finally { setBusy(false); }
  };
  return <span className={`media-seek-control${compact ? " compact" : ""}`}><button type="button" data-seek-ms={timestampMs} data-seek-origin={origin} onClick={(event) => { event.stopPropagation(); void seek(); }} disabled={busy}>{busy ? "定位中…" : label}</button>{receipt ? <small role="status" data-seek-outcome={receipt.outcome} data-seek-requested-ms={receipt.requestedMs} data-seek-observed-ms={receipt.observedMs} data-seek-delta-ms={receipt.deltaMs} data-seek-observed-at={receipt.observedAt}>{receipt.outcome === "located" ? `已定位 · ${receipt.deltaMs}ms` : `未定位 · ${receipt.failureCode}`}</small> : null}{error ? <small role="alert">定位失败 · {error}</small> : null}</span>;
}


function EvidenceLinks({ taskId, ids, originKey }: { taskId: string; ids: string[]; originKey: string }) {
  return <div className="media-evidence-links">{ids.map((id) => { const triggerKey = `${originKey}-${id}`; return <a href={`#/media/tasks/${taskId}/evidence/${id}`} key={id} data-evidence-return-id={id} data-evidence-return-key={triggerKey} onClick={() => recordEvidenceReturn(taskId, id, triggerKey)}>证据 {id.slice(-6)}</a>; })}</div>;
}


function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
