# V3-4 v2 合同修订独立文档审查请求

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。

## 1. 决策范围

只读审查 V3-4 v2 合同修订是否足以关闭两项 Major：上游 seal 被误当正文，以及 restricted 页被迫伪造大纲。本轮不得实施 V3-4 产品代码、不得运行云端请求、不得读取 API Key/Cookie、不得批准真实 selected-frame 上传。

## 2. 候选自报

- V3-3 已取得 sealed LIMITED PASS；其 production run 只公开 hash/seal，并按合同删除 private task root。
- V3-4 必须在全新单 run 内重建 12 页真实 evidence；V3-2/V3-3 seal 只作 qualification binding。
- 固定终态分母：样本 01..10 `ready`、样本 11 restricted=`blocked` 且零投影、样本 12 low-signal=`degraded` 且仅基于真实证据发布。
- v1 Schema 字节保持不变；v2 增加 blocked/nullable projection/typed publish receipt。
- Outline 冻结为本地确定性抽取，不新增 transcript/OCR 文本云上传。
- 中性图 MiniMax 实时 probe 已 PASS，但不等同于新 task 的真实 frame 授权。
- targeted contract tests 48/48；Runtime full 633/633。

## 3. 必须独立复算

1. 18 项 payload SHA-256 与权威源逐字节一致，目录平铺且总数不超过 20。
2. v1 Schema SHA-256 保持 `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4`；v2 Draft 2020-12 meta PASS。
3. ready/degraded/blocked 三正例均 Schema/semantic PASS。
4. 缺 evidence/projection、blocked 假投影、跨 task/未知 evidence、时间逆序、projection drift、path escape、publish receipt 错配均 fail closed。
5. 权威计划是否把 12 页明确固定为 10 ready + 1 degraded + 1 blocked，并拒绝缩小分母或伪造受限页。
6. qualification seal 与 fresh-run content handoff 是否分离，是否禁止跨 run 拼接旧 private artifact。
7. 本地 Outline 策略是否避免额外云文本上传，同时保留 V3-5 内容质量人工门槛。
8. MiniMax 中性 probe 是否仅证明接口可用，没有越权成为真实 selected-frame 授权。

## 4. 输出决定

报告写入：

`docs/active/project/evidence/v3_media_companion/v3-4-contract-amendment-independent-document-audit.md`

必须给出 Fatal/Major/Minor，并分别判断：

1. v2 合同修订是否 PASS。
2. V3-4 是否可请求用户明确的产品实施与最多 8 张 selected-frame task-scope 授权。
3. 未取得上述授权前，V3-4 implementation 是否仍保持 NO-GO。
