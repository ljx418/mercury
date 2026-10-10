# V3-3-6 第三次真实生产矩阵失败记录

日期：2026-10-08。runId：`v3-3-vision-production-20261008T065233Z`。

## 事实

- 在 60 秒冷却后，以全新 namespace 从样本 1 执行，仍收到 MiniMax HTTP 529。
- run 无 result/seal，私有目录已清理，不复用任何局部结果。
- 随后的隔离诊断以同一凭据、端点、模型、prompt 和冻结样本 1 的 737,005 字节真实 PNG 请求成功返回 HTTP 200。
- 中性图探测也返回 HTTP 200；因此凭据、区域、模型图像能力、真实帧尺寸和请求格式均不是持续性阻塞。
- 失败模式与 MiniMax 官方说明的动态限流/约一分钟恢复一致，风险集中在自动化矩阵的连续 dispatch 节奏。

## 决定

`FAILED / RATE-PACING REPLAN / NO CROSS-RUN REUSE`。

不得增加自动重试或缩小分母。允许在相邻云视觉 dispatch 之间加入固定 65 秒客户端节流；每个样本仍只 dispatch 一次，任一非 2xx 仍令整轮失败。
