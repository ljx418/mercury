# V3-4 真实运行失败记录：20261008T104139Z

日期：2026-10-08。状态：`INVALID / NO SEAL / DO NOT REUSE`。

## 事实

- runId：`v3-4-outline-production-20261008T104139Z`。
- WSL ext4 私有目录权限门槛通过；样本 01 完成真实 B站输入获取和固定片段帧提取后，在本地 OCR 初始化时失败。
- 失败原因为系统 Python 搜索路径不含冻结的 `rapidocr==3.9.2` 安装目标；`onnxruntime==1.28.0` 与 `opencv-python==5.0.0.93` 已存在。
- 本次没有云视觉调用，没有生成 terminal envelope、run result 或 seal。
- finally 清理后原始视频、音频、帧和开发截图残留计数为 `0`。

## 处置

1. 删除本次公开空 run 与私有数据库；不得跨 run 复用样本 01。
2. 新 run 显式把 V3-3 已冻结并验收的 `/tmp/navia-v3-3-rapidocr-spike.L6efjk` 加入 `PYTHONPATH`。
3. 保持 `LocalOcrAdapter` 的依赖版本和模型哈希验证开启，从样本 01 全量重跑。

## PRD 检视

该处置仅恢复已冻结 OCR 运行环境，不改变算法、模型、分母、云上传边界或用户体验，不构成规格降级。
