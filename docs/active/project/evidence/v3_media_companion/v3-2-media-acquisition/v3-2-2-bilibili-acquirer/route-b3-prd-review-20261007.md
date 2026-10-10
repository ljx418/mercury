# V3-2-2 Route B3 PRD 规格检视

日期：2026-10-07。对象：B3 实现与 `v3-2-route-b3-20261007T014759Z`。

## 规格对账

| PRD 要求 | 证据 | 判断 |
|---|---|---|
| 字幕优先，无字幕/字幕失败后本地媒体 ASR | 三槽 acquisition receipt + route result | PASS |
| 12 个真实 B站 URL，6+3+1+1+1 | raw + v5 registry | PASS |
| 三个 ASR 槽位真实媒体 | 3 个 artifact hash/bytes/16 kHz mono shape | PASS |
| Cookie task lease 与秘密隔离 | lease path、公开双扫描 0 hit | PASS |
| 平台拒绝诚实 blocked/degraded | restricted/low_signal 唯一结果 | PASS |
| 取消与终态清理 | cleanupResidualCount=0，private root absent | PASS |
| 不把验收故障放入产品 | production-unreachable 0 hit | PASS |
| 门户开放性 | `MediaAcquirer` 新增 portal-neutral `SubtitleDiscoveryReceipt`；B站策略仍在 adapter | PASS |
| 本地 SenseVoice 全长转写 | 本阶段只产出真实音频，尚未执行 V3-2-3 | PENDING BY STAGE |

## 偏移检查

- 没有新增用户操作、权限或 B站专用字段到通用 coordinator request。
- B3 只修订验收事实权威，不把所有视频强制送入 ASR；生产仍优先可用字幕。
- 自然无字幕计数不再是固定 URL 门槛，但产品空候选分支未删除，本 run 也真实观测并执行 1 次。
- 没有把本轮媒体获取扩大声明为视频理解、图文大纲或 V3 完成。

结论：Fatal=0，Major=0，Minor=1。Minor：本 run 的 3 个临时音频已按清理策略删除，后续 V3-2-3 必须从同规格全新 task 获取输入，不能引用公开 hash 冒充可转写媒体。

