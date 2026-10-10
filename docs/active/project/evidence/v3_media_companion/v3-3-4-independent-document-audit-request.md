# V3-3 / V3-4 独立文档审查请求

日期：2026-10-06。审查对象为 `docs/active/project/external-audit-package/` 的平铺文件；先读取 `AUDIT_MANIFEST.md`，独立重算所有载荷 SHA-256。

## 1. 审查决定对象

请在以下两种决定中分别给出结论：

- V3-3/V3-4 文档方向是否 `PASS`，即能否在列明前置关闭后指导自动化实施。
- 当前实现门禁是否必须保持 `NO-GO`。

不得把 Schema、fixture、24 个合同测试或 376 个 Runtime 回归扩大为 OCR/VLM/TaskStore/Outline 已实现。

## 2. 必查问题

1. PRD、架构、阶段计划是否保持 B站首版、V3-5 人工验收和 V4 deferred 边界。
2. V3-3 `-0..-7`、A01..A16 是否完整，24/12/8/1280 预算与 10 OCR/8 VLM 页面分母是否冲突。
3. 未授权、撤销竞争、原视频上传、路径穿越、跨 task、Provider 静默切换是否 fail closed。
4. fixture 中 provider/model 占位值是否被明确禁止进入生产证据。
5. V3-4 `-0..-7`、V401..V418 是否完整；SQLite aggregate/event/outbox 同事务和 crash recovery 是否可实现。
6. Outline、Timeline、Mindmap 的 task/outline/evidence identity 是否闭合，是否允许无证据章节。
7. `knowledgeImportStatus=deferred_to_v4` 是否防止把 V3 本地任务误报为 V4 知识库。
8. 前序 V3-2、RapidOCR、VLM Provider、外部授权等 Major 是否仍被保留。
9. 是否存在缩分母、跨 run 拼接、mock/fixture 假绿或提前触发 H01..H10。

## 3. 独立验证要求

- 独立运行 Draft 2020-12 `check_schema` 和 positive fixture validate。
- 独立统计 A01..A16、V401..V418 和 `-0..-7`。
- 抽样构造至少四类负例：预算扩大、未选帧上传、跨 task evidence、非 deferred 知识状态。
- 检查 19 项载荷与 manifest hash，并与权威源对账。
- 报告 Fatal/Major/Minor、允许/禁止项和具体文件/行号。

## 4. 期望落盘

`docs/active/project/evidence/v3_media_companion/v3-3-4-independent-document-audit.md`

审查为只读，不得修改主工作树、运行真实 Provider、读取秘密文件或启动产品实现。
