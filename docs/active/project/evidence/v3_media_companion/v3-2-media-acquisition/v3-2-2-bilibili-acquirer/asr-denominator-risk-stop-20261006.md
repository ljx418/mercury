# V3-2-2 ASR 固定分母风险停止

日期：2026-10-06。状态：`FAIL / REPLAN / USER DECISION REQUIRED`。

## 1. 自动化停止事实

Amendment 1 Round 2 文档外审为 Fatal=0/Major=0，并允许执行全新单 run。production 候选 run `v3-2-sample-probe-20261006T103000Z` 完成 12/12 页面探测和临时 profile 清理，但三个 ASR 候选在同一 run 中均出现一个真实 `ai-zh` 字幕项。生成器按合同 fail closed，未生成 sample registry，更未生成 `productionReady=true`。

此前候选发现时这些页面的字幕项为 0，随后复探出现字幕，证明 B站会异步补充 AI 字幕。继续用“首次探测为 0”的短视频凑满 3 个 ASR 会形成不可复现假绿。

本轮还修复了 probe 的多 P duration 语义：`durationSeconds` 必须按当前 cid 对应 part 读取，不能使用合集总时长。该修复尚未进入 production run 候选或实施 PASS。

## 2. 不受影响的结论

- 用户授权 Cookie 当前 server validation 有效；本次停止不是凭据失效。
- 6+3+1+1+1 固定分母未被缩小。
- SenseVoiceSmall Q8 development baseline、V3-2-1 LIMITED PASS 和既有 V3-1.3 PASS 不变。
- Cookie 值未写入公开证据；失败 run 未跨 run 拼接；H01..H10 仍推迟到 V3-5。

## 3. 路线选择

### 路线 A：保持三个自然无字幕样本

使用经过两次探测仍无字幕的长视频或多 P 指定分 P，并扩展 probe/registry 对 `partIndex`、`partId`、query URL 的机器绑定。

- 优点：完全保持原 PRD “3 个自然无字幕”语义；真实覆盖字幕不可用用户场景。
- 成本：样本寻找和平台漂移成本高；可能需要处理更长媒体；固定 URL 仍可能再次被 B站补字幕。
- 架构成本：中等，需要把当前分 P identity 从默认 1 提升为显式合同字段并重审 Schema/runner。
- 体验回退：无，但验收稳定性较差。

### 路线 B：一个自然无字幕 + 两个真实故障回退（推荐）

保留至少一个经过双探测的自然无字幕样本；另外两个使用真实 B站音频，但在测试环境对字幕 body 获取注入可审计的 403/empty-body 故障，验证 `credentialed_subtitle -> credentialed_media_asr` 的真实回退。字幕发现、媒体下载、SenseVoice 和产物均使用真实数据，只有故障条件受控。

- 优点：稳定、可重复；直接验证用户最关心的回退行为；不会与 B站异步 AI 字幕竞争。
- 成本：需要新增 fault provenance、禁止 production 开关和负例；必须修改“3 个自然无字幕”的验收措辞。
- 架构成本：中等，复用现有 fault injection/evidence 模式，不改变生产路由。
- 体验回退：生产体验无回退；验收语义从“3 个自然无字幕”调整为“1 个自然无字幕 + 2 个真实字幕故障回退”。

### 路线 C：取消三个 ASR 固定分母

只在偶发无字幕页面执行 ASR，不设置固定正例。

- 优点：实施最省。
- 成本：ASR 主能力缺少稳定出门证据。
- 架构成本：低。
- 体验回退：明显，无法证明无字幕/字幕失败时仍可完成视频理解；不推荐。

## 4. 当前门禁

V3-2-2：`FAIL / REPLAN`。V3-2-3..V3-7：`BLOCKED`。在用户选择路线前，禁止继续 production sample run、生成 registry、进入 Acquirer 产品实现或把 Round 2 文档 PASS 扩大为阶段通过。
