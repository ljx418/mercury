# V3-2-0b-5.1 失败尝试：20260922T071435Z

状态：`INVALIDATED / DO NOT REUSE`

首个 worker 在模型启动前因 systemd 最小环境缺少 `PYTHONPATH=<repo>/services/local-runtime` 而触发 `ModuleNotFoundError: navia_runtime`。没有候选转写可验收。

最小修复：显式传入与原 0b-5 runner 相同的 HOME/LANG/LC_ALL/PYTHONPATH/CUDA_VISIBLE_DEVICES 环境。新 run 从三个样本全量重跑，不复用已复制 WAV 或任务目录。
