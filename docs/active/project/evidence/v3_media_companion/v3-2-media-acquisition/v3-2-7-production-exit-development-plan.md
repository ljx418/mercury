# V3-2-7 单 run 生产出门开发计划

日期：2026-10-08。状态：`V3-2 LIMITED PASS / EXTERNAL INDEPENDENT AUDIT PASS`。正式候选为 `v3-2-production-20261007T174158Z`；原单父 run、12 页和候选生成时的 pending/false 边界不变。独立审查见 `v3-2-7-independent-implementation-exit-audit.md`，结论 Fatal=0/Major=0/Minor=0。

## 1. 目标

从全新 build、Chrome profile、Runtime、task root 和 Revision 3 registry 开始，在同一 run 完成 12 个真实 B站样本、四视口、真实 capture、三个全长 SenseVoice、故障引用、清理、public/private 分离和 seal。候选必须保持 `independentAuditStatus=pending`、`v3_2Passed=false`，只有不同 session 独立复算后才能形成 V3-2 LIMITED PASS。

## 2. 工具实体

| 实体 | 目标路径 | 责任 |
|---|---|---|
| `v3-media-transcript-production-runner.mjs` | `apps/chrome-extension/e2e/` | 生命周期编排；真实 Chrome 操作；不判定最终 PASS |
| `v3-media-transcript-collector.mjs` | 同目录 | 原始 CDP/Runtime/截图/文件 index；不补写业务事实 |
| `v3-media-transcript-verifier.py` | `services/local-runtime/scripts/` | A01..A20、12 页和合同语义独立复算 |
| `v3-media-transcript-package.py` | 同目录 | public/private 分类、canonical seal、manifest 和审计包 |
| `v3_media_transcript_exit_v1.schema.json` | contracts | UI/Fault/ExitCandidate 机器合同 |

## 3. 唯一 run 流程

1. 固定 snapshot/build/dependency/model/Revision 3 hashes。
2. 创建全新 profile/runtime/db/task root；前置回归不得跳过。
3. 按 registry 顺序执行 12 页：6 subtitle、3 ASR、1 multipart、1 restricted、1 low-signal。
4. 在同 run 完成 3 个全长 SenseVoice 和至少 1 个真实 trusted capture。
5. 重放 V3-2-5 UI 四视口和 V3-2-6 fault matrix 的 sealed receipts；不得复制旧 run 产物。
6. 清理所有进程/profile/task root，执行 secret/path/residual scan。
7. 生成 ExitCandidate、artifact index、seal 和不超过 20 文件外审包后停止。

## 4. 子阶段

`2-7-0` 合同/tooling 冻结；`2-7-1` lifecycle/collector；`2-7-2` 12 页成功矩阵；`2-7-3` UI/capture/ASR；`2-7-4` fault/cleanup；`2-7-5` verifier；`2-7-6` package/seal；`2-7-7` PRD review 与独立出门审计。

## 5. 停止条件

任何 URL/分类漂移、授权失效、跨 run artifact、skip prerequisite、fixture/mock、分母不足、secret/path/residual 命中、cleanup 未完成、候选提前 PASS、或审计 Fatal/Major 出现时，本 run 作废且不可补 seal。

## 6. 允许声明

独立审计通过后最多声明“V3-2 在冻结的 12 个 B站样本上完成受控字幕/媒体获取、SenseVoice transcript 和可信 capture 回退”。不得声明 OCR/VLM、VideoOutline、Media Mindmap、Ask、V3 完成或其他门户 ready。
