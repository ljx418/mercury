# V3-3-2 实施前审计

日期：2026-10-08。

决定：`GO`。Fatal=0，Major=0。

- 输入只能来自 V3-3-1 `VisionMediaBinding`，复用其 hash/task/path 防线。
- 算法只读取视频像素和时长，不读取文本来源，避免以字幕选择“画面证据”。
- OpenCV 仅做低分辨率场景差分；最终证据图仍由受控 FFmpeg 抽取。
- 固定预算无请求参数，因此调用方不能扩大上传数量。
- 本阶段不上传任何帧；V3-3-4 的 consent 与 outbound barrier 仍未被提前满足。
