# V3-5.1 三视频生产机器候选独立实施审查请求

日期：2026-10-10。只读入口：`AUDIT_MANIFEST.md` 与本文件。

## 决策对象

请独立判断 `v3-5.1-production-candidate-20261010T210000Z` 是否达到：

`MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING`

本轮不得把它扩大为 V3-5.1 LIMITED PASS、V3-6 GO 或 V3 PASS。固定候选的人类质量提交与旧 V3-5 H01..H10 正式 submission 均不存在。

## 必须复核

1. 19 个载荷 SHA-256 与权威源逐字节一致；包内无子目录，总文件数 <=20。
2. 三候选 Draft 2020-12 Schema 与 semantic verifier 是否真实通过，task/outline/evidence 是否跨候选隔离。
3. 三条真实 B站视频是否各含 12 章节、12 问、8 selected frames；是否为 0 raw media/audio/transcript/OCR cloud upload。
4. browser verification 是否每候选五类 seek origin 各 2 次、真实 readback `delta<=2000ms`，四视口、Axe、键盘、性能、CSP 是否闭合。
5. Runtime 679、Extension 351、targeted 19/6、typecheck/build 记录是否自洽；cleanup 与 secret scan 是否通过。
6. 重点检查 Ask 假绿：候选内 `criticalMeaningError=false` / `citationSupported=true` 由生产者写入，production verifier 是否在没有独立 submission 时仍强制 `passed=false`、`status=HUMAN_REVIEW_PENDING`、exit 3；篡改 candidate hash 是否 fail closed。
7. 人类审查合同是否固定 3 x 12 问、UX01..UX05、三个候选 hash 与 overallDecision；自动化是否可能代签。
8. stage gate 与 PRD review 是否明确 V3-6/V3-7 仍 BLOCKED，未越界承诺 YouTube/小红书/V4/BiliNote parity。

## 分级与输出

- Fatal：秘密泄露、伪造/代签人类结论、跨 run 拼接、候选哈希不闭合。
- Major：机器分母缺失、Ask 假绿仍可使 production verifier PASS、真实 seek/三视频/回归自报不可复算、阶段状态越界。
- Minor：不影响机器候选与 pending 门禁的可追踪性或命名问题。

请把审查报告写入：

`docs/active/project/evidence/v3_media_companion/v3-5.1-workspace-comprehension/production-candidate/independent-implementation-exit-audit.md`

审查期间不得修改产品代码、候选、manifest 或现有证据；不得运行云 Provider、Chrome 采集、ASR 或旧 generator。
