# V3-2-3 SenseVoice 全长转写实施前恢复审计

日期：2026-10-07。

决定：`INTERNAL DOCUMENT PASS / IMPLEMENTATION NO-GO PENDING EXTERNAL AUDIT`。

## 1. 已关闭前置

- V3-2-2 Route B3 独立实施出门：`LIMITED PASS`，Fatal=0/Major=0/Minor=3。
- 权威 source run=`v3-2-route-b3-20261007T014759Z`，canonical content SHA-256=`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`。
- 三个固定能力槽位、真实媒体 shape/hash、生产故障不可达和 B3 清理事实已经独立复算。

## 2. 本次修订关闭的问题

1. 旧计划错误依赖 B3 已清理的 task-private 音频；现改为全新单 run 内逐任务 acquisition->ASR，不复用公开 hash。
2. 旧计划称“三个固定无字幕样本”；现与 B3 一致改为“三个固定 ASR 能力槽位”，运行时必须真实走媒体路线，否则整轮重规划。
3. 旧 `speech_interval_overlap/v1` 未定义独立分母；现冻结 FSMN-VAD count 与 SRT count 相等的保守成功条件，count mismatch fail closed。
4. 旧架构未说明 acquisition sandbox 与 native host task root 不同；现冻结 `TaskAudioStager` 流式复制、双 hash/shape 核验和双层 cleanup。
5. B3 Minor M-1/M-2/M-3 已转换为后继约束：负例分组独立 ID、扫描计数字段明确、Cookie 值仅私有扫描。

## 3. 当前审计结论

- Fatal：0。
- Major：0（文档候选层面）。
- Minor：2：
  - m-1：冻结 runtime 的 VAD 只公开总段数而非完整区间；成功门槛被提高为 count 完全相等，可能造成 false negative，但不会造成 false positive。
  - m-2：三个能力槽位的平台字幕状态仍可能漂移；通过 B3 wrapper 允许动态 0+3..3+0 分布，但生产故障不可达、预绑定映射和单次注入必须重新审计。

## 4. 实现前剩余门禁

1. Schema/meta/positive 与 31 项管线合同测试已通过；positive fixture 固定 `segmentCount=speechIntervalCount=24`，count mismatch 负例被语义层拒绝。
2. 内部恢复文档审计已完成，Fatal=0/Major=0；报告为 `v3-2-3-resumption-internal-document-audit-20261007.md`。
3. 仍须重建不超过 20 文件的平铺审计包，完成 Claude Code CLI 独立文档审查，要求 Fatal=0/Major=0。
4. 外审通过前禁止修改产品实现、运行真实 acquisition/SenseVoice 或声明 V3-2-3 开始。

人工验收继续推迟到 V3-5。本阶段禁止请求人类听写或用人工结果生成 transcript。
