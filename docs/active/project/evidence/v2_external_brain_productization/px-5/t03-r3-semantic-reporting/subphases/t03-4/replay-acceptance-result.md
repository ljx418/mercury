# T03-4 T02.3 ProductionValidation 重放验收结果

日期：2026-09-14。状态：FAIL / REPLAN。Fatal=0，Major=1。

## 已通过项

- Contract regression：109/109。
- Production mutations：42/42 detected，0 例只改 report 布尔值。
- Knowledge Status：203 checked / 0 Schema errors。
- G1/G2/G3/G4/G5/G6 均显示 passed；G7 pending。
- 旧 T02.2 使用同一 validator 稳定产生 7 个 `userAction=retry` enum errors，G5 failed。

## Major：Runtime offline 区间包含成功 Runtime response

T02.3 raw 的 `runtime_offline` 区间为 sequence `1330..1370`。其中：

```text
1330 fault_start(runtime_offline)
1331 runtime_request GET /v1/knowledge/status
1332 runtime_response status=200
1333..1364 后续 runtime_request
1335..1366 对应 transport_failure
```

因此 `PX_RULE_RUNTIME_OFFLINE_AUTHORITY_VIOLATION` 正确失败。最终规则分母为 60 passed / 1 failed / 2 human pending / 0 N/A，`machinePassed=false`、`finalPassed=false`。Status Schema 0 error 只证明响应字段合法，不能证明 fault 区间权威合法。

## 决定

T03-4 replay FAIL；T03-5..7 NO-GO。不得删除事件、修改 sealed raw、放宽 validator、把 1332 response 改写为 failure，或仅修改测试期望。返回 R2 新建 T02.4，完整重采后再从 T03-1 重放。
