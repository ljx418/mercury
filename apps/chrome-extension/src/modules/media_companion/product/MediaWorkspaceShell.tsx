import { useEffect, useMemo, useRef, useState } from "react";
import {
  askMediaOutlineTask,
  createMediaOutlineExport,
  downloadMediaOutlineExport,
  getMediaWorkspaceComprehension,
  getMediaTranscriptProjection,
  getMediaOutlineTask,
  listMediaOutlineTaskAsks,
  listMediaOutlineTasks,
  synthesizeMediaWorkspaceComprehension,
  type MediaAskResult,
  type MediaComprehensionProjection,
  type MediaComprehensionEvidence,
  type MediaSynthesisStyle,
  type MediaExportManifest,
  type MediaOutlineTask,
  type MediaTranscriptProjection,
  RuntimeRequestError,
} from "../../../runtimeClient";
import { LocalRuntimeAccess } from "../../knowledge_workspace/LocalRuntimeAccess";
import { MediaJumpbackController, type MediaJumpbackOrigin, type MediaSeekReceipt } from "./MediaJumpbackController";
import { mediaChapterPath, mediaTaskPath, selectedMediaChapter, type MediaWorkspaceResolution, type MediaWorkspaceRoute } from "./MediaWorkspaceRouter";
import { FrameThumbnail, InteractiveMindmapView, InteractiveTimelineView, SemanticOutlineView } from "./ComprehensionViews";
import { clearEvidenceReturn, readEvidenceReturn, recordEvidenceReturn, type EvidenceReturnBinding } from "./evidenceReturn";

const LABELS: Record<MediaWorkspaceRoute["kind"], string> = {
  task_library: "视频任务",
  task_overview: "任务概览",
  outline: "图文大纲",
  timeline: "时间线",
  mindmap: "媒体导图",
  ask: "视频问答",
  evidence: "证据",
  export: "导出",
};

function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return elapsed;
}

function mediaBackPath(route: MediaWorkspaceRoute | null): { href: string; label: string } {
  if (!route || route.kind === "task_library") return { href: "#/", label: "返回 Navia" };
  if (route.kind === "task_overview") return { href: "#/media/tasks", label: "返回视频任务" };
  return { href: mediaTaskPath(route.taskId), label: "返回任务概览" };
}

function restoreEvidenceFocus(binding: EvidenceReturnBinding): void {
  let attempts = 0;
  const find = () => Array.from(document.querySelectorAll<HTMLElement>("[data-evidence-return-id]"))
    .find((element) => element.dataset.evidenceReturnId === binding.evidenceId
      && (!binding.triggerKey || element.dataset.evidenceReturnKey === binding.triggerKey));
  const attempt = () => {
    const trigger = find();
    if (!trigger || window.location.hash !== binding.returnHash) {
      if (++attempts < 20) window.setTimeout(attempt, 50);
      return;
    }
    trigger.closest("details:not([open])")?.setAttribute("open", "");
    trigger.focus();
    window.setTimeout(() => {
      if (trigger.isConnected && document.activeElement === trigger && window.location.hash === binding.returnHash) {
        clearEvidenceReturn();
      } else if (++attempts < 20) {
        window.setTimeout(attempt, 50);
      }
    }, 50);
  };
  window.setTimeout(attempt, 100);
}

export function MediaWorkspaceShell({ resolution }: { resolution: MediaWorkspaceResolution }) {
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [tasks, setTasks] = useState<MediaOutlineTask[]>([]);
  const [task, setTask] = useState<MediaOutlineTask | null>(null);
  const [transcriptProjection, setTranscriptProjection] = useState<MediaTranscriptProjection | null>(null);
  const [comprehension, setComprehension] = useState<MediaComprehensionProjection | null>(null);
  const [comprehensionLoading, setComprehensionLoading] = useState(false);
  const [readScope, setReadScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = resolution.ok ? resolution.route : null;

  useEffect(() => {
    if (!runtimeConnected || !route) return;
    let cancelled = false;
    let pollTimer: number | null = null;
    setReadScope(route.path);
    setLoading(true);
    setError(null);
    setTask(null);
    setTranscriptProjection(null);
    setComprehension(null);
    setComprehensionLoading(false);
    const read = async (initial: boolean) => {
      try {
        if (route.kind === "task_library") {
          const value = await listMediaOutlineTasks();
          if (!cancelled) { setTasks(value); setError(null); }
          return;
        }
        let value: MediaOutlineTask;
        try {
          value = await getMediaOutlineTask(route.taskId);
        } catch (failure) {
          if (!(failure instanceof RuntimeRequestError) || failure.httpStatus !== 404) throw failure;
          const pending = await getMediaTranscriptProjection(route.taskId);
          if (cancelled) return;
          setTask(null);
          setComprehension(null);
          setComprehensionLoading(false);
          setTranscriptProjection(pending);
          setError(null);
          if (!["blocked", "failed", "cancelled"].includes(pending.state)) {
            pollTimer = window.setTimeout(() => void read(false), 1500);
          }
          return;
        }
        if (cancelled) return;
        setTask(value);
        setTranscriptProjection(null);
        setError(null);
        if (value.projections) {
          setComprehension(null);
          setComprehensionLoading(true);
          try {
            const projection = await getMediaWorkspaceComprehension(value.taskId, value.revision);
            if (!cancelled) setComprehension(projection);
          } catch (failure) {
            if (!(failure instanceof RuntimeRequestError) || failure.httpStatus !== 404) throw failure;
            if (!cancelled) setComprehension(null);
          } finally {
            if (!cancelled) setComprehensionLoading(false);
          }
        } else {
          setComprehension(null);
          setComprehensionLoading(false);
        }
        if (!cancelled && !["ready", "degraded", "blocked", "failed", "cancelled"].includes(value.state)) {
          pollTimer = window.setTimeout(() => void read(false), 1500);
        }
      } catch (failure) {
        if (!cancelled) {
          setComprehensionLoading(false);
          setError(failure instanceof Error ? failure.message : "媒体任务读取失败");
          if (route.kind !== "task_library") pollTimer = window.setTimeout(() => void read(false), 3000);
        }
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };
    void read(true);
    return () => { cancelled = true; if (pollTimer !== null) window.clearTimeout(pollTimer); };
  }, [runtimeConnected, route?.path]);

  const title = route ? LABELS[route.kind] : "无效媒体路由";
  const back = mediaBackPath(route);
  const currentScope = runtimeConnected && readScope === route?.path;
  const selectedTaskId = route && route.kind !== "task_library" ? route.taskId : null;
  const visibleTask = currentScope && task?.taskId === selectedTaskId ? task : null;
  const visibleAcquisition = currentScope && transcriptProjection?.taskId === selectedTaskId ? transcriptProjection : null;
  const visibleComprehension = visibleTask && comprehension?.task.taskId === visibleTask.taskId && comprehension.task.taskRevision === visibleTask.revision ? comprehension : null;
  useEffect(() => {
    const binding = readEvidenceReturn();
    if (!binding || binding.returnHash !== window.location.hash || route?.kind === "evidence") return;
    const restore = () => {
      const shell = document.querySelector<HTMLElement>("[data-testid='media-product-shell']");
      if (shell?.dataset.taskId !== binding.taskId || window.location.hash !== binding.returnHash) return false;
      const trigger = Array.from(shell.querySelectorAll<HTMLElement>("[data-evidence-return-id]"))
        .find((element) => element.dataset.evidenceReturnId === binding.evidenceId
          && (!binding.triggerKey || element.dataset.evidenceReturnKey === binding.triggerKey));
      if (!trigger) return false;
      trigger.closest("details:not([open])")?.setAttribute("open", "");
      trigger.focus();
      if (document.activeElement !== trigger) return false;
      clearEvidenceReturn();
      return true;
    };
    if (restore()) return;
    const observer = new MutationObserver(() => { if (restore()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-task-id"] });
    return () => observer.disconnect();
  }, [route?.path]);
  return <div
    className="media-product-shell"
    data-testid="media-product-shell"
    data-route-kind={route?.kind ?? "invalid"}
    data-task-id={visibleTask?.taskId ?? visibleAcquisition?.taskId ?? ""}
    data-task-revision={visibleTask?.revision ?? ""}
  >
    <aside className="media-product-nav" aria-label="Media Workspace 导航">
      <a className="media-product-brand" href="#/media/tasks"><span aria-hidden="true">N</span><strong>Navia Media</strong></a>
      <a data-testid="media-route-task-library" className={route?.kind === "task_library" ? "active" : ""} href="#/media/tasks">视频任务</a>
      {visibleTask ? <TaskNavigation task={visibleTask} active={route?.kind ?? "task_overview"} /> : null}
      <small>知识导入将在 V4 提供</small>
    </aside>
    <main className="media-product-main">
      <header className="media-product-header"><div><a className="media-product-back" href={back.href}>{back.label}</a><p>MEDIA COMPANION</p><h1>{title}</h1></div><span className={`media-runtime-beacon ${runtimeConnected ? "is-online" : "is-connecting"}`}>{runtimeConnected ? "本机伴侣已连接" : "正在连接本机伴侣"}</span></header>
      <details className="media-runtime-details"><summary>连接与运行状态</summary><LocalRuntimeAccess title="本机 Runtime 安全会话" onChange={(change) => { if (change.status !== "connected") setReadScope(null); setRuntimeConnected(change.status === "connected"); }} /></details>
      {!runtimeConnected ? <section className="media-product-loading" role="status">本机伴侣未连接，历史任务内容已暂时隐藏；连接恢复后将重新读取当前任务。</section> : null}
      {!resolution.ok ? <Recovery title="无法打开该媒体页面" detail={resolution.attemptedPath} /> : null}
      {currentScope && loading ? <section className="media-product-loading" role="status">正在从本机 Runtime 恢复任务权威状态…</section> : null}
      {currentScope && error ? <Recovery title="无法读取该媒体任务" detail={error} /> : null}
      {visibleTask?.policyContext?.status === "historical" ? <p className="media-legacy-notice" role="status">历史授权结果：仅供查看，不会作为当前授权下的新任务证据。</p> : null}
      {currentScope && !loading && !error && route?.kind === "task_library" ? <TaskLibrary tasks={tasks} /> : null}
      {currentScope && !loading && !error && route && route.kind !== "task_library" && !visibleTask && visibleAcquisition ? <section className="media-task-overview" role="status"><div className="media-task-state"><span>{visibleAcquisition.state}</span><strong>{sourceLabel(visibleAcquisition.sourceIdentity)}</strong></div><p>{["blocked", "failed", "cancelled"].includes(visibleAcquisition.state) ? `采集已停止：${visibleAcquisition.failureCode ?? visibleAcquisition.state}` : "正在处理当前视频；大纲尚未发布，页面会在同一任务完成后自动更新。"}</p></section> : null}
      {currentScope && !loading && !error && comprehensionLoading && visibleTask ? <section className="media-product-loading" role="status">正在读取当前任务的理解结果…</section> : null}
      {currentScope && !loading && !error && route && route.kind !== "task_library" && visibleTask && visibleComprehension && visibleTask.policyContext?.status !== "historical" ? <ComprehensionQualityControl task={visibleTask} projection={visibleComprehension} onUpdate={(value) => setComprehension((current) => current?.task.taskId === value.task.taskId && current.task.taskRevision === value.task.taskRevision ? value : current)} /> : null}
      {currentScope && !loading && !error && !comprehensionLoading && route && route.kind !== "task_library" && visibleTask ? <TaskRouteContent route={route} task={visibleTask} comprehension={visibleComprehension} selectedChapterId={selectedMediaChapter(window.location.hash)} /> : null}
    </main>
  </div>;
}

function ComprehensionQualityControl({ task, projection, onUpdate }: {
  task: MediaOutlineTask;
  projection: MediaComprehensionProjection;
  onUpdate: (value: MediaComprehensionProjection) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<MediaSynthesisStyle>(projection.quality?.style ?? "structured");
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const elapsed = useElapsedSeconds(busy);
  const grounded = projection.quality?.mode === "grounded_model";
  useEffect(() => {
    if (!confirming) return;
    const dialog = dialogRef.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>("select:not(:disabled), button:not(:disabled)") ?? []);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busyRef.current) { event.preventDefault(); setConfirming(false); }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = controls();
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); openerRef.current?.focus(); };
  }, [confirming]);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      onUpdate(await synthesizeMediaWorkspaceComprehension(task.taskId, task.revision, style));
      setConfirming(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "高质量理解生成失败");
    } finally { setBusy(false); }
  };
  return <section className={`media-quality-control ${grounded ? "ready" : "preview"}`} data-testid="media-quality-control" data-quality-mode={grounded ? "grounded_model" : "local_extract_only"}>
    <div><strong>{grounded ? `高质量${projection.quality?.styleRisk?.label ?? "结构化"}理解` : "本地提取预览"}</strong><p>{grounded ? `已根据全片派生文本建立章节、逻辑关系和证据引用。${projection.quality?.styleRisk?.riskDescription ?? "仍需人工抽查。"}` : "当前结果只做本地切分和摘录，可能出现章节失真、回答无关或概括不足。"}</p></div>
    <button type="button" ref={openerRef} onClick={() => setConfirming(true)}>{grounded ? "更换结果风格" : "生成高质量图文大纲"}</button>
    {grounded ? <span>{projection.authorization.modelId}</span> : null}
    {confirming ? <div ref={dialogRef} className="media-synthesis-dialog" role="dialog" aria-modal="true" aria-labelledby="media-synthesis-title">
      <div><h2 id="media-synthesis-title">允许本次视频进行结构化理解？</h2><p>将发送带时间戳的派生字幕、OCR/画面描述和随机证据 ID 到已验证模型。不会发送 Cookie、原始音视频、截图二进制或本地路径。</p><label htmlFor="media-synthesis-style">结果风格</label><select id="media-synthesis-style" value={style} onChange={(event) => setStyle(event.target.value as MediaSynthesisStyle)} disabled={busy}><option value="structured">结构化（推荐，风险最低）</option><option value="concise">精简（可能遗漏次要信息）</option><option value="detailed">详细（内容更长、可能冗余）</option><option value="tutorial">教程（仅适合操作型视频）</option></select><p>风格只改变组织和篇幅，不改变证据来源。模型输出会经过证据 ID、时间范围和字段校验；失败不会覆盖当前结果。</p>{busy ? <p className="media-live-progress" role="status"><span aria-hidden="true" />正在分析全片证据 · {elapsed} 秒</p> : null}{error ? <p role="alert">{error}</p> : null}<div><button type="button" onClick={() => void run()} disabled={busy}>{busy ? `正在理解 · ${elapsed}s` : "允许并生成"}</button><button type="button" onClick={() => setConfirming(false)} disabled={busy}>取消</button></div></div>
    </div> : null}
  </section>;
}

function TaskNavigation({ task, active }: { task: MediaOutlineTask; active: MediaWorkspaceRoute["kind"] }) {
  const entries: Array<[Exclude<MediaWorkspaceRoute["kind"], "task_library" | "evidence">, string]> = [
    ["task_overview", "概览"], ["outline", "大纲"], ["timeline", "时间线"], ["mindmap", "导图"], ["ask", "问答"], ["export", "导出"],
  ];
  return <nav aria-label="当前媒体任务">
    {entries.filter(([kind]) => task.policyContext?.status !== "historical" || (kind !== "ask" && kind !== "export")).map(([kind, label]) => <a data-testid={`media-route-${kind}`} className={active === kind ? "active" : ""} href={kind === "task_overview" ? mediaTaskPath(task.taskId) : mediaTaskPath(task.taskId, kind)} key={kind}>{label}</a>)}
  </nav>;
}

function TaskLibrary({ tasks }: { tasks: MediaOutlineTask[] }) {
  if (!tasks.length) return <section className="media-product-empty"><h2>还没有视频分析任务</h2><p>在 B站视频页打开 Navia，并从 Chat 启动视频理解。</p></section>;
  return <section className="media-task-library" aria-labelledby="media-task-library-title"><h2 id="media-task-library-title">最近的视频任务</h2><div className="media-task-list">
    {tasks.map((task) => <a data-testid={`media-task-row-${task.taskId}`} href={mediaTaskPath(task.taskId)} key={task.taskId}><div><strong>{sourceLabel(task.sourceIdentity)}</strong><span>{task.policyContext?.status === "historical" ? "历史授权结果 · " : ""}{task.state} · rev {task.revision}</span></div><time>{new Date(task.updatedAt).toLocaleString()}</time></a>)}
  </div></section>;
}

function TaskRouteContent({ route, task, comprehension, selectedChapterId }: { route: Exclude<MediaWorkspaceRoute, { kind: "task_library" }>; task: MediaOutlineTask; comprehension: MediaComprehensionProjection | null; selectedChapterId: string | null }) {
  const projections = task.projections;
  if (task.policyContext?.status === "historical" && (route.kind === "ask" || route.kind === "export")) {
    return <Recovery title="历史结果仅供查看" detail="请回到当前授权下的视频任务进行新的问答或导出。" />;
  }
  if (route.kind === "task_overview") return <MediaTaskOverview task={task} comprehension={comprehension} />;
  if (!projections?.outline) return <Recovery title="该任务没有可用投影" detail={task.terminalFailureCode ?? task.state} />;
  if (route.kind === "outline" && comprehension) return <SemanticOutlineView task={task} projection={comprehension} selectedChapterId={selectedChapterId} />;
  if (route.kind === "timeline" && comprehension) return <InteractiveTimelineView task={task} projection={comprehension} />;
  if (route.kind === "mindmap" && comprehension) return <InteractiveMindmapView task={task} projection={comprehension} />;
  if (route.kind === "outline") return <section className="media-outline-view"><p className="media-legacy-notice">历史任务使用旧版固定投影；重新分析可生成语义章节。</p><h2>{projections.outline.title}</h2>{projections.outline.sections.map((section) => <article key={section.sectionId}><SeekButton task={task} timestampMs={section.startMs} origin="outline" label={formatTime(section.startMs)} /><div><h3>{section.title}</h3><p>{section.summary}</p><EvidenceLinks taskId={task.taskId} ids={section.evidenceIds} originKey={`outline-${section.sectionId}`} /></div></article>)}</section>;
  if (route.kind === "timeline") return <section className="media-timeline-view"><p className="media-legacy-notice">历史任务使用旧版列表时间线。</p><h2>时间线</h2>{projections.timeline.map((item) => <article key={item.segmentId}><SeekButton task={task} timestampMs={item.startMs} origin="timeline" label={formatTime(item.startMs)} /><div><strong>{sectionTitle(projections.outline.sections, item.sectionId)}</strong><EvidenceLinks taskId={task.taskId} ids={item.evidenceIds} originKey={`timeline-${item.segmentId}`} /></div></article>)}</section>;
  if (route.kind === "mindmap") return <section className="media-mindmap-view"><p className="media-legacy-notice">历史任务使用旧版一层导图。</p><h2>媒体导图</h2><ul>{projections.mindmap.nodes.map((node) => {
    const evidence = projections.evidenceCatalog.find((item) => node.evidenceIds.includes(item.evidenceId));
    return <li className={node.parentNodeId ? "child" : "root"} key={node.nodeId}><strong>{node.label}</strong>{evidence ? <SeekButton task={task} timestampMs={evidence.timestampStartMs} origin="mindmap" label={`跳到 ${formatTime(evidence.timestampStartMs)}`} /> : null}{node.evidenceIds.length ? <EvidenceLinks taskId={task.taskId} ids={node.evidenceIds} originKey={`mindmap-${node.nodeId}`} /> : null}</li>;
  })}</ul></section>;
  if (route.kind === "evidence") {
    const evidence = comprehension?.evidenceCatalog.find((item) => item.evidenceId === route.evidenceId)
      ?? projections.evidenceCatalog.find((item) => item.evidenceId === route.evidenceId);
    return evidence ? <EvidenceView task={task} evidence={evidence} /> : <Recovery title="证据不存在" detail={route.evidenceId} />;
  }
  if (route.kind === "ask") return <AskVideoPanel task={task} />;
  return <MediaExportPanel task={task} />;
}

function MediaTaskOverview({ task, comprehension }: { task: MediaOutlineTask; comprehension: MediaComprehensionProjection | null }) {
  const projections = task.projections;
  if (!projections?.outline) return <section className="media-task-overview"><div className="media-task-state"><span>{task.state}</span><strong>{sourceLabel(task.sourceIdentity)}</strong><small>rev {task.revision} · {task.knowledgeImportStatus}</small></div><p>该任务尚未发布大纲。{task.terminalFailureCode ?? "请等待处理完成。"}</p></section>;
  const transcript = comprehension?.evidenceCatalog.filter((item) => item.kind === "transcript") ?? [];
  const groundedClaims = comprehension?.grounded?.claims ?? [];
  const limited = comprehension?.quality?.status === "limited";
  return <section className="media-task-overview media-overview-report">
    <div className="media-task-state"><span>{task.state}</span><strong>{sourceLabel(task.sourceIdentity)}</strong><small>rev {task.revision} · {task.knowledgeImportStatus}</small></div>
    <header className="media-overview-hero">
      <p>VIDEO BRIEF</p>
      <h2>{comprehension?.outline.title ?? projections.outline.title}</h2>
      <div>{comprehension?.outline.summary ?? projections.outline.summary}</div>
      {comprehension?.grounded?.brief.origin ? <small
        data-testid="media-brief-origin"
        data-brief-origin={comprehension.grounded.brief.origin}
      >{comprehension.grounded.brief.origin === "deterministic_claim_composer"
          ? `由 ${comprehension.grounded.brief.sourceClaimIds?.length ?? 0} 条已核验证据表达组合`
          : "由模型直接生成"}</small> : null}
    </header>
    {comprehension ? <>
      {limited ? <div className="media-grounded-limited" role="status"><strong>证据覆盖受限</strong><span>当前结果不能代表完整视频理解。</span><small>{comprehension.quality?.failureCodes?.join(" · ")}</small></div> : null}
      <section className="media-overview-structure" aria-labelledby="media-overview-structure-title"><h3 id="media-overview-structure-title">视频结构</h3><ol>{comprehension.outline.chapters.map((chapter) => <li key={chapter.chapterId}><a href={mediaChapterPath(task.taskId, chapter.chapterId)}><time>{formatTime(chapter.startMs)}</time><span><strong>{chapter.title}</strong><small>{chapter.thesis}</small></span></a></li>)}</ol></section>
      <section className="media-overview-evidence" aria-labelledby="media-overview-evidence-title"><h3 id="media-overview-evidence-title">主要表达与关键依据</h3><div>{groundedClaims.length > 0 ? groundedClaims.map((claim) => <article key={claim.claimId}><strong>{claim.text}</strong><p>{claim.regions.map((region) => ({ opening: "开篇", middle: "中段", ending: "结尾" })[region]).join(" · ")}</p><a data-evidence-return-id={claim.evidenceIds[0]} onClick={() => recordEvidenceReturn(task.taskId, claim.evidenceIds[0], claim.claimId)} href={`#/media/tasks/${task.taskId}/evidence/${claim.evidenceIds[0]}`}>查看 {claim.evidenceIds.length} 条直接证据</a></article>) : comprehension.outline.chapters.slice(0, 6).map((chapter) => <article key={chapter.chapterId}><strong>{chapter.title}</strong><p>{chapter.keyPoints.slice(0, 2).join("；")}</p><small>{chapter.evidenceIds.length} 条证据 · {formatTime(chapter.startMs)}–{formatTime(chapter.endMs)}</small></article>)}</div></section>
      <details className="media-overview-transcript"><summary><span>按时间查看识别文字</span><small>{transcript.length} 段 · 当前为单轨识别，未启用多人声纹分离</small></summary><ol>{transcript.map((item) => <li key={item.evidenceId}><time>{formatTime(item.timestampStartMs)}–{formatTime(item.timestampEndMs)}</time><strong>说话人（单轨）</strong><p>{item.excerpt}</p></li>)}</ol></details>
    </> : <p className="media-legacy-notice">该历史任务尚无新版理解投影；重新分析后可查看章节结构与时间戳文字。</p>}
    <div className="media-overview-actions"><a className="primary-link" href={mediaTaskPath(task.taskId, "outline")}>查看图文大纲</a><a href={mediaTaskPath(task.taskId, "timeline")}>打开证据时间线</a><a href={mediaTaskPath(task.taskId, "mindmap")}>打开逻辑导图</a></div>
  </section>;
}

function EvidenceView({ task, evidence }: { task: MediaOutlineTask; evidence: NonNullable<MediaOutlineTask["projections"]>["evidenceCatalog"][number] | MediaComprehensionEvidence }) {
  const binding = readEvidenceReturn();
  const returnHash = binding?.taskId === task.taskId && binding.evidenceId === evidence.evidenceId
    ? binding.returnHash
    : mediaTaskPath(task.taskId, "outline");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const binding = readEvidenceReturn();
      if (!binding || binding.taskId !== task.taskId || binding.evidenceId !== evidence.evidenceId) return;
      event.preventDefault();
      window.location.hash = binding.returnHash;
      restoreEvidenceFocus(binding);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [task.taskId, evidence.evidenceId]);
  return <section className="media-evidence-view" data-evidence-kind={evidence.kind} data-testid="media-evidence-view" tabIndex={-1}><a className="media-evidence-back" href={returnHash} onClick={() => { if (binding && binding.taskId === task.taskId && binding.evidenceId === evidence.evidenceId) restoreEvidenceFocus(binding); }}>← 返回证据来源</a><h2>证据详情</h2><p className="media-evidence-kind">{evidenceKindLabel(evidence.kind)}</p>{"excerpt" in evidence ? <div className="media-evidence-excerpt"><strong>证据摘录</strong><p>{evidence.excerpt}</p><small>仅展示摘录；请跳回原片核对完整上下文。</small></div> : null}{evidence.kind === "frame" && "thumbnailAvailable" in evidence && evidence.thumbnailAvailable ? <FrameThumbnail taskId={task.taskId} evidenceId={evidence.evidenceId} alt={`视频画面 ${formatTime(evidence.timestampStartMs)}`} /> : null}<p className="media-evidence-keyboard-hint">按 Esc 返回证据来源</p><dl><div><dt>类型</dt><dd>{evidence.kind}</dd></div><div><dt>来源</dt><dd>B站当前分P · Runtime 私有证据</dd></div><div><dt>时间</dt><dd>{formatTime(evidence.timestampStartMs)} - {formatTime(evidence.timestampEndMs)}</dd></div><div><dt>内容哈希</dt><dd><code>{evidence.contentSha256}</code></dd></div><div><dt>证据 ID</dt><dd><code>{evidence.evidenceId}</code></dd></div><div><dt>反跳状态</dt><dd>通过当前页面 adapter 校验并回读播放器</dd></div></dl><SeekButton task={task} timestampMs={evidence.timestampStartMs} origin="evidence_drawer" label="跳回播放器" /></section>;
}

function SeekButton({ task, timestampMs, origin, label }: { task: MediaOutlineTask; timestampMs: number; origin: MediaJumpbackOrigin; label: string }) {
  const [receipt, setReceipt] = useState<MediaSeekReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const seek = async () => {
    setBusy(true);
    try { setReceipt(await new MediaJumpbackController().seek(task.sourceIdentity, timestampMs, origin)); }
    catch { setReceipt({ origin, requestedMs: timestampMs, observedMs: 0, deltaMs: timestampMs, outcome: "blocked", pageIdentityMatched: false, observedAt: new Date().toISOString(), failureCode: "V3_MEDIA_PORTAL_UNSUPPORTED" }); }
    finally { setBusy(false); }
  };
  return <span className="media-seek-control"><button type="button" data-seek-ms={timestampMs} data-seek-origin={origin} onClick={() => void seek()} disabled={busy}>{busy ? "跳转中…" : label}</button>{receipt ? <small role="status" data-seek-outcome={receipt.outcome} data-seek-requested-ms={receipt.requestedMs} data-seek-observed-ms={receipt.observedMs} data-seek-delta-ms={receipt.deltaMs} data-seek-observed-at={receipt.observedAt}>{receipt.outcome === "located" ? `已定位 · 误差 ${receipt.deltaMs}ms` : `未定位 · ${receipt.failureCode}`}</small> : null}</span>;
}

function AskVideoPanel({ task }: { task: MediaOutlineTask }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<MediaAskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsedSeconds(busy);
  const requestGeneration = useRef(0);
  const evidence = task.projections?.evidenceCatalog ?? [];
  useEffect(() => {
    let cancelled = false;
    const generation = ++requestGeneration.current;
    void listMediaOutlineTaskAsks(task.taskId, task.revision).then((results) => {
      if (!cancelled && generation === requestGeneration.current && results.length) setResult(results.at(-1) ?? null);
    }).catch((failure) => {
      if (!cancelled && generation === requestGeneration.current) setError(failure instanceof Error ? failure.message : "问答历史读取失败");
    });
    return () => { cancelled = true; requestGeneration.current += 1; };
  }, [task.taskId, task.revision]);
  const submit = async () => {
    const generation = ++requestGeneration.current;
    setBusy(true); setError(null);
    try {
      const next = await askMediaOutlineTask(task.taskId, task.revision, question);
      if (generation === requestGeneration.current) setResult(next);
    } catch (failure) {
      if (generation === requestGeneration.current) setError(failure instanceof Error ? failure.message : "视频问答失败");
    } finally {
      if (generation === requestGeneration.current) setBusy(false);
    }
  };
  const executionLabel = result?.executionMode === "grounded_model" ? "模型证据问答" : result?.executionMode === "structured_projection" ? "结构化全片索引" : "本地确定性";
  return <section className="media-ask-view"><h2>视频问答</h2><p>先定位当前任务的章节与证据，再生成逐块引用；证据不足时不会补充外部常识。</p><label htmlFor="media-ask-question">问题</label><textarea id="media-ask-question" data-testid="media-ask-question" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} /><button type="button" data-testid="media-ask-submit" onClick={() => void submit()} disabled={busy || !question.trim()}>{busy ? `正在检索与生成 · ${elapsed}s` : "基于证据回答"}</button>{busy ? <p className="media-live-progress" role="status"><span aria-hidden="true" />问题已提交，正在核对全片章节与引用证据。</p> : null}{error ? <p role="alert">{error}</p> : null}{result ? <article data-testid="media-ask-result" data-ask-status={result.status} data-ask-question={result.question}><header className="media-ask-result-heading"><h3>{result.status === "answered" ? "有证据回答" : "证据不足"}</h3><span>{askCategoryLabel(result.category)} · {executionLabel}</span></header>{result.answerBlocks?.length ? <div className="media-answer-blocks">{result.answerBlocks.map((block, index) => <div key={`${block.timestampMs}-${index}`}><p>{block.text}</p><small>{formatTime(block.timestampMs)} · {block.evidenceIds.length} 条引用</small></div>)}</div> : result.answer ? <p>{result.answer}</p> : <p>当前任务证据无法支持这个问题。</p>}<div className="media-ask-citations">{result.evidenceIds.map((id) => { const item = evidence.find((candidate) => candidate.evidenceId === id); return item ? <span key={id}><SeekButton task={task} timestampMs={item.timestampStartMs} origin="ask_citation" label={`引用 ${formatTime(item.timestampStartMs)}`} /><a href={`#/media/tasks/${task.taskId}/evidence/${id}`}>查看证据</a></span> : null; })}</div></article> : null}</section>;
}

function MediaExportPanel({ task }: { task: MediaOutlineTask }) {
  const [manifests, setManifests] = useState<MediaExportManifest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (format: MediaExportManifest["format"]) => {
    setBusy(format); setError(null);
    try {
      const manifest = await createMediaOutlineExport(task.taskId, task.revision, format);
      const blob = await downloadMediaOutlineExport(task.taskId, manifest);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = manifest.filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setManifests((current) => [...current.filter((item) => item.format !== format), manifest]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "本地导出失败"); }
    finally { setBusy(null); }
  };
  return <section className="media-export-view"><h2>本地导出</h2><p>导出不会写入知识库。知识导入将在 V4 提供。</p><div className="media-export-actions"><button type="button" data-testid="media-export-json" disabled={busy !== null} onClick={() => void run("json_bundle")}>导出 JSON</button><button type="button" data-testid="media-export-zip" disabled={busy !== null} onClick={() => void run("markdown_zip")}>导出 Markdown ZIP</button></div>{busy ? <p role="status">正在生成本地文件…</p> : null}{error ? <p role="alert">{error}</p> : null}{manifests.map((manifest) => <article key={manifest.exportId} data-export-format={manifest.format}><strong>{manifest.filename}</strong><span>{manifest.byteLength} bytes · {manifest.memberIndex.length} 项</span><code>{manifest.artifactSha256}</code><small>knowledgeImportStatus: deferred_to_v4</small></article>)}</section>;
}

function EvidenceLinks({ taskId, ids, originKey }: { taskId: string; ids: string[]; originKey: string }) {
  return <div className="media-evidence-links">{ids.map((id) => <a
    href={`#/media/tasks/${taskId}/evidence/${id}`}
    key={id}
    data-evidence-return-id={id}
    data-evidence-return-key={`${originKey}-${id}`}
    onClick={() => recordEvidenceReturn(taskId, id, `${originKey}-${id}`)}
  >证据 {id.slice(-6)}</a>)}</div>;
}

function Recovery({ title, detail }: { title: string; detail: string }) {
  return <section className="media-product-empty" role="alert"><h2>{title}</h2><p>{detail}</p><a href="#/media/tasks">返回视频任务</a></section>;
}

function sourceLabel(sourceIdentity: string): string {
  const parts = sourceIdentity.split(":");
  return parts[2] || sourceIdentity;
}

function sectionTitle(sections: Array<{ sectionId: string; title: string }>, sectionId: string): string {
  return sections.find((item) => item.sectionId === sectionId)?.title ?? "未命名片段";
}

function formatTime(value: number): string {
  const seconds = Math.floor(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function evidenceKindLabel(kind: string): string {
  return ({
    transcript: "真实语音转写",
    frame: "本地选中画面",
    ocr_block: "本地画面文字",
    vision_caption: "受控云端画面理解",
  } as Record<string, string>)[kind] ?? "媒体证据";
}

function askCategoryLabel(category: MediaAskResult["category"]): string {
  return category === "visual" ? "画面问题" : category === "cross_chapter" ? "跨章节问题" : "事实问题";
}
