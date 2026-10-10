# V3-3-2 确定性采样开发计划

日期：2026-10-08。前置：V3-3-1 LIMITED PASS。

## 目标

基于同一已绑定视频字节，以固定 `scene-change-plus-timeline-budget/v1` 生成最多 24 个候选时间点、最多 12 个证据选择和最多 8 个云端目标。相同输入、策略和工具必须得到相同 receipt hash。

## 实施

1. 固定 timeline 采样与低分辨率灰度 scene score；不读取字幕、标题、简介或 Provider 输出。
2. 时间点为整数毫秒，范围合法、升序去重；近邻 scene point 只保留最高分。
3. 证据选择由 8 个 timeline 锚点和最多 4 个 scene-change 点组成；Provider/UI 无法修改 24/12/8。
4. receipt 记录策略版本、媒体 hash、候选原因、score、selected/cloudEligible 与 canonical hash。
5. 使用真实视频重复运行并逐字节比较 receipt；预算或身份篡改必须拒绝。
