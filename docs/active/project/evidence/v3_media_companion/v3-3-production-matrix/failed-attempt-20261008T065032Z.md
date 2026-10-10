# V3-3-6 第二次真实生产矩阵失败记录

日期：2026-10-08。runId：`v3-3-vision-production-20261008T065032Z`。

## 事实

- 本轮使用修订后的 120 秒 timeout、0 retry，并从冻结 registry 的样本 1 开始全新执行。
- MiniMax 中国区 `MiniMax-M3` 返回 HTTP 529，适配器映射为 `VISION_PROVIDER_UNAVAILABLE` 并 fail-closed。
- 失败不是读取超时；120 秒修订没有掩盖远端 529，也没有触发自动重试或 Provider 切换。
- 公开 run 目录为空；无 `run-result.json`、无 seal。
- `/tmp/navia-v3-3-vision-production-20261008T065032Z` 已删除；无 runner、yt-dlp 或媒体残留。
- 未降低 10/10 OCR、8/8 VLM 分母，未跨 run 复用局部结果。

## 决定

`FAILED / TRANSIENT PROVIDER UNAVAILABLE / NO CROSS-RUN REUSE`。

保留 0 retry 合同。允许在冷却窗口后以全新 runId 从样本 1 重试完整矩阵；若 HTTP 529 连续重现，则停止并回到 Provider 可用性路线评估，不以扩大重试次数或拼接 run 达成假绿。
