# V3-3-6 真实视觉生产矩阵验收结果

日期：2026-10-08。runId：`v3-3-vision-production-20261008T092933Z`。

结论：`PASS FOR V3-3-6`。M01..M16 全部通过。

| 门槛 | 结果 |
|---|---|
| M01/M02 冻结输入与样本 | registry SHA-256 `42c745d9...feb95`；10 个固定 sample，6+3+1 |
| M03/M04/M05 真实媒体/采样/帧 | 10/10 当前 B站 8 秒媒体；10/10 确定性 sampling；最长边均 <=1280 |
| M06 本地 OCR | 10/10 完成；RapidOCR 网络 dispatch=0；允许合法空 blocks |
| M07/M08 云分母 | 固定前 8 个 MiniMax-M3 8/8；后 2 个 dispatch=0 |
| M09/M10 治理 | 每目标单图、每 task 本轮一次；授权前/撤销后 dispatch=0 |
| M11/M12 receipt/cleanup | 10/10 Schema-valid；10/10 residual=0、pending=0；最终 private root=0 |
| M13 公开边界 | 无 raw frame/caption/绝对路径；API key/Cookie 原值与敏感模式扫描 0 hit |
| M14 单 run | 仅本 run 计数；四个失败 run 均 0 文件、无 seal |
| M15 回归 | Runtime 616；Extension 47 files/317 tests；typecheck/build PASS |
| M16 PRD/独立复算 | 无缩分母；verifier 正例 PASS、语义负例拒绝 |

哈希：result=`c63ac81261b5b82d8b9b91becfe8f9e3891077b7965537ecfe26dba1f057381e`；seal=`ab99a529cfcb9d22e31018367587112810883e7da24bc389a904600d0c835645`；content=`81b6b4a3fdfa0d1e5a05d15a083bd8c72f4c8f8e82c1525bbce0e7b1258208de`。

说明：高峰期 529 的四次失败保留为风险证据；成功 run 在非高峰从样本 1 全新执行，没有跨 run 拼接。
