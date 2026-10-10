# V3-2-5..7 Transcript 产品化与出门文档内部审计

日期：2026-10-06。范围仅为文档、机器合同和测试，不运行产品 UI、Chrome capture 或 12 页生产矩阵。

## 0. 决定

`DOCUMENT CANDIDATE READY FOR EXTERNAL AUDIT / IMPLEMENTATION NO-GO`。

文档自身 Fatal=0/Major=0/Minor=2。继承阻塞不因本审计关闭。

## 1. 完整性

| 阶段 | 开发计划 | 验收 | 威胁模型 | 预审 | 合同 |
|---|---|---|---|---|---|
| V3-2-5 | `2-5-0..7` | A01..A14 | 双容器/捕获/取消/秘密 | Major2 | ProductUiAcceptance |
| V3-2-6 | `2-6-0..7` | A01..A12 + F01..F14 | test hook/终态/清理 | Major2 | FaultMatrix |
| V3-2-7 | `2-7-0..7` | 总 A01..A20 | single-run/seal/候选 | Major3 | ExitCandidate |

## 2. PRD/架构一致性

- V3-2 仍只交付 transcript，不提前进入关键帧/OCR/VLM、VideoOutline、Mindmap、Ask、历史或导出。
- Side Panel 与 Workspace 只读同一 Runtime task；捕获仍需真实用户点击。
- 12 页保持 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low-signal。
- SenseVoice 为 development baseline，Tiny 只作技术兜底；跨模型质量回退留在 V4。
- H01..H10 不提前，仍只在 V3-5 自动门槛后执行。

## 3. 机器复算

- `v3_media_transcript_exit_v1.schema.json` Draft 2020-12 meta-validation PASS。
- 三个 positive receipt 通过 Schema 和语义复算。
- 新合同专用测试 19 passed；与 V3-3..7 合同联合定向回归 55 passed；Runtime 全量 407 passed in 41.82s。
- 新合同负例覆盖秘密/路径/过度声明、四视口/状态缩减、双终态/后写/残留、故障重复、12 页缩减/重分类/跨 run、缺 capture/ASR 和候选提前 PASS。
- 首轮 positive fixture 的 private index hash 少两个字符，被 Schema 正确拒绝；修复 fixture 后 19 passed，未放宽 SHA-256 规则。

## 4. 防假绿

1. UI receipt 不能以组件测试替代四视口真实截图和 Runtime task read。
2. FaultMatrix 每个 F 项独立 task，汇总 14/14 不能替代逐项 receipt。
3. ExitCandidate 固定 false/pending，不可自我批准。
4. 12 个 sampleId/sourceIdentity/URL hash 必须唯一且分类精确。
5. public/private、secret=0、residual=0 和 seal 不能省略。

## 5. 继承 Major

1. V3-2-2 有效授权会话和 Revision 3 尚未通过。
2. V3-2-3 全长 ASR、V3-2-4 trusted capture 尚未实施出门。
3. V3-2-5/6/7 需按顺序外审和实施；runner/collector/verifier/package 尚不存在。

## 6. Minor

- M-1：V3-2-5 最终 Workspace router 文件名需按实施时基线冻结。
- M-2：外部 Claude CLI 上一轮曾无输出终止，本报告不能代替组织独立审查。

## 7. 结论

此前最薄弱的 V3-2-5..7 已升级为实施级文档候选，足以提交外部审查；不允许因此越过 V3-2-2..4 或进入代码实施。
