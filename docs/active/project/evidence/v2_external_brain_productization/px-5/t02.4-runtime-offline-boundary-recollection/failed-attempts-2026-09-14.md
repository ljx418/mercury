# T02.4 失败执行隔离记录

日期：2026-09-14。结论：三次失败执行均无 seal，cleanup 4/4；不得作为正例或与成功 run 拼接。

| runId | 快照 | 失败点 | seal | cleanup |
|---|---|---|---|---|
| `t02-r2-runtime-offline-boundary-production-input-20260914T093148` | `4356acf` | T01 前置误回退到缺少 `libnspr4.so` 的 Linux Chromium | 无 | 4/4 |
| `t02-r2-runtime-offline-boundary-production-input-20260914T093607` | `4356acf` | `scenario_forget_2_reload` 两个准备导航请求未收敛 | 无 | 4/4 |
| `t02-r2-runtime-offline-boundary-production-input-20260914T094241` | `4356acf` | 同一场景一个准备导航请求未收敛 | 无 | 4/4 |

处理：显式复用已验证的 Windows Chrome-for-Testing；对 reload/back 准备导航增加真实错误页等待和观察队列 drain，不伪造终态。修复后快照为 `990eb47d494bb11c2f9fe1e427fbf4db066a51ab`。

成功候选仅为 `t02-r2-runtime-offline-boundary-production-input-20260914T095030`。失败目录保留诊断与 cleanup，不含 `raw/raw-run.json`。
