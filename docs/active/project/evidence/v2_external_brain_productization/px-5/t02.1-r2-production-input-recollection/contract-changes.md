# T02.1 合同变更

日期：2026-09-12

## 1. 产品合同

```text
NONE
```

Workspace、Runtime HTTP、Adapter、Knowledge Status、Permission、Forget、稳定 ID、route path 与 G1-G7 分母均未改变。

## 2. 原始证据合同

`v2_px_raw_run.schema.json` 的 `route_observation.payload.errorCode` 已冻结为：

```text
INVALID_ROUTE
WORKSPACE_NOT_FOUND
SOURCE_NOT_FOUND
FORBIDDEN
```

该字段只记录真实 Route A 错误页观察，不新增产品错误语义。无错误的 route observation 继续不携带该字段；未知字符串被 Schema 拒绝。

## 3. 只读 readiness 口径

`audit-t03-input-readiness.py` 现在先收集 canonical error，再解析 Knowledge route；因此 `#/foreign` 的 `INVALID_ROUTE` 不会因缺少 canonical routeIntent 而被漏计。有效 recovery 仍必须同时存在：

```text
错误 route observation
对应 <errorScenario>_recovery
isTrusted=true 的 button:返回来源库 动作
mode=recovery 的 Source Library observation
```

这是审计器缺陷修复，不放宽任何分母。旧 accepted run 仍稳定输出原 4 个 Major。
