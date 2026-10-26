# V3-5.10 Media Experience Repair

Status: experience direction approved; Route A implementation has a limited
same-source fresh-run pass (see Stage A Route A implementation audit), while
full Stage A remains NOT PASSED. Route A was explicitly approved. Stage B-D
implementation remains NO-GO until the preceding stage exits. Date: 2026-10-12.

## Product delta and boundaries

The V3 media task remains the single authority for transcript, selected frames, OCR,
vision descriptions, outline, timeline, question answering, and export. The side
panel may show a clearly labelled transcript preview when transcription completes;
it must not call that preview a whole-video summary. Workspace views continue to
derive from the same task ID, revision, and evidence catalog. Existing V3-5.1
contracts and historical tasks remain readable. V4 knowledge import is unchanged.

New V3 targets in the experience direction: a <=100-character whole-video brief;
evidence-backed concept relationships; at least five independently generated
export styles with user-selected coverage and eligible frames. These are product
extensions, not claims that the old PRD or implementation already delivered them.
Generated illustrations, if introduced later, must be opt-in and visibly distinct
from actual video frames. Existing cloud-derived-text consent is not expanded.

## Stage sequence and acceptance

| Stage | Work | Required exit evidence |
|---|---|---|
| A: trust and navigation | Task-authoritative status, elapsed/last-progress clock, collapsed latest-step card, transcript preview, route-safe chapter navigation, seek receipts, stale-task guards | Real task transitions and recovery in Chrome; no false busy after published outline; no invalid chapter route; no wrong-task content; keyboard and four viewport checks |
| B: comprehension quality | Grounded short brief, thesis/evidence synthesis, temporal chapter coverage and imbalance validator | Fresh full-video evidence for six frozen BVIDs; <=100 characters; no first-minute-only conclusion; every claim supported or explicitly insufficient; chapter boundary review |
| C: visual workspace | Stable frame preview, video-relative timeline axis, wheel/pointer/keyboard navigation, screenshot-linked moments, concept relation graph with movable saved layout | Real frames and player seeks; no layout flash; relative time labels only; relationship endpoints and evidence closed; old tasks still render |
| D: exports | Move long article/note/column out of Outline; add at least five prompt-distinct export styles, coverage/frame controls and preview | Five distinct real task outputs, selected evidence closure, no synthetic frame presented as source, repeatable artifact hashes, cancellation/error recovery |
| E: independent exit | Six-video host-LLM content review plus interaction review of outline, timeline and graph; PRD audit and human handoff | Per-video rubric for accuracy, full-span coverage, value, temporal fit, screenshot match and usable seek; no major false-green; human acceptance page and instructions |

Fixed BVIDs for fresh acceptance: `BV1pohR6rEEh`, `BV1hMpE6FEXG`,
`BV1VHHe6kEH3`, `BV1SDHy6aEiB`, `BV1vSHD6tEsM`, `BV1FCps68EGf`.
An unavailable or restricted video is reported as such, never silently replaced
or removed from the denominator. Automated checks and host-LLM review are both
required; neither can substitute for real Chrome user-journey evidence.

## Contract and risk decisions

1. Task status is a monotonic task/revision-scoped state plus current step,
   timestamp of last authoritative progress, and explicit terminal outcome.
   The UI timer is elapsed time, not fabricated percent completion. Inactivity
   may show a warning but never asserts failure without a terminal or transport
   error. Chat and Workspace must agree on the same authority.
2. Routing uses one hash route. Chapter selection is a route parameter or
   navigation state consumed by the outline, never a second hash fragment.
3. Grounded synopsis, chapter graph, and exports are versioned derivatives of
   the same evidence catalog. Existing projection schemas are not changed in
   place. All old readers remain available; new claims need valid evidence IDs.
4. V3 currently uses `vis-timeline` and React Flow. First repair configuration,
   lifecycle and data contracts. Draw.io embedding is deferred: remote iframe
   integration, bundle cost and separate editing state would increase risk
   without fixing the current evidence and temporal defects.
5. Each stage needs a PRD check, real-data end-to-end exercise, automated tests,
   and a written audit. A missing screenshot or an LLM output that merely repeats
   transcript is a failure, not a degraded success. No previous sealed run is
   modified or spliced into a new run.

## Internal preimplementation review

The 13 user-reported defects map to A (1-5,7), B (6,8,9), C (10,12,13),
and D (11). Independent read-only UX review also found silent timeline seek
failure, stale task display after Runtime loss, evidence details without content,
lost Ask question context, missing dialog focus management, unclear task rows,
and a possible cross-task synthesis race. Those are required A/C exit checks.

Current status: implementation authorized; completion **not proven**. Stage B-D
require new contract and acceptance details before code edits. No six-video run,
Chrome screenshots or host-LLM content review has been performed for this
revision. The entry audit has no newly identified Fatal/Major spec contradiction,
but product quality remains below the approved target until exit evidence exists.

> **2026-10-14 状态冻结**（仅冻结当前权威状态词，不改写历史失败证据）：
> - **Stage A** 固定负向旅程 NJ-01..NJ-10 LIMITED PASS（单 BVID `BV1hMpE6FEXG`，独立审查 Fatal=0 / Major=0 / Minor=3，Orca task `task_b307e1598b9e`）。
> - **Stage B B-0** 冻结 PASS；**B-1..B-4** 实现 LIMITED PASS candidate。
> - **Stage B Route 2（确定性 brief composer）** 文档 CONDITIONAL GO + 实现 LIMITED PASS；**B-5 真实 fresh 六视频分母仍 FAIL/REPLAN**（`BV1pohR6rEEh`）。
> - **DeepSeek strict adapter DS-1..DS-5** LIMITED PASS（结构 20/20，不证明内容正确）。
> - **Chat Provider 默认** MiniMax；DeepSeek 已通过凭据库安全导入、**未启用**；保存 ≠ 选择；首次使用不诱导，不自动切换。
> - **B-5..B-7、Stage C/D/E、V3-6/V3-7 全部 NO-GO**；不得据任何当前候选升格为 V3 PASS。
> - 实施边界：单任务锁单一 Provider，禁止跨 Provider 拼接或隐式 fallback；所有真实 Chrome 实例必须 `--mute-audio`；6 个固定 BVID 全程 fresh Runtime/database/profile/task；0 原始视频/音频/帧/Cookie/密钥上传，派生 transcript/OCR/vision-caption 文本仅在既有授权范围内发送；DeepSeek 任务级选择与真实项目派生文本上传须用户另行高风险授权。
> - 详细诊断与 SHA 见 `evidence/v3_media_companion/v3-5.10-experience-repair/`。

## 2026-10-15 P0 trusted-capture transport correction

The Stage B fresh-run prerequisite now includes an internal capture relay correction. The user journey, one-shot grant, Runtime API, authority and local-only audio boundary remain unchanged. Background owns the Runtime WebSocket; Offscreen owns only capture/downsampling and sends ordered PCM over an exact-sender internal Port. This avoids the observed Offscreen-only connection failure without weakening Chrome user activation or adding a second product orchestrator.

Implementation is not authorized by this note. The frozen architecture, R0-R7 plan, A01-A14 acceptance matrix and preimplementation audit are under `evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-*`. P1 six-video execution remains blocked until a single-video immutable candidate passes independent review with Fatal=0/Major=0.
