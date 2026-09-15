# T02.3 故障状态合同修复与全量真实 Chrome 重采开发计划

日期：2026-09-13
状态：`USER APPROVED / IMPLEMENTATION AUTHORIZED`

## 1. 目标

T03-4 对 sealed T02.2 raw 的 179 条 Knowledge Status observation 进行离线 Schema 校验时发现 7 条受控故障响应使用非法 `userAction=retry`。T02.3 只修复 R2 故障注入器和证据校验链，不修改产品组件、Runtime、公开 API、Knowledge Status Schema、RuleId 或验收阈值。

冻结映射：

```text
adapter_blocked          -> configure_adapter
data_service_unreachable -> reconnect
source_failed            -> retry_source_build
```

## 2. 允许修改范围

| 实体 | 目的 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 使用封闭故障策略；采集期间记录所有成功 Status 响应；seal 前 fail closed |
| `apps/chrome-extension/e2e/lib/v2PxKnowledgeStatusEvidence.mjs` | 封闭映射、响应解析、离线 Draft 2020-12 批量校验、旧 raw 复核 |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | canonical 映射、合法/非法 Status 与原始字节回归 |
| 本阶段 verifier、readiness、计划、验收与 evidence | 独立重算 T02.2 失败和 T02.3 成功 |

明确禁止修改产品前端、Runtime、Adapter、data_service、合同 Schema 和旧 T02/T02.1/T02.2 run。

## 3. 实施算法

1. 故障状态由 `faultType` 查封闭策略生成；未知 fault 立即失败，不提供默认动作。
2. 每个成功 `/v1/knowledge/status` response 在原始响应字节写入 artifact 后登记；JSON envelope、`ok=true` 和 `data` 均必须存在。
3. 所有登记值通过本地 `v2_knowledge_status.schema.json` 及同目录 `$id` registry 批量校验；不得访问网络。
4. 校验结果作为 public artifact 落盘。错误数非零时先生成 diagnostic，再退出；不得调用 raw collector `seal()`。
5. 使用新 snapshot、runId、build、profile、Runtime、数据库和证据根完整重采，不跨 run 拼接。

## 4. 执行顺序

1. 先写测试并证明非法 `retry` 被拒绝、三类 canonical payload 通过。
2. 证明旧 T02.2 raw 的成功响应可稳定重算为 `checked=178/errors=7`；T03 加入 Runtime offline 前端推断后仍应为 179 条派生观察。
3. 执行 build、typecheck、collector、前端、Runtime 和 T01 Chrome 前置。
4. 创建 `t02-r2-status-contract-production-input-<timestamp>` 完整真实 Chrome run。
5. 对新 run 重算 T02.2 全部分母和 T02.3 状态分母；本地两轮 PRD/架构/false-green 审计后生成候选。
6. 清空并重建最多 20 文件的平铺外部审计包；独立审查 Fatal=0/Major=0 后更新 T03 基线。

## 5. 停止条件

需要修改冻结合同或产品行为、任何前置测试失败、Status errors 非零、真实 Chrome/Axe/Keyboard 失败、分母减少、raw/seal/hash/privacy/cleanup 失败、旧 run 字节变化或本地审计出现 Fatal/Major 时立即停止。失败 run 不封存、不补写、不拼接。
