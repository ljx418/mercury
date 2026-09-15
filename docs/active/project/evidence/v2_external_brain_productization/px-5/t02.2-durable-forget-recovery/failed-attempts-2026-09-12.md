# T02.2 失败执行与采集同步修订记录

日期：2026-09-12
状态：`FAILED RUNS / UNSEALED / EXCLUDED FROM CANDIDATE`

## 1. 失败执行

| runId | snapshot | 失败位置 | 结果 |
|---|---|---|---|
| `t02-r2-durable-forget-production-input-20260912T160946` | `36f5a6f67a11ab1090d115599d1d038793645382` | T01 prerequisite | Linux Playwright Chromium 缺 `libnspr4.so`；未进入 R2，cleanup 通过 |
| `t02-r2-durable-forget-production-input-20260912T161500` | 同上 | 第一条 Forget 后回库 | `/knowledge/status` 与 `/knowledge/workspaces` request 无 terminal，30s 后 fail closed；cleanup 通过 |
| `t02-r2-durable-forget-production-input-20260912T163000` | 同上 | 同一位置 | 相同两个 endpoint 的 request 无 terminal，稳定复现；cleanup 通过 |
| `t02-r2-durable-forget-production-input-20260912T170000` | `7b7629b7d5ebbcf787e56e64200868001132b1f0` | 同一位置 | Page 级 Playwright 网络监听未覆盖该扩展请求；仍 fail closed，cleanup 通过 |
| `t02-r2-durable-forget-production-input-20260912T173000` | `249c8f62e213548a7b341f8e389e7cbc836414be` | 同一位置 | BrowserContext 已收到响应，但临时 page 已关闭导致 `response.body()` 失败；仍 fail closed，cleanup 通过 |

五次执行均没有 `raw/raw-run.json` 和 seal，不得进入候选、拼接或作为通过证据。后四次使用真实 Windows Chrome，排除了首轮 Linux Chromium 依赖问题。

## 2. 根因边界

产品页面能完成 Forget 并进入 Source Library。对失败事件的 scenario/navigation 反查发现，两个 orphan 来自路由矩阵中已经关闭的临时 `reopen` 页面；页面关闭前没有排空 UI 产生的 observation。后续 BrowserContext 诊断捕获到对应响应，却因目标页面已经关闭而不能读取 body，进一步排除了 Runtime 无响应。

不能采用：根据 HTTP 路径补 200、发第二个探测请求替代原请求、删除 orphan、延长到无限等待或降低 exact-one-terminal 规则。

## 3. 同范围修订

runner 保持 E2E message bridge 为唯一 observation 来源。在每个 route matrix 场景完成后、每个 Forget recovery 完成后，立即执行 `drainR2ObservationsUntilSettled()`；`reopen` 临时页只在 settle 成功后关闭。此前试验性的 Page/BrowserContext 网络 fallback 被删除，不进入候选实现。

该修订只影响 E2E collector，不修改 Workspace 产品组件、Runtime、Adapter、API、Schema 或门槛。修订后必须创建新 snapshot 和新完整 run；上述失败目录保持隔离。
