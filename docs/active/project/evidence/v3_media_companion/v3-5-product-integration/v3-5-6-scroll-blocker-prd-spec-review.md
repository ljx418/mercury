# V3-5-6 PRD 规格检视

日期：2026-10-09。结论：`NO SPEC DEVIATION`。

## 用户体验覆盖

- Chat：当前页识读、媒体授权/采集、问答、知识提纯与保存相关控件在窄面板中均可通过滚轮和键盘到达。
- Know：Runtime 会话入口、来源保存及 Workspace 操作在同一个可滚动区域中可达。
- 顶部导航保持固定，不随内容滚出视口；Chat 内原有消息区局部滚动仍保留。

## 架构与合同

- 仅调整 Side Panel 视图容器和布局 CSS，不修改 Runtime、知识 API、媒体任务状态机、授权、凭据、Ask、保存或人工 judgment 合同。
- Know 仍由 `LocalRuntimeAccess` 与 `KnowledgeQuickSurface` 组成，只新增共享滚动父容器。
- 没有将 Agent 远期能力提前实现，也没有扩大 V3-5 出门声明。

## 结论

本修复恢复了 PRD 已承诺操作的可达性，不新增规格，不缩小验收分母。V3-5 最终状态仍取决于 fresh run、H01..H10 人工签署和后续独立审计。

