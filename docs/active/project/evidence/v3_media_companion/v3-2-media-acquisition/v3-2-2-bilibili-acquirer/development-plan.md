# V3-2-2 B站字幕与媒体 Acquirer 开发计划

日期：2026-10-06。状态：`DOCUMENT CANDIDATE`。

## 1. 目标体验

用户在当前 B站详情页点击开始后，Runtime 使用同 task、未过期、未撤销的租约优先读取凭据字幕；无字幕时只获取当前分 P 的任务期音频。平台限制、登录失效或媒体拒绝必须返回封闭失败码，不能绕过限制或改用标题生成 transcript。

## 2. 实现实体

- `acquisition/contracts.py`：portal-neutral `MediaAcquirer`、`SubtitleCandidate`、`AcquiredMedia`。
- `acquisition/subtitle_resolver.py`：B站字幕 JSON 到有序强类型 segment；拒绝空、越界、重叠和未绑定来源。
- `acquisition/downloaders/yt_dlp.py`：固定 executable、argv array、无 shell/config/plugin/update/exec、重定向与 URL 边界。
- `acquisition/bilibili/acquirer.py`：唯一持有 B站 API/URL/Cookie 格式知识。
- `credential_transport.py`：增加同 task 的私有租约借用回调；不公开 credential、路径或可逆 hash。
- `coordinator.py`：记录 route attempt、artifact public ref、封闭失败码；成功后停止后续 route。

## 3. 顺序任务

1. V3-2-2-0：Revision 3 Schema、平台漂移 Amendment 1、生成器、真实授权 Chrome 单 run 12 页 probe 和内部/外部审计；锚点保留但按当前 API 字幕事实分类。
2. V3-2-2-1：冻结通用接口、B站 URL/API allowlist、Cookiefile serializer 和下载器 argv。
3. V3-2-2-2：实现凭据字幕、公开字幕解析与 hash/provenance。
4. V3-2-2-3：实现当前分 P 音频获取、配额、取消和清理。
5. V3-2-2-4：集成 coordinator/API，完成 6 subtitle、2 media、multipart、restricted 真实验收。
6. V3-2-2-5：全量回归、PRD 检视、秘密扫描和独立实施出门审查。

## 4. 禁止项

不实现 ASR、tabCapture、关键帧/OCR/VLM、VideoOutline、Ask 或导出；不接收用户 URL；不下载其他分 P；不读取浏览器 profile；不保存长期 Cookie；不自动重试已过期 lease；不把受限样本转成成功。

## 5. 出门条件

BA01..BA16 全通过、真实输入且 0 mock production observation、12 页必须来自同一 run、Fatal=0/Major=0。V3-2-2 PASS 只允许进入 V3-2-3 计划与审计。
