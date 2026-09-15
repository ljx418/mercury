# T02.2 变更清单

日期：2026-09-12

## 1. 实现与验收器

| 文件 | 变更 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 读取真实 RouteError DOM；记录 3×4 Forget trigger/recovery；真实点击返回来源库；每个 route/recovery 后 settle，临时页 settle 后关闭 |
| `apps/chrome-extension/e2e/lib/v2PxRouteEvidence.mjs` | 封闭 canonical route error code，拒绝缺失、未知和 expected/observed 不一致 |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | 增加 route error Schema/invariant 与 DOM error helper 回归 |
| `.../t03-r3-semantic-reporting/audit-t03-input-readiness.py` | 增加同源 durable Forget 12+12、可信恢复、Runtime authority 与顺序验证 |
| `.../t02.2-durable-forget-recovery/verify-t02.2-candidate.py` | 重算完整 T02/T02.1 分母、T02.2 分母、旧 run fail-closed、artifact/seal/privacy/cleanup |

## 2. 证据与文档

新增 T02.2 开发计划、验收计划、两轮实施前审计、失败执行记录、collector 生命周期重计划审计、本地机器结果、PRD 检视、候选结果、本地双轮审计和 handoff。成功 run 位于：

`runs/t02-r2-durable-forget-production-input-20260912T165535/`

五个失败 run 保持 unsealed/excluded；不得放入成功候选。

## 3. 合同与产品变更

```text
Product component changes: none
Runtime / Adapter / data_service changes: none
Public API changes: none
JSON Schema version changes: none
RuleId / requirement registry changes: none
PRD scope changes: none
```

提交历史中曾出现 Page/BrowserContext 网络终态 fallback 试验，但最终候选树已完全删除；它不属于候选实现或权威证据来源。
