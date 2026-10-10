# V3-5-2 验收计划

日期：2026-10-08。生产正例必须来自 fresh 真实 B站任务。

| ID | 操作 | 必须结果 |
|---|---|---|
| R01 | 打开任务库 | 从 Runtime list API 返回真实任务，不读取 fixture/run 文件 |
| R02 | 打开任务概览 | taskId/revision/outlineId 与 Side Panel 相同 |
| R03 | 依次打开 outline/timeline/mindmap/ask/evidence/export | 6 条子路由均重读同一 Runtime task，当前导航唯一高亮 |
| R04 | 直接粘贴 8 条 canonical URL | 全部恢复正确 route；无前端预置状态依赖 |
| R05 | 每条 route 刷新 | Runtime 重连后恢复同 task/revision |
| R06 | 浏览器 Back/Forward | URL、标题、活动导航和内容一致 |
| R07 | 关闭 Workspace 后从 Side Panel 重开 | 回到同 task canonical 概览 |
| R08 | 打开旧 transcript URL | history replace 到 canonical 概览，不产生旧页面 |
| R09 | invalid route/task/evidence | 显示明确失败与“返回视频任务”，无越权内容 |
| R10 | 打开 Knowledge route | 仍由既有 Knowledge WorkspaceRouter 处理 |
| R11 | 刷新任务库 | 无跨 task 内容，按 Runtime `updatedAt` 顺序展示 |
| R12 | 回归与清理 | Runtime/frontend/typecheck/build 全绿，0 secret/path，Profile/临时媒体删除 |

出门条件：R01..R12 全 PASS，PRD review Fatal=0/Major=0。Ask/export 占位不得计相应功能通过。
