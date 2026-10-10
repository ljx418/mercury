# V3-2-0b-5 第三轮 GPU 隔离拒绝

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T062523Z`  
结论：`INVALID / NOT AN ACCEPTED RUN`

三个真实音频窗口已重新下载与 trim，网络地址族拒绝探针通过；GPU 探针发现单独 `DevicePolicy=closed` 的 user service 中 `/dev/dxg` 仍为 readable，因此按 fail-closed 规则在 ASR 前停止。

修复路线：增加 `PrivateDevices=yes`。独立实测显示宿主 `/dev/dxg` readable，而相同 transient service 内节点 absent/denied；候选二进制动态链接仅 libc/libstdc++/libm/libgomp/libgcc，无 CUDA/ROCm。该失败 run 不得拼接，残留私有 WAV 在重跑前删除。
