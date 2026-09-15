# T03 实施风险停止：T02.3 Runtime offline 边界包含成功响应

日期：2026-09-14。阶段：T03-4 T02.3 replay。决定：`STOP / REPLAN`。

## 1. 停止事实

T03-0/T03-3 回归、T03-1 reader 和 T03-2 DerivedFacts replay 均通过。T03-4 使用 `t02-r2-status-contract-production-input-20260914T001017` 执行共享 production validator 后，唯一机器失败为：

```text
PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION
```

raw 的 offline fault interval `1330..1370` 内，request sequence 1331 对 `/v1/knowledge/status` 得到 sequence 1332 的 HTTP 200 `runtime_response`；其余 17 个请求得到 transport failure。该事实与“offline interval 内不存在 Runtime response”冲突。

## 2. 自审结论撤回边界

`../t02.3-status-contract-recollection/self-audit-2026-09-14.md` 的 T02.3 limited PASS 结论被本记录撤回为：

```text
T02.3 raw/schema/status-shape collection: historical local candidate evidence
T02.3 as T03 production-positive base: REJECTED
```

原文件、raw、seal 和 hash 保持不变，作为审计历史和 T02.4 负回归。不能把它继续解释为 T03 正基线。

## 3. 根因

R2 runner 在发出 `SIGTERM` 前先调用 `collector.startFault(runtime_offline)`。进程关闭与 CDP 网络事件排空存在时间窗口，一个在途 status 请求成功返回并被纳入 fault interval。T02.3 verifier 只覆盖 203 个成功 Status 的 Schema shape，没有重算 offline interval 的 terminal kind，导致自审漏检。

## 4. 最小修复路线

建立 `T02.4 Runtime Offline Boundary Recollection`：

1. Runtime 退出并排空关闭前在途观察后，才写入 `fault_start`。
2. seal 前逐个 offline request 验证恰有一个 `transport_failure`，且 response 数为 0。
3. verifier 独立重算同一规则；旧 T02.3 必须稳定失败 1 个边界错误。
4. 创建新 snapshot/run/build/profile/runtime/database，完整真实 Chrome 重采，不复用任何旧分母。
5. 新 run 通过后再从 T03-1 生成全新 DerivedFacts/Validation。

## 5. 门禁

```text
T02.3 self-audit limited PASS: RETRACTED AS T03 POSITIVE BASE
T02.4 implementation: NO-GO / PENDING USER APPROVAL
T03-4: FAIL / STOPPED
T03-5..7: NO-GO
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```
