# T04 R4 文档候选静态验证记录

日期：2026-09-14  
范围：仅文档、Schema、冻结证据 hash 与 Draw.io XML；未运行 T04 产品代码、Runtime 或 Chrome。  
状态：`INTERNAL STATIC VERIFICATION PASS / EXTERNAL DOCUMENT AUDIT REQUIRED / IMPLEMENTATION NO-GO`

## 1. 权威输入复算

| 输入 | 复算结果 |
|---|---|
| T03 独立实现出门审查 | SHA-256 `1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`，与 T04 文档一致 |
| T02.5 raw-run 原始字节 | SHA-256 `ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3` |
| T02.5 canonical seal | 删除根 `seal` 后按排序 compact JSON 重算为 `fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f`，匹配 |
| T02.5 product base | Git commit `430cddcb7ff618978851af1f3b9a3c48f2370d36` 可读取 |
| T03 正候选 | `t03-r3-production-exit-candidate-20260914T134804` 存在；核心六文件 hash 可重算 |
| T03 旧候选 | `...T132413` 只登记为 forbidden/stale negative，不作为 baseline |

T03 正候选核心 hash：

```text
derived-facts.json               5c538f3e1a6fd0047659484e0b66d04af7b81a1071fee6f8131e0c2aef2d9eef
production-validation.json       26272fc1837e866d39049d083ff7b7f4511f06f00459827d62a989b452ef123e
architecture-scan-manifest.json  731ef89d38ba2ec009449e75ba0dcfff1a8f6cdd2cdb4fc6bbae0d186209e4c6
report.json                      2c72446c7598d7dda6fa529ade42eeb4b1d02dc1df9547baabf29bd94297a38d
production-package.json          625a322b0dd4642cc1564e1189ded872933cd0b2c51bf38be5930de7c03ff410
invocation-record.json           473159174cef49a575b40fbeed937df276e6a6c9c1641c5e17cc8a28ea3a16da
```

## 2. Schema 验证

使用 Python `jsonschema` 的 `Draft202012Validator.check_schema` 与 `FormatChecker` 独立执行：

| Schema | SHA-256 | 元校验 | 根正例 | 逐根 required 删除 |
|---|---|---|---|---|
| SnapshotInputManifest v1 | `22359f1ea7ee7e819ab38b5054398c96b8ef445ce9b4cd8b84d3449fedb1a570` | PASS | PASS | 12/12 rejected |
| SnapshotRevalidation v1 | `e9376298a26fb9a27cc61ba0731b1bcdb819d1a6e75609f916c88a4cbe930461` | PASS | PASS | 14/14 rejected |
| ExitManifest v1 | `ce3a00c5dfd48b1e2a15f9d34fbe457143fcda8c7bdfa5248c8fd9fce28c18e1` | PASS | PASS | 20/20 rejected |

额外防假绿变异均被 Schema 拒绝：

```text
四步任一重复：rejected
derive/validate 顺序交换：rejected
十个 exact comparison path 任一重复：rejected
八个 stdout/stderr path 任一重复：rejected
T02 12 ID 任一重复：rejected
T03 14 ID 任一重复：rejected
T04 14 ID 任一重复：rejected
25 requirement 任一重复：rejected
```

注册表复算：14 个 acceptance ID 唯一；25 个 requirementId 与 requirementKey 分别唯一；22 个 failure code 唯一；全部 requirement failure 均属于封闭 failure registry。

## 3. 产品基线边界

对 `430cdd...` 与当前工作树复算：

```text
package.json base    41df9d241634ac89a8ddd7e7416f787b354402b2bfe57dacc2a3e92eefe5dd1a
package.json current e7b0f68c5bb76054ca62e74521b2ef8a16a27de32a741ffa087b5ecc2e509551
pnpm-lock base       c7d4b6921e87fd2044640d438562c38bd79182a7701a7819413724963d5700bc
pnpm-lock current    c7d4b6921e87fd2044640d438562c38bd79182a7701a7819413724963d5700bc
```

差异只说明当前主工作树注册了 T03 script aliases，不能带入 T04 acceptance commit。文档已冻结：package/lock 取 product base 字节；T03/T04 入口使用 direct Node argv；T04 不修改产品构建配置。

## 4. Draw.io 结构

文件 SHA-256：`50ce1f0d08dea416072f6c0b11f75c432f8a98cc13805285c50258cfacf813a9`。

```text
pages=8
vertices=112
edges=42
duplicateIds=0
outOfBounds=0
brokenEdgeReferences=0
```

八页均为 1600x900。文本断言包含 R4-P、R4-E、A01-A14、N001-N025、ExitManifest、外部文档审查和 `G7/Human/final=pending/pending/false`；不再包含旧 N001-N022/N001-N024 状态。

## 5. 四轮内部审计结论

| 轮次 | 发现 | 处置后 |
|---|---|---|
| 完整性 | 依赖闭包最终数量不能手填 | 保留为 T04-0 实测项 |
| 可复现性 | npm/pnpm、浮动 Python、Git 悬空对象、archive 自引用 | 冻结 pnpm、hash lock/wheelhouse、Git bundle、payload-only archive |
| 时间与集合 | A14 未来独立审查自引用；数量可被重复 ID 冒充 | 独立审查移至外层 Gate；Schema 固定步骤与精确集合 |
| 产品基线 | package script alias 会改变构建输入 | package/lock 固定 base；direct Node argv |

内部最终分级：Fatal 0 / Major 0 / Minor 1。唯一 Minor 是依赖闭包文件总数必须由未来 T04-0 解析器实际计算，不能在文档阶段声称固定数量；该项已是 T04-A02 的硬失败条件。

## 6. 当前门禁

```text
T03 LIMITED PASS: 保持
T04 documentation candidate: INTERNAL PASS
T04 external document audit: PENDING
T04 implementation: NO-GO
PX-5: FAIL / REOPENED
PX-6: BLOCKED_BY_PX5_T04_PENDING
```

只有外部文档审查 `Fatal=0 / Major=0` 且用户之后明确批准 `T04-0..T04-7 implementation`，才能生成固定路径的 `implementation-authorization.json` 并启动 T04-0。
