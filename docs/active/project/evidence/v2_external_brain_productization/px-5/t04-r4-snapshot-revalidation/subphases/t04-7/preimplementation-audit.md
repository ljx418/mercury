# T04-7 实现出门审计实施前审计

日期：2026-09-14  
结论：`GO FOR PACKAGE BUILD ONLY AFTER T04-6 PASS`

## 平铺外审包

每轮必须先清空 `docs/active/project/external-audit-package/`，只生成 19 个高优先级载荷和 `AUDIT_MANIFEST.md`，总数精确 20、无子目录。Manifest 记录每个文件的权威来源、原始字节 SHA-256 和 byteLength；载荷包括 PRD、架构、stage gate、T04 计划/合同/文档外审/授权、两泳道、SnapshotRevalidation、ExitManifest、25 负例、中文 HTML、public tar 与关键实现源码。

## 独立审查

审查者必须先重算 ExitManifest 原始字节 SHA-256，再独立复核 T04-A01..A14、两泳道、25 个负例、公开 tar 成员与声明边界。审查报告必须位于 T04 evidence 目录，不能回写候选、不能进入 public tar。

## 出门条件

只有实现出门独立审查 `Fatal=0 / Major=0` 才允许声明 `T04 LIMITED PASS for isolated snapshot revalidation and PX-6 review input`。在此之前 T04 审计状态为 pending；Human Review/G7/final 仍为 `pending / pending / false`，PX-5 仍 FAIL/REOPENED，PX-6 仍 BLOCKED。
