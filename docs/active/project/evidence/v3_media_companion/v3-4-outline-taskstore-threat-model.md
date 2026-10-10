# V3-4 MediaTaskStore 与三视图威胁模型

日期：2026-10-08。状态：`V2 CONTRACT FROZEN / IMPLEMENTATION NO-GO`。

## 1. 信任边界

SQLite/MediaTaskStore 是媒体任务事实权威；Extension 是不可信展示/命令客户端；ASR/OCR/VLM/outline Provider 输出是不可信候选；只有 validator 和 repository transaction 能发布新 revision。

## 2. 威胁与控制

| ID | 威胁 | 控制 | 验证 |
|---|---|---|---|
| TS01 | UI 伪造 task/state | Runtime 分配 ID、闭集 transition、鉴权 API | V402 negative |
| TS02 | 跨 task evidence 注入 | composite FK/validator/task identity closure + transaction receipt 三项闭合字段 | V411 |
| TS03 | 旧写覆盖新 revision | optimistic CAS | V404/V408 |
| TS04 | aggregate 成功但 event/outbox 丢失 | 单 SQLite transaction | V403 |
| TS05 | 崩溃后重复 Provider side effect | durable outbox + receipt reconciliation | V406 |
| TS06 | 取消后仍发布结果 | cancel barrier checked before commit | V407 |
| TS07 | Provider 生成无证据章节 | minItems + semantic evidence closure | V410 |
| TS08 | timeline/mindmap 二次造事实 | pure projectors、canonical input/output hash | V413-V415 |
| TS09 | 前端缓存造成 route 假恢复 | API re-read、revision binding | V416 |
| TS10 | SQL/JSON 注入 | parameterized SQL、typed JSON Schema、escaped renderer | tests/static audit |
| TS11 | DB/WAL 或绝对路径进入公开包 | public allowlist、secret/path/tar scan | V417 |
| TS12 | 把 V3 task 当作知识库 | const `deferred_to_v4`、无 V2 adapter calls | V417 |
| TS13 | 迁移破坏旧 V1/V2 数据 | additive migration、before/after manifest、backup failure rollback | V401 |
| TS14 | idempotency key 重放制造重复 | key+task+operation unique constraint | V405 |
| TS15 | 把上游 seal 哈希当成可消费正文 | qualification/content handoff 分离；V3-4 fresh run 重建 evidence | V409 |
| TS16 | 为受限页伪造大纲以满足 12 页分母 | v2 `blocked` 零投影终态 + semantic verifier | V409/C04/C06 |
| TS17 | Outline 阶段再次上传 transcript/OCR 文本 | 本地确定性抽取，无 outline cloud adapter | static audit/V415 |
| TS18 | 继承旧视觉同意执行新任务上传 | 每个 V3-4 task 新 consent decision；最多 8 张 selected frame | consent receipts/V409 |

## 3. 恢复原则

- 已提交事务可重读，未提交事务必须不存在。
- `in_progress` outbox 在重启后先查 Provider/receipt；无法证明未执行时不得自动重放。
- 已发布旧 revision 保留只读；新 revision 只能通过 CAS 成为 current。
- corruption、migration failure 或 reconciliation uncertainty 均 fail closed，并保留原数据库副本。

## 4. 非目标

本阶段不提供跨设备同步、知识库 Query/Graph/Durable Forget、自动维护、后台联网搜索或多用户数据库隔离。把这些能力写入状态或 UI 属于规格偏移。

## 5. 当前风险

- V3-3 已限定 PASS，但其 private 内容按合同清理；V3-4 必须重新获取真实 evidence。
- MiniMax 中性图实时复验已通过，但不等于 V3-4 的真实 selected-frame 上传授权。
- v2 合同已完成内部测试，仍需独立文档复审和用户明确批准 V3-4 实施及最多 8 张 selected frame 的新 task-scope 授权。

这些门禁关闭前保持 implementation NO-GO。
