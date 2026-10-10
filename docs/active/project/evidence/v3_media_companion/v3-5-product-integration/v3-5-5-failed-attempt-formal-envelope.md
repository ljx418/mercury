# V3-5-5 正式 receipt API envelope 失败记录

日期：2026-10-09。决定：`DISCARDED / RECEIPT SHAPE BUG / REPLAN`。

fresh run 已完成产品与 UI 验收，但 post-run receipt 组装报告 task binding incomplete。独立对照 Runtime API 合同确认 `runtimeGet` 返回的 data 仍分别包裹为 `{task}` 与 `{results}`；runner 错把外层对象当作 task/list。

修订只显式读取 `.task` 和 `.results`，不改变 Runtime、产品数据或验收门槛。该 run 不参与通过结论，必须清理并从零重跑。
