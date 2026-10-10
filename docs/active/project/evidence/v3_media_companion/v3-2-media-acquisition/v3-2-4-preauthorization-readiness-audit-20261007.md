# V3-2-4 高风险实施授权前准备度审计

日期：2026-10-07。结论：`READY FOR EXPLICIT HIGH-RISK AUTHORIZATION / IMPLEMENTATION NO-GO`。

## 1. 前置与文档

- V3-2-3：`LIMITED PASS / Fatal=0 / Major=0 / Minor=2`，前序门禁关闭。
- V3-2-4 development、acceptance TC01..TC20、threat model、capture stream v1 Schema 与正例均已冻结。
- `test_v3_media_pipeline_contracts.py` 已包含 capture schema/semantic 合同；本轮 Runtime 全量 474 passed。
- H01..H10 仍只在 V3-5，不把高风险授权冒充人类产品验收。

## 2. 精确权限增量

当前 `wxt.config.ts` 与构建 manifest 的 permissions 均为 `activeTab/scripting/sidePanel/storage/tabs`，可选权限为 `cookies`；当前不存在 `tabCapture`、`offscreen`，也不存在 `<all_urls>`。

授权后允许的唯一权限改动：

1. 在固定 permissions 中加入 `tabCapture` 与 `offscreen`。
2. 不新增或扩大 host permissions，不新增 `<all_urls>`。
3. 不扩大 `web_accessible_resources` 到 capture ticket、streamId、原始音频或 Offscreen 内部入口。

## 3. 允许实施范围

- Runtime：30 秒、256-bit、one-shot、task/tab/page/adapter/surface 绑定的 private ticket 与 public grant；专用认证 WebSocket；连续 chunk sink；task-private WAV；清理 barrier。
- Extension：只接受 Side Panel/Workspace 新鲜可信点击的 controller/router；Background 二次校验当前 tab/page/task；唯一 Offscreen Document 消费 streamId；AudioContext 回放原声；停止清理。
- 集成：V3-2-3 SenseVoice service；至少一个固定真实 B站样本完成前三路机器失败后的真实 capture + transcript。
- 验收：可见真实 Chrome、四视口、键盘、Axe、全部停止事件、秘密扫描与 TC01..TC20。

## 4. 禁止项与重新授权

- 禁止后台、定时器、content script、页面脚本或恢复逻辑自动开始捕获。
- 禁止 content script/page 持有 ticket 或 streamId；禁止持久化 raw chunk/WAV。
- 禁止静音 fixture、预录 WAV、JS 伪造 trusted click 或旧 transcript 计正例。
- 若需要新 host permission、`<all_urls>`、后台自动 capture、持久化原始音频或超过冻结 900 秒上限，立即停止并重新取得授权。

## 5. 风险分级

- Fatal：0。
- Major：1，缺少用户对上述音频捕获权限与实现边界的明确高风险授权。
- Minor：0。

授权前不得修改 manifest、实现 capture 或启动真实 tabCapture。建议授权原话：`approved V3-2-4 trusted tabCapture implementation (V3-2-4-0..7 only)`。
