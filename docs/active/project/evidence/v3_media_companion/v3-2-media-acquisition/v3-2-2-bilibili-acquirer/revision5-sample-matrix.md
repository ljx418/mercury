# Revision 5 Route B3 样本矩阵

日期：2026-10-07。Revision 5 supersede Revision 4；历史 Schema、run 和失败事实只读。

| sampleId | BVID | primaryClass | 固定策略 |
|---|---|---|---|
| 01..06 | 与 Revision 4 相同 | subtitle | 真实字幕 |
| 07 | BV13W41137qV | asr | 0 字幕直接媒体；否则验收 503 后媒体 |
| 08 | BV1ZpYd66ELP | asr / anchor | 0 字幕直接媒体；否则验收 403 后媒体 |
| 09 | BV1pW421c7DH | asr | 0 字幕直接媒体；否则验收空体后媒体 |
| 10 | BV1PA4m1w7ya | multipart | 冻结当前分 P |
| 11 | BV1vt1sBgEzc | restricted | blocked |
| 12 | BV1goA2zrEEq | low_signal | degraded |

三个 ASR URL、顺序和 faultPolicy 在 Chrome 探测前固定。运行时分类只读取 acquisition task 的真实 discovery receipt；`runtimeNoSubtitle + auditedSubtitleFailure = totalMediaFallback = 3`。
