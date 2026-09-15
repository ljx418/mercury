# PX6-0..5 实施出门外部审计请求

日期：2026-09-15

请从平铺审计包 `AUDIT_MANIFEST.md` 开始，只读复核。本次决定对象仅为：

```text
PX6-0..5 machine candidate LIMITED PASS or FAIL
```

重点独立执行：

1. 19 个载荷 SHA-256 与权威源一致性。
2. PX-6 Schema meta、7 positive、20 registry/case/failureCode。
3. T04.1 ExitManifest raw/content/public/audit binding。
4. Git bundle acceptance commit、1152 dependency closure 与 R4-P/R4-E。
5. 28 tracked source AST 扫描、raw→facts、17/12/20/12/4/4/0/0/5 分母。
6. 63/109/42、T04 14/25、T04.1 14/8。
7. PX6-N-001..020 是否实际执行，而非回显 expected code。
8. MachineExitAudit A01..A14 passed、A15/A16 pending。
9. 机器公开包成员、hash 可重建，且不含 human/final/identity/success claim。
10. `document-snapshot/*.base64` 是否能恢复 4 份 active Markdown 与 Draw.io 的候选时点原始字节，并与 `sourceSha256/sourceByteLength` 一致。
11. PX6-7 独立终审握手 Major 是否被 fail-closed，且没有误扩张为 PX6-0..5 失败。

请将结论保存到：

`docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/independent-implementation-exit-audit.md`

允许结论最多为 `PX6-0..5 LIMITED PASS; PX6-6 human review pending; PX6-7 production finalizer blocked`。不得升级为 PX-6、PX-5、V2、RAG 或 RKM 通过。
