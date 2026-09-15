# V2-PX-4 实现前审计

日期：2026-09-08

## 风险闭环

- 组件责任和 Runtime API 已逐项映射；不新增 public contract。
- 当前 Runtime 没有 permission list API，PX-4 只展示本页真实 grant/revoke 响应，不虚构历史列表。
- Forget 只删除专门创建的验收 source；共享 PRD 基线 source 不用于破坏性测试。
- Ask/Graph/Trace 仅渲染 Runtime 返回值。
- dialog 必须二次确认，成功后重读 Runtime 并验证原 route 不可恢复。
- 768/1280 的截图必须按实际 PNG 尺寸复核。

Findings：Fatal 0，Major 0，Minor 0。

门禁：GO for PX-4 implementation；PX-5+ 仍 No-Go。

## 实现中审计补充

真实 E2E 发现 `/v1/knowledge/sources` 仍返回 forgotten source，与同一 Runtime 的 `libraryAbsent=true` 冲突。该问题按 Major 打回 PX-4，在不改变 public API/Schema 的前提下修复为 Library list 仅返回 active source，并增加 API 回归测试。修复后重新执行完整验收，未留下 Fatal/Major。
