# WP0 R1 Codex 受限重冻结决定

日期：2026-10-17  
候选：`wp0-r1-corrective-round3-2026-10-16`  
决定：**接受受限重冻结；R1 checkpoint PASS**

## 1. 实现审查结论

第三轮产品实现关闭了上一轮全部问题：

- Background 使用真实 `bootstrapLocalRuntimeSession`、
  `cancelMediaAcquisition`、`getMediaAcquisition`，不再向自身发送不存在的
  `delete/status/recover` 消息；
- `connecting` 为 bootstrap -> DELETE -> GET，其余四 phase 为
  bootstrap -> GET；
- token 只存在于 Runtime client 的进程内 session，不进入 marker 或持久存储；
- 严格六字段 marker 不增加 `sourceIdentity`，不可调用的
  `recover(sourceIdentity)` 已从内部 adapter 合同删除；
- acquisition 终态闭集为
  `succeeded/degraded/blocked/failed/cancelled`；
- production adapter 与新 worker 读取旧 marker 均有组合测试。

实现审查未发现新增 Fatal、Major 或 Minor。

## 2. 重冻结范围

只更新 relay v10 的实现证据，不改变产品协议：

1. `MediaCaptureController.ts` source SHA-256：
   `10c9404a...` -> `b344caf3...`；
2. `media-capture-offscreen/main.ts` source SHA-256：
   `21796782...` -> `fff4948e...`；
3. 新增 `relayContracts.ts` target implementation scope，SHA-256：
   `d09c43c4...`；
4. verifier 将 pre-normalization source inventory 与 normalized target
   implementation inventory 分开复算：source `40/40`、target `20/20`。

## 3. 为什么不能把 `relayContracts.ts` 直接放入 source scope

首次受限重冻结尝试直接把 `relayContracts.ts` 放入 source scope，baseline
得到 `48/50`。该文件同时定义：

- 15 个 source/target 共享码；
- 5 个仅属于 normalized target inventory 的新 relay 码；
- 1 个 producer 内部 source 诊断码。

将整个文件视作 pre-normalization source 会错误地把 5 个 target-only code
解释成 source inventory 扩张。最终证据模型保留 `sourceInventoryCount=40` 与
`targetInventoryCount=20`，并增加独立、内容寻址的 `targetScopes`：

- source scope 抽取结果必须精确等于冻结 source 40；
- target scope 的 target 交集必须精确等于冻结 target 20；
- target scope 额外值只允许来自冻结 source 40；
- discovery universe 必须精确等于 source | target | non-relay allowlist；
- 未列出的边界发码文件仍被拒绝。

这不是放宽检查，而是消除 source/target 混算，并为 target 实现增加独立
SHA-256 锚点。

## 4. 明确不变项

- Schema canonical authority 不变；
- protocol canonical authority 不变；
- source/target inventory 仍为 40/20；
- 20 个 FailureCode、9 个 Port message、30 个负例均不变；
- limits、Origin、ticket TTL、Cookie/provider、BVID 分母、公共 API、Runtime
  endpoint 均不变；
- baseline 分母仍为 50，mutation 分母仍为 15；
- 没有修改产品代码或 Runtime 代码。

## 5. 最终机器结果

| 检查 | 结果 | 退出码 |
|---|---:|---:|
| relay v10 baseline | **50/50** | 0 |
| relay v10 mutations | **15/15** | 0 |
| source inventory | **40/40，0 missing，0 extra** | 0 |
| target implementation inventory | **20/20，0 missing，0 extra** | 0 |
| unlisted boundary emit | **0** | 0 |
| target scope unexpected code | **0** | 0 |

原始结果：`62-codex-r1-refreeze-baseline.json`、
`63-codex-r1-refreeze-mutations.json`。

## 6. 冻结文件事实

```text
65b31eadd4acf41386c6f21f8172ccc7176a604a8a2a1c55a8ccc5ac751c6dd4  docs/active/project/contracts/v3_media_capture_internal_relay_v10.schema.json
1439f0f1952abe87080aa413277032bce5ee1070ccd5612fe821246ec3a0bff9  docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json
57380dbf80e3285fe8ff61945b55285d36c42507ac4b05ce2746143fe2dc87aa  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-contract.py
9c376719117a8cb0740c9eda28e23cab5b12b2c1da5d0846615fbda9ee453f0e  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

以上文件字节哈希以最终 manifest 为准；若后续文档整理导致本节与 manifest
冲突，manifest 优先。

## 7. 门禁决定

`R1 checkpoint PASS`。Fatal=0、Major=0、Minor=0。允许进入 R2；该结论不等于
WP0、Stage A/B 或 V3 PASS，也不授权跳过 R2-R7。

