# V3-5-0 产品集成合同、Media Router 与原型实施计划

日期：2026-10-08。授权范围：V3-5-0..7。

## 目标

1. 保留 Knowledge `WorkspaceRouter` 原语义，新增独立 `MediaWorkspaceRouter`，在入口层先按 `#/media/*` 分派。
2. 冻结八条 canonical media route；旧 `#/media/transcript/:taskId` 只做 replace 迁移。
3. 新增类型化 outline task Runtime client，所有页面 reload/back/reopen 均重读 Runtime。
4. 建立可操作产品 shell 原型，不伪造未实现 Ask/export/seek 成功状态。
5. product acceptance fresh run 只接受 v2。

## 改动边界

- Frontend：`src/modules/media_companion/product/`、Workspace 入口和必要样式/测试。
- Runtime：本子阶段仅补任务列表读取能力，不实现 Ask/export 或更改 V3-4 outline 算法。
- 不改 Knowledge route union，不导入知识库，不修改 sealed V3-4 run。

## 顺序

V3-5-0a 路由解析与负例 -> 0b Runtime task client/list API -> 0c Media shell/真实 task 页面 -> 0d 旧路由 replace -> 0e 单元/合同回归 -> 0f PRD 审查 -> 0g 子阶段审计。
