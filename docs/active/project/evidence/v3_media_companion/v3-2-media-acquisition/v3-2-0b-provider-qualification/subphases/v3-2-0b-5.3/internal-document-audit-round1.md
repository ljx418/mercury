# V3-2-0b-5.3 内部文档审查第一轮

日期：2026-09-22  
审查性质：文档、Schema、Draw.io 与历史证据静态审查；未运行产品代码或 ASR。

## 1. 审查输入

- 总 PRD、目标架构、开发计划、总验收和 V3 Stage Gate。
- 固定窗口 ADR、合同/API、开发、验收与威胁模型。
- fixed-window Schema、policy registry、candidate manifest 与 fixtures。
- 原 0b-5 accepted run、0b-5.1 失败、0b-5.1b 状态传播、5.2 单 bin 诊断。
- 8 页 `v3-media-companion-gap.drawio`。

## 2. 第一轮发现与闭环

| ID | 严重度 | 发现 | 修复 | 状态 |
|---|---|---|---|---|
| R1-M1 | Major | sample 03 的 SHA-256 在对话摘要中漏掉末尾 `b`，candidate 被 Schema 拒绝 | 回到 accepted run `result.json`，修正为 64 位权威值 `...f7cc97b`；不放宽正则 | CLOSED |
| R1-M2 | Major | 初版 Schema 只限制数组长度，可能让重复 sample/chunk index 通过 | source、run sample 与 8 chunk 改为固定 `prefixItems`、`uniqueItems`、`items=false` | CLOSED |
| R1-M3 | Major | 初版 run Schema 对三样本共用 16360ms 上限，sample 02 可在 14760ms 之后假绿 | 为三个 sample 分别绑定 source hash 与 16360/14760/16280ms 上限 | CLOSED |
| R1-M4 | Major | Draw.io 仍写 0b 为文档候选，和已失败事实冲突 | 原位更新 2/4/7/8 页：0b FAIL/REPLAN、5.3 文档候选、FW01..FW20 | CLOSED |
| R1-m1 | Minor | 本工作包没有新交互原型 | 记录为有意不新增：用户可见界面和动作不变，只回归 Settings 失败状态与匿名 review 页面 | CLOSED |
| R1-m2 | Minor | 8 次进程启动可能造成体验回退 | 把逐样本 <=2x 从观测提升为硬门槛，超限必须 FAIL/REPLAN | CLOSED |

## 3. 机器复算

```text
Draft202012Validator.check_schema: PASS
candidate instance errors: 0
synthetic positive run: PASS
registry requirements: 20
negative fixture cases: 20
(requirementId, requirementKey, failureCode): exact set equality
source samples: exact ordered 3
chunk boundaries: exact ordered 8
latency maximum: exact 2.0 x per sample
structural false-green probes: 5/5 rejected
Draw.io pages: 8
duplicate cell IDs: 0
broken edge references: 0
git diff --check: PASS
```

五个结构攻击为：重复 source、concurrency=8、重复 chunk index、sample 02 elapsed=14761、sample 03 错误 source hash。

## 4. 结论

第一轮发现 Fatal=0、Major=4、Minor=2，均已落盘关闭。修订后未发现未关闭 Fatal/Major；进入第二轮 false-green、PRD 偏移、开放门户和停止状态复审。产品实现仍 NO-GO。
