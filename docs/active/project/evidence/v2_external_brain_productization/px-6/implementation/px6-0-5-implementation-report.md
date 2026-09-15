# PX6-0..5 机器出门实现报告

日期：2026-09-15  
状态：`PX6-0..5 LIMITED PASS / HUMAN REVIEW + FINAL HANDSHAKE PENDING`

## 1. 实施范围

本轮只修改 P7 Evidence Plane：

```text
apps/chrome-extension/e2e/run-v2-px-6-exit-audit.mjs
apps/chrome-extension/e2e/lib/v2PxExitAudit.mjs
apps/chrome-extension/e2e/lib/v2PxHumanReviewSubmission.mjs
apps/chrome-extension/e2e/lib/v2PxExitAudit.node-test.mjs
apps/chrome-extension/e2e/lib/v2PxHumanReviewSubmission.node-test.mjs
apps/chrome-extension/package.json
```

没有修改 Side Panel、Workspace、Runtime、Adapter、data_service API 或 T04.1 候选。

## 2. 实际结果

正式机器 run：`px6-machine-exit-20260914t164500z`。较早的 `px6-machine-exit-20260914t153501z` 在外审前发现运行时间字段未绑定授权时间；`px6-machine-exit-20260914t161545z` 又发现 tar mode 受 `/mnt/c` 与 ext4 差异影响；`px6-machine-exit-20260914t162001z` 用于验证 tar 修复；`px6-machine-exit-20260914t163000z` 只记录 live document path/hash，无法在活动状态更新后独立恢复文档字节。四个旧 run 只保留为诊断或前审计候选，不参与最终分母或审计结论。

```text
PX6-0 Schema meta / 7 positive / 20 registry / 20 cases：PASS
PX6-1 T04.1 raw/content/audit/public/replay binding：PASS
PX6-2 raw -> facts、R4-P/R4-E、63/109/42、T04/T04.1：PASS
PX6-3 ReviewRequest / EvidenceIndex / checklist / read-only HTML：PASS
PX6-4 PX6-N-001..020：20/20 PASS
PX6-5 deterministic machine-only package：PASS
```

状态固定为：

```text
machinePassed=true
status=waiting_for_human_review
humanReviewStatus=pending
g7Status=pending
finalPassed=false
```

公开包：`public/px6-public-evidence.tar.gz`，SHA-256 `ae3e1cf59adb77906a13873e2a0ffc6b835bdd8a49e1a57567a0d0645baa2925`，22 个成员，235032 bytes。新增的 5 个成员是可解码恢复原始字节的 Base64 文档快照；`/mnt/c` 正式 run 与 `/tmp` ext4 独立重跑逐字节相等。

核心产物原始 SHA-256：

```text
candidate-binding.json       e62e2a430c5d61a887efba2507deda225d9581e58dbfde5e8cf208590811572b
document-drawio-audit.json   54ce0ef8898fad9b6737b0b5784a31036d238e59abd1434e8838f352b92588db
machine-exit-audit.json      821d49662c8dc7b0f7c9a4eb1e57fd09f18d116b52b4e1e767c0c578a0e50cd2
review-request.json          339de3ffa21bc3925c72db02fd158d58d21b385519529dc6fc1b792060805ea9
evidence-index.json          b0090c5e214ff66c32ed483298b2c9b3b054eee6d3ff16a8c984a690a84dbe6c
px6-negative-results.json    cb7e4139506d0614c56c91b8869aa92787b9a2bffcc4b897ea14348ceeb46e5d
```

## 3. 实施中闭环

1. 授权 JSON 尾随 LF 被 canonical 检查拒绝；只移除尾随字节后通过。
2. Git bundle 的 tree mode 与 WSL `/mnt/c` closure mode 不同；检出后按冻结 closure 恢复 `100644/100755/120000` 再复算。
3. 存储版 Architecture Manifest 不含 inline source；从冻结 acceptance commit 按 path/hash 装载内存源码后执行 TypeScript AST 扫描。
4. T04 内部 `replay_validation/fresh_source_run` 在 PX-6 边界重绑定为 `t04_candidate/replay/...` 与 `t04_candidate/fresh/...`。
5. 机器包的人类字段扫描改为精确 JSON key，保留 `reviewerFieldsGenerated=false` 和负例文本，不误报说明性证据。
6. A11 的文档审计不再只记录页数和状态汇总；`document-drawio-audit.json` 绑定 4 份 active Markdown 与 1 份 Draw.io 的 `sourcePath/sourceSha256/sourceByteLength/mediaType`，并将逐文件 Base64 冻结字节作为 `px6_run` ArtifactRef 纳入公开机器包。独立复核可在活动文档状态更新后继续恢复候选时点的完整原始字节。

上述修复均保留原门槛，没有改低分母、修改真实证据或调用旧 PX-6 脚本。

## 4. 测试

```text
pnpm typecheck                                      PASS
pnpm test:v2-px6-exit                              16/16 PASS
formal PX-6 machine CLI                            exit 0
independent Schema/content/member/hash audit       PASS
deterministic archive rebuild                      byte-identical
cross-filesystem rerun (/mnt/c vs /tmp ext4)       7/7 core artifacts byte-identical
```

## 5. 有限声明

本报告只支持“PX-6 machine review package is ready for human review”。它不支持 PX-6 PASS、V2 PASS、RAG ready、完整外脑或 RKM 已实现。

独立实施出门审计见 `independent-implementation-exit-audit.md`，结论 `Fatal=0 / Major=0 / Minor=0`，原始 SHA-256 为 `d43f8f98b46e1813d95894830032074572b4fd6834e642e7ec4447217ac42f50`。
