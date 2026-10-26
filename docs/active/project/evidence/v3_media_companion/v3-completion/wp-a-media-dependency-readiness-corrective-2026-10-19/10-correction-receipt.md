# WP-A 纠偏收据（2026-10-19）

状态：**WP-A AWAITING CODEX CHECKPOINT**

## 结论

- A01-A24 固定分母现为 **24/24 PASS**。
- A24 已经由公开 HTTP API、生产 factory/acquirer 和生产 SenseVoice 跑通；未启动 capture、Chrome、云 Provider或声音。
- 初始 `credential-leases` 410 不是产品缺陷：探针把 envelope `issuedAt` 截断到整秒，早于保留毫秒的 channel `issuedAt`。探针现复用 channel 权威时间窗。
- 纠偏发现并关闭四类真实缺口：显式 redirect/HTTPS/host/retry/deadline；repair job 持久化与五阶段重启恢复；终态不可逆；任务快照篡改严格失败与 Settings 恢复展示。
- v11 仅更新 `app.py` source scope SHA 和由完整 `sourceInventoryEvidence` 推导的 authority digest；40/20 code inventory、schema、消息集合、阈值和公共 API 均未改变。v10 历史证据未修改。

## changed files

- `services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py`
- `services/local-runtime/navia_runtime/app.py`
- `services/local-runtime/scripts/v3_media_dependency_wp_a_probe.py`
- `services/local-runtime/tests/test_v3_media_dependency_repair_matrix.py`
- `services/local-runtime/tests/test_v3_media_dependency_task_binding.py`
- `apps/chrome-extension/src/modules/media_companion/settings/MediaDependencySettingsPanel.tsx`
- `apps/chrome-extension/src/modules/media_companion/settings/MediaDependencySettingsPanel.test.tsx`
- `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py`
- Extension build output under `apps/chrome-extension/chrome-mv3-unpacked/`.

公共合同变化：**none**。内部状态所有权与测试证据增强。

