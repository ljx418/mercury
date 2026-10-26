# Stage B B-5-1 详细开发计划（Provider 集中授权边界，2026-10-14）

范围：本子阶段只做 Provider 集中授权边界（DEV-2），不进入 Composer、不启动 Chrome/Runtime/Provider、不上传任何媒体或派生文本。

## 1. 范围与不扩展

- 范围：
  - 单任务仅一个权威 Provider（task 级别 receipt 字段补全）；
  - V2.1 receipt 扩展字段：`endpointClass`、`structureMode`、`attemptId`、`latencyMs`、`requestSha256`、`responseSha256`、`finishReason`；
  - V2 receipt 不增加新字段（schema 字节保留）；
  - 失败码分类（unavailable/timeout/empty/malformed/schema-invalid/refusal/authorization-denied）落 `synthesis.py` 与 `service.py`，其中 `refusal` 与 `authorization-denied` 不触发 repair 与 composer、不触发自动 fallback。
- 不扩展：B-5-2（Composer）、B-5-3（fresh run）、B-5-4（自验证与 PRD 检视）、B-5-5（清理）、B-5-6（handoff）、B-5-7（external-audit-package）、跨 Provider 拼接、最佳 N、隐式 fallback、阈值降低、新 Provider 引入。

## 2. 验收门槛（只对本子阶段）

| ID | 描述 | 门槛 |
|---|---|---|
| AR-1 | V2.1 receipt 字段补全 | `providerId/modelId/outboundDerivedTextSha256/requestCount` 与新增 `endpointClass/structureMode/attemptId/latencyMs/requestSha256/responseSha256/finishReason` 共 11 字段全部存在于 V2.1 路径产物 |
| AR-2 | V2 receipt 不增新字段 | V2 路径产物的 receipt 仍仅含 V2 schema 允许的 4 字段 |
| AR-3 | refusal 不进 composer/refair | `V3510B_PROVIDER_REFUSAL` 抛出时直接经 service.py 上抛、进入原始 provider 失败语义；不调用 `repair_v2`、不进 `compose_brief_from_validated_claims` |
| AR-4 | authorization-denied 不进 composer | `V3510B_PROVIDER_AUTHORIZATION_DENIED` 抛出时同上 |
| AR-5 | 单元测试持续 PASS | `pytest test_v3_grounded_comprehension_v2.py` 全部 PASS |
| AR-6 | 文件改动可复算 | quality.py 与 service.py 重算后 SHA-256 + 改动说明在 `stage-b-b5-recovery-preimplementation-audit.md §1` 追加 |

## 3. 风险闭环

| 风险 | 闭环 |
|---|---|
| V2 历史产物 schema 漂移 | `_save_grounded_v2` 路径不改动，仅 `_receipt()` 函数接受新可选字段且 V2 schema 下不写入 |
| Provider 单点回退无兜底 | refusal/authorization-denied 显式上抛 403/401（沿用现有 `_provider_unavailable` 体系）；HTTP 502 路径不变 |
| 旧 pytest 受影响 | _receipt 函数为构造新 schema 形态的扩展点；默认参数行为与原 4 字段一致 |
| 任务级 provider 不能跨任务共享 | task_store 不必新增列；锁定约束在 service.py 接收链路 hard-fail |
| 真实 fresh run 仍 NO-GO | B-5-1 仅落代码改动，不触发 Chrome/Runtime/Provider |

## 4. 详细实施步骤

1. 修改 `quality.py`：
   - `_receipt()` 接受可选的 `endpoint_class/structure_mode/attempt_id/latency_ms/request_sha256/response_sha256/finish_reason`，仅当 `schema_version` 以 `/v2.1` 结尾时写入；
   - 默认参数保证 V2 schema 形态不变（4 字段）；
   - 同步更新 `validate_grounded_comprehension` 调用点。
2. 修改 `service.py`：
   - `_receipt_dict()` 构造 receipt 时一并构造扩展字段；
   - `synthesize` 失败路径补 `V3510B_PROVIDER_REFUSAL` 与 `V3510B_PROVIDER_AUTHORIZATION_DENIED` 的捕获分支，不进入 repair 与 composer。
3. 重算 quality.py / service.py SHA-256 + 字节大小 + mtime，落 `stage-b-b5-recovery-preimplementation-audit.md §1`。
4. 运行 `pytest test_v3_grounded_comprehension_v2.py` 全 PASS。

## 5. 失败码映射（DEV-2 接收边界）

| code | 触发 | 接收门 |
|---|---|---|
| `V3510B_PROVIDER_REFUSAL` | Provider 显式返回 refusal / safety block | 不 trigger `repair_v2`、不进 composer |
| `V3510B_PROVIDER_AUTHORIZATION_DENIED` | 401/403 + 区域 mismatch | 不 trigger `repair_v2`、不进 composer |
| `V3510B_PROVIDER_TIMEOUT` | 服务端超时 | 仍触发最后一次 retry（沿用 synthesis 现有逻辑） |
| `V3510B_PROVIDER_UNAVAILABLE` | 5xx/网络 | 仍触发最后一次 retry |
| `V3510B_PROVIDER_RESPONSE_INVALID` | 解析/缺字段 | 仍触发最后一次 retry |
| `V3510B_BRIEF_LENGTH_INVALID` | brief <20 或 >100 字 | 触发 `repair_v2` 一次（沿用），失败才进 composer |
| `V3510B_BRIEF_RAW_PREFIX` | brief 是 transcript 原文前缀 | 触发 `repair_v2` 一次（沿用），失败才进 composer |
| `V3510B_PROVIDER_RESPONSE_INVALID` schema 子分支 | schema invalid | 不触发 repair、不进 composer |

## 6. 风险与不达预期处置

- 任何一项 AR 不达 → 本子阶段回滚、复查 `_receipt()` 与 `_receipt_dict()` 路径，再实施。
- 文件字节与计划 SHA 不符 → 立即停止、追加说明、决定是否回退。
- 测试 RED → 不进入下一子阶段。

## 7. 出本计划的依赖

- 用户单独下达的"任务级临时选择 DeepSeek 与真实项目派生 transcript/OCR/vision-caption 文本上传"高风险授权已生效（按本会话用户指令）；
- MiniMax 默认 Chat Provider 不被本子阶段改动；
- DeepSeek `selected=false` 不被本子阶段改动。
