# V3-5.9 开发计划：持久 B站登录态与一次下载缓存

日期：2026-10-11。范围：仅 V3 B站媒体获取、Settings、Runtime 私有缓存和视觉证据恢复；不扩大门户、不上传原始媒体、不改变既有 ASR/VLM/Outline 合同。

## 目标体验

用户在 Settings 一次导入并验证 B站 Cookie、开启登录态下载。之后打开 B站视频和 Navia 即自动分析；Runtime 只下载一份低清视频，同时完成本地音频转写和关键帧抽取。设置页展示缓存占用，可配置自动清理并立即清空。

## 实施顺序

1. 冻结秘密持久化、Cookie 格式、验证、停用/删除合同。
2. 实现 SQLite 元数据 + OS credential store 秘密分离。
3. 实现私有 cache authority、配额、TTL/LRU、hash 和异常恢复。
4. 将音频与视觉链改为共用一次完整低清下载，保留短租约与分段下载回退。
5. 接入 Settings 和自动分析，补齐错误恢复说明。
6. 单元、集成、全量回归、真实 B站和 secret scan。
7. PRD 规格检视和内部出门审计，停止在人工验收。

## 禁止事项

- Cookie 写入扩展 storage、SQLite、日志、事件、Trace 或审计包。
- 缓存跨来源/分P复用，或把缓存文件当作公开 evidence。
- 上传原始视频、音频、全文 transcript/OCR；云视觉仍最多 8 张选定帧。
- 为通过验收降低视觉门槛、伪造截图、拼接旧 run。
