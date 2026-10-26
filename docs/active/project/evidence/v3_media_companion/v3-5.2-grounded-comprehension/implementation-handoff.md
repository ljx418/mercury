# V3-5.2 实施交接

日期：2026-10-11。Stage Gate：`IMPLEMENTED CANDIDATE / HUMAN QUALITY AND ASYNC UX NO-GO`。

## 模块与变更

- Runtime：新增派生文本分块、全片归并、严格证据校验和私有投影持久化。
- Ask：高质量投影存在时使用完整章节 + MiniMax grounded answer；视觉问题只接受 OCR/vision-caption，合同失败最多重试三次。
- Extension：明确区分本地预览与高质量理解，增加任务级授权和生成入口。
- 风格：精简/结构化/详细/教程四种真实结果及覆盖遗漏、过度纳入、步骤化重组风险提示。
- 文档：架构、开发计划、验收门槛和 BiliNote 路线对照均已落盘。
- 未新增：原始音视频/截图云上传、跨视频 RAG、知识库导入、逐问题云模型回答。

## 合同状态

- Public API changed：yes，新增 `POST /v1/media/tasks/{taskId}/comprehension/synthesize`。
- Adapter contract changed：yes，增加仅接收派生 evidence 文本的 MiniMax synthesis adapter。
- Data model changed：yes，新增兼容读取的 `v3-media-workspace-comprehension-projection/v2`。
- Event type changed：no。
- 旧 v1 投影保持可读；未授权、模型失败或校验失败均保留 v1 本地预览。

## 验证与证据

- Runtime comprehension 定向：18 passed；全量：694 passed（1 warning）。
- Extension 定向：6 passed；全量：52 files / 351 passed。
- Extension typecheck 与 production build：PASS。
- Fixture：`services/local-runtime/tests/test_v3_media_comprehension.py`。
- 真实数据：三个既有真实 B站任务均完成派生 transcript/OCR/vision-caption MiniMax 结构化生成；原始媒体上传计数 0。
- 真实质量：最终独立私有 DB run 36/36；公开摘要不含问题回答正文或私有 evidence 内容。
- 风格对照：最短视频 concise/detailed/tutorial 与 active structured 均真实运行并独立私有保存。

## PRD 覆盖与剩余风险

- 覆盖 V3-5.2 的全片结构化理解、同源大纲/时间线/导图索引、证据闭合和失败保留。
- 未关闭独立人类内容质量、8 个视觉节点准确性和同步等待体验。
- 长视频高质量大纲约 345 秒；跨章问答中位数约 23.4 秒、最大约 31.5 秒。
- 停止条件：V3-5.3 后台任务/进度/检查点文档与实现尚未完成；因此 V3-6 不得开始。

## Integration 交接

- 输入：ready/degraded task、exact revision、派生 transcript/OCR/vision-caption evidence、已验证 MiniMax provider。
- 输出：v2 comprehension projection、provider/model/outbound hash receipt、同 task/revision Ask cache invalidation。
- 假设：Provider 支持 OpenAI-compatible chat completions，并已通过设置页能力测试。
- 禁止：把机器测试、合法 JSON 或引用闭合外推为内容质量 PASS。

## No-Go 自检

- [x] 未改动 V1.2 A/C/D 实现目录或其公共合同。
- [x] 未绕过 Runtime 安全会话或 Provider secret store。
- [x] 未创建临时事件字符串。
- [x] 未把 fake provider 测试作为真实 E2E 证据。
- [x] 未扩大到 V4/RKM/Agent 范围。
