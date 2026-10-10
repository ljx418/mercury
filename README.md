# Navia / 伴航

> 当前执行状态（2026-09-22）：V2/PX-6/RKM 已暂停并保留未完成事实，V3 Media Companion 优先。V3-1.1 B站页面 adapter 保留历史外部限定 PASS；V3-1.2 通用 session/B站 Cookie 候选产品链为 `QUALIFIED PASS`；V3-1.3 Browser→Runtime 凭据通道独立实施出门审查 `PASS`。V3-2-0 的真实 ASR 质量门禁失败并保持 reopened；V3-2-0a Provider/模型管理获独立 `LOCAL LIMITED PASS`。V3-2-0b 已完成 Paraformer Q8 资产、Provider、Settings 与低资源真实推理，但在固定 sample 03 的非静音 bin 产生完整遗漏，当前为 `FAIL / REPLAN`；5.1a 失败证据可审计化与 5.1b 产品状态传播已分别出门，但不改变质量失败。0b-6/0b-7 与 V3-2-1+ 均 NO-GO。媒体获取、可信 tabCapture、生产 transcript、OCR/VLM 仍未实现。最新状态见 `docs/active/project/stage-gates/v3-media-companion.md`。

Navia is a Chrome companion-reading MVP with a local headless runtime. V1 frontend interaction follows `docs/active/project/interaction-prd/窗口交互_PRD.md`: an in-page floating ball opens an embedded dual-track AI panel that can read the current page, summarize it, answer page-grounded questions, and generate Mermaid mindmaps with traceable runtime events.

V1.0 focuses on the functional loop and PRD-aligned in-page interaction skeleton. V1.1 is the frontend fidelity stage: it aligns the injected panel with the Figma Make prototype shape and visual-regression acceptance. V1.2 introduced a documentation-first architecture stage: it froze the AI reading A/B/C/D module split, service/app workspace boundaries, and lightweight Adapter contracts before parallel implementation.

## External Agent Quick Start

If you are an external coding agent or a developer joining one module, start with:

```text
AGENTS.md
docs/active/project/AGENT_ONBOARDING.md
docs/active/project/V1_2_AGENT_WORKPACKS.md
docs/active/README.md
```

These documents define the V1.2 module workpacks, allowed edit directories, required contracts, evidence expectations, and Integration handoff rules.

Short version:

| Workpack | Directory |
|---|---|
| A Page Reading | `services/local-runtime/navia_runtime/modules/page_reading/` |
| B Renderer | `apps/chrome-extension/src/modules/*_renderer/` |
| C Mindmap | `services/local-runtime/navia_runtime/modules/mindmap/` |
| D CoreProvider / Adapter | `services/local-runtime/navia_runtime/modules/agent_loop/`, `services/local-runtime/navia_runtime/modules/adapters/` |
| Integration | existing entrypoints listed in `docs/active/project/stage-gates/v1.2-e-integration.md` |

Do not start implementation before reading your module documentation under `docs/active/modules/` and the matching stage gate.

## Requirements

- Python 3.11+
- Node.js 20+
- pnpm 10+
- Chrome with Extension Developer Mode enabled

## Install

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

cd apps/chrome-extension
pnpm install
cd ../..
```

## Run Local Runtime

```bash
uvicorn navia_runtime.app:app --host 127.0.0.1 --port 17861 --app-dir services/local-runtime
```

Runtime state is persisted locally in SQLite at `.navia/navia.sqlite3` by default. Use `NAVIA_DB_PATH=/path/to/navia.sqlite3` to override it.

Health check:

```bash
curl http://127.0.0.1:17861/v1/health
```

### Run H01 with the real knowledge service

The default Runtime remains mock-first for contract tests. For PX-6 H01 real-persistence acceptance, start the sibling `data_service` repository and Navia Runtime through the explicit launcher:

```bash
./scripts/h01_real_data_service.sh start
./scripts/h01_real_data_service.sh status
```

The launcher expects `../data_service/backend/app/main.py`, stores acceptance data under `.navia/h01-real-data-service/`, and starts `data_service` on `127.0.0.1:8003` plus Navia Runtime on `127.0.0.1:17861`. Override `NAVIA_DATA_SERVICE_REPO` when the sibling repository lives elsewhere. Stop both recorded processes with:

```bash
./scripts/h01_real_data_service.sh stop
```

H01 real mode currently enables workspace, source import, build status, and source trace only. Query, Graph, and durable Forget remain fail-closed and must not be presented as completed real-service capabilities.

## Build Chrome Extension

```bash
cd apps/chrome-extension
pnpm build
cd ../..
```

Load this directory in `chrome://extensions`:

```text
apps/chrome-extension/chrome-mv3-unpacked
```

The build writes the unpacked extension to `apps/chrome-extension/chrome-mv3-unpacked`.

The content script mounts the in-page floating launcher and chat panel. Mermaid rendering still runs in the extension page `mermaid-renderer.html` through an iframe so Mermaid itself is not executed directly in the webpage context.

## Verify

Runtime tests:

```bash
PYTHONPATH=services/local-runtime python3 -m pytest -q services/local-runtime/tests
```

Chrome extension tests:

```bash
cd apps/chrome-extension
pnpm test
pnpm run typecheck
pnpm build
```

Chrome UI E2E automation:

```bash
cd apps/chrome-extension
pnpm run e2e:inpage
```

If browser automation cannot expose the extension service worker or content script, do not fake the result. Use the manual Chrome flow below and record it in the relevant stage gate.

## Minimal Manual Chrome Acceptance

1. Start Runtime:

```bash
uvicorn navia_runtime.app:app --host 127.0.0.1 --port 17861 --app-dir services/local-runtime
```

2. Load the unpacked extension:

```text
apps/chrome-extension/chrome-mv3-unpacked
```

3. Open a normal webpage, not `chrome://` or Chrome Web Store.
4. Confirm the Navia floating ball or hover strip appears.
5. Open the in-page panel and confirm Runtime is online.
6. Click `读取当前页面`.
7. Send a page-grounded question or click `总结`.
8. Click `Mindmap` and confirm Mermaid SVG renders, or that source fallback is visible.
9. Refresh or reopen the page and confirm the latest session, page title, messages, and artifact restore.
10. Collapse the panel and confirm the page layout is restored.

## Project Layout

```text
services/local-runtime/                       Python FastAPI local runtime and AgentCore baseline
services/local-runtime/navia_runtime/modules/ V1.2 service modules for A/C/D
apps/chrome-extension/                        WXT + React Chrome MV3 extension
apps/chrome-extension/src/modules/            V1.2 frontend renderer modules for B
docs/active/project/                          PRD, architecture, contracts, stage gates, evidence
docs/active/modules/runtime/                  A/C/D runtime module development documents
docs/active/modules/frontend/                 B frontend module development documents
docs/history/                                 inactive and superseded documents
.navia/                                       Local SQLite runtime state, ignored by Git
```

## Active Documentation

Current project documentation lives in:

- `docs/active/README.md`
- `docs/active/project/README.md`

The historical A-V1.2 page-perception development and audit package lives in:

- `docs/active/project/design/v1.2-ai-reading-modular-architecture.md`
- `docs/active/project/design/v1.2-ai-reading-workspace-partition.md`
- `docs/active/project/contracts/v1_2_adapter_contracts.md`
- `docs/active/project/stage-gates/v1.2-0-ai-reading-contract-and-workspace-freeze.md`
- `docs/active/project/design/v1.2-a-page-perception-gap.drawio`
- `docs/active/project/stage-gates/v1.2-a-v1.2-production-page-perception.md`
- `docs/active/project/contracts/a_v1_2_page_perception.schema.json`

V1.2 allows lightweight MCP / Skill / External API Adapter contracts only through D Adapter Layer and governance hooks. It does not allow long-term memory, RAG, multi-agent orchestration, browser automation, or high-risk side effects by default.

Historical V1.0, V1.1, A-V1.1, and V1.13-V1.16 documents have been moved to `docs/history/`.

Additional external-agent onboarding docs:

- `AGENTS.md`
- `docs/active/project/AGENT_ONBOARDING.md`
- `docs/active/project/V1_2_AGENT_WORKPACKS.md`
- `docs/active/project/MODULE_HANDOFF_TEMPLATE.md`

Module-local development docs have been moved out of implementation directories and into:

- `docs/active/modules/runtime/`
- `docs/active/modules/frontend/`

## V1 Scope Boundaries

V1 does not add RAG, long-term memory, multi-agent orchestration, browser automation, network search, local file access by default, voice, desktop pet, deep research, or PPT generation. V1.2 may define MCP / Skill Adapter contracts for future controlled integration, but all such calls must be routed through D Adapter Layer and governance hooks.

## Recent Independent Audits

Read-only static reviews and isolated diagnostic reproductions are archived under `docs/active/project/evidence/` and listed in `docs/active/project/README.md` 的"独立审查归档（按阶段）"节。当前两条最近审计：

- `docs/active/project/evidence/v2_external_brain_productization/px-5/r1-independent-audit-2026-09-09.md` — V2-PX R1 实现期主代理独立审查，确认 F-1..F-6 共六项 Major（缓存命中绕过撤销复检、Forget 接受空对象与任意 confirmationText、EvidenceRef 资源放大、Adapter 接受 `authorized_local_document` 直通、四面 verification 硬编码 True），并附可复现脚本。R1 整体 / PX-5 / PX-6 仍保持未通过。
- `docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-2026-09-10.md` — V2-RKM 文档方向第二轮独立复审，独立重算 19 项 SHA-256 与 Draw.io XML 结构，确认文档包一致；附 16 项次级问题清单（S-1..S-16）供 RKM-0 合同冻结前关闭。RKM-0..5 仍为 `NOT_IMPLEMENTED`。

- `docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-round2-2026-09-10.md` — ClaudeCode CLI第二轮复审原文，包含G-1..G-7及错误的36项/阶段措辞，作为历史审计证据保留。
- `docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-round2-remediation-2026-09-10.md` — `DOC-Closure`权威处置：纠正为39项、移除T00、冻结G-1..G-7字段语义并完成三组限定范围0/0/0复核；仍不放行代码或T05。

本轮逐项修订记录：`docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md`。原独立审查文件保留原文；文档处置不代表fixture或产品已验收。

最新风险再核查见该记录第6节：新增RC-01..04维护状态/日程、turn事务交接、离线撤销控制面及Forget优先恢复的设计与验收步骤。图纸仍8页；未放行代码，DS/模型/真实Chrome风险仍待验证。

最新分阶段文档审查：`docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-staged-implementation-review-2026-09-10.md`。含两组独立多轮复核、T01..10/AC01..10及待冻结D01..09；限定文档范围零发现不代表代码批准或产品通过。

上一轮 V2-PX T04.1/PX-6 文档冻结审计已经归档。T04 实现独立审计仍位于 `docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-implementation-exit-audit.md`；T04 LIMITED PASS 不单独构成 PX-5/PX-6/V2 产品通过。

2026-09-15 当前外部审计包已切换为 PX6-0..5 机器出门候选（19 个载荷 + 1 个 manifest）：`docs/active/project/external-audit-package/`。独立实施审计位于 `docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/independent-implementation-exit-audit.md`，结论为 PX6-0..5 LIMITED PASS（Fatal 0 / Major 0 / Minor 0）；PX6-6 人类 H01..H07、PX6-7 两步终审握手以及 PX-6/PX-5/V2 最终通过均未完成。

2026-09-22 当前优先级为 V3 Media Companion；V2/PX-6 与 RKM 保持封存且未完成，知识导入、Query、Graph、Durable Forget 转入 V4。V3-1.3 已完成 Browser-to-Runtime 一次性凭据通道并独立出门 `PASS`。V3-2-0 的 ASR 人类质量结论仍 `FAIL / REPLAN`；V3-2-0a 已获独立 `LOCAL LIMITED PASS`。V3-2-0b 的官方 FunASR llama.cpp + Paraformer Q8 + FSMN-VAD 已完成固定资产安装、Provider/Settings 与低资源真实推理；15 秒 VAD 重跑在 sample 03 / bin 2 产生非静音完整遗漏，机器 preflight 已 fail closed，未进入人工盲评。BiliNote 仍仅作 `reference_only` 研究；其默认 Faster-Whisper Tiny 已由 Navia 作为 fallback-only 提供，不能计生产质量。字幕正文获取、媒体下载/可信 tabCapture、生产 transcript、关键帧、本地 OCR、授权云端 VLM、`VideoOutline`、Media Mindmap、Ask 和时间反跳仍为 `NOT_IMPLEMENTED`。

V3-2-0b 交互审查入口为 `docs/active/project/design/v3-media-companion-prototype-review/v3-2-0b-asr-qualification.html`；当前失败与重规划入口为 `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-provider-qualification/v3-2-0b-replan-decision-2026-09-22.md`。推荐的固定 15 秒预切片路线会改变 candidate manifest 与生产推理合同，必须重新完成详细文档、内外审和用户授权；V3-2-1..7 继续 NO-GO。
