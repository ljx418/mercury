# V3-3-1 任务媒体绑定与抽帧开发计划

日期：2026-10-08。前置：V3-2 LIMITED PASS、V3-3-0c REAL MINIMAX CAPABILITY PASS。

## 目标

把 V3-2 同一 task sandbox 内的真实视频 artifact 绑定为只读视觉输入，并通过受控 FFprobe/FFmpeg 生成候选帧。该阶段不执行 OCR、VLM、摘要或知识保存。

## 实体

- `VisionMediaBinding`：固定 taskId、sourceIdentity、ArtifactRef、媒体 SHA-256 与声明时长。
- `FrameExtractor`：校验 task owner、私有 regular file、hash、真实时长、时间范围；以 argv 调用 FFprobe/FFmpeg。
- `ExtractedFrame`：返回 timestamp、宽高、相对引用、SHA-256；不得公开绝对路径。
- `FrameExtractionError`：只使用 `MEDIA_BINDING_INVALID`、`FRAME_EXTRACTOR_UNAVAILABLE`、`FRAME_EXTRACTION_FAILED`、`FRAME_TIME_OUT_OF_RANGE`。

## 顺序

1. V3-3-1-0 冻结数据类与 FailureCode。
2. V3-3-1-1 实现 sandbox/path/hash/task 绑定。
3. V3-3-1-2 实现 FFprobe 媒体探测。
4. V3-3-1-3 实现单时间点受控抽帧及 1280 px 上限。
5. V3-3-1-4 加入路径穿越、跨 task、hash 漂移、越界、损坏媒体和超时负例。
6. V3-3-1-5 使用真实视频字节重复抽帧，核对输出 hash、尺寸和私有权限。
7. V3-3-1-6 执行回归、PRD 检视和实施出门审计。

## 禁止

禁止 shell 拼接、sandbox 外路径、跟随 symlink、覆盖源媒体、把页面截图冒充视频帧、把本阶段扩大为 OCR/VLM 完成。
