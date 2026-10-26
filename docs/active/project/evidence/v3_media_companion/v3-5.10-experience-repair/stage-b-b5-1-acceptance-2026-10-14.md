# Stage B B-5-1 子阶段验收（Provider 集中授权边界 DEV-2）

日期：2026-10-14。范围：B-5-1 (DEV-2) — 不进入 Composer、不启动 Chrome/Runtime/Provider、不上传任何媒体或派生文本。仅复算 Provider 集中授权边界。

## 1. 范围与不动边界

不动边界（与 `stage-b-b5-1-detailed-plan-2026-10-14.md §1` 一致）：

- 单任务仅一个权威 Provider（任务级 receipt 字段补全）；
- V2.1 receipt 扩展字段：`endpointClass` / `structureMode` / `attemptId` / `latencyMs` / `requestSha256` / `responseSha256` / `finishReason`；
- V2 receipt 不增加新字段（schema 字节保留）；
- 失败码 `V3510B_PROVIDER_REFUSAL` / `V3510B_PROVIDER_AUTHORIZATION_DENIED` 不进入 repair / composer、不触发自动 fallback；
- HTTP 502 路径不变；无 Cookie/原始媒体/密钥上传扩张；Provider 选择与 Chat 默认一致（MiniMax 默认；DeepSeek 任务级启用仍待用户高风险授权）。

不扩展：B-5-2（Composer）/ B-5-3（fresh run）/ B-5-4（自验证与 PRD 检视）/ B-5-5（清理）/ B-5-6（handoff）/ B-5-7（external-audit-package）/ 跨 Provider 拼接 / 最佳 N / 隐式 fallback / 阈值降低 / 新 Provider 引入。

## 2. 复算指纹（与 `stage-b-b5-recovery-preimplementation-audit.md §1` 对齐）

| 文件 | 当前 SHA-256 | 大小 (B) |
|---|---|---:|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | 20200 |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | 36026 |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | 51764 |

复算命令（在 `<repo_root>` 执行；本会话独立子代理在出门审计前可逐条复算）：

```bash
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py
```

三文件 SHA-256 与审计文档 §1 完全一致，AR-6 **PASS**。B-5-1 期间不发生额外字节变更，复算命令输出可重现。

## 3. AR 逐条核对

| AR | 描述 | 结论 | 证据 |
|---|---|---|---|
| AR-1 | V2.1 receipt 11 字段齐备 | **PASS** | `test_ar1_v2_1_receipt_carries_seven_provider_lock_extras`：以 schema_version=`v3-media-grounded-comprehension/v2.1` + 完整 7 extras 调用 `validate_grounded_comprehension`，断言 `endpointClass` / `structureMode` / `attemptId` / `latencyMs` / `requestSha256` / `responseSha256` / `finishReason` 与 4 原始字段 + 6 上传计数齐全 |
| AR-2 | V2 receipt 不增新字段 | **PASS** | `test_ar2_v2_receipt_preserves_four_field_byte_layout_and_drops_extras`：默认 V2 schema_version + 7 extras 调用 `validate_grounded_comprehension`，断言 7 extras 全部不在 receipt；brief 不含 `origin` / `sourceClaimIds`；4 字段值正确传递 |
| AR-3 | refusal 不进 composer/repair | **PASS** | `test_no_retry_failures_set_includes_refusal_and_authorization`、`test_ar3_provider_refusal_does_not_enter_repair_or_composer`：构造 `V3510B_PROVIDER_REFUSAL`（status=403）的 fake provider，`MediaComprehensionService.synthesize` 重抛同 code，`repair_v2` 调用计数 = 0，`grounded-comprehension-v2.1/<taskId>` 不存在 |
| AR-4 | authorization-denied 不进 composer | **PASS** | `test_ar4_provider_authorization_denied_does_not_enter_repair_or_composer`、`test_ar4_401_unauthorized_translates_to_authorization_denied_without_repair`、`test_ar4_403_forbidden_translates_to_authorization_denied_without_repair`：fake provider 抛 `V3510B_PROVIDER_AUTHORIZATION_DENIED`、MiniMaxGroundedSynthesisProvider 经 httpx mock 返回 HTTP 401/403 三条路径全部翻成 `V3510B_PROVIDER_AUTHORIZATION_DENIED`（status=401，synthesis.py 对 401/403 硬编码翻译）+ `repair_v2` 不被调用 + V2.1 产物未落盘 |
| AR-5 | 单元测试持续 PASS | **PASS** | `test_v3_grounded_comprehension_v2.py` 10 passed（既有回归 GREEN）；本子阶段新增 `test_v3_grounded_comprehension_b5_1.py` 12 passed；合计 22 passed in 1.68s |
| AR-6 | 文件改动可复算 | **PASS** | 见 §2；三文件 SHA 完全匹配审计文档 §1 |

### AR-1 字段语义明细

| 字段 | 来源 | V2.1 必填? |
|---|---|---|
| `providerId` | `quality.py:: _receipt` 强校验 | 必 |
| `modelId` | `quality.py:: _receipt` 强校验 | 必 |
| `outboundDerivedTextSha256` | `quality.py:: _receipt` 强校验 | 必 |
| `requestCount` | `quality.py:: _receipt` 强校验 | 必 |
| `rawVideoUploadCount` | 0（hard-coded） | 必 |
| `rawAudioUploadCount` | 0 | 必 |
| `frameByteUploadCount` | 0 | 必 |
| `cookieUploadCount` | 0 | 必 |
| `apiKeyDisclosureCount` | 0 | 必 |
| `localPathUploadCount` | 0 | 必 |
| `endpointClass` | `MiniMaxGroundedSynthesisProvider._endpoint_class`/`DeepSeekStrictGroundedSynthesisProvider._endpoint_class` 经 `b5_provider_receipt_extras()` 透传 | 否 |
| `structureMode` | 同上，`openai_chat_object` / `deepseek_beta_strict_tool_v1` | 否 |
| `attemptId` | `_complete_once` 内 `attempt-<16hex>` | 否 |
| `latencyMs` | `_complete_once` 内 `round((time.monotonic() - started) * 1000)` | 否 |
| `requestSha256` | 同 `outboundDerivedTextSha256` | 否 |
| `responseSha256` | `_complete_once` 内 `hashlib.sha256(response_bytes).hexdigest()` | 否 |
| `finishReason` | `_complete_once` 内允许集合 `{stop, tool_calls, length, content_filter, refusal, authorization_denied, empty, malformed, schema_invalid}`；未知值统一归一为 `malformed`（`test_finish_reason_unknown_normalizes_to_malformed_in_v2_1`） | 否 |

## 4. 测试与回归摘要

命令：

```bash
cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py -v
```

结果：

```
22 passed (test_v3_grounded_comprehension_b5_1.py + test_v3_grounded_comprehension_v2.py)
28 passed (test_v3_media_comprehension.py, 含 stage_b_*)
 6 passed (test_v3_companion_runtime.py)
```

合计 56/56 PASS。B-5-1 专属测试 12 项、新增 fixture 不进入既有产品代码；既有回归 44 项无回退。

### B-5-1 专属测试逐项

| 测试 | 覆盖 |
|---|---|
| `test_ar1_v2_1_receipt_carries_seven_provider_lock_extras` | AR-1 全字段齐备 |
| `test_ar2_v2_receipt_preserves_four_field_byte_layout_and_drops_extras` | AR-2 V2 字节保留 |
| `test_provider_receipt_extras_writes_no_extras_when_extras_empty` | V2.1 路径下空 extras 不引入新字段 |
| `test_finish_reason_unknown_normalizes_to_malformed_in_v2_1` | `finishReason` 允许集合 + 未知值归一化 |
| `test_no_retry_failures_set_includes_refusal_and_authorization` | §5 失败码映射集合语义 |
| `test_ar3_provider_refusal_does_not_enter_repair_or_composer` | AR-3 行为门 |
| `test_ar4_provider_authorization_denied_does_not_enter_repair_or_composer` | AR-4 fake provider 路径 |
| `test_ar4_401_unauthorized_translates_to_authorization_denied_without_repair` | AR-4 真实 MiniMaxGroundedSynthesisProvider + HTTP 401 翻译 |
| `test_ar4_403_forbidden_translates_to_authorization_denied_without_repair` | AR-4 真实 Provider + HTTP 403 翻译 |
| `test_provider_b5_receipt_extras_records_endpoint_class_and_structure_mode` | MiniMaxGroundedSynthesisProvider.b5_provider_receipt_extras() 字段集 |
| `test_deepseek_strict_provider_b5_receipt_extras_advertise_strict_contract` | DeepSeek `endpointClass="deepseek_strict_tool"`、`structureMode="deepseek_beta_strict_tool_v1"` |
| `test_non_no_retry_failure_still_routes_through_repair_v2` | §5 BRIEF_LENGTH_INVALID 路径未被 B-5-1 误伤（既有路经仍走 repair_v2） |

## 5. PRD / 架构 / 合同复检

### 5.1 PRD 边界（与 `docs/active/project/01-prd.md` + `stage-gates/v3-media-companion.md` §26 align）

- 单任务锁单一 Provider — V2.1 receipt 记录 `endpointClass` + `structureMode` 使 provider 身份在 receipt 中可复算；`Provider.synthesize_v2` 仍单一路径，无跨 Provider 拼接入口（AR-1 + AR-3/4）。
- 0 原始视频/音频/帧/Cookie/密钥上传 — `_receipt()` 6 个上传计数全部 hard-coded 0（AR-1 测试断言）；与 stage-gates "不扩大云授权范围"一致。
- `--mute-audio` Chrome 实例 — B-5-1 不进入 Chrome/Runtime 调用；待 B-5-2/DEV-4 单独实施（out of scope）。
- Chat 默认 MiniMax、DeepSeek `selected=false` — 本子阶段不改 `provider_settings`/`chatProviderSelection.ts`；沿用 chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md 既有边界。

### 5.2 架构契约（与 `stage-b-route-2-contract-addendum.md` + `stage-b-b5-recovery-development-plan.md` §5 DEV-2 align）

- V2 (`v3-media-grounded-comprehension/v2`) 仍 immutable — `_receipt()` 默认 schema_version=v2 时只写入 4 字段 + 6 上传计数；AR-2 测试固定了这一点（不变更多 1 字节）。
- V2.1 (`v3-media-grounded-comprehension/v2.1`) 是新写入格式 — `quality.py:: _receipt` 仅在 `schema_version` 以 `/v2.1` 结尾时 `update(_normalize_provider_extras(extras))`；default 形态与 V2 字节保留一致。
- 阅读器优先 V2.1 / 回退 V2 / 不跨版本合并 — `MediaComprehensionService.get` 在 `_load_grounded_v2_1` 失败时回退到 `_load_grounded_v2`，互不合并（`service.py:95-98`）。
- `compose_brief_from_validated_claims` 仅在 `V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` 下被调用 — `_NO_RETRY_FAILURES` 在收到这两码以外的 `_NO_RETRY_FAILURES` 码（含 REFUSAL / AUTHORIZATION_DENIED）时直接上抛，不进入 compose (`service.py:269-276`)。

### 5.3 合同 schema（MR-07 必填项前置审视）

`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` 当前 `Receipt` 类型仍 `additionalProperties: false` 且 `required` 仅含 4 字段 + 6 上传计数；`docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` 一致。

实现 `_receipt()` 在 V2.1 路径下会写入 7 extras；这与 schema 当前形态存在 **缺口**：

- 现有 `stage-b-route-2-contract-fixtures.json` `positiveInstances` 也仅校验 4 + 6 receipt 形态通过 meta-validation，未断言 11 字段形态；
- 真实 B-5 fresh run 落盘 V2.1 derivative 时，MR-07 的 schema meta-validation 将拒绝含 extras 的 Receipt（`additionalProperties: false`）。

此缺口已记为 M-B5-1-01，必须在 B-5-2 出门前修补 schema + fixtures（属于 B-5-2 自身范围，本子阶段不动 schema）。

## 6. 严重度

| 严重度 | 计数 | 列表 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | — |
| Minor | 1 | M-B5-1-01: V2.1 contract schema 未声明 7 extras；待 B-5-2 内补 schema 与 route-2-contract-fixtures；不得静默修改 |

与 `stage-b-b5-recovery-preimplementation-audit.md §3` 一致；本子阶段无新增 Fatal/Major。

## 7. 隐私与上传计数

本子阶段无 fresh run、无 Provider 调用、无 Chrome/Runtime 行为；上传计数的可达性仅由 `_receipt()` hard-coded 0 与回归测试断言双重保证（`test_ar1_v2_1_receipt_carries_seven_provider_lock_extras`）。

收到 receipt extras 中的 `requestSha256` / `responseSha256` / `attemptId` 仅是请求与响应字节的不可逆摘要（64/64 hex），不包含密钥、Cookie、路径、原始媒体。

## 8. 不允许验收姿势（沿用 B-5 顶层契约）

- 不允许用单元测试 / 合规模型 / 旧 run 拼接顶替 B-5 fresh run（本子阶段仅完成 DEV-2，B-5 fresh 仍 NO-GO 等待用户 high-risk 授权）；
- 不允许在 B-5-1 内引入新 Provider、跨 Provider 拼接、最佳 N、自动 fallback、阈值降低；
- 不允许在未授权时启动 Chrome/Runtime/Provider/上传真实项目派生文本。

## 9. 出本子阶段结论

- **DOCUMENT CANDIDATE & IMPLEMENTATION PASS / READY FOR B-5-2**.
- Fatal=0 / Major=0；Minor=1（M-B5-1-01 已显式记录，预 B-5-2 修补）。
- AR-1..AR-6 全部 PASS；B-5-1 专属测试 12 passed；既有回归 44 passed 无回退。
- B-5-1 期间未启动 Chrome/Runtime/Provider；SHA-256 与审计文档 §1 复算一致。

## 10. 进入 B-5-2 前置条件（用户需独立确认）

- B-5-2 详细开发计划冻结；
- B-5-2 出门审计独立 Claude Code CLI 启动；
- M-B5-1-01（V2.1 schema 补 7 extras 字段 + route-2-contract-fixtures 增 11 字段 positiveInstance）已在 B-5-2 范围内补齐；
- 真实 Chrome 实例仍 `--mute-audio`（沿用 26 节末尾）；
- 未恢复用户对 DeepSeek 任务级启用与真实项目派生文本上传的高风险授权前，B-5-2 不应进入 fresh；该授权独立追踪，不在本子阶段范围。
