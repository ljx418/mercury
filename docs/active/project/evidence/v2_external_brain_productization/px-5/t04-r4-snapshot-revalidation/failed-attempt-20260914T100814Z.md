# T04 正式候选失败记录：Windows Chrome 使用 WSL profile

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t100814z`  
状态：`VOID / NOT SEALED / NOT ELIGIBLE FOR T04 EVIDENCE`

## 事实

- 修复后的隔离 Python venv 已跨过上一轮故障；Runtime 全量测试不再触发 300 passed/6 failed/1 error。
- T04-3 在 T01 真实 Chrome 前置中失败：`Chrome did not expose CDP`。
- 原始 `chrome.log` 同时记录 DevTools 曾监听以及 Windows Chrome 对 `\\wsl.localhost\...\tmp\...\fresh-profile-root` 的 cache/network sandbox 授权失败，随后 network service 崩溃。
- cleanup manifest 为四项 true，系统进程复核无 Chrome、Runtime 或 fixture server 残留；该 run 未产生 sealed fresh raw。

## 独立复现

使用同一 `203c6991...` detached snapshot、相同 Chrome 与 extension build，只把全新 T01 profile root 移到 `/mnt/c/workspace/` 的 Windows 挂载盘，T01 runner exitCode=0。该结果证明失败来自跨 WSL/Windows 的 profile 文件系统边界，不是产品交互或 T01 assertion 失败。

## 处置

只修改 T04 runner：T04-3 为 Chrome profile 使用仓库外、runId 唯一的 Windows 挂载盘目录；运行结束后强制递归删除并验证目录不存在。源码、Extension build、Runtime、数据库、raw/output 仍来自 detached snapshot 与 T04 隔离目录；不复用任何历史 profile 或 artifact。

实现文件已变化，本 run 永久作废。新 run 必须从 T04-0 重建，禁止复用本轮 T04-0/1/2 输出。
