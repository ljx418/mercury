# V3-2-0b 外部文档审查 Major 闭环

日期：2026-09-22  
范围：仅关闭 `v3-2-0b-independent-document-audit.md` 的 Major-1，不改变产品规格、架构或实施范围。

## 问题

外部审查发现 `external-audit-package/15-v3-media-companion-gap.drawio` 与权威源 `design/v3-media-companion-gap.drawio` 字节不一致。结构一致不等于审计载荷一致，因此不得在该 Major 未关闭时实施。

## 修复

1. 用权威源原字节重新生成审计包中的 `15-v3-media-companion-gap.drawio`。
2. 将 `AUDIT_MANIFEST.md` 的字节数与 SHA-256 更新为权威源当前值。
3. 不修改 Draw.io 内容，不豁免字节级核对，不降低审计门槛。

## 独立复算门槛

- 权威源与平铺副本 SHA-256 必须逐字节相等。
- 审计包仍必须为 18 项载荷 + 1 manifest，平铺且无子目录。
- 其余 17 项载荷必须继续与各自权威源一致。
- Draw.io 必须保持 8 页、无重复 ID、无断边、无越界节点。

## 决定

上述门槛全部通过后，Major-1 关闭。外部审查最终风险计数按客观修复结果更新为 Fatal=0 / Major=0 / Minor=2。该闭环只允许结合用户明确授权进入 V3-2-0b；V3-2-1..V3-2-7 仍保持 BLOCKED。

## 复算结果

```text
payloads=18
packageFiles=19
authorityMismatch=0
manifestMismatch=0
drawio.pages=8
drawio.vertices=113
drawio.edges=54
drawio.duplicateIds=0
drawio.brokenReferences=0
drawio.outOfBounds=0
```

修复后 Draw.io 权威源与平铺副本均为 `53110` bytes，SHA-256 均为 `f6d2d433d545a2b87b85dc62cb8a5b5226a97468e922a2f530f0fdd20984488c`。Major-1 已关闭。
