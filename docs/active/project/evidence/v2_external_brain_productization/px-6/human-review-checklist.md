# PX-6 人工产品核查清单

> 2026-09-09 撤回：本文件后续内容为旧记录，原 PASS / Major 0 / 仅待人工签署结论失效。当前 PX-5 FAIL / REOPENED，PX-6 BLOCKED_BY_PX5_MAJOR。参见 [中断恢复证据复核](../px-5/resumption-evidence-audit-2026-09-09.md)。未补齐证据前不得签署或放行。

## 2026-09-08 历史记录（不作为当前放行依据）

机器状态：PASS，等待人工核查

- [ ] 从 Side Panel 打开工作台，进入 Source Library。
- [ ] 查看当前来源，确认 Source Detail 的标题、sourceId、breadcrumb 一致。
- [ ] 在 Ask、Graph 等有效上下文点击“在工作台中打开”，确认保留上下文。
- [ ] 核查 Sources / Ask / Trace / Graph / Permission / Forget 的可读性与操作反馈。
- [ ] 核查 360/420 Side Panel 与 768/1280 Workspace 无遮挡、截断和阻塞。
- [ ] 核查 Runtime offline、Adapter blocked、data_service unreachable、source failed 不被合并。
- [ ] 核查 Forget 后 Library / Ask / Graph / Trace 均不返回来源，重开显示 SOURCE_NOT_FOUND。
- [ ] 确认最终声明不扩大为完整外脑、RAG、自动遗忘或 V3。

通过后需在 Human Review v3 中提供真实 reviewer、reviewedAt 和各 Gate evidence；自动化不得代填。
