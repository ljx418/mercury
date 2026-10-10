# V3-3-6 实施出门审计

日期：2026-10-08。

决定：`V3-3-6 LIMITED PASS`。Fatal=0，Major=0，Minor=2。

## 独立检查

- `verify_v3_vision_production_matrix.py` 不调用 runner，独立读取 registry/result/seal 并完成 16 类全局检查与 10 个逐样本检查，结果 PASS。
- 语义负例在同步重算 content/result/seal 后给非 cloud 样本写入 vision，仍被 `SAMPLE_09_NON_TARGET_DISPATCH` 拒绝，证明 verifier 不只核验哈希。
- API key/Cookie 原值与公开敏感模式扫描均 0 hit；private root 不存在。
- Runtime 616 passed；Extension 修订后的默认 `npm test` 为 47 files/317 tests、0 error；typecheck/build PASS。

## Minor

- M-1：MiniMax Token Plan 高峰 529 仍是外部运行风险；产品必须保留可见失败和手动重试，不得承诺全天候云视觉成功。
- M-2：本阶段封存的是 10 个视觉样本，不替代 V3-6 最终 12 页 `6+3+1+1+1` 单 run。

只允许进入 V3-3-7 独立复算和 V3-4 实施前恢复审计，不得声明 V3 整体通过。
