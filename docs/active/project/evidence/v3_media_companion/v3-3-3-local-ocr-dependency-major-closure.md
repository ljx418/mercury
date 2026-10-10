# V3-3-3 OCR 依赖 Major 关闭记录

日期：2026-10-08。

## 关闭对象

实施前审计 M-1：默认 Python 缺少冻结 RapidOCR 依赖，禁止开始产品适配器实现。

## 关闭证据

- 使用 `services/local-runtime/.venv/` 隔离环境安装仓库 `requirements.txt`，未破坏系统 Python。
- `rapidocr==3.9.2`、`onnxruntime==1.28.0`、`opencv-python==5.0.0.93` 的 distribution metadata 精确匹配。
- 三份 wheel 内资产 byte/hash 精确匹配 `v3-3-rapidocr-manifest.json`：
  - det：9,929,594 bytes，`090f04...ff94f`
  - rec：21,234,383 bytes，`6f3272...14884`
  - cls：585,532 bytes，`e47ace...d6215c`
- 冻结引擎真实 self-test 在网络 connect 强制拒绝下识别生成帧成功。
- `scripts/start_companion.sh` 优先使用隔离 Python；根目录 Windows 快捷方式重启后进程命令为 `services/local-runtime/.venv/bin/python -m navia_runtime.companion`，健康接口 HTTP 200。

结论：M-1 CLOSED。Fatal=0，Major=0，允许执行 V3-3-3 产品适配器及真实单样本验收。

