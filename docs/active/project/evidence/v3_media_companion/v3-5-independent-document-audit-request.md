# V3-5 产品集成文档独立审查请求

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`，然后读取 `01-audit-request.md`。

## 决策问题

请独立决定：V3-5 文档候选是否达到 `CONDITIONAL GO FOR EXPLICIT USER IMPLEMENTATION AUTHORIZATION`。本轮只审文档、合同和测试设计，不运行 V3-5 产品代码，不签署 H01..H10。

## 必须复算

1. 所有载荷与 manifest SHA-256；目录平铺、无子目录、总文件数小于 20；权威源与平铺副本 0 mismatch。
2. PRD/架构/Stage Gate 是否保持 V3-4 LIMITED PASS、V2/V4 边界，不把 V3-5 扩大为 V3、知识库、Agent 或跨门户完成。
3. 历史 `v3_media_product_acceptance_v1.schema.json` 是否保持只读；fresh run 是否唯一绑定 v2。
4. v2 Schema meta；必需 `taskExecution`；routeDrift/fallback reason；本地 ASR 的资源提示、取消、临时媒体删除约束。
5. 独立运行 `test_v3_media_product_contracts.py`，确认当前 23 tests PASS，并抽查至少 8 类假绿负例。
6. semantic verifier 的固定映射是否明确：subtitle -> subtitle route；asr/multipart -> media/capture ASR；restricted -> blocked；low_signal -> visual_low_signal。
7. V3-4 route drift 是否被诚实保留：registry 字幕类不等于当次 observed subtitle route；UI 只显示 Runtime 事实。
8. 8 条 canonical media route、旧 transcript replace 迁移与 Knowledge router 隔离是否可实现且无冲突。
9. A01..A18 是否有用户操作和硬结果；H01..H10 是否只要求可见体验，不要求人类提供 Cookie、听写、日志或 hash。
10. 给出 Fatal/Major/Minor，并明确是否允许用户另行授权 V3-5-0..7 实施。

## 禁止扩大结论

- 不得把文档 PASS 写成 V3-5 implementation PASS、H review PASS、V3 PASS 或完整产品 PASS。
- 不得修改 V3-4 sealed run、历史 schema、产品代码或用户凭据。
- 不得把当前原型/历史截图认定为未来 fresh build 的人工验收证据。

## 落盘要求

将结论写入：

`docs/active/project/evidence/v3_media_companion/v3-5-independent-document-audit.md`
