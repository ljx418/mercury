# V3-5 双容器产品体验与唯一一轮人工验收开发计划

日期：2026-10-08。状态：`DOCUMENT RESUMPTION CANDIDATE / IMPLEMENTATION NO-GO / V3-4 LIMITED PASS SATISFIED / ONLY HUMAN ACCEPTANCE STAGE`。

## 1. 用户结果

用户在 B站当前视频页打开 Navia 后：

1. Side Panel 识别当前视频、展示五项授权、启动任务、路线/进度、等待可信 capture、取消和快速摘要。
2. 用户打开 Media Workspace 查看同一 task 的图文大纲、时间线、Media Mindmap、Ask、证据抽屉、历史和导出。
3. 点击章节、导图节点或引用时，Navia 通过当前 `MediaPortalAdapter` 跳回真实播放器并回读 `currentTime`。
4. Ask 有证据才回答；无证据、证据类型不支持或 Provider 不可用时明确拒答/blocked。
5. 用户可导出本地 Markdown ZIP 或 JSON；界面明确写明未导入知识库，V4 才提供知识接入。

## 2. 前置门禁

- V3-4 已独立限定 PASS，Runtime 可恢复同 task/revision/outline/projections。
- V3-5 产品集成合同、H01..H10 submission 合同、组件路由和截图基线完成外部文档审查。
- `v3_media_companion_contracts.schema.json` 与 `v3_media_product_acceptance_v1.schema.json` 作为历史合同保持只读；V3-5 fresh run 唯一接受 `v3_media_product_acceptance_v2.schema.json`。v2 新增 `taskExecution`，逐项记录 registry class、Runtime observed route、route drift、fallback reason 与资源提示，禁止旧字段覆盖新语义。
- 自动 UI、Axe、键盘、seek、Ask 和导出门槛全部 PASS 后，才生成并开放人工验收页面。
- 人类不提供 Cookie、不听写、不构造证据、不分析日志，只判断可见体验与内容。
- V3-4 fresh run 已观测到 registry 字幕类样本实时回退到 `credentialed_media_asr`。V3-5 只能显示 Runtime 实际 route/event，必须在回退时告知预计等待、CPU/内存/临时磁盘占用和取消方式；禁止从 registry class 推导或承诺字幕快路径。

## 3. 组件与路由

### Side Panel

| 组件 | 输入 | 用户操作 | 状态 |
|---|---|---|---|
| `MediaPageIdentityCard` | `MediaPageContext` | 刷新识别、查看标题/作者/分P/时长 | detected/unsupported/stale |
| `MediaConsentCard` | consent policy | 查看五项 scope、授权、撤销 | existing V3-1 component 扩展状态，不显示 Cookie 值 |
| `MediaTaskStartCard` | task capability | 开始/重试/打开 Workspace | ready/blocked/running/terminal |
| `MediaRouteProgress` | acquisition/transcript/task events | 查看路线、进度和失败原因 | subtitle/media ASR/page subtitle/capture |
| `TrustedCapturePrompt` | one-shot capture requirement | 真实点击启动/取消 | awaiting/consumed/expired |
| `MediaQuickSummary` | published outline | 跳转章节、打开完整工作台 | loading/grounded/degraded |

### Media Workspace

| 路由 | 组件 | 权威数据 |
|---|---|---|
| `/media/tasks` | `MediaTaskHistory` | Runtime task list |
| `/media/tasks/:taskId` | `MediaTaskOverview` | task + current revision |
| `/media/tasks/:taskId/outline` | `VideoOutlineView` | published outline |
| `/media/tasks/:taskId/timeline` | `MediaTimelineView` | timeline projection |
| `/media/tasks/:taskId/mindmap` | `MediaMindmapView` | mindmap projection |
| `/media/tasks/:taskId/ask` | `AskVideoPanel` | governed Ask result + evidence refs |
| `/media/tasks/:taskId/evidence/:evidenceId` | `MediaEvidenceDrawer` | evidence catalog + private artifact endpoint |
| `/media/tasks/:taskId/export` | `MediaExportPanel` | export job/manifest |

direct-open/reload/Back/reopen 都从 Runtime 重读；未找到/无权 task 返回可恢复页面，不用 React cache 造事实。

实现使用 `workspace.html#` 后的上述 canonical path。现有 `#/media/transcript/:taskId` 仅作为 V3-2 兼容入口：读取 task 后以 `history.replaceState` 迁移到 `#/media/tasks/:taskId`；不得形成第二套状态权威。Media router 必须先于现有 Knowledge router 分派，且不得改变既有 `#/knowledge/*` 语义。

## 4. Ask Video

- 请求绑定 taskId、outlineId、revision、question 和当前 evidence catalog hash。
- Provider 只能通过 D Adapter/Governance；B 前端不得直连模型。
- `answered` 必须至少一个同 task evidenceId；`insufficient_evidence` 的 answer 为空并说明缺口类型；`blocked` 显示 Provider/权限/任务状态原因。
- 视觉问题至少引用 frame/vision evidence，不能只用 transcript 回答“画面里有什么”。
- Ask 结果保存到 task revision，但不会进入 V4 知识库。

## 5. 反跳与证据

- `MediaJumpbackController` 只接收 task/source/playbackUnit/timestamp/evidence binding。
- Adapter 在当前页面 identity 一致时设置播放器时间，再回读真实 `currentTime`。
- `TaskBinding.mediaDurationMs` 固定当前分 P 时长；每次 seek receipt 显式记录 `deltaMs=abs(observedMs-requestedMs)`。Schema 限制 `deltaMs<=2000`，`located` 时必须 `pageIdentityMatched=true`；语义 verifier 复算算术关系并拒绝 `requestedMs` 或 `observedMs` 超过当前分 P 时长。
- `located` 要求 `abs(observed-requested)<=2s`；否则只能 fallback/blocked。
- 五次固定操作至少覆盖 outline、timeline、mindmap、Ask citation、evidence drawer。
- 页面导航、分P变化、播放器不可用和时间越界均返回结构化失败，不伪 located。

## 6. 导出

- Markdown ZIP 包含 README、outline、timeline、mindmap JSON、Ask 摘要、evidence index 和缩略图 allowlist。
- JSON bundle 使用版本化 schema；两个格式均生成 member index、bytes、SHA-256。
- 不导出 Cookie、token、绝对路径、原视频、非证据帧、Provider key 或 SQLite/WAL。
- `knowledgeImportStatus=deferred_to_v4`；UI 不显示“保存到知识库”。

## 7. 子阶段

### V3-5-0 产品集成合同与原型冻结

冻结 product acceptance v2、human review、Ask、jumpback、export schemas，更新交互 HTML 和逐步配图。`taskExecution.routeDrift` 必须由 verifier 根据 class/route 映射复算；本地 ASR 必须记录资源提示已显示、可取消、临时文件已删除。外审 Fatal=0/Major=0 后才进入代码。

### V3-5-1 Side Panel

实现识别、授权、任务启动、Runtime 实际路线/进度、字幕转 ASR 资源影响、capture prompt、取消、快速摘要和 Workspace deep link。

### V3-5-2 Workspace shell 与路由

实现任务历史和 7 个 task routes，所有 route 从 Runtime 重读并覆盖 direct/reload/Back/reopen。

### V3-5-3 Outline/Timeline/Mindmap/Evidence

用同一 outline/evidence 渲染，不进行前端总结；证据抽屉显示类型、时间、来源和可反跳状态。

### V3-5-4 Ask、jumpback 与 export

实现有证据回答/拒答、五类 seek、两种导出、取消和故障反馈。

### V3-5-5 自动 UI 与可访问性

在 Side Panel 360/420、Workspace 768/1280 运行真实 Chrome；Axe serious/critical=0、键盘主流程、焦点返回、无根溢出。

### V3-5-6 人工 H01..H10

只有 V3-5-A01..A18 自动门槛全 PASS 才生成冻结 bundle 与逐步截图页面。人类在可见 Chrome 执行一次并提交 Schema-valid review；Schema 强制 overall PASS 只能包含全 PASS，任一 BLOCKED 优先为 BLOCKED，FAIL/BLOCKED 不得被自动覆盖。

### V3-5-7 独立出门审计

独立复算自动门槛、H submission hash/bundle binding、截图和候选状态。Fatal=0/Major=0 后仅放行 V3-6。

## 8. 交付物

- Extension/Runtime 生产代码、产品集成和 H submission schemas。
- 双容器四视口真实截图、Axe/keyboard/route/seek/export evidence。
- 带逐步配图的人类验收 HTML、冻结 bundle、review submission。
- 每子阶段 acceptance、PRD review、false-green audit 和独立实施审查。

当前 V3-4 已取得独立 LIMITED PASS。V3-5 文档需完成本轮恢复外审并取得 Fatal=0/Major=0，之后仍须用户明确授权代码实施；人工验收保持 NO-GO，直到 A01..A18 全绿。
