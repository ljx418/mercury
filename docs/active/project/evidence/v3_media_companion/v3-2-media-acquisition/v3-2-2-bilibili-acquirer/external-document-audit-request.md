# V3-2-2 Revision 3 外部文档审查请求

日期：2026-10-06。只读审查，不运行产品、Runtime、Chrome、下载器或模型。

## 审查问题

1. Revision 2 是否保持不可变，revision 3 是否使用新 `$id`/路径并保留审计链。
2. Revision 3 是否完整保留 12 URL、6+3+1+1+1、身份/分P、页面/server probe、截图/hash、授权证据和 SenseVoice baseline。
3. 删除 comparison/reviewer/adjudication 是否严格限于用户已移入 V4 的跨模型质量门禁，是否产生其他分母退化。
4. V3-2-2 ADR、开发 BA01..BA16、威胁模型是否足以实现 B站字幕与当前分 P 媒体获取，且不扩大到 ASR/capture/V3-3。
5. `code=-101/isLogin=false` 是否必须维持 implementation NO-GO，旧失败 run 是否禁止与未来新 run 拼接。
6. 人工 H01..H10 后移到 V3-5 是否与 PRD 用户体验和最终出门保持一致。

## 决定边界

期望输出 Fatal/Major/Minor、文档 PASS/FAIL，以及有效授权会话恢复后是否允许重新执行 V3-2-2 实施前审计。即使文档 PASS，当前 V3-2-2 implementation 仍 NO-GO，直到全新授权 run 生成 schema-valid revision 3。

请将报告保存到 `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/independent-document-audit.md`。
