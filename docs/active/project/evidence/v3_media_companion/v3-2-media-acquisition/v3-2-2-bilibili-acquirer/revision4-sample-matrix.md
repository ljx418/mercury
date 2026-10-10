# Revision 4 样本矩阵

日期：2026-10-06。该矩阵取代 Revision 3 作为后续 V3-2 production candidate 的唯一输入；Revision 3 保持历史只读。

| sampleId | BVID | primaryClass | asrTriggerClass | 预期路线/结果 |
|---|---|---|---|---|
| v3-sample-01 | BV1yLuwzpEt2 | subtitle | - | subtitle/success |
| v3-sample-02 | BV1VG4117775 | subtitle | - | subtitle/success |
| v3-sample-03 | BV1Bt411D78C | subtitle | - | subtitle/success |
| v3-sample-04 | BV1CiFMenEye | subtitle | - | subtitle/success |
| v3-sample-05 | BV1Fh1VYFEDu | subtitle | - | subtitle/success |
| v3-sample-06 | BV1iv411j7wL | subtitle | - | subtitle/success |
| v3-sample-07 | BV13W41137qV | asr | natural_no_subtitle | media/success |
| v3-sample-08 | BV1ZpYd66ELP | asr | audited_subtitle_failure | subtitle_body_http_403 -> media/success |
| v3-sample-09 | BV1pW421c7DH | asr | audited_subtitle_failure | subtitle_body_empty -> media/success |
| v3-sample-10 | BV1PA4m1w7ya | multipart | - | frozen part only/success |
| v3-sample-11 | BV1vt1sBgEzc | restricted | - | blocked |
| v3-sample-12 | BV1goA2zrEEq | low_signal | - | degraded |

硬约束：`naturalNoSubtitle=1`、`auditedSubtitleFailure=2`；两个 faultClass 各 1；固定锚点存在；12 URL 唯一；所有正例来自同一授权 production run。

2026-10-06 平台漂移修订：首轮 Route B production probe 中 `BV1Jm4y1k7SL` 返回 0 个真实字幕项，无法继续充当“注入前真实发现”样本，旧候选作废。第 9 项替换为未重复的 `BV1pW421c7DH`；先前授权 Chrome discovery run 已观测 3 个字幕项、当前分 P 约 573 秒。替换不改变固定分母、faultClass、生产不可达边界或低资源上限；新的完整 12 页 run 必须再次证明其真实字幕发现，历史 discovery 只用于选择候选。
