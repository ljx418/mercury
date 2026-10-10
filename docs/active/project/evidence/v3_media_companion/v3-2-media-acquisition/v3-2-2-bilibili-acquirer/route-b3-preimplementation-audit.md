# V3-2-2 Route B3 实施前内部审计

日期：2026-10-07。审计对象：B3 修订、验收计划、PRD/Stage Gate 修订候选和拟新增 Revision 5。

## 1. 规格一致性

- PRD 用户路径仍是“字幕优先，失败后真实媒体 + 本地 ASR”，没有把验收故障暴露给产品。
- 12 页、6+3+1+1+1、固定 anchor、三真实媒体、SenseVoiceSmall Q8、8 CPU/8 GiB/no GPU、秘密与清理门槛均未缩减。
- Revision 4 及其 run 保持历史只读；Revision 5 显式 supersede，不重写失败事实。
- 自然无字幕能力由生产 coordinator 的空候选分支和负例覆盖；真实 run 只记录平台当时事实，不再要求第三方页面长期维持某状态。

## 2. 架构与风险

| 风险 | 闭环 |
|---|---|
| 运行后挑选样本 | 三 URL、顺序和 faultPolicy 预冻结；样本集合精确校验 |
| 全部用注入导致自然路径消失 | 生产空候选路径保留并有合同测试；run 明示自然观测计数，不冒充已观测 |
| 故障进入生产 | wrapper 仍只在 scripts；静态扫描 Runtime/API/env/package 0 可达 |
| 浏览器与 Runtime 状态竞态 | 分类权威改为 acquisition task 内真实 discovery receipt，而非旧页面计数 |
| 总分母被动态分类缩小 | 两类计数可变但和必须为 3；三媒体 artifact 均为硬门槛 |
| ASR 未实际执行 | B3 只放行 V3-2-3；不得将媒体获取写成 transcript PASS |

## 3. 判定

Fatal=0，Major=0。Minor=2：

1. 第三方平台若在 acquisition task 内持续拒绝字幕 discovery，必须按平台拒绝失败，不得自动把网络错误等同于 0 字幕。
2. B3 自身不执行 SenseVoice，三条媒体的完整转写仍必须由紧随其后的 V3-2-3 单独出门。

结论：`B3 DOCUMENT/INTERNAL AUDIT PASS; IMPLEMENTATION AUTHORIZED BY USER`。允许按 B3-0..B3-7 实施；任一真实数据硬门槛失败时回到 REPLAN，不得降级门槛。

