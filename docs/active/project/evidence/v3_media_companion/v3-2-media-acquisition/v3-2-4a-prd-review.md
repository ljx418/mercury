# V3-2-4a PRD 规格检视

日期：2026-10-07。结论：`NO MAJOR PRD DEVIATION IN V3-2-4a SCOPE`。

## 覆盖

- 当前 B站页 identity、当前分 P 与 task 绑定，未把 B站字段泄漏到通用 UI/client。
- 路线顺序保持 credentialed subtitle -> credentialed media ASR -> public/page subtitle -> trusted tab capture。
- Cookie 只通过既有短期 lease 使用；公开响应、截图和证据扫描为零命中。
- 捕获必须由用户明确操作触发，且只捕获绑定 tab；没有后台自动录音或 `<all_urls>` 扩权。
- 本地 SenseVoice 产出真实 transcript；低资源执行采用串行测试和受限 native process。
- 接口保留 portal adapter 边界，未来 YouTube/小红书必须注册独立 adapter、权限和证据，不能继承 B站会话。

## 未覆盖且不得误报

- V3-2-5 transcript 产品化、V3-2-6 故障矩阵、V3-2-7 十二页总验收尚未实施。
- V3-3 视觉证据、V3-4 图文大纲/TaskStore、V3-5 人类产品验收尚未由本候选证明。
- 单一真实 B站页面只能证明该时点路径，不能证明所有视频、门户或平台策略稳定。

没有缩小 PRD 分母或用 mock 替代真实数据。下一步仅允许独立审查本候选。
