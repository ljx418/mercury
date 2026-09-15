# T02.3 本地验收结果

日期：2026-09-14
结论：`A01-A12 PASS / A13 PENDING / FORMAL PASS FORBIDDEN`

## 1. 机器验收

- `local-verification.json`：34/34，Fatal 0 / Major 0。
- `public-package-verification.json`：34/34，Fatal 0 / Major 0。
- `t03-input-readiness.json`：Fatal 0 / Major 0，`readyForPositiveProductionValidation=true`。
- `knowledge-status-contract.json`：203 checked / 0 errors。
- raw Schema meta/instance、captured collector invariants、canonical seal、artifact index/bytes/references 均通过。
- Runtime exact-one terminal：557 request = 540 response + 17 transport failure，0 orphan/multi-terminal。
- Background exact-one terminal：7 request = 7 response，0 orphan。

## 2. 真实 Chrome 与回归

```text
fresh extension build: exit 0
TypeScript typecheck: exit 0
collector tests: 15/15
frontend tests: 169/169
Runtime tests: 307 passed
T01 real Chrome: 36/36
Axe: violations=[], serious=0, critical=0
Keyboard: 5/5
cleanup: browser/runtime/fixture/profile = 4/4 true
```

## 3. Status 合同闭环

新 run 对全部成功 `/v1/knowledge/status` response artifact 原始字节执行离线 Draft 2020-12 校验。三类受控故障动作分别为：

```text
adapterStatus=blocked -> configure_adapter
dataServiceStatus=unreachable -> reconnect
sourceBuildStatus=failed -> retry_source_build
```

恢复后的正常 Status 使用 `userAction=none`，不冒充故障响应。旧 T02.2 原始字节在同一 checker 下仍精确产生 7 个 `userAction=retry` enum 错误。

## 4. 未关闭项

唯一未关闭门槛为 T02.3-A13 外部独立审查。独立审查前不得改写为 T02.3 PASS，也不得更新 T03 production-positive baseline。
