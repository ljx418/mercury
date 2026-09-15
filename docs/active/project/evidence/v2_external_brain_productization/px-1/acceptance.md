# V2-PX PX-1 Acceptance

## Result

```text
Date: 2026-09-01
Automated acceptance: PASS
Human review: not required for PX-1 technical gate
Independent audit: FAIL
Stage disposition: FAIL / REOPENED
Fatal: 0
Major: 3
Minor: 1
```

The automated checks below remain valid evidence, but they do not close the three Major findings recorded in `independent-audit.md`. PX-1 is not accepted and PX-2 remains No-Go.

## Delivered

- WXT 生产构建生成固定 `workspace.html`、独立 JS/CSS。
- 五类 canonical route 的 build/parse、direct-open、reload、Back 和 reopen。
- `INVALID_ROUTE`、`WORKSPACE_NOT_FOUND`、`SOURCE_NOT_FOUND` 可恢复错误。
- extension-origin Workspace 读取真实 Runtime workspace/source/graph 权威状态。
- Runtime transport failure 时页面壳继续打开，显示 `offline / unchecked / unchecked / unknown`。
- Side Panel 最小真实“打开工作台”入口，经 background 创建或聚焦单一 Workspace 标签页。
- 打开/聚焦期间浏览器网络观测 `POST /v1/knowledge/sources = 0`。

## Real Data

E2E 从当前仓库真实 `docs/active/project/01-prd.md` 原始字节创建授权文档 source：

```text
title: Navia PRD - V2-PX Route A
originUrl: navia://docs/active/project/01-prd.md
workspaceId: ws_default
sourceId: src_00000000000000000000000003
status: trace_ready
evidenceRefs: 1
```

重复执行使用 Runtime `Idempotency-Key` 精确重放，真实 source setup 与 Workspace 入口期间的 ingest 请求分开计数。

## Commands

| Check | Result |
|---|---|
| `npm --prefix apps/chrome-extension test` | PASS，15 files / 133 tests |
| `npm --prefix apps/chrome-extension run typecheck` | PASS |
| `npm --prefix apps/chrome-extension run build` | PASS，`workspace.html` 存在 |
| `npm --prefix apps/chrome-extension run e2e:chrome:v2-px-workspace-router` | PASS，20 checks / 3 screenshots |
| `npm --prefix apps/chrome-extension run validate:v2-external-brain-productization` | PASS，109 negative fixtures |
| `PYTHONPATH=services/local-runtime python3 -m pytest -q services/local-runtime/tests/test_v2_memory_knowledge_api.py` | PASS，4 tests |

## Evidence

- `build-spike.json`
- `route-e2e.json`
- `screenshots/workspace-library-1280.png`
- `screenshots/workspace-source-detail-1280.png`
- `screenshots/workspace-runtime-offline-1280.png`
- `logs/frontend-test.log`
- `logs/typecheck.log`
- `logs/build.log`
- `logs/runtime-memory-test.log`
- `logs/px-0.2-validator-regression.log`

截图均为真实 headless Chrome 加载 unpacked extension 后生成，路径和 SHA-256 记录在 `route-e2e.json`。所有 Chrome 实例已由 E2E `finally` 清理。

## Independent Audit Findings

- `WORKSPACE_NOT_FOUND` recovery loops on the missing workspace ID, and `FORBIDDEN` has no verifiable authority path.
- concurrent same-window open requests can race and create duplicate Workspace tabs.
- five-route Back/reopen evidence is incomplete.

See `independent-audit.md` for the exact read-only audit result.

## Existing Build Minor

WXT 仍报告既有 Mermaid 共享 chunk 超过 500 kB。Workspace 自身构建 chunk 约 11.37 kB，未新增同级体积风险；该 warning 不阻塞 PX-1。

## Not Claimed

- PX-2 三个入口与 420/360px Quick Surface 未完成。
- PX-3 多窗口 tab reuse、五类 action、poll/reconnect 未完成。
- PX-4 Ask/Graph/Permission/Forget 交付级宽屏组件未完成。
- PX-5 完整真实 source corpus 与双容器验收未完成。
- PX-6 人工产品出门审计未完成。
- 不声明 V2 ready、完整外脑、RAG ready 或最终 Monica-like UX。
