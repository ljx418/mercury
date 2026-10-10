# V3-3-1 任务媒体绑定与抽帧验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 绑定 V3-2 task 的真实视频 artifact | task/source/artifact/hash 一致；源文件只读不变 |
| A02 | FFprobe 正常视频 | 得到正时长、宽高；不接受无视频流输入 |
| A03 | 在 0、中点、尾部合法时间抽帧 | PNG 非空、最长边 <=1280、时间有序、hash 可复算 |
| A04 | 对相同字节和时间点重复抽帧 | 输出 SHA-256 相同 |
| A05 | 跨 task ArtifactRef、路径穿越或 symlink | `MEDIA_BINDING_INVALID`，不读取目标 |
| A06 | 篡改媒体字节或声明 hash | `MEDIA_BINDING_INVALID` |
| A07 | 负时间或超出真实时长 | `FRAME_TIME_OUT_OF_RANGE` |
| A08 | 损坏媒体、FFmpeg 失败或超时 | 唯一失败码且不留下 staging 文件 |
| A09 | 检查公开 DTO | 无绝对路径、Cookie、API Key、原视频字节 |
| A10 | 运行 V3-1/V3-2 与 Runtime 回归 | 无新增 Fatal/Major PRD 偏差 |

真实验收必须使用可解码视频字节；只用 JSON fixture 或静态页面截图为 Major。
