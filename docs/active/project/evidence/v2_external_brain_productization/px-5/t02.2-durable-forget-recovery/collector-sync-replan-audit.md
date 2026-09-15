# T02.2 采集同步修订实施前审计

日期：2026-09-12
状态：`LOCAL PASS / IMPLEMENTATION CONTINUES WITHIN APPROVED SCOPE`

## 1. 触发原因

四个独立 Windows Chrome run 在第一条 Forget 后均留下 `/v1/knowledge/status` 与 `/v1/knowledge/workspaces` request、无 bridge terminal，并由 collector 在 30 秒后拒绝。失败目录 cleanup 均通过且无 seal。BrowserContext 监听的最后一次诊断显示响应存在，但读取 body 时页面已经关闭，证明 orphan 来自更早被关闭的临时 `reopen` 页面，而不是当前 Forget recovery 或 Runtime 缺少响应。

## 2. 方案审计

| 检查 | 结论 |
|---|---|
| 是否修改产品行为 | 否；只修改 E2E runner/helper/test 和证据文档 |
| 是否修改 Runtime/API/Schema | 否 |
| 是否伪造终态 | 否；不新增网络 fallback，仍只记录产品 E2E message bridge 的原始 observation |
| 是否允许按 URL 猜测 | 否 |
| 是否使用后续探测替代原请求 | 否 |
| 是否可能双终态 | 否；终态仍只有既有 bridge 一个来源 |
| 是否弱化 exact-one-terminal | 否；页面关闭前无法 settle 时仍超时失败 |
| 是否保留真实 response bytes | 是；沿用 bridge 原始 response bytes 与既有 artifact 写入 |
| 是否覆盖生命周期缺陷 | 是；所有 route 场景与 Forget recovery 在切换/关闭页面前强制 settle |
| 是否需要全量重采 | 是；新 snapshot、新 build/profile/runtime/database/raw/seal |

## 3. 风险与控制

- route observation 后必须立即 settle，避免 UI 请求跨 scenario 归属。
- `reopen` 临时页必须在 settle 成功后关闭；settle 超时则 run 失败且不得 seal。
- 不允许 BrowserContext/Page 网络监听成为第二终态源，也不允许从 HTTP 状态补写 bridge observation。
- 生命周期修复不证明 T03/PX-5 通过；仍需全量 verifier、PRD 检视和独立审查。

## 4. 审计结论

```text
Fatal: 0
Major: 0
Minor: 0
Collector sync implementation: GO within T02.2 frozen scope
T03: NO-GO
```
