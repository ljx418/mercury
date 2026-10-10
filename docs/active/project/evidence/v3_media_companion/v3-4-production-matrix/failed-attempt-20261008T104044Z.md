# V3-4 真实运行失败记录：20261008T104044Z

日期：2026-10-08。状态：`INVALID / NO SEAL / DO NOT REUSE`。

## 事实

- runId：`v3-4-outline-production-20261008T104044Z`。
- 在 `v3-sample-01` 创建采集临时文件前失败，错误码为 `V3_MEDIA_TEMP_FILE_MODE_INVALID`。
- 根因：私有运行目录位于 WSL 的 `/mnt/c` NTFS 挂载；请求 `0700` 后实测目录模式仍为 `0777`，不满足 `TaskArtifactSandbox` 的私有目录硬门槛。
- 未完成任何媒体下载、ASR、OCR 或云视觉调用；媒体/帧/开发截图残留计数为 `0`。
- 未生成 `run-result.json` 或 `run-seal.json`，不得把本次尝试拼接进后续候选。

## 处置

1. 删除本次空公开 run 目录与 `.navia/private/...` 临时目录。
2. 保持公开 evidence 目录不变；新 run 使用 WSL ext4 私有目录 `/tmp/navia-v3-4-private/<runId>`。
3. 从 12 项固定分母的第一项重新执行，所有采集、转写、截图、视觉与提交均重新产生。

## PRD 检视

该失败不改变 V3-4 的用户体验、状态合同、固定样本分母或隐私边界，仅修正验收运行的私有文件系统位置。不得放宽目录权限检查。
