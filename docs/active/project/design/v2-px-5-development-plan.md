# V2-PX-5 真实 Chrome 自动化证据开发计划

日期：2026-09-08

2026-09-14 状态增量：旧单段计划已由 T01..T04 修复链细化。T03 R3 与 T04 R4 均取得 LIMITED PASS；T04 独立审计为 Fatal 0/Major 0/Minor 1。当前只允许 T04.1 以全新 run 完整重跑并关闭 replay `artifactRoot` 命名 Minor，以及完成 PX-6 文档冻结/外审。详见 `evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/`。PX-5 仍 FAIL/REOPENED，PX-6 仍 BLOCKED。

## 1. 阶段目标

在不替代 PX-6 人工产品核查的前提下，生成可重复执行的 `production_acceptance + real_chrome_dual_container` 自动化候选证据。证据必须来自真实仓库字节、真实 Runtime、真实 unpacked extension 和 Headless Chrome，不复用 contract fixture、review prototype 或 `virtual/*`。

## 2. 合法出门状态

PX-5 自动化通过时：

```text
PX-5 automated evidence candidate: PASS
report.passed: false
report.claim: V2-PX External Brain Productization acceptance did not pass.
humanReview.status: pending
PX-6: WAITING_FOR_HUMAN_REVIEW
```

`report.passed=true`、dual-container success claim 和 Human Review `passed` 只能由 PX-6 在真实人工核查后产生。自动化不得填写 reviewer 或代签。

## 3. 当前实现序列与权威边界

旧版单段采集、生成、校验方案仅保留为历史背景，不再是可执行入口。当前唯一合法序列如下：

1. **T01 / R1：已限定通过。**前端与真实 Chrome 修复证据保持封存，不在 T04 中重写。
2. **T02 / T02.1 / T02.2：历史限定通过或对照输入。**不得与后续 run 拼接，不得作为当前 production-positive 唯一输入。
3. **T02.3：拒绝作为正例。**offline 区间包含成功 Runtime response，必须保留为失败样本。
4. **T02.4：仅 fail-closed regression input。**缺少 sealed T01 structured assertion，不得提升为正例。
5. **T02.5 / R2：当前唯一 production-positive 原始输入。**固定 `runId=t02-r2-t01-structured-production-input-20260914T125700`、raw SHA-256 `ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3`、seal SHA-256 `fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f`、产品快照 commit `430cddcb7ff618978851af1f3b9a3c48f2370d36`。
6. **T03 / R3：production-candidate pipeline LIMITED PASS。**有效候选只能是 `t03-r3-production-exit-candidate-20260914T134804`；旧候选 `...T132413` 只能作负向历史证据。T03 保持 `humanReviewStatus=pending`、G7 pending、`finalPassed=false`。
7. **T04 / R4：LIMITED PASS。**候选 `t04-r4-snapshot-revalidation-20260914t105407z` 已完成 R4-P 隔离重放与 R4-E 全新真实 Chrome，独立审计 Fatal 0/Major 0/Minor 1；旧候选保持不可变，不能作为 PX-6 最终输入。
8. **T04.1：文档候选、实施 NO-GO。**只统一 Replay InvocationRecord 根与 step ArtifactRef 为 `replay_validation`，但必须从空目录完整重跑 R4-P、R4-E、T02、T03、T04 并取得新独立审计 Fatal 0/Major 0。
9. **PX-6：文档候选、实施 BLOCKED。**T04.1 通过、PX-6 外部文档审查 Fatal 0/Major 0 且用户另行授权后，才允许生成 machine-only review package；Human Review 必须由人类另行提交。

T04/T04.1 的实现实体、依赖闭包、14 项固定验收分母、25 个负例和 unsigned ExitManifest 以 `evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/` 为唯一细化权威。PX-6 的 16 项验收、20 个负例和 Human Review 边界以 `design/v2-px-6-*.md` 与 `contracts/v2_px6_exit_contracts.schema.json` 为准。旧 generator、旧 production validator 和旧 `audit-v2-external-brain-exit.mjs` 均不得生成新 PASS。

## 4. 失败打回

任一 source 不是实际字节、截图不可解码、路由/ID/operation 不一致、fault 无 injection 记录、Forget 只隐藏 UI、架构扫描未读取源码、Human Review 被自动签署、V2-7 回归失败，均为 Major，打回 PX-5 计划阶段。

## 5. 不包含

不接入真实 data_service；不实现自动遗忘、RAG、Dream Cycle、默认本地文件扫描、V3 视频理解；不修改冻结公共合同。
