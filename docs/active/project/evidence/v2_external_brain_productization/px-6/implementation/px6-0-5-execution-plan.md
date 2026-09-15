# PX6-0..5 机器出门实现计划

日期：2026-09-14  
Run：`px6-machine-exit-20260914t164500z`  
状态：`AUTHORIZED / MACHINE PHASE ONLY`

## 目标

只在 P7 Evidence Plane 新增 PX-6 reader、机器审计、review request、20 个真实 semantic mutation 与 machine-only package。产品 UI、Runtime、T04.1 候选和人类字段均只读。

## 实体

```text
apps/chrome-extension/e2e/run-v2-px-6-exit-audit.mjs
apps/chrome-extension/e2e/lib/v2PxExitAudit.mjs
apps/chrome-extension/e2e/lib/v2PxHumanReviewSubmission.mjs
对应 *.node-test.mjs
```

## 顺序

1. PX6-0：元校验 PX-6 Schema，验证 7 个合同正例、20 项 registry/case 一一对应。
2. PX6-1：严格读取显式 CandidateBinding；重算 ExitManifest、audit、public archive 与 resolved invocation。
3. PX6-2：从 fresh raw 重新派生 facts 并重跑 T04/production 分母，生成 MachineExitAudit。
4. PX6-3：生成 7 Gate ReviewRequest、EvidenceIndex、只读 HTML 与人工 checklist。
5. PX6-4：实际执行 PX6-N-001..020 mutation；禁止回显 expected code。
6. PX6-5：生成确定性 machine-only public package，状态固定 waiting/pending/pending/false 后强制停止。
7. PX6-7 finalizer 代码与负例可实现、可单测，但没有人类 ReviewSubmission 时不得执行生产最终化。

每个阶段写独立 result/log；失败只生成 CollectionDiagnostic 并退出 2。旧 `audit-v2-external-brain-exit.mjs` 不得调用。

> 2026-09-15 确定性补强：时间字段统一绑定实施授权的 `authorizedAt`，tar 固定为 `ustar/mode=0644/owner=0/group=0/mtime=0`；A11 另外把 4 份 active Markdown 与 Draw.io 的原始字节按逐文件 Base64 冻结进 `document-snapshot/`，并记录源字节 hash/length/mediaType，避免文档中的声明示例被误识别为真实签署字段。先前未外审 run `px6-machine-exit-20260914t153501z`、`px6-machine-exit-20260914t161545z`、`px6-machine-exit-20260914t162001z` 和 `px6-machine-exit-20260914t163000z` 仅保留为实现诊断或前审计候选，不作为最终外审候选；不得与本 run 拼接。
