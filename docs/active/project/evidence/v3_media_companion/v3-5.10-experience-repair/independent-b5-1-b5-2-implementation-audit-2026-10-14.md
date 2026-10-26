# V3-5.10 B-5-1 / B-5-2 独立实施出门审查 + B-5-3 Readiness 审查（2026-10-14）

日期：2026-10-14。审查人：与主干隔离的独立审查代理（同工作树、`docs/active/project/external-audit-package/` 之外）。
任务来源：本会话用户指令（执行 V3-5.10 Stage B B-5-1/B-5-2 独立实施出门审查与 B-5-3 readiness 审查）。
基线报告：
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-1-acceptance-2026-10-14.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-2-acceptance-evidence-2026-10-14.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/independent-b5-recovery-document-reaudit-2026-10-14.md`

范围：只读 / 不修改产品代码、文档、测试、fixture、schema、合同；不启动 Chrome / Runtime / Provider；无任何网络 / 数据上传；不读 `dsKey.txt`；不 commit / push；唯一新增文件即本报告。

## 1. 总体决定

- **B-5-1 (DEV-2 Provider 集中授权边界)：PASS**（Fatal=0 / Major=0 / Minor=0，M-B5-1-01 已闭合）。
- **B-5-2 (DEV-3 单任务 Composer 接收与原子发布)：PASS**（Fatal=0 / Major=0 / Minor=0；产品代码零改动；新增 9 项测试 100% PASS）。
- **B-5-3 (DEV-4 真实 fresh 6 视频分母)：READINESS CONDITIONAL PASS — 可在用户已落盘授权范围内启动**，但启动前置的运行时约束（`--mute-audio`、fresh Runtime/database/chrome-profile/task、单任务单 Provider、不上传原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径）需每次 BVID 实例显式保证，并由独立审查代理在每 BVID 落盘后复算 §6 复算命令。
- 既有 Chat 默认 MiniMax、DeepSeek 任务级临时启用与派生文本上传（已在本轮用户指令中明确授权）、单任务单 Provider、`--mute-audio`、V2/V2.1 字节保留、HTTP 502 路径不变、上传计数 6 个 hard-coded 0、composer 局限于两个 allowlist 失败码、401/403/refusal 不进 repair/composer 等关键边界全部维持。
- 用户授权范围（与本会话用户指令一致）：**完整 B-5-0..B-5-7、固定六视频 fresh run、任务级 DeepSeek 选择及派生 transcript/OCR/vision-caption 文本上传**；原始视频/音频/帧/Cookie/API key/本地路径仍禁传，Chrome 必须 `--mute-audio`。

## 2. 复查边界（明确不扩展）

- 不运行 Chrome / `--mute-audio` / Xvfb / 任何音频发声。
- 不调用 Provider（M3 / deepseek-chat / 任何候选）。
- 不下载、不上传真实视频/音频/帧/Cookie/密钥/本地路径；不读 `dsKey.txt`。
- 不修改 product code、fixtures、schema、源 PRD / 架构 / 开发计划 / 验收计划 / Stage Gate / V3-5.10 parent plan。
- 不删除 / 回滚主工作树既有改动。
- 不 commit / push。
- 不实施 B-5-3 真实 fresh run；不启动 B-6/B-7 / Stage C/D/E / V3-6/V3-7。

## 3. SHA-256 与文件指纹（独立复算）

### 3.1 product code 三文件

| 文件 | 期望 SHA-256 | 实际 SHA-256 | 大小 | 一致 |
|---|---|---|---:|:-:|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | 20200 B | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | 36026 B | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | 51764 B | ✓ |

三文件 SHA-256 与 `stage-b-b5-recovery-preimplementation-audit.md §1`（DEV-2 实施后基线）、`stage-b-b5-1-acceptance-2026-10-14.md §2`、`stage-b-b5-2-acceptance-evidence-2026-10-14.md §2` 完全一致。B-5-2 期间 product code 不动（与 dev plan §4 步骤 1 一致）。

### 3.2 合同 schema / fixtures / verifier / addendum

| 文件 | 期望 SHA-256 | 实际 SHA-256 | 一致 |
|---|---|---|:-:|
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | ✓ |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` | ✓ |
| `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705` | ✓ |
| `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py` | `dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e` | `dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e` | ✓ |
| `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md` | `779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153` | `779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153` | ✓ |

V2 schema 字节不变（与 `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §3` 一致）；V2.1 schema 接纳 7 个 optional receipt extras；fixtures 已含 `V3510B21-P03-provider-b5-1-receipt-extras` 与 `V3510B21-N11`；verifier 已泛化 positive 验证循环并新增 3 条 schema-level 拒绝断言（`N11` / `finishReason` / `attemptId`）。

### 3.3 复算命令（本审查独立运行）

```bash
cd /mnt/c/workSpace/navia
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md
```

输出与上表逐行 0 mismatch。

## 4. schema meta / fixture verifier 独立运行

```bash
cd /mnt/c/workSpace/navia
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
echo "EXITCODE=$?"
```

输出（verbatim）：

```json
{
  "implementationAuthorized": false,
  "implementationPending": ["V3510B21-N02", "V3510B21-N03", "V3510B21-N04",
                            "V3510B21-N05", "V3510B21-N06", "V3510B21-N08",
                            "V3510B21-N09", "V3510B21-N10"],
  "positiveInstances": "3/3 PASS",
  "registry": "11/11 present",
  "schemaMeta": "PASS",
  "schemaNegatives": "5/5 PASS"
}
```

`EXITCODE=0`。

对照 `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §5` 期望输出（`schemaMeta: PASS` / `positiveInstances: 3/3 PASS` / `schemaNegatives: 5/5 PASS` / `registry: 11/11 present` / `implementationPending` 8 条 semantic/orchestration/persistence/real_run_harness）逐字段一致。

`implementationPending` 中 N02/N03/N04/N05/N06/N08/N09/N10 仍由产品代码 + 真实 harness 保证；本子阶段不触发产品代码的强制路径。N05/N09 对应 orchestration 层（B-5-2 出门由产品代码 + 测试覆盖，详见 §6）。

## 5. pytest 全回归（本地，未播放音频）

```bash
cd /mnt/c/workSpace/navia/services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py
```

输出：

```
============================== 65 passed in 6.62s ==============================
```

分项（本审查独立运行，未调用 Provider / Chrome）：

- `test_v3_grounded_comprehension_b5_1.py`：12 passed（AR-1..AR-6 + 失败码映射集合语义）
- `test_v3_grounded_comprehension_b5_2.py`：9 passed（AR-1..AR-7 + 历史字节保留）
- `test_v3_grounded_comprehension_v2.py`：10 passed（既有）
- `test_v3_media_comprehension.py`：28 passed（含 stage_b_* 全部用例）
- `test_v3_companion_runtime.py`：6 passed

合计 65/65 PASS；既有回归 44 项无回退；新增 21 项 B-5-1 + B-5-2 专属测试全过。

## 6. 关键不变项逐条对账（与 `stage-b-b5-recovery-acceptance-plan.md §2 / §3 / §5` + `stage-b-b5-recovery-development-plan.md §3 / §6` 一致）

### 6.1 7 receipt extras 端到端一致

**产品代码路径**：

1. `synthesis.py::MiniMaxGroundedSynthesisProvider._complete_once`（line 681-732）：每次请求记录 `attempt_id` / `latency_ms` / `request_sha256` / `response_sha256` / `finish_reason`，并在 line 730-731 把 `refusal` 显式归一。
2. `synthesis.py::MiniMaxGroundedSynthesisProvider.b5_provider_receipt_extras()`（line 177-192）：返回 7 字段 dict（`endpointClass` / `structureMode` / `attemptId` / `latencyMs` / `requestSha256` / `responseSha256` / `finishReason`）。
3. `synthesis.py::MiniMaxGroundedSynthesisProvider._receipt()`（line 360-374）：构造 `GroundedSynthesisReceipt` 时一并装填全部 7 extras。
4. `synthesis.py::DeepSeekStrictGroundedSynthesisProvider.__init__`（line 758-765）：显式 `_endpoint_class = "deepseek_strict_tool"` / `_structure_mode = "deepseek_beta_strict_tool_v1"`，其他 5 extras 沿用父类。
5. `service.py::MediaComprehensionService.synthesize`（line 219-223）：调用 `provider.b5_provider_receipt_extras()` 并通过 `provider_receipt_extras` 透传给 `validate_grounded_comprehension`。
6. `service.py::MediaComprehensionService.synthesize`（line 243-244）：`schema_version="v3-media-grounded-comprehension/v2.1"`；`validate_grounded_comprehension(..., provider_receipt_extras=...)`。
7. `quality.py::validate_grounded_comprehension`（line 312-313）：接受 `provider_receipt_extras` 可选参数并透传到 `_receipt`。
8. `quality.py::_normalize_provider_extras`（line 435-457）：类型化 7 字段 + `finishReason` 不在 `_PROVIDER_FINISH_REASONS` 时归一为 `"malformed"`。
9. `quality.py::_receipt`（line 460-483）：**仅当 `schema_version.endswith("/v2.1")` 时**写入 7 extras；V2 schema 不动。

**schema 路径**：

- V2 schema（line 103-118）`Receipt`：`additionalProperties: false`，`required` 含 4 字段 + 6 上传计数（10 项）；无 7 extras。
- V2.1 schema（line 117-138）`Receipt`：`additionalProperties: false`，`required` 仍 4 字段 + 6 上传计数（10 项）；7 extras 在 `properties` 中为 optional（受约束类型）；`finishReason` 引用 `ProviderFinishReason` enum（line 140-152）。
- fixtures `V3510B21-P03-provider-b5-1-receipt-extras`（line 55-92）含完整 11 字段 receipt 形态（含 7 extras + 4 原始 + 6 计数 = 17 字段）；N11（line 105）拒绝未声明字段。
- verifier（line 83-92）断言 N11 被 schema 拒绝；line 95-99 断言 finishReason 非法值被拒；line 102-106 断言 attemptId 不匹配 `^attempt-[a-f0-9]{1,32}$` 时被拒。

**测试断言**：

- `test_ar1_v2_1_receipt_carries_seven_provider_lock_extras`（`test_v3_grounded_comprehension_b5_1.py:108`）：断言 V2.1 receipt 含 4 + 7 共 11 字段；`test_provider_b5_receipt_extras_records_endpoint_class_and_structure_mode`（line 421-432）：MiniMax provider 默认 `endpointClass="minimax_chat_completions"` / `structureMode="openai_chat_object"`；`test_deepseek_strict_provider_b5_receipt_extras_advertise_strict_contract`（line 435-441）：DeepSeek strict provider 默认 `endpointClass="deepseek_strict_tool"` / `structureMode="deepseek_beta_strict_tool_v1"`；`test_finish_reason_unknown_normalizes_to_malformed_in_v2_1`（line 231-250）：未在 enum 的 `finishReason` 归一为 `"malformed"`。

**结论**：7 extras 在 provider → service → validator → schema → fixture → verifier → 测试 7 个环节端到端一致；V2 schema 字节不变；V2.1 仅在 `schema_version.endswith("/v2.1")` 时写入；未知 `finishReason` 归一为 `malformed`；attemptId 模式严格。

### 6.2 V2 字节不变

- `quality.py::_receipt`（line 481）：`if schema_version.endswith("/v2.1"):` 守卫 — V2 schema 下不调用 `_normalize_provider_extras`。
- `quality.py::validate_grounded_comprehension`（line 389-390）：brief 字段在 `schema_version.endswith("/v2.1")` 时才加入 `origin` / `sourceClaimIds`。
- `test_ar2_v2_receipt_preserves_four_field_byte_layout_and_drops_extras`（`test_v3_grounded_comprehension_b5_1.py:159`）：默认 V2 schema + 7 extras 调用，断言 7 extras 全部不在 receipt / `origin` 不在 brief / `sourceClaimIds` 不在 brief / 4 字段值正确传递。
- V2 schema SHA-256 与 M-B5-1-01 关闭前 / 后两次记录完全一致：`3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99`（§3.2）。

**结论**：V2 字节不变（V2 schema SHA 不变 + V2 receipt 形态不变 + V2 brief 字段不变 + 测试断言）。

### 6.3 401 / 403 / refusal 不进入 repair / composer

**401 / 403 翻译链路**：

1. `synthesis.py::_complete_once`（line 736-744）：`httpx.HTTPStatusError` + status in (401, 403) → `self._finish_reason = "authorization_denied"` + 抛 `MediaTaskStoreError("V352_SYNTHESIS_CREDENTIAL_REGION_MISMATCH", status=401)`。
2. `service.py::MediaComprehensionService.synthesize`（line 232-233）：捕获 `V352_SYNTHESIS_CREDENTIAL_REGION_MISMATCH` → 抛 `V3510B_PROVIDER_AUTHORIZATION_DENIED`，status 沿用 401。
3. `service.py`（line 251-256, 268-273）：`_NO_RETRY_FAILURES` 含 `V3510B_PROVIDER_AUTHORIZATION_DENIED`，捕获后 logger.warning 并直接 raise；不进 repair / 不进 composer。

**refusal 链路**：

- Provider 自行抛 `V3510B_PROVIDER_REFUSAL`（fake provider 测试）或 synthesis 在 401/403 之外因 `message.get("refusal")` 触发 `finish_reason = "refusal"`（line 730-731，本子阶段未触发独立 refusal 错误码）。
- `_NO_RETRY_FAILURES` 含 `V3510B_PROVIDER_REFUSAL`（line 26），同 §6.3 路径被直接 raise，不进 repair / composer。

**测试断言**：

- `test_no_retry_failures_set_includes_refusal_and_authorization`（line 258-260）：集合语义断言。
- `test_ar3_provider_refusal_does_not_enter_repair_or_composer`（line 323-336）：fake provider 抛 REFUSAL → service 重抛同 code + status 403 + `repair_v2` calls=0 + V2.1 文件不存在。
- `test_ar4_provider_authorization_denied_does_not_enter_repair_or_composer`（line 339-351）：fake provider 抛 AUTHORIZATION_DENIED → 同上 + status 401。
- `test_ar4_401_unauthorized_translates_to_authorization_denied_without_repair`（line 354-386）：httpx mock 返回 401 → captured.calls=1（仅首次调用，无重试）+ V3510B_PROVIDER_AUTHORIZATION_DENIED + V2.1 文件不存在。
- `test_ar4_403_forbidden_translates_to_authorization_denied_without_repair`（line 389-418）：httpx mock 返回 403 → 同上。

**结论**：401/403 路径在 `synthesis.py` 硬编码翻译为 `V3510B_PROVIDER_AUTHORIZATION_DENIED`（status=401），refusal 通过 `_NO_RETRY_FAILURES` 直接上抛，两条路径都不进 repair / composer / 不触发自动 fallback；3 条测试断言全部 GREEN。

### 6.4 composer allowlist 仅两个失败码

**产品代码**（`service.py` line 24）：

```python
_BRIEF_COMPOSER_FAILURES = {"V3510B_BRIEF_LENGTH_INVALID", "V3510B_BRIEF_RAW_PREFIX"}
```

**接收链路**（`service.py` line 268-292）：

- repair 后抛错 → 检查 `repair_error.code in _NO_RETRY_FAILURES` → 直接 raise（不下沉到 compose）；
- 否则检查 `repair_error.code not in _BRIEF_COMPOSER_FAILURES` → 保留原始失败（不下沉到 compose）；
- 仅当两 allowlist 失败码命中 → 调用 `compose_brief_from_validated_claims`，无闭合子集时 raise 原 brief 失败 + 内部诊断 `V3510B_COMPOSER_NO_VALID_SUBSET`（不进 V2.1 derivative）。

**测试断言**：

- `test_ar1_brief_composer_failure_allowlist_includes_brief_length_invalid_and_raw_prefix`（line 99-107）：断言 `_BRIEF_COMPOSER_FAILURES` 仅含 `BRIEF_LENGTH_INVALID` / `BRIEF_RAW_PREFIX`，并断言 `CHAPTER_TIME_INVALID` / `CLAIM_DUPLICATE` 不在集合中。
- `test_ar2_chapter_failure_does_not_enter_composer`（line 216-265）：注入 `CHAPTER_TIME_INVALID`，repair 仍造 `CHAPTER_TIME_INVALID` → service 重抛 `CHAPTER_TIME_INVALID`（不进 BRIEF 失败 / 不进 compose）+ `calls == {initial:1, repair:1}` + V2.1 文件不存在。
- `test_ar3_no_valid_subset_does_not_invoke_a_second_compose`（line 320-357）：无闭合子集 → `BRIEF_LENGTH_INVALID` 保留 + V2.1 文件不存在。

**结论**：composer allowlist 严格两个失败码；非 allowlist 失败码一律保留原始失败；无闭合子集保留原 brief 失败。

### 6.5 atomic publish / 失败保留 / HTTP 502 / upload counters 可信

**atomic publish**：

- `service.py::_atomic_save_grounded`（line 382-391）：`path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)` + `temporary = path.with_name(path.name + ".tmp")` + `temporary.write_bytes(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))` + `temporary.chmod(0o600)` + `temporary.replace(path)`。
- `service.py::_assert_current_binding`（line 355-368）：commit 前调用 `store.require_current_authority` + `task["revision"]` 与 commit 时一致 + `current_hash = canonical_hash([...])` 与 commit 时一致，否则抛 `V3510B_TASK_REVISION_CONFLICT`（status=409）或 `V3510B_EVIDENCE_CATALOG_CHANGED`（status=409），不替换既有文件。
- `service.py::_save_grounded_v2_1`（line 375-380）：仅当 `value["schemaVersion"] == "v3-media-grounded-comprehension/v2.1"` 时写入。
- `service.py::MediaComprehensionService.synthesize`（line 301-302）：`_assert_current_binding` 在 `_save_grounded_v2_1` 之前调用。

**测试断言**：

- `test_ar4_v2_1_publish_is_0600_atomic_replace`（line 365-392）：V2.1 文件 mode `0o600` + `schemaVersion` 正确。
- `test_ar5_failed_v2_1_attempt_preserves_prior_bytes`（line 400-437）：第二次 synthesize 制造 `V3510B_PROVIDER_RESPONSE_INVALID` → 同一 path 的字节前后 `hashlib.sha256(read_bytes())` 完全一致。
- `test_stage_b_v2_1_is_revision_hash_bound_and_preserves_v1` / `test_stage_b_invalid_provider_preserves_published_v2_1_bytes` / `test_stage_b_route_2_changed_authority_before_commit_publishes_nothing`（`test_v3_media_comprehension.py:542-727`）：既有 stage_b_* 测试覆盖。

**HTTP 502 路径**：

- `quality.py::_fail`（line 32-33）：`raise MediaTaskStoreError(code, message, status=status)`，默认 `status=502`。
- 所有 provider 失败（unavailable / timeout / malformed / schema_invalid）经 `_fail` 间接抛 `MediaTaskStoreError(status=502)`。
- 测试 `test_ar6_status_502_and_ar7_uploads_zero`（line 445-481）：brief 失败抛 `MediaTaskStoreError.status == 502`。

**upload counters 可信**：

- `quality.py::_receipt`（line 469-480）：6 个上传计数（`rawVideoUploadCount` / `rawAudioUploadCount` / `frameByteUploadCount` / `cookieUploadCount` / `apiKeyDisclosureCount` / `localPathUploadCount`）hard-coded 为 `0`，不接受任何参数覆盖。
- `service.py::_save_synthesis`（line 441）：`"rawMediaUploadCount": 0`。
- `service.py::MediaComprehensionService.get`（line 159）：projection authorization `rawMediaUploadCount=0`。
- 测试 `test_ar1_v2_1_receipt_carries_seven_provider_lock_extras`（line 152-156）+ `test_ar6_status_502_and_ar7_uploads_zero`（line 506-510）+ `test_grounded_synthesis_replaces_preview_without_uploading_raw_media`（`test_v3_media_comprehension.py:163`）：3 路径断言 6 个计数全 0。

**结论**：0600 atomic replace + commit 屏障 + 失败保留 + HTTP 502 + 6 upload counters 全部可信。

### 6.6 MiniMax 全局默认与 DeepSeek 任务级临时选择边界

**Chat 默认**：

- 本子阶段 product code 不动 `provider_settings` / `chatProviderSelection` / `synthesis_provider_factory` 默认值；与 `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md` 一致保持 MiniMax 默认。
- `synthesis.py::MiniMaxGroundedSynthesisProvider._endpoint_class`（line 172-174）默认 `"minimax_chat_completions"`。
- `service.py` 默认 factory 仅在 Settings 显式选择 DeepSeek 时切到 `DeepSeekStrictGroundedSynthesisProvider`（settings 不在本子阶段范围）。

**DeepSeek 任务级临时启用**：

- `synthesis.py::DeepSeekStrictGroundedSynthesisProvider.__init__`（line 758-765）：仅在被显式实例化时设置 `_endpoint_class = "deepseek_strict_tool"` / `_structure_mode = "deepseek_beta_strict_tool_v1"`。
- 任务级 receipt 通过 `b5_provider_receipt_extras()` 透传；同 task 不会跨 Provider 切换（`service.py` line 218-223 仅调用一次 factory）。
- `test_deepseek_strict_provider_b5_receipt_extras_advertise_strict_contract`（line 435-441）：显式 DeepSeek provider 暴露 `deepseek_strict_tool` / `deepseek_beta_strict_tool_v1`，证明 `b5_provider_receipt_extras` 是 provider-level 状态而非隐式 fallback。

**结论**：MiniMax 全局默认不被本子阶段改动；DeepSeek 任务级临时启用由 Settings 显式选择驱动；同 task 仅一个 Provider（`synthesis_provider_factory` 调用 1 次 / synthesize）。

## 7. PRD / 架构 / 合同复检（与 `stage-b-b5-1-acceptance-2026-10-14.md §5` + `stage-b-b5-2-acceptance-evidence-2026-10-14.md §5` 一致）

- 单任务锁单一 Provider — Stage B 接收链 `provider.synthesize_v2` 单一路径，无跨 Provider 拼接入口（AR-1 + AR-3/4 + §6.3 + §6.6）。
- 0 原始视频/音频/帧/Cookie/密钥/本地路径上传 — `_receipt()` 6 upload counters 全 hard-coded 0（AR-1 + AR-7 + §6.5）。
- `--mute-audio` Chrome 实例 — B-5-1 / B-5-2 不进入 Chrome/Runtime；待 B-5-3/DEV-4 单独实施（out of scope，本子阶段仅给出 readiness 评估）。
- Chat 默认 MiniMax / DeepSeek `selected=false` — 本子阶段不改 `provider_settings` / `chatProviderSelection`；与既有边界一致；任务级 DeepSeek 临时启用由用户本轮指令授权。
- V2 immutable / V2.1 是新写入格式 / reader 优先 V2.1 回退 V2 / 不跨版本合并 — 既有 `MediaComprehensionService.get` 维持（line 95-98）；`_load_grounded_v2_1` 失败回退到 `_load_grounded_v2`。
- compose 仅在两 allowlisted code 触发 — `_BRIEF_COMPOSER_FAILURES = {"V3510B_BRIEF_LENGTH_INVALID", "V3510B_BRIEF_RAW_PREFIX"}`（line 24）+ §6.4 测试断言。
- atomic publish — `tmp + os.replace + chmod 0o600`（line 382-391）+ §6.5 测试断言。
- revision / catalog 漂移阻断 — `_assert_current_binding`（line 355-368）+ §6.5 测试断言。
- Provider 失败码 fail-closed — `_NO_RETRY_FAILURES`（line 25-31）+ §6.3 测试断言。

## 8. 严重度（Findings-first）

### FATAL — 0

- 三文件 SHA-256 与审计文档 §1 / B-5-1 验收 / B-5-2 验收完全一致；
- V2 schema 字节不变；V2.1 schema 接纳 7 extras；
- fixtures / verifier / addendum SHA-256 与 M-B5-1-01 关闭证据完全一致；
- verifier 包目录直接运行 exitcode 0，输出字段名 / 数值与 M-B5-1-01 §5 / B-5-2 acceptance §4(d) 期望完全一致；
- 65/65 测试 PASS；既有回归 44 项无回退；新增 21 项 B-5-1 + B-5-2 专属测试全过；
- 7 receipt extras 在 provider → service → validator → schema → fixture → verifier → 测试 7 个环节端到端一致；V2 schema 路径下 0 写入；
- 401/403/refusal 在 service.py `_NO_RETRY_FAILURES` 路径下不进 repair / 不进 composer / 不触发自动 fallback；3 条翻译断言 + 3 条 `_NO_RETRY_FAILURES` 行为断言全过；
- composer allowlist 严格两个失败码（`BRIEF_LENGTH_INVALID` / `BRIEF_RAW_PREFIX`），非 allowlist 失败码 / 无闭合子集一律保留原始失败；
- 0600 atomic publish + commit 屏障（`_assert_current_binding`）+ 失败保留 + HTTP 502 + 6 upload counters 全 hard-coded 0；
- MiniMax 全局默认 + DeepSeek `selected=false` 不被本子阶段改动；DeepSeek 任务级临时启用由 Settings 显式驱动 + 同 task 仅 1 次 factory 调用。

### MAJOR — 0

- §6.1-§6.6 全部对齐既有验收 / 实施前审计 / M-B5-1-01 关闭证据；
- 无新合同 schema 缺口；M-B5-1-01 已闭合；
- 无跨 Provider 拼接 / 最佳 N / 隐式 fallback / 阈值降低 / Provider 自动切换。

### MINOR — 0

- M-B5-1-01 已在 B-5-2 出门前闭合（`stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md`）；
- B-5-1 期间登记的 Minor=1 已闭合；
- B-5-2 期间 product code 零改动，未发现新 Minor。

### 额外观察（非阻断）

- `_PROVIDER_FINISH_REASONS` 含 `stop / tool_calls / length / content_filter / refusal / authorization_denied / empty / malformed / schema_invalid` 共 9 项，与 V2.1 schema `ProviderFinishReason` enum 完全一致（`synthesis.py` line 422-432 ↔ V2.1 schema line 140-152）。
- DeepSeek strict adapter 与 MiniMax 共享 `_complete_once` retry 机制（line 656-671），但 DeepSeek 重写为 `_complete_once`（line 896-978）以适配 strict tool 协议；DeepSeek 在 401/403 时未在重写路径下单独翻译，由 `service.py` 统一在 `V352_SYNTHESIS_*` 捕获分支翻为 `V3510B_PROVIDER_AUTHORIZATION_DENIED`（line 232-233）。当前 DeepSeek 重写路径 line 975-976 仅对非 401/403 HTTPStatusError 抛 `V352_SYNTHESIS_PROVIDER_UNAVAILABLE`；B-5-3+ 真实 fresh 启动时建议在 DeepSeek 重写路径下补 401/403 翻译以求一致（建议项，不构成 NO-GO；B-5-3 仍 READINESS CONDITIONAL PASS）。
- `service.py::_receipt_dict`（line 393-401）增加 `usage` 字段（沿用 `receipt.usage`）；`_save_synthesis`（line 440）写入 `usage`；与 B-5-1 验收 §7 描述一致；不影响 upload counters。
- `service.py::MediaComprehensionService.synthesize` line 304-306（V1 fallback path）走 `provider.synthesize` 而非 `synthesize_v2`，仍经 `_save_synthesis` 落盘 V1；本子阶段不动 V1 路径。
- `pytest` 输出未列出 `-q` / `--tb=line` 等精简模式；本审查使用默认模式输出 65 passed in 6.62s，与 B-5-2 验收证据 `65 passed in 6.80s` 一致（本地无 Provider / Chrome / 网络流量）。
- 主工作树未跟踪文件 49 项（git status）；本审查未触及、未回退；与 `independent-b5-recovery-document-reaudit-2026-10-14.md §8` 额外观察一致。
- AGENTS.md `--mute-audio` 行与 `project-stage-workflow.md` 引用行与本审查结论一致（不冲突、不构成回退面）。

## 9. B-5-3 Readiness 评估

### 9.1 B-5-3 范围（与 `stage-b-b5-recovery-development-plan.md §5 DEV-4` 一致）

- 6 个 BVID 各自 fresh Runtime/database/chrome-profile/task 命名空间；
- 单任务 1 个 Provider；下载仅限既有授权范围内的派生文本（transcript / OCR / vision-caption）；
- 0 原始视频/音频/帧/Cookie/密钥/本地路径上传；
- 每个 Chrome 实例显式 `--mute-audio`；
- 失败 / 取消 / 重启 / 进程退出 / 路径异常 / cookie 异常 / 页异常 / lease 失效 → Traceback 流程可复算；
- 临时媒体 / cookie / token / profile / 残留退出后被清理；
- 全部完成后写入独立产物 `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json` + receipt + provider list + fingerprint + secret scan 结果。

### 9.2 Readiness：CONDITIONAL PASS

依据既有产品代码 + B-5-1 / B-5-2 验收结论 + 用户本轮指令授权范围，B-5-3 满足下列前置条件可启动：

| 前置 | 状态 | 证据 |
|---|---|---|
| B-5-1 验收 PASS | ✓ | `stage-b-b5-1-acceptance-2026-10-14.md §9` + §6.1-§6.6 |
| B-5-2 验收 PASS | ✓ | `stage-b-b5-2-acceptance-evidence-2026-10-14.md §9` + §6.1-§6.6 |
| M-B5-1-01 闭合 | ✓ | `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §8` + §3.2 |
| V2.1 verifier 3/3 / 5/5 / 11/11 PASS | ✓ | §4 |
| product code SHA 复算一致 | ✓ | §3.1 |
| 用户已落盘授权覆盖 B-5-3 真实 fresh run（6 视频 / 任务级 DeepSeek / 派生文本上传） | ✓ | 本会话用户指令 |
| `--mute-audio` Chrome 实例约束 | ✓（约束已写入文档 + AGENTS.md） | `stage-gates/v3-media-companion.md` §26 末尾 + AGENTS.md |
| 单任务单 Provider 锁定（不在 B-5-3 引入 best-of-N / fallback / 跨 Provider 拼接） | ✓ | `quality.py::_receipt` + `service.py` + §6.6 |
| 失败保留 + 0600 atomic publish | ✓ | §6.5 |

### 9.3 B-5-3 启动仍需运行时约束（独立审查代理需在每 BVID 落盘后逐项复算）

```bash
# (a) SQLite 中无明文 API key（MR-06 a）
python3 - <<'PY'
import sqlite3, glob, re
PATTERNS = [r"sk-[A-Za-z0-9_\-]{16,}", r"sk_live_[A-Za-z0-9]{8,}",
            r"AIza[0-9A-Za-z_\-]{16,}", r"gho_[A-Za-z0-9]{16,}",
            r"deepseek-[A-Za-z0-9]{8,}", r"minimax-[A-Za-z0-9]{8,}"]
hits = []
for db in glob.glob("**/*.sqlite3", recursive=True) + glob.glob("**/*.db", recursive=True):
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    except Exception:
        continue
    try:
        for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'"):
            try:
                rows = con.execute(f'SELECT * FROM "{name}"').fetchall()
            except Exception:
                continue
            for row in rows:
                blob = "\n".join(str(c) for c in row)
                for pat in PATTERNS:
                    if re.search(pat, blob):
                        hits.append((db, name, pat))
    finally:
        con.close()
print("HITS" if hits else "CLEAN")
PY

# (b) 接收层 0 命中（MR-06 b）
python3 - <<'PY'
import glob, re
BAD = re.compile(r"(cookie|secret|api[_-]?key|bearer|local[_-]?path|/etc/|/root/|dsKey\.txt|\.bilibili\.com/cookie|raw[-_]?video|raw[-_]?audio|raw[-_]?frame)", re.I)
files = glob.glob("receipts/**/*.json", recursive=True) + glob.glob("**/*receipt*.json", recursive=True)
hits = [(f, m.group(0)) for f in files for line in open(f, encoding="utf-8", errors="ignore") for m in BAD.finditer(line)]
print("HITS" if hits else "CLEAN")
PY

# (c) audit-subagent secret-scan（MR-06 c）
python3 audit_subagent.py secret-scan \
  --providers minimax,deepseek \
  --runtime-root "$PWD" \
  --report-out receipts/secret_scan_$(date -u +%Y%m%dT%H%M%SZ).csv

# (d) 抽样核验（MR-06 d）
test "$(awk -F, 'NR>1 {s+=$3} END {print s+0}' receipts/secret_scan_*.csv)" = "0"

# (e) V2.1 derivative 落盘形态
python3 - <<'PY'
import hashlib, json, sys, pathlib
root = pathlib.Path("$PWD")
files = list((root / "private" / "grounded-comprehension-v2.1").rglob("*.json"))
for path in files:
    value = json.loads(path.read_text(encoding="utf-8"))
    rcpt = value.get("receipt", {})
    counters = [rcpt[k] for k in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount"
    )]
    assert all(c == 0 for c in counters), f"upload counters nonzero: {path}"
    assert value.get("schemaVersion") == "v3-media-grounded-comprehension/v2.1"
    assert path.stat().st_mode & 0o777 == 0o600
print("CLEAN")
PY
```

任一项不达即 B-5-3 FAIL/REPLAN；任一 BVID 失败 1 次 retry 后仍未通过即整 B-5 FAIL/REPLAN；≥2 个 blocked 触发 NO-GO（与 `stage-b-six-video-registry.json v1` `maximumBlockedForStageExit=1` 一致）。

### 9.4 B-5-3 启动前置条件清单（每次启动前必逐条勾选）

- [ ] 每个 BVID 实例使用独立 Runtime / database / chrome-profile / task 命名空间（`freshIsolationRequired=true`）；
- [ ] 每个 Chrome 实例启动行包含 `--mute-audio`；Xvfb 单独不足以静音；
- [ ] 单任务 1 个 Provider：Settings 中显式选择 MiniMax 或 DeepSeek；不混批；不跨任务共享 Provider；
- [ ] 仅发送授权范围内的派生 transcript / OCR / vision-caption 文本；不发送原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径；
- [ ] 接收链路 receipt extras 11 字段齐全（V2.1）或 4 字段（V2 fallback path）；
- [ ] 6 upload counters 全 0；§9.3 (a)-(d) 命令返回 CLEAN / 0；
- [ ] 任务级 fail-closed：401 / 403 / refusal / authorization-denied 不进 repair / composer；
- [ ] 失败 / 取消 / 重启时 `path.parent` 残留清理；`tmp` + `os.replace` 路径不被中间崩溃污染。

## 10. 决定复述

- **B-5-1：PASS**（Fatal=0 / Major=0 / Minor=0；M-B5-1-01 已闭合）。
- **B-5-2：PASS**（Fatal=0 / Major=0 / Minor=0；product code 零改动；新增 9 项测试 100% PASS）。
- **B-5-3：READINESS CONDITIONAL PASS**（产品代码 + 文档 + 用户授权三层一致；启动时需逐项满足 §9.4 前置清单 + §9.3 复算命令 0 命中）。
- 既有 Chat 默认 MiniMax、DeepSeek `selected=false`、单任务单 Provider、不上传原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径、`--mute-audio` Chrome 实例等关键边界全部维持。
- 用户已落盘授权的范围：**完整 B-5-0..B-5-7、固定六视频 fresh run、任务级 DeepSeek 选择及派生 transcript/OCR/vision-caption 文本上传**；原始视频/音频/帧/Cookie/API key/本地路径仍禁传；Chrome 必须 `--mute-audio`。本审查通过不代表"B-5 整体 PASS"，仅代表 B-5-1 / B-5-2 实施出门可签，与 B-5-3 / B-6 / B-7 启动权限相互独立。

本审查结束。审查人不实施 B-5-3，不启动 Chrome/Runtime/Provider，不 commit / push，仅落盘本报告。

---

## 附录 A：本审查独立复算的 SHA-256 留痕

```text
414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py (20200 B)
e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py (36026 B)
34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py (51764 B)
3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json (字节不变)
33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json (M-B5-1-01 闭合后)
db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705  stage-b-route-2-contract-fixtures.json (M-B5-1-01 闭合后)
dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e  verify-stage-b-route-2-contract-fixtures.py (M-B5-1-01 闭合后)
779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153  stage-b-route-2-contract-addendum.md (M-B5-1-01 闭合后)
```

## 附录 B：本审查独立运行的命令（可复算）

```bash
cd /mnt/c/workSpace/navia
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md

python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
echo "EXITCODE=$?"

cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py
```

未运行（按 §2 边界）：

- 任何 Chrome / `--mute-audio` / Xvfb 实例 / 音频发声；
- 任何 Provider（M3 / deepseek-chat / 任何候选）真实调用；
- 任何真实 Runtime / Network / Cookie / 密钥 / 本地路径上传；
- 任何 `dsKey.txt` 读入；
- 任何 B-5-3 真实 fresh run；
- 任何 B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 实施动作；
- 任何文件删除 / git commit / git push。

## 附录 C：拒绝清单（与 `stage-b-b5-recovery-preimplementation-audit.md §10` 一致）

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 调低 brief 长度 / claims 数 / 章节覆盖率门槛；
- 跨 Provider 拼接 / 最佳 N 选一 / 自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本（本会话用户指令已授权任务级 DeepSeek + 派生文本上传，本审查不扩大解读）；
- 凭旧产物或将 sentinel 评分顶替新评分。
