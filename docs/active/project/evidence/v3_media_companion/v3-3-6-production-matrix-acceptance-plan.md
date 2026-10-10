# V3-3-6 真实视觉生产矩阵验收计划

日期：2026-10-08。

| ID | 必须结果 |
|---|---|
| M01 | sourceRunId/registry SHA 与冻结输入精确一致 |
| M02 | 样本精确 10，分类 6+3+1，唯一 mediaId/playbackUnitId |
| M03 | 10/10 当前真实媒体下载、task/source/current part/hash 绑定 |
| M04 | 10/10 确定性 sampling，预算 24/12/8，无重复/越界 |
| M05 | 10/10 真实 frame 抽取，最长边<=1280 |
| M06 | 10/10 RapidOCR 本地完成，网络调用 0，typed observation 完整 |
| M07 | 前 8 个固定 cloud target 精确 8/8 真实 MiniMax 成功 |
| M08 | 后 2 个非 cloud target Provider dispatch=0 |
| M09 | 8 次 VLM 均单图、正确 consent decision/sequence、usage/hash 完整 |
| M10 | 授权前与撤销后总 Provider dispatch=0 |
| M11 | 10/10 VisionEvidenceReceipt Schema/semantic PASS |
| M12 | 10/10 task 非证据 residual=0、pending outbound=0、最终 task root 删除 |
| M13 | public package 0 secret/path/raw frame/caption 原文 |
| M14 | run 单一、无旧结果拼接、失败 run 不 seal |
| M15 | Runtime/Extension/V3-1/V3-2 回归全绿 |
| M16 | PRD 检视无范围漂移，独立复算前 final 仍 false |

