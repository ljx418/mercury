# V3-3-2 确定性采样验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 同一真实媒体连续采样两次 | canonical hash 和全部时间点完全相同 |
| A02 | 检查候选 | 1..24、升序、去重、全部小于真实时长 |
| A03 | 检查 selected/cloudEligible | selected <=12、cloudEligible <=8，且均属于候选 |
| A04 | 检查原因 | 每项只允许 timeline/scene_change/both；scene score 有限且 >=0 |
| A05 | 修改媒体一个字节或跨 task | 绑定失败，不产生 receipt |
| A06 | 尝试由调用方扩大预算 | API 不接受预算输入；常量仍为 24/12/8 |
| A07 | 检查输入语义 | 不读取 transcript/title/description，0 Provider 网络请求 |
| A08 | 回归和 PRD 检视 | V3-3-1/V3-2 通过，无阶段越界 |
