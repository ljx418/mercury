# Navia / 伴航

> 当前执行状态（2026-09-14）：T02.5 是 V2-PX 唯一 production-positive R2 输入；T03 R3 pipeline 与 T04 R4 隔离快照复验均已取得独立实现出门 LIMITED PASS。T04 外审为 Fatal 0/Major 0/Minor 1；T04.1 全量重跑修复和 PX-6 machine/human/final 两阶段工作包已进入文档审查，尚无代码授权。Human Review、G7、final 仍 pending/pending/false；PX-5 仍 REOPENED，PX-6 BLOCKED，RKM 未实施。最新状态见 `docs/active/project/stage-gates/v2-external-brain-productization.md`。

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

2026-09-15 H01 的 mock-only 阻塞已有真实 `data_service` 实现候选和 Runtime 级持久化复验；真实 Chrome 三入口仍待人类验收，不能升级为 H01/PX-6 PASS。V3 已冻结 B站优先路线与首个样本 `BV1ZpYd66ELP`，字幕采集、本地 ASR、`VideoOutline`、Media Mindmap 和时间反跳仍为 `NOT_IMPLEMENTED`。入口见 `docs/active/project/design/v3-media-companion-development-acceptance-plan.md`。
