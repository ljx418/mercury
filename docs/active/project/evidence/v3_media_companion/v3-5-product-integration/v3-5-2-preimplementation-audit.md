# V3-5-2 实施前审计

日期：2026-10-08。结论：`GO`。

- Fatal：0
- Major：0
- Minor：2

## 风险闭环

1. **双路由权威**：Media router 只接管 `#/media/*`；Knowledge route 返回 null，继续由既有 Router 处理。
2. **旧路径分叉**：legacy transcript 只做 `history.replaceState`，最终 route 统一为 task overview。
3. **前端假恢复**：每次 hash 变化清空 task 后重新调用 Runtime；禁止 localStorage、fixture 或旧 evidence run 注入。
4. **跨 task 内容**：内容组件只接收当前 route taskId 的 GET 结果；evidenceId 必须在同 task catalog 中存在。
5. **未实现能力冒充**：Ask/export 保持明确的后续阶段提示，不生成答案或文件。
6. **测试入口真实性**：生产正例继续使用 Chrome 原生 Side Panel 创建 fresh task，再在真实 Workspace 操作路由。

## Minor

- M-1：当前 task schema 不含完整标题/作者元数据，任务库暂以 sourceIdentity 的 mediaId 显示；完整产品元数据需在后续投影合同阶段补齐。
- M-2：本阶段 route 测试可使用 transcript-only degraded fresh task；V3-5-3 仍须 fresh visual task 验证完整内容投影。

允许实施 V3-5-2a..f。禁止提前宣称 Ask/export/seek 或 V3-5 整体通过。
