# M-B5-1-01 关闭证据（V2.1 Receipt 接纳 7 extras,2026-10-14）

日期：2026-10-14。范围：把 B-5-1 实施期间发现的 schema 缺口（M-B5-1-01）关闭；V2 schema 字节不变；V2.1 schema、fixtures、verifier、契约文档与原审计一并登记指纹。

## 1. 缺口来源

B-5-1（DEV-2 Provider 集中授权边界）实施时，
`quality.py::_receipt()` 在 `schema_version` 以 `/v2.1` 结尾的路径下写入 7 个扩展 receipt 字段
（`endpointClass` / `structureMode` / `attemptId` / `latencyMs` / `requestSha256` /
`responseSha256` / `finishReason`）。
但 V2.1 schema（`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`）
的 `Receipt` 类型仍 `additionalProperties: false` 且 `required`/properties 均未声明上述 7 字段；
真实 B-5 fresh run 落盘 V2.1 derivative 时，MR-07 schema meta-validation 会被 schema 直接拒绝。

`stage-b-b5-1-acceptance-2026-10-14.md §6` 已将本项登记为 M-B5-1-01（Minor），
本文件即其关闭证据。

## 2. 改动列表

1. `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`
   - `Receipt` properties 在原本 4 + 6 之后追加 7 个 optional 字段（受约束类型）；
   - 新增 `$defs/ProviderFinishReason`（`finishReason` 的允许集合）；
   - `additionalProperties: false` 不变；`required` 不变（extras 全 optional）。
2. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json`
   - `schemaVersion` 升至 `v3-5.10-stage-b-route-2-fixtures/v2`；
   - `positiveInstances` 增加 `V3510B21-P03-provider-b5-1-receipt-extras`（11 字段 receipt 形态）；
   - `negativeCases` 增加 `V3510B21-N11`（V2.1 Receipt 出现未声明 extras 字段时 schema 拒绝）；
   - 原有 `V3510B21-P01/P02` 与 `N01..N10` 全部原样保留。
3. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py`
   - 通用化 positive 验证循环（接受 `instance` 或 `copyFrom + mutations`），不在硬编码 P01/P02；
   - 增加 N11 / finishReason / attemptId 三条 schema-level 拒绝断言；
   - 注册表期望从 `N01..N10` 升至 `N01..N11`；
   - 报告输出 `positiveInstances: 3/3 PASS`、`schemaNegatives: 5/5 PASS`、`registry: 11/11 present`。
4. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md`
   - 新增 `Provider receipt extras (V2.1 only)` 段：列出 7 字段类型与允许集；
   - `New negative obligations` 追加 `V3510B21-N11` 描述。
5. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-preimplementation-audit.md`
   - 在 Gate decision 之后追加 2026-10-14 addendum，登记 7 字段接纳与上文文件变更；
   - 严重度表与 M-1/M-2 未变；本 addendum 不构成 gate 翻新。

## 3. V2 schema 字节不变校验

| 文件 | SHA-256（前后） | 状态 |
|---|---|---|
| `v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` → `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | **PASS（字节不变）** |
| `v3_media_grounded_comprehension_v2_1.schema.json` | `39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231` → `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` | **PASS（按计划变更）** |

复算命令：

```bash
sha256sum \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json
```

## 4. 闭合后指纹登记

| 文件 | SHA-256 |
|---|---|
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` |
| `stage-b-route-2-contract-fixtures.json` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705` |
| `stage-b-route-2-contract-addendum.md` | `779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153` |
| `verify-stage-b-route-2-contract-fixtures.py` | `dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e` |
| `stage-b-route-2-preimplementation-audit.md` | `ef2b0c18f98b03d16c4505331201f3896ab75c2ebcc82c3fde26d51ac102ff25` |

## 5. verifier 输出

```bash
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
```

输出（verbatim）：

```json
{
  "implementationAuthorized": false,
  "implementationPending": [
    "V3510B21-N02", "V3510B21-N03", "V3510B21-N04",
    "V3510B21-N05", "V3510B21-N06", "V3510B21-N08",
    "V3510B21-N09", "V3510B21-N10"
  ],
  "positiveInstances": "3/3 PASS",
  "registry": "11/11 present",
  "schemaMeta": "PASS",
  "schemaNegatives": "5/5 PASS"
}
```

`implementationPending` 列出的 N02/N03/N04/N05/N06/N08/N09/N10 仍处于
`semantic` / `orchestration` / `persistence` / `real_run_harness` 层，不在
document-stage verifier 范围内，由产品代码（`quality.py` / `service.py` /
`synthesis.py`）与 harness 保证；本子阶段未触发产品代码的强制路径。

## 6. schema-level 拒绝断言覆盖

| 测试断言 | 期望结果 |
|---|---|
| `N01：composer sourceClaimIds 1 条` | brief schema 拒绝（allOf 约束） |
| `N07：provider origin 含 sourceClaimIds` | brief schema 拒绝（allOf 约束） |
| `N11：V2.1 receipt 出现未声明字段` | receipt schema 拒绝（additionalProperties=false） |
| `attemptId` 不匹配 `^attempt-[a-f0-9]{1,32}$` | receipt schema 拒绝 |
| `finishReason` 不在 enum | receipt schema 拒绝 |

5 条 schema-level 拒绝断言全过；未发表负面路径仍由产品代码 trap。

## 7. 严重度

| 严重度 | 计数 | 列表 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | — |
| Minor | 0（闭合 M-B5-1-01） | — |

闭合后与 `stage-b-b5-recovery-preimplementation-audit.md §3` 一致；M-B5-1-01
从 B-5-1 验收中的 Minor 转 Closed（Minor=0）。

## 8. 出本子阶段结论

**M-B5-1-01 CLOSED**。V2.1 schema / fixtures / verifier / 契约文档均已对齐
B-5-1 实现的 7 extras 语义；V2 schema 字节不变。可进入 B-5-2。
