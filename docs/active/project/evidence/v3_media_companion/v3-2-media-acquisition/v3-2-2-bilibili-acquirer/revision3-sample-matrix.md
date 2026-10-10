# Revision 3 固定样本矩阵

日期：2026-10-06。状态：`AMENDMENT 1 CANDIDATE / SINGLE-RUN REPROBE PENDING`。

| sampleId | BVID | primaryClass | expectedOutcome |
|---|---|---|---|
| 01 | BV1yLuwzpEt2 | subtitle | success |
| 02 | BV1VG4117775 | subtitle | success |
| 03 | BV1Bt411D78C | subtitle | success |
| 04 | BV1CiFMenEye | subtitle | success |
| 05 | BV1Fh1VYFEDu | subtitle | success |
| 06 | BV1ZpYd66ELP | subtitle | success |
| 07 | BV1Jm4y1k7SL | asr | success |
| 08 | BV1Bb411w741 | asr | success |
| 09 | BV17x411i7Kh | asr | success |
| 10 | BV1PA4m1w7ya | multipart | success |
| 11 | BV1vt1sBgEzc | restricted | blocked |
| 12 | BV1goA2zrEEq | low_signal | degraded |

锚点 `BV1ZpYd66ELP` 仍是必测页面。有效登录会话的 run `v3-2-sample-probe-20261006T085921Z` 与随后锚点复探均观测到 3 个 API 字幕项，因此按当前平台事实归入 subtitle。ASR 候选来自同会话真实探测：`BV1Jm4y1k7SL`、`BV1Bb411w741`、`BV17x411i7Kh` 当前分 P 约为 223、1192、256 秒，均不得超过低资源上限 1200 秒。生产判定只接受修订后 12 项在同一全新 run 的结果；任一 subtitle 项为空、任一 ASR 项出现字幕或 ASR 时长超限都 fail closed，不得跨 run 拼接。
