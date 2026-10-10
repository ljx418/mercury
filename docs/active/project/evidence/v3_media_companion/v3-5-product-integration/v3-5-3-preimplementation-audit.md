# V3-5-3 实施前内部审计

日期：2026-10-08。审查范围：V3-5-3 开发/验收计划、V3 PRD、V3-4 已审计实现、V3-5-1/2 实际代码与真实 run。

## 1. 独立风险核查

| 风险 | 处置 | 结论 |
|---|---|---|
| ASR 后原 Cookie lease 过期或多租约歧义 | 新端点显式绑定新的 `credentialLeaseId`；不使用 `resolve_for_task` 猜测 | CLOSED |
| UI 获得撤销令牌 | 撤销令牌继续只在 background broker 内存；UI 只发 `revoke_lease(leaseId)` 消息 | CLOSED |
| transcript-only terminal 无法升级 | fresh task 在视觉事务完成前只提交一次终态；旧 terminal 保持不可变 | CLOSED |
| 云端上传范围扩大 | 复用 Governed adapter；仅 1 个 <=1280px selected frame；不上传视频/音频/transcript/OCR | CLOSED |
| Cookie/媒体/帧残留 | task sandbox + downloader finally + materializer finally + lease revoke；A11/A14 硬门槛 | CLOSED |
| 三视图漂移或前端总结 | Runtime generator/TaskStore 为唯一权威；Workspace 只渲染同一 envelope | CLOSED |
| 把 8 秒切片承诺为全片视觉覆盖 | UI/evidence 仅称“选中画面证据”；大纲主体仍由全片 transcript 支撑 | CLOSED |

## 2. PRD 与架构检视

- 覆盖 V3 PRD 的 Chat 视频理解、图文大纲、证据可追溯、隐私授权和本地优先边界。
- 未进入 V3-5-4 Ask/seek/export，未进入 V4 Knowledge/Agent。
- 沿用 `PortalAdapter -> credential lease -> local acquisition -> Frame/OCR -> governed VLM -> TaskStore -> Workspace` 单向数据流，无新状态权威。
- V3-5-1/2 的 transcript-only fallback 保留；视觉产品是 fresh run 的增强路径，不篡改旧证据。

## 3. 审计结论

- Fatal：0
- Major：0
- Minor：2
  - M-1：0–8 秒视觉切片只证明选中画面理解，不证明全片逐帧视觉覆盖；已在计划、UI 文案与验收中限界。
  - M-2：MiniMax 可能受限流影响；真实 run 允许按冻结 cooldown 等待，但不允许用缓存结果替代。

决定：`GO V3-5-3-1..7`。用户已明确授权 `V3-5-0..7 implementation`；无需新增高风险授权。任一真实验收失败时立即回到计划阶段。
