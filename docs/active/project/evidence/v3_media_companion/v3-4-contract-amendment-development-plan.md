# V3-4 合同修订开发计划

日期：2026-10-08。状态：`DOCUMENT/CONTRACT REMEDIATION`。

## 根因

V3-3 sealed run 只公开哈希并删除 private task root，能证明流水线资格但不能提供 V3-4 所需正文。旧 `v3_media_outline_taskstore_v1` 又强制每个样本都有非空 evidence/outline/timeline/mindmap，与冻结 12 页中的 restricted/blocked 样本冲突。

## 修订

1. V1 保持只读历史；新增 `v3_media_outline_taskstore_v2.schema.json`。
2. 新增 `blocked` 终态和 typed `terminalFailureCode`。
3. `ready/degraded` 必须 evidence 非空、三视图非空且 `outlinePublished/projectionPublished=true`。
4. `blocked/failed/cancelled` 必须三视图为 null/空、发布位为 false；禁止伪造章节补齐 12 页。
5. evidence ref 增加受控 `relativeArtifactRef`，正文保留在当前 task 私有 root，公开材料只保留 hash/ref。
6. V3-2/V3-3 seal 作为能力、工具和样本资格基线；V3-4 必须在全新单 run 内对 12 页重新获取真实 evidence 并写入 MediaTaskStore。
7. 10 个内容可用样本生成真实三视图；restricted 样本进入 blocked 零发布；low-signal 可进入 degraded，但仍须真实 evidence 与三视图闭合。

## 云调用边界

V3-4 若重新生成 8 个 VLM caption，需要新的 task-scope `selected_frame_cloud_vision` 授权。V3-3 已消费的授权不能继承；未获授权前只允许完成合同/fixture/审计，不允许生产 run 或以 local-only 结果冒充完整 V3-4。
