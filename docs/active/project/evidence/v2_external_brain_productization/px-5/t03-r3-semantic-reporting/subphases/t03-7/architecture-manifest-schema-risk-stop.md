# T03-7 Architecture Manifest Schema 风险停止记录

日期：2026-09-14  
状态：`MAJOR / T03-7 REOPENED`

## 发现

只读 `verify-t03-exit-candidate.py` 对 `t03-r3-production-exit-candidate-20260914T132413` 执行 Draft 2020-12 根实例校验时发现：

1. `evidenceClass=production_acceptance` 的 28 个 `trackedPaths` 均错误携带 `inlineSource`；冻结 Schema 明确禁止生产 manifest 内嵌源码正文。
2. 生成器输出 `symlinkPolicy=reject`；冻结 Schema 要求 `hash_link_target_utf8`。
3. `validate-v2-px-production-package.mjs` 写入 manifest 前没有调用该根 Schema，导致 G4 结构自报通过。

该问题属于 evidence false-green。候选的 61/2 rules、G1-G6 和 package/invocation 结果均不能升级为 T03 出门依据。

## 影响与隔离

- 旧候选目录保持字节不变，仅作失败回归。
- T02.5 raw/seal、T03-0..6 通过结论不撤销。
- T03-7、T03、PX-5 保持 FAIL/REOPENED；T04、PX-6、RKM 保持禁止。
- 禁止放宽 Schema、删除生产 AST 扫描或信任 `violations=0`。

## 恢复条件

生产 manifest 必须只公开 path/mode/blob hash；AST scanner 必须仍从同一冻结 Git commit 的原始 blob 字节执行。新候选须从空目录生成，并通过根 Schema、G4 hash 重算、42 mutations、完整回归和本地 verifier 之后才能送独立出门审计。
