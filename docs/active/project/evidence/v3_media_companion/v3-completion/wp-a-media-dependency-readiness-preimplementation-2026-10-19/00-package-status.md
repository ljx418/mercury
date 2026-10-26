# WP-A 媒体依赖就绪实施前冻结包

日期：2026-10-19  
坐标：`V3 post-R7 / WP-A media dependency readiness / preimplementation`  
状态：`DOCUMENT PASS / IMPLEMENTATION MAY START / PRODUCT CODE NOT STARTED`

## 基线

- WP0 已在 `../wp0/wp0-r7-2026-10-19/` 受限收口；不得重跑 R0-R7，也不得把 capture 历史 0/7 改写为通过。
- 本机当前 `yt-dlp`、`ffmpeg`、`ffprobe` 与 SenseVoice 已可用于开发验证，但“本机已有文件”不是产品安装体验已经实现。
- 当前 `build_media_downloader()` 在工具缺失或校验失败时静默返回 `None`，Settings 无法提前说明原因。

## 本包冻结内容

1. 用户体验和非目标。
2. 具体代码实体、所有权、调用关系和状态机。
3. 三个 JSON Schema、四个合法 fixture、固定 API 和失败码。
4. A0-A7 开发顺序、24 项验收矩阵和反假绿规则。
5. ClaudeCode 单一实施工作包和停止条件。

本包不授权本地文件导入、自动安装系统包、任意 URL 下载、tabCapture 升格、Provider/Cookie 范围变化或 V3 PASS 声明。

审查结果：首轮 5 Major 经单批修订后，复审关闭 M1/M4/M5；M2/M3 与两个 Minor 经定向闭环复核确认 `Fatal=0 / Major=0 / Minor=0`。机器文档 verifier `42/42`。下一步只能把 `07-claudecode-implementation-goal.md` 作为一个 WP-A 实施工作包交给 ClaudeCode。

