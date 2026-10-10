# V3-2-0b-5 第五轮 DrvFS 私有权限失效

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T062816Z`  
结论：`INVALIDATED AFTER INTERNAL AUDIT / NOT AN ACCEPTED RUN`

三样本真实推理、网络/GPU隔离、时间轴和资源均通过；内部审计发现 `.navia/...` 位于 `/mnt/c` DrvFS，调用 chmod 后私有根和 candidate 文件仍显示 `0777`，违反 B05-13 的根 0700/文件 0600 硬门槛。公开 `result.json` 的 `passed=true` 因未检查文件系统 mode 而构成候选自报假绿，不得使用。

修复：runner 在任何下载前强制复读 root mode=0700，并对 WAV/candidate/handoff 强制复读 mode=0600；新 run 的 private root 移到 Linux 文件系统 `/home/administrator/.navia/v3-asr-provider-qualification-private/<runId>`。本 run 的成功推理不可拼接到新 run，私有数据全部删除。
