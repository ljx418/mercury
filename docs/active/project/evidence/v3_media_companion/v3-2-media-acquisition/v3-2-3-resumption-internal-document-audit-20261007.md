# V3-2-3 实施前恢复内部文档审计

日期：2026-10-07。范围：Route B3 后的 SenseVoice 全长转写恢复文档，不含产品实现或真实转写运行。

## 1. 决定

`INTERNAL DOCUMENT PASS / EXTERNAL DOCUMENT AUDIT REQUIRED / IMPLEMENTATION NO-GO`。

- Fatal：0。
- Major：0。
- Minor：2。

## 2. 复核结果

| 项 | 结果 |
|---|---|
| B3 前置 | 独立出门 Fatal=0/Major=0/Minor=3，`LIMITED PASS` |
| 固定分母 | 3 个能力槽位、sample-07/08/09、BVID 与顺序精确 |
| 单 run lineage | 三个新 task；0 B3 音频复用；0 cross-run；0 人工 transcript |
| B3 稳定路由 | task-time 真实字幕发现；0 候选直接媒体；有候选只用预绑定 acceptance fault 一次；动态和=3 |
| 生产隔离 | Runtime/API/env/Acquirer/registry fault 0 可达仍是硬门槛 |
| 架构可实现性 | acquisition sandbox -> 私有流式 copy -> native ASR root；双 hash/shape 与双层 cleanup |
| ASR profile | engine/version/model/revision/weights/VAD/device/compute 全闭锁 |
| 覆盖率 | VAD start/end count 一致且等于非空 SRT count；成功只发布 1.0；不确定即 fail closed |
| 开发顺序 | `2-3-0..2-3-7` 共 8 子阶段，线性无环 |
| 验收分母 | ST01..ST20 正好 20 项，无 N/A |
| 人工边界 | V3-2-3 不请求听写；H01..H10 仍只在 V3-5 |
| 合同验证 | Transcript Execution v2 Schema meta/positive PASS；严格 count equality 与 mismatch 负例；管线合同 31 passed |
| 文档格式 | `git diff --check` PASS |

## 3. 本轮发现与闭环

### Major M-1：完全禁用 acceptance fault 会使固定分母不可实现

B3 权威 run 中 sample-08/09 的 task-time 字幕数为 2；如果 V3-2-3 要求产品自然走媒体，固定 3 个 ASR 输入将稳定缺 2 个。已修复为复用 B3 审计通过的 acceptance wrapper：真实发现先发生，故障映射运行前冻结且每槽最多一次，随后仍获取真实当前分 P 媒体。产品路径静态 0 可达。该修订与 PRD Route B3 一致，不降低真实性。

### Major M-2：覆盖率算法存在循环证明

原文只写 `speech_interval_overlap/v1`，没有说明 speech interval 来源。冻结 runtime 的官方实现会用 FSMN-VAD 切段并只为非空识别结果写 SRT，同时 stderr 给出 VAD 总段数。已采用保守规则：start/end VAD count 必须一致，且 SRT count 必须等于 VAD count；否则 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`。成功 receipt 固定 1.0。这样可能产生 false negative，但不会用 SRT 自身制造 false positive。

### Major M-3：B3 私有音频已清理

原计划要求消费既有 V3-2-2 当前 task 音频，现实中 B3 cleanup 已删除这些字节。已改为同规格全新单 run 逐任务 acquisition->ASR，并明确 B3 只提供身份/路线基线。公开 hash 不得冒充输入。

三项 Major 均已闭环，当前 Major=0。

### 外审 Round 1 M-1：fixture/test 未强制 count equality

第一轮外审发现 positive fixture 为 `segmentCount=120`、`speechIntervalCount=24`，测试仍按旧 `coverageRatio>=0.9` 判定。现已把正例改为 `24==24`；`validate_transcript_semantics` 对 succeeded receipt 强制 count equality、duration equality、ratio=1.0、passed=true；新增 mismatch 负例。该项闭环后需第二轮独立复算。

## 4. Minor 与执行限制

- m-1：VAD 不公开完整遗漏区间时长，严格 count equality 会拒绝部分可能仍达到 90% 的结果；这是保守失败，不是体验承诺回退。V4 可在升级 runtime/独立 VAD receipt 后优化。
- m-2：B站字幕状态会继续漂移；动态 0+3..3+0 分布可接受，但三个固定 URL、预绑定 fault 和总媒体数 3 不可改变。

## 5. 外审要求

外部 reviewer 必须独立确认：B3 source binding、三个固定槽位、acceptance/production 隔离、单 run lineage、双层私有音频 cleanup、VAD count 防假绿、ST01..ST20、低资源 timeout、V4 质量边界及 V3-5 人工时点。Fatal 或 Major 非零时不得进入实现。

参考实现事实来自 FunASR 官方 runtime README 与 SenseVoice runtime source：

- `https://github.com/modelscope/FunASR/blob/main/runtime/llama.cpp/README.md`
- `https://github.com/modelscope/FunASR/blob/main/runtime/llama.cpp/sensevoice/funasr-sensevoice/funasr-sensevoice.cpp`
