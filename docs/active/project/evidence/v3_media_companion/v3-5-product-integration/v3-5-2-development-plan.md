# V3-5-2 Workspace Shell 与路由开发计划

日期：2026-10-08。前置：V3-5-1 PASS。授权来源：用户已批准 `V3-5-0..7 implementation`。

## 用户结果

用户可从 Side Panel 打开同一真实媒体任务，并在 Workspace 中稳定访问任务库、概览、大纲、时间线、导图、问答、证据和导出入口。直接粘贴链接、刷新、浏览器前进/后退和关闭后重开均由 Runtime 重读，不依赖前端内存或旧 run 文件。

## 实施边界

1. 固定 8 条路由：`/media/tasks`、任务概览、outline、timeline、mindmap、ask、evidence、export。
2. 旧 `#/media/transcript/:taskId` 只允许 `replace` 到任务概览，不保留第二权威页面。
3. 每条任务路由都调用 `GET /v1/media/outline-tasks/:taskId`；任务库调用 list API。
4. invalid route、未知 task 和未知 evidence 必须显示恢复入口，不回落到 Knowledge 或伪造空任务。
5. 任务导航、当前 route、taskId、revision 和 Runtime 连接状态增加稳定 DOM 标识，供真实浏览器验证。
6. Ask/export 本阶段仍为诚实占位；具体能力归 V3-5-4。

## 实施顺序

1. `V3-5-2a`：路由解析、canonical/legacy/invalid 合同测试。
2. `V3-5-2b`：Workspace Shell 稳定标识、任务库和恢复页面。
3. `V3-5-2c`：8 路由 direct/reload/Back/reopen 自动验证。
4. `V3-5-2d`：真实 B站 fresh task，证明同 task/revision 从 Runtime 恢复。
5. `V3-5-2e`：Knowledge route 非回归、全量测试与构建。
6. `V3-5-2f`：PRD 检视和内部出门审计。

## 非目标

- 不实现 Ask 回答、export 文件生成或 seek。
- 不在前端重新计算 outline/timeline/mindmap。
- 不把 transcript-only degraded 任务声明为完整画面理解。
