# V3-5.9 PRD 规格检视

## 结论

`PASS`。实现扩展了既有 V3 主干，没有废弃 V3-1.3 短租约、V3-2 媒体获取、V3-3 视觉治理或 V3-5 投影合同。

## 对齐项

- 一次配置、日常自动分析：Settings 持久登录态优先，短租约回退。
- Cookie 最小暴露：秘密只进入 OS credential store，UI/SQLite/日志/证据不含值。
- 真实数据：真实 B站视频完成一次下载、音频导出和 8 帧抽取。
- 图文证据：视觉链仍从本地帧派生，最多 8 张受治理上传。
- 资源透明：设置页展示网络/磁盘影响、缓存使用、配额、保留期和手动清空。
- 门户开放性：通用 resolver/cache 使用 adapter + source identity；B站 Cookie policy 留在 B站实现。

## 未越界项

- 未宣称 YouTube/小红书已实现。
- 未上传原始视频、音频、全文 transcript 或 OCR。
- 未把失效 Cookie、公开媒体下载或旧 ready 任务冒充本轮登录态正向验收。
- 未改变 V4 的智能回退、跨模型质量优化或 Agent 范围。
