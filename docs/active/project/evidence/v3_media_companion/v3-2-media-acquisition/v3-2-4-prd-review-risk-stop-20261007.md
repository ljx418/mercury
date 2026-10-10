# V3-2-4 PRD 规格检视与风险停止

日期：2026-10-07。审查性质：子阶段端到端验收后的 PRD 复核。

## 1. 对齐项

- 路由顺序固定为 credentialed subtitle → credentialed media ASR → public/page subtitle → trusted tab capture。
- capture 需要新鲜可信点击、一次性 30 秒 grant、同 task/tab/page/adapter/surface binding。
- `tabCapture` 与 Offscreen 分层明确；原声回放、PCM、本机 SenseVoice、停止清理均有具体实体。
- B站实现通过 generic binding/adapter contract 进入 capture；未增加 YouTube/小红书 host 或特判。
- Cookie、Runtime bearer、ticket、streamId、原始 PCM 不进入公开 evidence。

## 2. Major 风险

**M-1 产品 route orchestration 缺失**：PRD 要求用户点击开始分析后，同一任务先执行三路并在失败时出现 capture。当前产品 UI 只完成 consent + credential lease，V3-2-1..3 的真实媒体能力由独立 runner 调用，没有 `MediaAcquisitionClient` 将其连接到 Side Panel/Workspace。

影响：TC02、TC03、TC04、TC13、TC18 无法通过真实用户路径；直接由测试写入 eligibility 会伪造生产可达性。

## 3. 修订路线

建议新增 `V3-2-4a acquisition orchestration closure` 文档冻结，范围严格限定为：

1. `MediaAcquisitionClient` 创建同 task，并复用 credential lease 的 taskId。
2. Runtime production endpoint 顺序执行/记录三路，失败原因来自实际 adapter，不接受 UI 自报。
3. Side Panel/Workspace 订阅同一 task projection，仅 authority projection 可显示 capture card。
4. 真实 Chrome B站样本通过前三路实际失败进入按钮；真实点击完成 capture→SenseVoice。
5. 完成 TC02/03/04/09..19 后再做独立实施出门审计。

该路线不改变 PRD 目标，不扩权限或 portal host，但会新增生产编排 API/状态投影，必须先文档审计后实施。

## 4. 决定

`V3-2-4 IMPLEMENTATION CANDIDATE / ACCEPTANCE FAIL / REPLAN REQUIRED`。

- V3-2-3 LIMITED PASS 保持。
- V3-2-4 不通过。
- V3-2-5..7 继续 BLOCKED。
- 不提交外部实施出门审计包，因为候选存在 1 项已确认 Major；先冻结 V3-2-4a 文档更符合防假绿门禁。

