# V3-6 / V3-7 最终证据与审计威胁模型

日期：2026-10-06。状态：`DOCUMENT CANDIDATE`。

| ID | 威胁 | 控制 |
|---|---|---|
| F01 | 跨 run 拼接补齐分母 | runId/build/profile/runtime/db/root 单一绑定 |
| F02 | 失败样本从 12 页删除 | registry 集合精确相等、分类计数 const |
| F03 | mock/fixture 计生产 | evidenceClass + provider execution receipt + static scan |
| F04 | H 项被自动代签/改写 | immutable submission hash、reviewer input、bundle binding |
| F05 | 旧截图/报告复用 | build/run/timestamp/viewport metadata 与 fresh artifact hash |
| F06 | public tar 泄露 secret/private data | member allowlist、needle/token/path/profile scan |
| F07 | seal 后修改 candidate | canonical seal + manifest + immutable candidate directory |
| F08 | validator 自报即通过 | 独立 reviewer 重算 schema/semantic/hash/denominator |
| F09 | blocked/degraded 被计 success | expected class 与 terminal state 逐样本核对 |
| F10 | cleanup 仅看日志声明 | 进程/profile/path/socket/task artifact 实际枚举 |
| F11 | 局部测试支持全局声明 | A01..A20 固定总分母和 PRD coverage matrix |
| F12 | 审计结论扩大到其他门户/V4 | allowlisted final claim exact match |

V3-7 reviewer 不得运行旧 generator 覆盖候选，不得修复文件后继续同一审查，也不得把无法读取的 private artifact 默认为通过。
