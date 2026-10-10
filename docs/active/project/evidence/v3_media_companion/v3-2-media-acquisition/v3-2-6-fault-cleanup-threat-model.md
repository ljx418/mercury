# V3-2-6 故障与清理威胁模型

日期：2026-10-06。

| 威胁 | 防线 |
|---|---|
| test hook 泄漏到生产 | 签名 isolated profile + 环境闭集；生产 API/message 无字段 |
| 一个 task 注入多个故障导致归因不明 | F01..F14 独立 task/root/run segment |
| 终态后后台继续写 | terminal sequence barrier + observation/artifact 数量二次采样 |
| cleanup 假绿 | 文件系统、进程、track、socket、DB/trace 多面扫描 |
| orphan recovery 误删用户文件 | owner manifest、root allowlist、lstat/no-follow、外部 hash canary |
| secret 只扫 public tar | task root、日志、DB、trace、retry、public package 双层扫描 |
| 自动重试旧 capture authority | ticket one-shot；断线要求全新 trusted click |

故障恢复只证明失败安全性，不证明生产成功路径或 V3-2 完成。
