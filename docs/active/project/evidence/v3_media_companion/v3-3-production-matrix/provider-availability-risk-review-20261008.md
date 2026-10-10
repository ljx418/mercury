# V3-3-6 MiniMax 可用性风险复审

日期：2026-10-08。决定：`IMPLEMENTATION COMPLETE / ACCEPTANCE BLOCKED`。Fatal=0，Major=1，Minor=0。

## Major M-1

个人 Token Plan 在高峰期无法稳定完成同一生产 run 的 8 个固定云视觉目标。四个 run 均正确 fail-closed；最后一轮在 65 秒节流下完成 6/8 后仍收到 529。继续立即重跑会把远端随机可用性当作通过条件，产生选择性成功风险。

## 恢复路线

| 路线 | 技术成本 | 架构成本 | 体验回退 | 决定 |
|---|---:|---:|---|---|
| A. 非高峰全新重跑 | 低；等待至官方高峰窗口后，从样本 1 重跑约 8-12 分钟 | 无 | 无 | 推荐 |
| B. 用户改用 MiniMax 按量付费生产 Key | 中；更新系统凭据并重做中性 capability probe | 无；同一 Provider adapter | 无，稳定性可能提升 | 备选 |
| C. 改换 MiniMax 模型或其他云 Provider | 中至高；重新冻结模型、成本、输出和真实 probe | 中；新增/切换 adapter manifest | 可能有质量与成本变化 | 需用户高风险授权 |
| D. 放宽同一 run、拼接局部成功或降低 8/8 | 低 | 破坏证据合同 | 明显回退且会假绿 | 拒绝 |

## 恢复门槛

路线 A 不改变任何产品代码或合同。恢复时必须生成全新 runId；旧四轮只作为失败历史。只有 10 个样本在同一 run 内全部完成、8 个固定 cloud target 各一次成功、seal 可独立复算且全量回归通过，V3-3-6 才可 LIMITED PASS。

在此之前 V3-4 实施保持 BLOCKED BY PREDECESSOR。

## 本地回归与保密复核

- Runtime 全量：616 passed，0 failed（仅 1 条既有 Starlette/httpx deprecation warning）。
- 四个失败 run 公开目录均为 0 文件；result/seal 均不存在，四个私有 `/tmp` root 均已删除。
- 本轮 11 个代码/文档/失败目录文件以 API key 与 Cookie 文件原值扫描：0 exact hit。
- `git diff --check`：PASS。

这些结果只证明实现与清理没有本地回归，不替代 V3-3-6 的同一 run 10/10、8/8 真实生产门槛。
