# V3-2-3 / V3-2-4 独立文档审查请求

日期：2026-10-06。审查对象仅为当前 `external-audit-package/` 的 19 项载荷和 manifest。

## 决策问题

1. V3-2-3 是否只消费 V3-2-2 当前 task/current part 的权威音频，且未提前实现下载、capture、视觉或大纲？
2. SenseVoice provider/engine/version/model/revision/weights、`development_baseline`、3/3 全长与 >=90% 覆盖率是否和 PRD/合同一致，是否存在 Tiny/字幕/窗口/跨 run 假绿？
3. Transcript Execution v2 是否关闭输入绑定、进度、覆盖率、终态与公开 receipt，同时保持历史 `MediaTranscript` v1 不变？
4. V3-2-4 是否只有前三 route 机器失败后的真实可信点击才能启动，且 task/tab/page/adapter/surface、30 秒 one-shot、Offscreen 单例、900 秒、原声回放和停止清理均明确？
5. Capture Stream v1 是否拒绝 ticket/streamId/tabId/raw path 等私有字段，并能支撑 chunk 顺序与零残留停止回执的后续 semantic validator？
6. ST01..ST16、TC01..TC20 是否固定、无 N/A、无人工提前、无权限/平台范围扩大，能否完整支撑后续自动化实施？
7. 当前是否应维持 V3-2-3/2-4 implementation NO-GO，直到前序独立出门、各阶段外审和 V3-2-4 高风险授权分别满足？

## 强制检查

- 独立重算 19 项 SHA-256，校验三份 JSON Schema meta 和 positive fixture。
- 检查 model/revision/weights、route order、Chrome permissions 与所有固定分母。
- 对发现项按 Fatal/Major/Minor 分级；不得把前序尚未通过误判为本包文档缺陷，也不得因此放行实施。
- 禁止运行产品、Runtime、Chrome、下载器、ASR 或旧 generator/validator；只读审查。

## 输出

报告保存到：

`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-4-independent-document-audit.md`

必须明确给出文档决定、实施决定、Fatal/Major/Minor，以及重新审查/实施的前置条件。
