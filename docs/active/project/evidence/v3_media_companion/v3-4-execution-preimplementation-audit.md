# V3-4 授权后实施前审计

日期：2026-10-08。

决定：`GO V3-4-0..7`。Fatal=0，Major=0，Minor=2。

- v2 文档独立审查 Fatal=0/Major=0，报告 SHA-256 `14b4a23137184ce8b58a5eae8c0b3b8c8b2800be5c526a9ba39ad2581ec60601`。
- 用户明确授权 V3-4-0..7、B站 Cookie 下载及最多 8 张 selected frame 上传至 MiniMax-M3。
- 禁止上传原始视频、音频、完整 transcript、OCR 文本；Outline 固定本地确定性生成。
- 临时媒体、帧和开发截图必须在形成验收回执后删除，残留扫描是硬门槛。
- 失败 run 不生成 seal，不与历史 run 拼接。

Minor：真实 12 页重采耗时较长；本地抽取表达质量仍由 V3-5 人工体验验收最终判断。
