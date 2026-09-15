# T02.3 失败执行隔离记录

日期：2026-09-14

## 1. 被排除的 run

| runId | 失败原因 | sealed raw | cleanup |
|---|---|---:|---:|
| `t02-r2-status-contract-production-input-20260913T234443` | Linux Playwright Chromium 缺 `libnspr4.so`，T01 前置失败 | 无 | 4/4 |
| `t02-r2-status-contract-production-input-d-20260913T234858` | 已安装 stable Chrome 未加载 Navia worker，仅观察到其他扩展 | 无 | 4/4 |
| `t02-r2-status-contract-production-input-20260913T235455` | Forget 错误页切换时 Status/Workspace bridge request 未终结 | 无 | 4/4 |
| `t02-r2-status-contract-production-input-20260914T000151` | 同一 bridge request-only 问题稳定复现 | 无 | 4/4 |

前两项通过固定使用已验证的 Chrome for Testing 路径解决。后两项经 `collector-sync-replan-audit.md` 审计后，在可信“返回来源库”动作之前增加 fail-closed settle barrier；没有引入 CDP 网络补写、终态推断或 orphan 删除。

## 2. 候选隔离

成功候选 `...T001017` 从零执行全部 prerequisite、真实 Chrome 采集、seal 和 cleanup。它不引用上述失败 run 的 event、artifact、截图、build、profile、数据库或 seal。

公开包首次构建漏带非私有 `.infra/t01-regression/raw/t01-real-chrome-run.json`，公开 verifier 因此为 33/34。该打包尝试未改变 raw/seal；补入既有 T01 结构化结果后从新目录解包复验为 34/34。只有最终 `public-evidence.tar.gz` 可进入审计包。
