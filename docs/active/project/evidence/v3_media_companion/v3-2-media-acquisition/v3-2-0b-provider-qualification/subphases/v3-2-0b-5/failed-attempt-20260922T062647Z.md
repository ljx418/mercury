# V3-2-0b-5 第四轮 systemd 相对路径错误

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T062647Z`  
结论：`INVALID / NOT AN ACCEPTED RUN`

三个真实音频与网络/GPU隔离探针通过，首个 worker 的 systemd 命令返回 125。诊断发现 runner 把 CLI 中的相对 `worker/install/repo/private` 路径传入 transient service；service 工作目录不属于合同，导致命令不可执行。

使用相同私有 WAV、相同模型和相同隔离属性，但把所有路径转为 `resolve(strict=True)` 后，诊断 worker exit 0：14 segments、626 chars、0..119980ms、8.07s、peak RSS 310584 KiB、CPU affinity 0..7、address-space 8 GiB。该诊断只证明根因，不计 accepted run；第四轮全部私有输出在重跑前删除。
