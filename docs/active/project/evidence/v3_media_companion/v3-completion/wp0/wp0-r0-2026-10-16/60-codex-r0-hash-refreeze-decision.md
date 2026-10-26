# WP0 R0 Codex 冻结锚点处置决定

日期：2026-10-16

结论：采用**受限重冻结**，拒绝回滚当前工作树。

## 1. 决定范围

只更新 relay v10 `sourceInventoryEvidence.scopes` 中以下两个源文件的
SHA-256 内容地址，并同步 verifier 内 `sourceEvidence` 的 canonical digest：

| 文件 | 旧 SHA-256 | 新 SHA-256 |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | `de3a903564fe534e1dd1bb94850491abaeec56fd567678b609a88fec33da759b` | `ddbf830f5ce5d15b2270deba636ad5620531ef122ef28ee6903a5f8ad603cb5c` |
| `services/local-runtime/navia_runtime/app.py` | `40040aed9ad7b3d29d93e487e92042ac97d201bf1f837dafdac697418f7c3618` | `518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8` |

`sourceEvidence` canonical digest 从
`6219ea718c1e3ca594ea5436bc62c0aae87e4936ee026825e3119bc36e4310b7`
更新为
`c7299b3b6f78eaed5de6613139067065f7666c0daf1c53a8c6ed41493017e7c6`。

## 2. 明确不变项

- relay v10 schema、protocol、公共 API 与行为合同不变；
- source/target registry 仍为 40/20；
- 30 个负例、FailureCode、抽取 scope、symbol 和 discovery roots 不变；
- baseline 仍为 50 项，mutation 仍为 15 项；
- 固定阈值和 R0-R7 出门条件不变；
- 不修改任何产品代码。

## 3. 为什么拒绝回滚

两个源文件相对当前 Git HEAD 合计包含 756 行净新增/调整，承载已批准并已有测试证据的
V3-2/V3-3 媒体门户设置、下载缓存、来源权威、策略切换、恢复、理解 Provider 与相关路由。
回滚会删除这些既有未提交实现，并违反不得覆盖用户/既有工作树改动的约束。

## 4. 防假绿核验

重冻结前已在临时副本中只替换上述三个 digest，权威 baseline 自然恢复为
50/50，source inventory 为 40/40，missing/extra 均为空。正式落盘后仍必须重新执行：

1. `verify-stage-b-b5-3-background-capture-relay-v10-contract.py`，要求 50/50、exit 0；
2. `verify-stage-b-b5-3-background-capture-relay-v10-mutations.py`，要求 15/15、exit 0。

任一失败则本决定不构成 R0 PASS，不得进入 R1。

## 5. 门禁边界

本决定只解除 `M-R0-01` 的冻结内容地址漂移，不证明 R1-R7、真实 Chrome、真实媒体、
SenseVoice、持久产品终态或完整 WP0 已通过。R0 是否接受，以正式 verifier 复跑和
Codex R0 gate review 为准。
