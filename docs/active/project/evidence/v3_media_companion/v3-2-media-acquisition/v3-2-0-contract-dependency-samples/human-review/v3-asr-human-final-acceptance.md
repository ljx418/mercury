# V3-2-0 ASR 人工最终验收

日期：2026-09-21。决策对象：`runId=v3-2-asr-comparison-20260918T153809Z`。

## 用户决定

用户提交 `reviewerId=123` 的 24 项独立听辨结果，并明确要求“以此结论作为最终结论进行验收”。该授权允许提前形成失败结论，但不能降低 PRD 的通过门槛，也不能伪造第二位 reviewer 或 adjudication。

## 证据校验

- review SHA-256：`29313674ac457dd8df72b9f84834e8379968884a6704777d1e157f02de785d77`。
- bundle SHA-256：`868c2ca3e8be7032501c39e93b6be86be1333b28fb70ec5d45b9b0f17be7d8d0`，与私有 bundle 字节复算一致。
- Draft 2020-12 Schema：`PASS`，0 errors。
- 固定分母：24/24 judgments，三个 BVID 各 8 项；`(bvid, binIndex)` 24/24 唯一且全集匹配。
- 原始判断未改写；第二份 review 和 adjudication 均未生成。

## 生产候选结果

| 指标 | 实际 | 冻结门槛 | 判定 |
|---|---:|---:|---|
| 当前人类判断中的 production 含义保留 | 23/24（95.8333%） | 最终通过需 44/48 | 分母不足，不得声明通过 |
| `BV1sMNtzJE5B` | 7/8 | 最终通过需 15/16 | 已出现单人失败样本 |
| `BV1xz4y1S7yF` | 8/8 | 最终通过需 15/16 | 当前 reviewer 内通过 |
| `BV1Bb411w741` | 8/8 | 最终通过需 15/16 | 当前 reviewer 内通过 |
| critical meaning error | 1 | 0 | FAIL |
| neither acceptable | 1 | 0 | FAIL |

偏好分布为：production 更好 16、baseline 更好 4、等价 3、两者均不可接受 1。`BV1sMNtzJE5B/binIndex=5` 同时记录 production 含义未保留、两者均不可接受和关键错误，因此触发 fail-closed。

## 门禁判定

```text
Human final decision: FAIL / REPLAN
D08: FAIL / REPLAN
V3-2-0: FAIL / REOPENED
V3-2-1+: BLOCKED
V3 overall: NOT PASSED
```

FailureCode：

- `V3_ASR_INDEPENDENT_DENOMINATOR_NOT_MET`
- `V3_ASR_PER_SAMPLE_MINIMUM_NOT_MET`
- `V3_ASR_CRITICAL_MEANING_ERROR`
- `V3_ASR_NEITHER_ACCEPTABLE`

## PRD 检视

结论未偏离 PRD。PRD 明确要求 44/48、每样本 15/16、critical=0、neither=0；本次不因用户要求“最终结论”而把单份 24 项结果扩写为 48 项，也不以 23/24 的总体比例掩盖关键错误和逐样本失败。

## 后续边界

本 run 和本 review 永久保留为失败证据，不得重新编辑或拼接。后续必须返回 ASR model/decode-profile ADR，形成新的模型或解码配置、新 runId、新 bundle hash 和新的人类证据；当前不得进入 V3-2-1。
