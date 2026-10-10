# V3-2-2 Route B 平台漂移修订

日期：2026-10-06。状态：实施中重新规划；仅修订第 9 个验收样本，不改变产品规格与固定分母。

## 1. 触发事实

首轮完整真实 Chrome run `v3-2-route-b-20261006T180000Z` 完成 12/12 页面探测。`BV1Jm4y1k7SL` 当前 `subtitleItems=0`，因此不能满足 RB05“两个 injected 样本在注入前均有真实字幕发现”的条件。继续对该样本注入 `subtitle_body_empty` 会把自然无字幕误标为字幕体故障，属于假绿。

## 2. 修订决定

- 作废首轮 run 的 production-candidate 资格，但保留原始证据。
- `v3-sample-09` 从 `BV1Jm4y1k7SL` 替换为 `BV1pW421c7DH`。
- discovery-only run 已观测 `BV1pW421c7DH` 有 3 个字幕项、当前分 P 时长约 573 秒、无限制信号；该事实只用于候选选择。
- 新完整授权 Chrome run 必须重新证明 12 项同 run 事实；不得把 discovery-only run 拼入 production evidence。

## 3. 不变量

固定分母仍为 12：`6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal`。ASR 触发仍为 `1 natural_no_subtitle + 2 audited_subtitle_failure`，且两个 faultClass 各 1。固定锚点 `BV1ZpYd66ELP`、Cookie 任务租约、生产故障注入不可达、真实媒体回退、SenseVoice 基线和低资源约束均不变。

## 4. 重新进入实施的门槛

1. registry、schema tests、候选清单和矩阵对新 BVID 一致。
2. v3/v4 registry 回归通过，12 BVID 唯一且旧 v3 builder 不变。
3. 静态生产不可达审计保持 0 hit。
4. 新 run 中 `BV1pW421c7DH.subtitleItems>=1`；否则再次 FAIL/REPLAN。
5. 新 run 独立完成后才可执行受控空体、真实媒体与 SenseVoice 链路。

## 5. PRD 检视

本修订没有新增或删除用户能力。用户仍在 B站当前视频页启动分析，系统优先使用真实字幕；无字幕或字幕体失败时获取当前分 P 媒体并转写。变更只消除平台字幕状态变化造成的验收假绿，不缩小 PRD 分母。
