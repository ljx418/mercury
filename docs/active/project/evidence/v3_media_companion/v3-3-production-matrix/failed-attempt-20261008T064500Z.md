# V3-3-6 首次真实生产矩阵失败记录

日期：2026-10-08。runId：`v3-3-vision-production-20261008T064500Z`。

## 事实

- 使用冻结 registry，从样本 1 开始执行真实 B 站媒体获取、抽帧、本地 OCR 和固定 cloud target 的 MiniMax 调用。
- 一个固定 cloud target 的 MiniMax 请求在 60 秒读取期限内未返回，适配器按 `VISION_TIMEOUT` fail-closed。
- run 未生成 `run-result.json`、未生成 seal，公开 run 目录为空。
- `/tmp/navia-v3-vision-production-20261008T064500Z` 私有工作目录已完全清理。
- 未切换 Provider/模型，未减少 10 个样本或 8 个 cloud target，未从 V3-3-1..5 或其他 run 拼接结果。
- 一条 OCR 空结果告警不构成失败：OCR 管线完成且 typed observation 合法；本次失败原因仅为 Provider 读取超时。

## 决定

`FAILED / REPLAN / NO CROSS-RUN REUSE`。

允许在保持 Provider、模型、请求、预算、样本与验收分母不变的前提下，把单次生产超时修订为 120 秒，并以全新 runId 从样本 1 重跑。旧命名空间只作为失败历史保留，禁止补写 seal 或作为新 run 输入。
