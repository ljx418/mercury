# V3-4 实施出门候选

日期：2026-10-08。

## 决定

`INTERNAL IMPLEMENTATION CANDIDATE PASS / EXTERNAL IMPLEMENTATION AUDIT REQUIRED`

内部复核 Fatal=0，Major=0，Minor=3。V3-4 尚不得宣称最终或独立通过；只允许重建外部审计包并请求不同审查 session 复算。

## 实现范围

- `outline.py`：本地确定性 extractive Outline，并由同一 Outline 纯投影 Timeline/Mindmap。
- `task_store.py`：SQLite additive migration、CAS revision、event/outbox/aggregate 同事务、idempotency、cancel/retry/recovery。
- `app.py`：Companion Session 保护的 task create/detail/latest/cancel/retry API。
- `v3_outline_production_matrix_runner.py`：12 页全新真实 run、最多 8 张 selected frame MiniMax-M3、逐任务清理。
- `v3-4-production-verifier.py`：从 sealed result 和私有 SQLite 独立重建 12 个 terminal envelope。

## V401..V418

| ID | 结果 | 实证 |
|---|---|---|
| V401 | PASS | additive migration 合同与全量测试；旧表无 rename/drop/alter |
| V402 | PASS | 12 个生产 task 终态闭集；事件 sequence 连续 |
| V403 | PASS | 5 个 fault injection 点全回滚；生产 12/12 outbox completed |
| V404 | PASS | stale revision 返回 conflict，状态不变 |
| V405 | PASS | 11 个可发布任务重放 canonical envelope 一致；12 条 idempotency row |
| V406 | PASS | restart/fault matrix、uncertain recovery 测试通过 |
| V407 | PASS | cancel barrier 后 0 outline/outbox publish |
| V408 | PASS | late stale revision 不覆盖新 revision |
| V409 | PASS | 单 run `v3-4-outline-production-20261008T104258Z`：10 ready + 1 degraded + 1 blocked |
| V410 | PASS | 无 evidence 发布被拒绝 |
| V411 | PASS | 跨 task/未知 evidence 拒绝；生产 0 unresolved/0 cross-task |
| V412 | PASS | 206 条私有 evidence 文件逐条文本 hash 对账；时间合法 |
| V413 | PASS | 11/11 timeline 数量与 section 一致、引用闭合 |
| V414 | PASS | 11/11 mindmap 唯一根且节点数=section+1 |
| V415 | PASS | 同一 evidence 输入与幂等重放结果稳定；Outline 阶段 0 云模型调用 |
| V416 | PASS | SQLite 关闭后只读重开，12 task/revision/event 可恢复；API 回归通过 |
| V417 | PASS | `deferred_to_v4` 12/12；公开包 0 绝对路径/DB/secret；原始媒体残留 0 |
| V418 | CANDIDATE PASS | Runtime 578、Extension 317、typecheck/build PASS；等待独立实现审查 |

独立 verifier：`20/20 PASS`，见 `v3-4-production-verification.json`。

## 真实运行

- runId：`v3-4-outline-production-20261008T104258Z`。
- 12 个当前 B站样本重新获取，不读取 V3-2/V3-3 的正文或媒体 artifact。
- 01..06 当前字幕，07..09 SenseVoice 本地 ASR，10 multipart 当前分 P + 本地 ASR，11 restricted blocked，12 low-signal degraded。
- MiniMax-M3：仅样本 01..08 各 1 张 selected frame，共 8 次；每次独立 grant/revoke，0 次 post-revocation dispatch。
- Cookie、API key、raw video/audio/frame、完整 transcript、OCR text 均未进入公开 result。
- 私有保留：SQLite 和文本 evidence，约 1.6 MB，权限 `0700`。
- 已删除：所有视频、音频、帧、候选图、开发截图，残留 `0`。

## 回归

- Runtime：`578 passed in 86.11s`（使用冻结 RapidOCR 路径）。
- Extension：`47 files / 317 tests passed`。
- Extension typecheck：exit 0。
- Extension production build：exit 0；仅既有 chunk-size warning。
- 定向 V3-4：`61 passed`。

## 失败尝试隔离

- `104044Z`：NTFS 无法表达私有 `0700`，无媒体/云调用/Seal，已删除 run workspace。
- `104139Z`：系统 Python 未加载冻结 RapidOCR，0 云调用/0 Seal，已删除 run workspace。
- 两次均记录为 `INVALID / NO SEAL / DO NOT REUSE`，成功 run 未拼接其任何 artifact。

## Minor

- M-1：大纲表达质量尚未由人类评价，只能在 V3-5 H01..H10 判断。
- M-2：生产私有文本证据保存在本机 ext4 用户目录，不进入审计包；外部审查只能验证其 hash/DB 闭合，不能读取正文。
- M-3：V3-4 API 已实现并回归，但 Chat 三视图 UI、Ask/seek/export 属 V3-5，当前没有提前宣称。

## PRD 边界

本候选实现媒体任务持久化与 Outline/Timeline/Mindmap 数据闭环，不实现或宣称知识导入、Query、Graph、Durable Forget、Agent、最终双容器 UI 或完整 V3 PASS。

