# V3-2-1 Threat Model

日期：2026-09-22

| 威胁 | 控制 | 验收 |
|---|---|---|
| 任意路径读写/删除 | caller 只给逻辑 kind；随机目录；`resolve/lstat` 与 root containment | traversal/absolute/link 负例 |
| 利用 owner cleanup 删除用户目录 | 只扫描 root 直接子目录；拒绝 symlink；manifest schema+owner marker+directory token 全匹配 | unknown/invalid/link 均保留 |
| 跨 task artifact 复用 | 每个 ref 绑定 task 与随机 sandbox；内部 path 不进入 API | 跨 task lookup 拒绝 |
| 部分写入/磁盘超额 | `.part` 0600，写前/写后配额，hash 后原子 rename | 超额无半成品 |
| 取消假成功 | cancel hook -> close handles/process -> cleanup scan -> terminal | hook/残留失败不得 cancelled |
| Cookie/账号进入公共状态 | coordinator 不接收 credentials/Cookie/path；只可记录公开 leaseId | additional field/secret scan |
| 并发双终态 | coordinator lock、单 task 单 cancel token、terminal idempotency | 并发 create/cancel 回归 |
| 重启幽灵文件 | startup owner-manifest recovery，删除后才接受新任务 | 重建 coordinator 真实验证 |

本阶段不持有 downloader、ffmpeg、ASR 子进程或 capture stream；相应威胁在 V3-2-2..4 继承本清理 barrier 后继续闭环。

