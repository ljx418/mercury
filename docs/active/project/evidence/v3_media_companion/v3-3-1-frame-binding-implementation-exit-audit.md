# V3-3-1 任务媒体绑定与抽帧实施出门审计

日期：2026-10-08。

## 结论

`V3-3-1 LIMITED PASS`。Fatal=0，Major=0，Minor=1。

## 实现与验收

- 新增 `VisionMediaBinding`、`FrameExtractor`、`MediaProbe`、`ExtractedFrame` 及闭集错误码。
- 复用 V3-2 `TaskArtifactSandbox`，新增私有 `frame/.png` artifact；公开 DTO 只含逻辑相对引用和 hash。
- FFprobe/FFmpeg 以 argv、`-nostdin`、固定 timeout 调用；输入和输出均由 task sandbox 验证。
- 39 项相关 pytest PASS，覆盖真实解码、重复 hash、跨 task、hash 漂移、越界、损坏媒体和失败清理。
- 真实 B站锚点：固定 `yt-dlp 2026.08.19` hash 匹配；获取 8 秒、1,208,799 bytes 视频片段，抽取 3 张 852×480 帧；媒体、cookiefile、sandbox 均清理。
- 机器结果：`v3-3-dependency-freeze/v3-3-1-real-bilibili-frame-result.json`。

## 修复记录

首轮真实解码测试发现 640×360 输入被放大为 1280×720。滤镜已改为只缩小不放大，回归断言固定原尺寸；该问题未进入真实验收候选。

## Minor

M-1：真实验收只覆盖 1 个锚点短片段，不计 V3-3 的 10 页生产分母。完整矩阵必须在 V3-3-6 单 run 重采。

允许进入 V3-3-2；禁止声明 OCR、VLM 或 V3-3 PASS。
