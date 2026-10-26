# WP0 R0 PRD 检视（2026-10-16）

Candidate: `wp0-r0-2026-10-16`
结论：**`R0 NO-GO / P0 MAJOR OPEN`**。不满足 `05-wp0-relay-acceptance.md` 的
「R0 先证明 50/50、15/15 和 Schema」，因此不进入 R1。

## 1. 覆盖矩阵对应（`04-prd-coverage-matrix.md`）

| 权威范围 | WP0 应交付 | 本轮实际 | 判定 |
|---|---|---|---|
| V3-2 trusted tabCapture ASR + SenseVoice + cleanup | WP0 canary | R0 只做合同证据核对；canary 属 R5 | 未到 R5，N/A |
| V3-4 单 TaskStore/Outline、同 task/revision | WP0 提供权威基础 | relay 抽取符号齐备；40-code inventory 未闭合 | 部分 |
| G3 B站 Chat、真实 route、0 残留 | WP0-WP5 | R0 未进入 run | 未到 |
| B-7 Stage B 独立审计 | WP2 后 Codex | 未触及 | 未到 |

本轮只覆盖 R0，故仅需证明「relay v10 冻结合同证据与工作树一致」。

## 2. 合同不变性检视

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| 公共 API / 公开 schema | 未修改 | ✅ |
| Origin / ticket TTL / Cookie / provider 合同 | 未修改 | ✅ |
| 固定分母（6 BVID、NJ-01..10、H01-H10、CX-H01..06） | 未修改 | ✅ |
| 验收阈值（50/50、15/15、20 target inventory） | 未修改 | ✅ |
| 40-code source inventory | 未修改（问题在于工作树哈希与冻结值不一致） | ✅ 未篡改 |
| 私有数据边界 | 未上传、未写入公开证据 | ✅ |
| 产品代码 | 未修改 | ✅ |

## 3. R0 门槛逐项

| R0 门槛 | 判定 | 证据 |
|---|---|---|
| v10 baseline 50/50 | ❌ 46/50 | `r0-relay-v10-contract-baseline.json` |
| v10 mutation 15/15 | ❌ 14/15 | `r0-relay-v10-mutations.json` |
| Schema meta / instance | ✅ | baseline `schemaMetaValid=true`、`protocolInstanceSchemaValid=true`、全部 immutable 检查 true |
| extension typecheck / test / build | ✅✅✅ | 退出码 0 / 0 / 0 |
| capture/transcript/outline/fault/product focused pytest | ✅ 180 passed | 退出码 0 |
| `scripts/stage_b_b5_3/test/*.node-test.mjs` | ✅ 134 离线 + 6 Runtime 集成 | 退出码 0 / 0 |

## 4. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| **Major** | **1** | 2 个冻结源文件哈希漂移 → 4 项检查失败、6 个 boundary code 未进入 emit 集 → R0 无法放行 R1 |
| Minor | 0 | — |

## 5. PRD 纠偏建议（交回 Codex）

R0 的失败不指向 relay 实现缺失，而指向**冻结证据与工作树的版本关系未被确定**。
本轮已排除：实现缺失、抽取器缺陷、fixture 缺位、relay 增量缺失四种解释。

需要 Codex 明确（ClaudeCode 不代选）：

1. 当前工作树的 `app.py` / `coordinator.py` 是否为权威内容？
   - 若是 → 重新冻结 fixture 的 scope 哈希与 40-code inventory（Codex 冻结动作）。
   - 若否 → 由有权限的一方还原这两个文件（Codex / 用户动作）。
2. 还原或重冻结后，ClaudeCode 重跑 R0 两项 verifier，要求 50/50 与 15/15。

## 6. 未启动事项声明

- R1–R7 未启动
- WP1 / Stage A / 六视频 fresh run 未启动
- Provider 请求 0 次
- 可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未宣布 PASS，未承担独立外审，未 commit / push
