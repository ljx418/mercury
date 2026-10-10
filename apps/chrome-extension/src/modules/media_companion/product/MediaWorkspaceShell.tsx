import { useEffect, useMemo, useRef, useState } from "react";
import {
  askMediaOutlineTask,
  createMediaOutlineExport,
  downloadMediaOutlineExport,
  getMediaWorkspaceComprehension,
  getMediaOutlineTask,
  listMediaOutlineTaskAsks,
  listMediaOutlineTasks,
  type MediaAskResult,
  type MediaComprehensionProjection,
  type MediaExportManifest,
  type MediaOutlineTask,
} from "../../../runtimeClient";
import { LocalRuntimeAccess } from "../../knowledge_workspace/LocalRuntimeAccess";
import { MediaJumpbackController, type MediaJumpbackOrigin, type MediaSeekReceipt } from "./MediaJumpbackController";
import { mediaTaskPath, type MediaWorkspaceResolution, type MediaWorkspaceRoute } from "./MediaWorkspaceRouter";
import { InteractiveMindmapView, InteractiveTimelineView, SemanticOutlineView } from "./ComprehensionViews";

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

const EVIDENCE_RETURN_KEY = "navia.mediaEvidenceReturn.v1";
type EvidenceReturnBinding = { taskId: string; evidenceId: string; returnHash: string };

function readEvidenceReturn(): EvidenceReturnBinding | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(EVIDENCE_RETURN_KEY) ?? "null") as Partial<EvidenceReturnBinding> | null;
    return value && typeof value.taskId === "string" && typeof value.evidenceId === "string"
      && typeof value.returnHash === "string" && value.returnHash.startsWith("#/media/tasks/")
      ? value as EvidenceReturnBinding : null;
  } catch { return null; }
}

function restoreEvidenceFocus(binding: EvidenceReturnBinding): void {
  let attempts = 0;
  const find = () => Array.from(document.querySelectorAll<HTMLElement>("[data-evidence-return-id]"))
    .find((element) => element.dataset.evidenceReturnId === binding.evidenceId);
  const attempt = () => {
    const trigger = find();
    if (!trigger || window.location.hash !== binding.returnHash) {
      if (++attempts < 20) window.setTimeout(attempt, 50);
      return;
    }
    trigger.focus();
    window.setTimeout(() => {
      if (trigger.isConnected && document.activeElement === trigger && window.location.hash === binding.returnHash) {
        sessionStorage.removeItem(EVIDENCE_RETURN_KEY);
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
  const [comprehension, setComprehension] = useState<MediaComprehensionProjection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = resolution.ok ? resolution.route : null;

  useEffect(() => {
    if (!runtimeConnected || !route) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTask(null);
    setComprehension(null);
    const request = route.kind === "task_library"
      ? listMediaOutlineTasks().then((value) => { if (!cancelled) setTasks(value); })
      : getMediaOutlineTask(route.taskId).then(async (value) => {
        if (!cancelled) setTask(value);
        if (!value.projections) return;
        try {
          const projection = await getMediaWorkspaceComprehension(value.taskId, value.revision);
          if (!cancelled) setComprehension(projection);
        } catch {
          // Historical V3-5 tasks remain readable through their frozen v2 projections.
        }
      });
    void request.catch((failure) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "媒体任务读取失败");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runtimeConnected, route?.path]);

  const title = route ? LABELS[route.kind] : "无效媒体路由";
  return <div
    className="media-product-shell"
    data-testid="media-product-shell"
    data-route-kind={route?.kind ?? "invalid"}
    data-task-id={task?.taskId ?? ""}
    data-task-revision={task?.revision ?? ""}
  >
    <aside className="media-product-nav" aria-label="Media Workspace 导航">
      <a className="media-product-brand" href="#/media/tasks"><span aria-hidden="true">N</span><strong>Navia Media</strong></a>
      <a data-testid="media-route-task-library" className={route?.kind === "task_library" ? "active" : ""} href="#/media/tasks">视频任务</a>
      {task ? <TaskNavigation task={task} active={route?.kind ?? "task_overview"} /> : null}
      <small>知识导入将在 V4 提供</small>
    </aside>
    <main className="media-product-main">
      <header className="media-product-header"><div><p>MEDIA COMPANION</p><h1>{title}</h1></div></header>
      <LocalRuntimeAccess title="本机 Runtime 安全会话" onChange={(change) => setRuntimeConnected(change.status === "connected")} />
      {!resolution.ok ? <Recovery title="无法打开该媒体页面" detail={resolution.attemptedPath} /> : null}
      {loading ? <section className="media-product-loading" role="status">正在从本机 Runtime 恢复任务权威状态…</section> : null}
      {error ? <Recovery title="无法读取该媒体任务" detail={error} /> : null}
      {!loading && !error && route?.kind === "task_library" ? <TaskLibrary tasks={tasks} /> : null}
      {!loading && !error && route && route.kind !== "task_library" && task ? <TaskRouteContent route={route} task={task} comprehension={comprehension} /> : null}
    </main>
  </div>;
}

function TaskNavigation({ task, active }: { task: MediaOutlineTask; active: MediaWorkspaceRoute["kind"] }) {
  const entries: Array<[Exclude<MediaWorkspaceRoute["kind"], "task_library" | "evidence">, string]> = [
    ["task_overview", "概览"], ["outline", "大纲"], ["timeline", "时间线"], ["mindmap", "导图"], ["ask", "问答"], ["export", "导出"],
  ];
  return <nav aria-label="当前媒体任务">
    {entries.map(([kind, label]) => <a data-testid={`media-route-${kind}`} className={active === kind ? "active" : ""} href={kind === "task_overview" ? mediaTaskPath(task.taskId) : mediaTaskPath(task.taskId, kind)} key={kind}>{label}</a>)}
  </nav>;
}

function TaskLibrary({ tasks }: { tasks: MediaOutlineTask[] }) {
  if (!tasks.length) return <section className="media-product-empty"><h2>还没有视频分析任务</h2><p>在 B站视频页打开 Navia，并从 Chat 启动视频理解。</p></section>;
  return <section className="media-task-library" aria-labelledby="media-task-library-title"><h2 id="media-task-library-title">最近的视频任务</h2><div className="media-task-list">
    {tasks.map((task) => <a data-testid={`media-task-row-${task.taskId}`} href={mediaTaskPath(task.taskId)} key={task.taskId}><div><strong>{sourceLabel(task.sourceIdentity)}</strong><span>{task.state} · rev {task.revision}</span></div><time>{new Date(task.updatedAt).toLocaleString()}</time></a>)}
  </div></section>;
}

function TaskRouteContent({ route, task, comprehension }: { route: Exclude<MediaWorkspaceRoute, { kind: "task_library" }>; task: MediaOutlineTask; comprehension: MediaComprehensionProjection | null }) {
  const projections = task.projections;
  if (route.kind === "task_overview") return <section className="media-task-overview"><div className="media-task-state"><span>{task.state}</span><strong>{sourceLabel(task.sourceIdentity)}</strong><small>rev {task.revision} · {task.knowledgeImportStatus}</small></div>{projections?.outline ? <><h2>{projections.outline.title}</h2><p>{projections.outline.summary}</p><a className="primary-link" href={mediaTaskPath(task.taskId, "outline")}>查看图文大纲</a></> : <p>该任务尚未发布大纲。{task.terminalFailureCode ?? "请等待处理完成。"}</p>}</section>;
  if (!projections?.outline) return <Recovery title="该任务没有可用投影" detail={task.terminalFailureCode ?? task.state} />;
  if (route.kind === "outline" && comprehension) return <SemanticOutlineView task={task} projection={comprehension} />;
  if (route.kind === "timeline" && comprehension) return <InteractiveTimelineView task={task} projection={comprehension} />;
  if (route.kind === "mindmap" && comprehension) return <InteractiveMindmapView task={task} projection={comprehension} />;
  if (route.kind === "outline") return <section className="media-outline-view"><p className="media-legacy-notice">历史任务使用旧版固定投影；重新分析可生成语义章节。</p><h2>{projections.outline.title}</h2>{projections.outline.sections.map((section) => <article key={section.sectionId}><SeekButton task={task} timestampMs={section.startMs} origin="outline" label={formatTime(section.startMs)} /><div><h3>{section.title}</h3><p>{section.summary}</p><EvidenceLinks taskId={task.taskId} ids={section.evidenceIds} /></div></article>)}</section>;
  if (route.kind === "timeline") return <section className="media-timeline-view"><p className="media-legacy-notice">历史任务使用旧版列表时间线。</p><h2>时间线</h2>{projections.timeline.map((item) => <article key={item.segmentId}><SeekButton task={task} timestampMs={item.startMs} origin="timeline" label={formatTime(item.startMs)} /><div><strong>{sectionTitle(projections.outline.sections, item.sectionId)}</strong><EvidenceLinks taskId={task.taskId} ids={item.evidenceIds} /></div></article>)}</section>;
  if (route.kind === "mindmap") return <section className="media-mindmap-view"><p className="media-legacy-notice">历史任务使用旧版一层导图。</p><h2>媒体导图</h2><ul>{projections.mindmap.nodes.map((node) => {
    const evidence = projections.evidenceCatalog.find((item) => node.evidenceIds.includes(item.evidenceId));
    return <li className={node.parentNodeId ? "child" : "root"} key={node.nodeId}><strong>{node.label}</strong>{evidence ? <SeekButton task={task} timestampMs={evidence.timestampStartMs} origin="mindmap" label={`跳到 ${formatTime(evidence.timestampStartMs)}`} /> : null}{node.evidenceIds.length ? <EvidenceLinks taskId={task.taskId} ids={node.evidenceIds} /> : null}</li>;
  })}</ul></section>;
  if (route.kind === "evidence") {
    const evidence = projections.evidenceCatalog.find((item) => item.evidenceId === route.evidenceId);
    return evidence ? <EvidenceView task={task} evidence={evidence} /> : <Recovery title="证据不存在" detail={route.evidenceId} />;
  }
  if (route.kind === "ask") return <AskVideoPanel task={task} />;
  return <MediaExportPanel task={task} />;
}

function EvidenceView({ task, evidence }: { task: MediaOutlineTask; evidence: NonNullable<MediaOutlineTask["projections"]>["evidenceCatalog"][number] }) {
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
  return <section className="media-evidence-view" data-evidence-kind={evidence.kind} data-testid="media-evidence-view" tabIndex={-1}><h2>证据详情</h2><p className="media-evidence-kind">{evidenceKindLabel(evidence.kind)}</p><p className="media-evidence-keyboard-hint">按 Esc 返回证据来源</p><dl><div><dt>类型</dt><dd>{evidence.kind}</dd></div><div><dt>来源</dt><dd>B站当前分P · Runtime 私有证据</dd></div><div><dt>时间</dt><dd>{formatTime(evidence.timestampStartMs)} - {formatTime(evidence.timestampEndMs)}</dd></div><div><dt>内容哈希</dt><dd><code>{evidence.contentSha256}</code></dd></div><div><dt>证据 ID</dt><dd><code>{evidence.evidenceId}</code></dd></div><div><dt>反跳状态</dt><dd>通过当前页面 adapter 校验并回读播放器</dd></div></dl><SeekButton task={task} timestampMs={evidence.timestampStartMs} origin="evidence_drawer" label="跳回播放器" /></section>;
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
  return <section className="media-ask-view"><h2>视频问答</h2><p>先定位当前任务的章节与证据，再生成逐块引用；证据不足时不会补充外部常识。云端文本处理保持关闭。</p><label htmlFor="media-ask-question">问题</label><textarea id="media-ask-question" data-testid="media-ask-question" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} /><button type="button" data-testid="media-ask-submit" onClick={() => void submit()} disabled={busy || !question.trim()}>{busy ? "检索证据中…" : "基于证据回答"}</button>{error ? <p role="alert">{error}</p> : null}{result ? <article data-testid="media-ask-result" data-ask-status={result.status} data-ask-question={result.question}><header className="media-ask-result-heading"><h3>{result.status === "answered" ? "有证据回答" : "证据不足"}</h3><span>{askCategoryLabel(result.category)} · 本地确定性</span></header>{result.answerBlocks?.length ? <div className="media-answer-blocks">{result.answerBlocks.map((block, index) => <div key={`${block.timestampMs}-${index}`}><p>{block.text}</p><small>{formatTime(block.timestampMs)} · {block.evidenceIds.length} 条引用</small></div>)}</div> : result.answer ? <p>{result.answer}</p> : <p>当前任务证据无法支持这个问题。</p>}<div className="media-ask-citations">{result.evidenceIds.map((id) => { const item = evidence.find((candidate) => candidate.evidenceId === id); return item ? <span key={id}><SeekButton task={task} timestampMs={item.timestampStartMs} origin="ask_citation" label={`引用 ${formatTime(item.timestampStartMs)}`} /><a href={`#/media/tasks/${task.taskId}/evidence/${id}`}>查看证据</a></span> : null; })}</div></article> : null}</section>;
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

function EvidenceLinks({ taskId, ids }: { taskId: string; ids: string[] }) {
  return <div className="media-evidence-links">{ids.map((id) => <a
    href={`#/media/tasks/${taskId}/evidence/${id}`}
    key={id}
    data-evidence-return-id={id}
    onClick={() => sessionStorage.setItem(EVIDENCE_RETURN_KEY, JSON.stringify({ taskId, evidenceId: id, returnHash: window.location.hash }))}
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
