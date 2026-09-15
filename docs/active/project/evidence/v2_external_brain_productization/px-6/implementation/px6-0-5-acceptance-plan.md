# PX6-0..5 机器出门验收计划

日期：2026-09-14

## 固定验收

- PX6-0：Schema meta PASS；7/7 positive；20 registry=20 cases=20 failure codes。
- PX6-1：唯一 binding 的 runId、snapshot commit、ExitManifest raw/content、public tar 和 T04.1 audit 原始 hash 精确匹配；resolved 内 root 集合仅 `replay_validation`。
- PX6-2：重新派生 raw facts，17 scenario、12=6+3+3 source、20 route cell、12 Forget chain、4 fault/viewport、Axe 0/0、Keyboard 5/5；63=61+2、109/109、42/42、T04 14/14、negative 25/25。
- PX6-3：G1..G7 各有前置、动作、观察、阈值、证据和失败处置；HTML 无通过按钮。
- PX6-4：PX6-N-001..020 全部由真实 mutation 命中 registry primary failure。
- PX6-5：A01..A14 passed，A15/A16 pending；无 reviewer/reviewedAt/review-submission/final-disposition；machine/human/G7/final = true/pending/pending/false。
- 公开包 hash/成员可重算且不含 ReviewSubmission、FinalDisposition、身份或后续独立审计。

## 停止门槛

任一 Fatal/Major、任何分母下降、跨 run、旧脚本调用、自动 reviewer 或 claim 越界均停止并回到计划。机器阶段通过后也必须停止，等待真实人类 H01..H07。
