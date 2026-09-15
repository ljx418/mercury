# V2-PX PX-1 Workspace Entry And Router Acceptance Plan

## Gate

PX-1 只有在本计划全部通过且 PRD/架构/false-green/独立审计均无 Fatal 或 Major 时才可关闭。PX-1 通过不等于 V2-PX 产品验收通过。

## A. Route Contract

- 五类 route 均能 build/parse round-trip：`source_library`、`source_detail`、`ask`、`graph`、`permissions`。
- Source Library 禁止 `sourceId`；Source Detail 必须包含 `workspaceId + sourceId`。
- 缺失、空白、重复或无法解码的 ID，以及未知 path，进入 `INVALID_ROUTE`。
- direct-open、reload、Browser Back 和 reopen 均从 URL 恢复，不从 fixture 或前端事实缓存恢复。
- Runtime 返回不存在的 workspace/source 时分别进入 `WORKSPACE_NOT_FOUND` / `SOURCE_NOT_FOUND`；`FORBIDDEN` 保留为可注入合同分支。

## B. Route A Six-Part Spike

1. build 产物存在 `chrome-mv3-unpacked/workspace.html`。
2. `chrome.runtime.getURL("workspace.html")` 生成 extension-origin URL。
3. Side Panel 最小真实入口经 background 打开或聚焦 Workspace，不要求人工输入 URL。
4. route direct-open/reload/Back/reopen 自动化通过。
5. build manifest 未新增权限、未放宽远程脚本 CSP、未引入 localhost Workspace。
6. Runtime offline 时 Workspace shell 仍打开，并显示本地推导诊断；重复打开只聚焦标签页且不触发 ingest API。

第 3、6 项在 PX-1 只证明最小 `open_workspace -> source_library` 路径。PX-2/PX-3 仍必须完成三个入口、多窗口和 reconnect 的完整矩阵。

## C. Functional Checks

- 在线 Runtime：列出真实 workspace/source；detail route 读取 route 中的真实 source。
- 离线 Runtime：不请求或显示权威 Adapter/data_service/source success；提供重试。
- 页面导航使用可访问的 nav/button，当前 route 有 `aria-current`，错误恢复操作可键盘触发。
- Workspace 页面不读取宿主 DOM，不直连 data_service，不生成 KnowledgeItem/EvidenceRef/graph relation。

## D. Commands And Evidence

```text
npm --prefix apps/chrome-extension test -- WorkspaceRouter
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension run build
npm --prefix apps/chrome-extension test
```

另需产出：

```text
docs/active/project/evidence/v2_external_brain_productization/px-1/build-spike.json
docs/active/project/evidence/v2_external_brain_productization/px-1/route-e2e.json
docs/active/project/evidence/v2_external_brain_productization/px-1/screenshots/*.png
docs/active/project/evidence/v2_external_brain_productization/px-1/acceptance.md
docs/active/project/evidence/v2_external_brain_productization/px-1/prd-review.md
docs/active/project/evidence/v2_external_brain_productization/px-1/architecture-review.md
docs/active/project/evidence/v2_external_brain_productization/px-1/false-green-audit.md
docs/active/project/evidence/v2_external_brain_productization/px-1/independent-audit.md
```

真实 Chrome 截图使用 headless 优先。合同 fixture、审查原型和旧 V2-7 截图不得冒充 PX-1 产品证据。

## E. Rejection Rules

- 仅能手输开发 URL。
- `workspace.html` 缺失或实际打开 localhost。
- route 与页面展示的 workspace/source ID 不一致。
- invalid route 静默回默认 fixture。
- 离线时显示 Adapter ready/data_service connected/source trace_ready。
- 重复入口创建多个标签或触发任何 save/ingest 请求。
- passed 声明缺少截图、命令日志或原始 route observation。

