# ADR V3-2-2-B：稳定 ASR 路线分母与验收故障隔离

日期：2026-10-06。状态：`ACCEPTED BY USER / DOCUMENT FREEZE`。

## Context

B站会在页面首次发布后异步补充 `ai-zh` 字幕。Revision 3 的三个“自然无字幕短视频”在正式单 run 中均获得字幕，生成器正确 fail closed。继续替换 URL 不能消除平台漂移，只会制造偶然通过、后续不可复验的假绿。

## Decision

1. Revision 1、2、3 与既有 run 全部只读；新增 sample registry Revision 4，不原地放宽历史 Schema。
2. 12 页及 `6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal` 分母不变；三个 ASR 样本改为：恰好 1 个 `natural_no_subtitle`，恰好 2 个 `audited_subtitle_failure`。
3. 两个受控故障样本必须先在真实授权会话中发现至少一个真实字幕项并固化响应 hash，再由独立验收编排器分别注入 `subtitle_body_http_403` 与 `subtitle_body_empty`，随后获取真实当前分 P 媒体。页面、字幕发现、媒体与后续 SenseVoice 均为真实数据，只有字幕体故障条件受控。
4. 故障计划只存在于 `apps/chrome-extension/e2e/` 的验收编排器；Runtime API、生产配置、`MediaAcquirer`、portal registry 和 dependency injection 容器均不得出现 fault 参数、环境变量或动态开关。
5. Revision 4 公开记录 `injectionLayer=acceptance_orchestrator`、`productionConfigReachable=false`、故障类别、真实字幕发现 hash 和真实媒体要求；不记录 Cookie、字幕私有 URL、cookiefile 或本地绝对路径。
6. 固定锚点 `BV1ZpYd66ELP` 保留并按本次真实平台事实走 `audited_subtitle_failure`。自然无字幕样本采用连续双探测仍无字幕的 `BV13W41137qV`；长媒体不降低 8 CPU/8 GiB/无 GPU 资源上限，只允许增加 wall-clock 时间。

## Consequences

- 获得稳定、可重复且直接覆盖“字幕获取失败后走真实媒体”的证据。
- 不再声称三个样本均天然无字幕；PRD、验收和报告必须使用 Revision 4 语义。
- 生产体验、路由顺序和用户权限无变化。
- 若注入机制可由生产入口触达、缺少注入前字幕 hash、使用 fixture 媒体、或跨 run 拼接，Revision 4 必须失败。

