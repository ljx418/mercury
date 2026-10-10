# V3-5-0 验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| R01 | 解析八条 canonical route | route kind、taskId、evidenceId 精确；多余 segment/非法 ID fail closed |
| R02 | 打开旧 transcript route | `history.replaceState` 到 `/media/tasks/:taskId`，不形成第二状态权威 |
| R03 | 打开 Knowledge route | 继续交给原 `WorkspaceRouter`，类型和行为不变 |
| R04 | direct/reload/back/reopen | 每次均调用 Runtime get/list，不从 React cache 恢复事实 |
| R05 | task 不存在/无权/Runtime offline | 可恢复到任务库，不显示假 task |
| R06 | 读取任务列表 | Runtime 返回按更新时间倒序的有限列表，无跨表正文泄漏 |
| R07 | contract regression | product v2、human schema 与历史 v1 测试全绿 |
| R08 | frontend regression | typecheck、相关 Vitest、build 全绿 |

出门：R01..R08 全 PASS、PRD 检视无新增 Fatal/Major，才进入 V3-5-1。
