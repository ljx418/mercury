# V3-5-2 PRD 规格检视

日期：2026-10-08。结论：`PASS`，Fatal=0，Major=0，Minor=2。

- 用户从 Side Panel 到 Workspace 的 task/revision 身份连续，刷新或关闭页面不会依赖前端缓存。
- 8 条媒体路由与既有 Knowledge 路由分区明确，legacy 入口不会形成第二套体验。
- invalid route 和旧链接均提供可理解恢复；未把 Ask、export 占位误写为完成。
- fresh task 仍为 transcript-only degraded，符合 V3-5-2 路由目标但不代表完整画面理解。

Minor：任务库目前显示 mediaId 而非完整标题/作者；完整元数据投影待后续合同增量。路由验收尚未覆盖真实 Runtime 重启，当前已覆盖文档重载、关闭重开和 DB 权威读取。
