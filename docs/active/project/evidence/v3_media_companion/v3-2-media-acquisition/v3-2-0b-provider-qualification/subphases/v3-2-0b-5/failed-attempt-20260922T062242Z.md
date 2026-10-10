# V3-2-0b-5 第二轮网络隔离拒绝

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T062242Z`  
结论：`INVALID / NOT AN ACCEPTED RUN`

三个真实音频窗口已完成下载与 trim，但在 ASR 前的网络拒绝探针中，单独 `IPAddressDeny=any` 的 transient user service 仍可通过宿主代理返回 HTTP 200。runner 按 fail-closed 规则停止，未执行任何 candidate worker。

修复路线：增加 systemd `RestrictAddressFamilies=AF_UNIX`，由 seccomp 地址族策略拒绝 AF_INET/AF_INET6；真实 curl 探针返回非零。保留 `IPAddressDeny=any` 作附加防线。该 run 的 Cookie 临时文件和 source media已删除，残留私有 WAV 在重跑前删除，不得拼接。
