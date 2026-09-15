# T03 实施风险停止：T02.2 故障状态违反 Knowledge Status 合同

日期：2026-09-13。阶段：T03-4 验收 / T03-5 实施前。决定：STOP / REPLAN。

## 1. 停止原因

T03 从 sealed T02.2 raw 派生 179 个 Knowledge Status observation，并使用本地离线 `$id` registry 逐项执行 Draft 2020-12 校验。7 条受控故障响应失败，唯一错误均为：

```text
userAction="retry"
not in none/start_runtime/configure_adapter/configure_data_service/
reconnect/upgrade_data_service/retry_source_build/open_debug
```

分布：adapter_blocked=2、data_service_unreachable=3、source_failed=2。`runtime_offline` 仍正确使用 frontend inference：runtimeStatus=null、adapter/data_service=unchecked、sourceBuildStatus=unknown。

## 2. 根因与边界

根因位于 `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` 的受控故障 route fulfillment；它固定写入 `userAction: "retry"`。这不是 T03 renderer 问题，也不是产品 Runtime 正常响应。T02.2 raw、seal 和独立 PASS 结论保持字节不变，但该 run 不能作为 G5 production-positive base。

不得采用：

- 在 DerivedFacts 或 Report 中把 `retry` 静默归一化；
- 扩大 Knowledge Status 枚举以迁就旧证据；
- 忽略故障 response 的 Schema 校验；
- 把 42/42 mutation 或 109 contract fixture PASS 扩大为 T03 PASS；
- 拼接 T02.2 与其他 run。

## 3. 当前可复现结果

```text
T03-0 contracts: PASS
T03-1 ArtifactReader: PASS
T03-2 DerivedFacts: PASS
T03-3 shared semantic/AST: PASS
T03-4 ProductionValidation: FAIL (Major 1)
  status observations checked: 179
  status contract errors: 7
  production mutations: 42/42 detected
  RuleResults: 60 passed / 1 failed / 2 pending / 0 N/A
  failed rule: PX_RULE_STATUS_COVERAGE_FAILED
  G1-G4: passed; G5: failed; G6: passed; G7: pending
T03-5: draft only / not accepted
T03-6..7: blocked
```

## 4. 推荐恢复路线

返回 R2 建立 T02.3，只修改受控故障注入器的状态动作映射并补测试：

```text
adapter_blocked -> configure_adapter
data_service_unreachable -> reconnect
source_failed -> retry_source_build
```

新 run 必须从零执行 build/typecheck、collector、前端、Runtime、T01 Chrome、Axe、Keyboard、12-source corpus、两条普通 route recovery、三来源 durable Forget 四恢复、四故障和清理；所有 `/v1/knowledge/status` 成功响应必须逐项通过冻结 Schema。旧 T02/T02.1/T02.2 均不得覆盖或拼接。

## 5. 恢复门槛

1. 用户批准 T02.3 限定修复与全新真实 Chrome 采集。
2. T02.3 独立 run 通过完整 R2 分母，Knowledge Status errors=0。
3. 平铺审计包独立复审 Fatal=0/Major=0。
4. T03 preimplementation 基线更新为 T02.3 runId/raw hash/seal/snapshot。
5. T03-1..4 对新 run 重放并通过后，才恢复 T03-5。

## 6. 门禁状态

```text
T02.2 limited PASS: preserved for its reviewed scope
T02.2 as T03 G5 positive base: REJECTED
T03 implementation: STOPPED at T03-4
T03-5..7: NO-GO
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```
