# V3-2-0b-5 第六轮 metrics 权限补漏

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T063012Z`  
结论：`INVALIDATED AFTER INTERNAL AUDIT / NOT AN ACCEPTED RUN`

三样本真实推理与隔离全部成功；Linux private root=0700，WAV/candidate/handoff=0600。内部审计发现 `/usr/bin/time` 直接创建的三个 metrics JSON 受默认 umask 影响为 0664。metrics 仅含资源数值，不含正文/Cookie，但仍属于私有资格目录，因此不得放宽 B05-13。

修复：每个 worker 完成后在读取 metrics 前执行 chmod 0600 并复读 mode；失败立即拒绝。该 run 自报 `passed=true` 已由 `invalidated.json` 撤销，所有私有输入/输出删除，不得拼接。
