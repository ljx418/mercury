# T03-6 验收计划

| ID | 必须结果 |
|---|---|
| T03-6-A01 | ProductionPackage v1 与 InvocationRecord v1 Schema 均通过 Draft 2020-12 meta validation |
| T03-6-A02 | Package 绑定 T02.5 raw 与同一 validation run 的 facts/validation/contract/human/report/html |
| T03-6-A03 | 所有引用 path/hash/length/mediaType 可从对应 root 重算 |
| T03-6-A04 | candidate 固定 automatedCandidatePassed=true、humanReviewStatus=pending、passed=false |
| T03-6-A05 | Package JSON 不包含自身引用或 hash |
| T03-6-A06 | Invocation 恰有 derive/validate/report/package 四个唯一 step，顺序固定且 exitCode=0 |
| T03-6-A07 | Invocation 最后绑定 package；Package 不反向绑定 invocation |
| T03-6-A08 | 修改任一 hash、runId、Human Review/Report 状态或 step 退出码均 fail-closed |
| T03-6-A09 | 公开记录不包含绝对仓库路径、token、profile 或 private artifact bytes |
| T03-6-A10 | 单元、Schema、PRD/架构/false-green 检视 Fatal=0/Major=0 |

固定 10 项，无 N/A；全部通过才允许 T03-7。
