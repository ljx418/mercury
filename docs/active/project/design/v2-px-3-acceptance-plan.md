# V2-PX-3 验收计划

日期：2026-09-08

## 1. 硬门槛

| ID | 验收要求 |
|---|---|
| P3-A1 | action/route/ID 合同单元测试全部通过，非法组合仍被拒绝 |
| P3-A2 | sender 窗口有 Workspace 时优先复用该窗口；无 sender match 时按 focused window、tabId 稳定选择 |
| P3-A3 | 8 个并发请求只创建 1 tab；模拟 Service Worker 重启后复用已有 tab；关闭后下一次创建新 tab |
| P3-A4 | 每次打开结果保持 requestId/workspaceId/sourceId route 一致，0 次 ingest |
| P3-A5 | poller 立即请求、无重叠、在线 5 秒、离线 1/2/4/8 秒退避、停止后无新请求 |
| P3-A6 | Runtime offline 四域为 offline/null、unchecked、unchecked、unknown；reconnect 后重新读取 Runtime 权威 source/status |
| P3-A7 | Workspace 与 Side Panel 对同一 source 显示相同 sourceId/status/operationId（如存在） |
| P3-A8 | 全量 frontend、typecheck、build、Runtime API、PX-0.2 validator 回归通过 |

## 2. 真实数据

使用当前 `docs/active/project/01-prd.md` 原始字节创建 Runtime source。不得以原型 localStorage、硬编码 `trace_ready` 或 fixture Runtime 替代 reconnect 证据。

## 3. 必需证据

- `px-3-e2e.json`、Chrome 日志和双容器截图。
- focused/full tests、typecheck、build、Runtime API、PX-0.2 validator 日志。
- `prd-review.md`、`architecture-review.md`、`false-green-audit.md`、`independent-audit.md`、`handoff.md`。

## 4. No-Go

- 多窗口随机聚焦或重复创建。
- Background/Workspace 打开导致 source ingest。
- offline 仍展示缓存 `trace_ready` 或伪造下游状态。
- reconnect 只改变 UI 文案而不重新请求 Runtime。
- 修改 Runtime contract、CSP 或 permissions。
