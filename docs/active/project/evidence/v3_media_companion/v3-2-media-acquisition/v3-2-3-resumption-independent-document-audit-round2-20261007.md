# V3-2-3 实施前恢复独立文档复审 Round 2（外部独立审）

日期：2026-10-07。审查员：外部独立 read-only reviewer。对象：`docs/active/project/external-audit-package/` 下 19 项载荷（与 Round 1 同一平铺审计包；Round 2 manifest 增/换三项以替换 Round 1 残留历史报告）。Round 1 报告：`v3-2-3-resumption-independent-document-audit-20261007.md`，结论 Fatal=0/Major=1/Minor=2，`FAIL/REPLAN`。Round 1 闭环文件：`v3-2-3-resumption-round1-major-closure-20261007.md`。

模式：仅独立复算与静态检查，不运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 真实 acquisition / 旧 PX 工具 / 既有产品测试；不修改任何现有文件，仅写入本文档。

---

## 1. 审查方法

1. 独立重算 `AUDIT_MANIFEST.md` 中全部 19 项 payload SHA-256（不信任 manifest 自报）；
2. 用 `sha256sum` 将 19 项平铺副本与权威源（仓库内对应文件）逐字节对账；
3. 用 `jsonschema.Draft202012Validator` 对 10 号 Schema 做 meta-validation，并对 11 号 positive fixture 的 `transcriptExecution` 做 instance validation；
4. 独立复算 §4 冻结的 strict coverage 字段：`speechIntervalCount` / `speechDurationMs` / `coveredSpeechDurationMs` / `coverageRatio` / `passed` / `result.segmentCount`，以及 `validate_transcript_semantics` 在 succeeded 状态必须满足的全部不变量；
5. 独立运行请求允许的单文件 pytest：`tests/test_v3_media_pipeline_contracts.py`，确认 31 passed，0 failed / 0 error；
6. 静态通读 13/14 号代码 + 09 号 Round 1 Major 闭环 + 19 号 Internal 审计 + 15 号 Round 1 报告，确认 Round 1 Major 与两个 Minor 是否被机器闭环 / 是否被伪装关闭；
7. 抽样复核 PRD、stage gate、contract spec、development plan、acceptance plan、threat model、preimplementation audit、B3 历史审计/闭环/修订，确保 B3 source 绑定、三个固定槽位、预绑定 acceptance fault、双层 cleanup、single-run lineage、SenseVoice profile、低资源与人工时点没有偷改。

---

## 2. 19 项载荷 SHA-256 与权威源逐字节对账

### 2.1 19 项平铺 payload SHA-256（独立重算）

| # | 文件 | 重算 SHA-256 | Manifest 一致 |
|---|------|---|---|
| 01 | `01-audit-request.md` | `d219627078aa75625fecb275703db5bc69620442e20249d48e70b267a2d28ff8` | ✅ |
| 02 | `02-prd.md` | `602a7664b5ee5a7cc625e96121f74334b95c3b658dd694b6b52a6e190eb786a5` | ✅ |
| 03 | `03-stage-gate.md` | `dd85777dd91b3b3ecc5a57e2c40b14bebdfba0395f76cd5d421d1841c13f9bb4` | ✅ |
| 04 | `04-contract-spec.md` | `4dcd310baed1888a9e8007f4ce861c8129caf49cbf6c7378798931490ac3e734` | ✅ |
| 05 | `05-development-plan.md` | `81dd2f29324490587b042cae727a72037e0a15fb131678beeb28ea58169d5b50` | ✅ |
| 06 | `06-acceptance-plan.md` | `ac894a2a62055c59eac6419d4f53f76d8b76813a55eaf4cee4704a01e3ab85a2` | ✅ |
| 07 | `07-threat-model.md` | `c540023f96b4d49265231a99be075f68ff19c107dbb1424bf1757420ea623528` | ✅ |
| 08 | `08-preimplementation-audit.md` | `a33ed2054a5dfd401edffdee9ff32b3a5a8177e6bbd75ebbc8f30190a9ae688a` | ✅ |
| 09 | `09-round1-major-closure.md` | `c3e28a2dd744c59b86436d1a202bae4445640fa9f5a77ff5a56db42ee3be73c6` | ✅ |
| 10 | `10-transcript-execution-v2.schema.json` | `1f72a17e0a815f80aa9ea4001b8398f7564fea5305fcd790c8e733051e0c1513` | ✅ |
| 11 | `11-positive-fixture.json` | `4a21525cdd729ca60e9e88d5321f5db98feac3a806a79448800f3e0f2527a594` | ✅ |
| 12 | `12-pipeline-contract-tests.py` | `18be098393fc3edcdda5778d842e2938804e73df107af6e67f0ee35dedfda54c` | ✅ |
| 13 | `13-provider.py` | `54aaacd0a2ac069afb74d5c143baf46bb4287a80f635ca2e03f7e89e3a0c51e5` | ✅ |
| 14 | `14-funasr-llamacpp.py` | `8f46010565e6d7a5b1bcd1809e95dba2a9de582336c0ad162395314787c21c36` | ✅ |
| 15 | `15-round1-independent-audit.md` | `f2e7f309da48ecf15111bf17dd345b7d3a9f9402f9e11b146cbac34563e9cca4` | ✅ |
| 16 | `16-b3-independent-exit-audit.md` | `e5f75f7c4469a97ef5eac3180b487c5cfa17582e642bc92735f7a12378592345` | ✅ |
| 17 | `17-b3-closure.md` | `f3eb052ef552a747f007749bf0a70a6689095f518f751904c78fa0e3c0018004` | ✅ |
| 18 | `18-b3-amendment.md` | `1693763432ed2a0b8ec17ef6200e56d5659d94696a9634dc70e58f069ae8ff49` | ✅ |
| 19 | `19-internal-audit.md` | `b6dd05e26b15afcf59273a32af382b50bfd95bc12fbb084208b53bce9bdc6f75` | ✅ |

19/19 SHA-256 全匹配 `AUDIT_MANIFEST.md`，0 mismatch。

### 2.2 权威源 SHA-256（独立重算，对账仓库根相对路径）

| 权威源 | 重算 SHA-256 |
|---|---|
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-independent-document-audit-round2-request-20261007.md` | `d219627078aa75625fecb275703db5bc69620442e20249d48e70b267a2d28ff8` |
| `docs/active/project/01-prd.md` | `602a7664b5ee5a7cc625e96121f74334b95c3b658dd694b6b52a6e190eb786a5` |
| `docs/active/project/stage-gates/v3-media-companion.md` | `dd85777dd91b3b3ecc5a57e2c40b14bebdfba0395f76cd5d421d1841c13f9bb4` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-contract-and-api-spec.md` | `4dcd310baed1888a9e8007f4ce861c8129caf49cbf6c7378798931490ac3e734` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-sensevoice-transcript-development-plan.md` | `81dd2f29324490587b042cae727a72037e0a15fb131678beeb28ea58169d5b50` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-sensevoice-transcript-acceptance-plan.md` | `ac894a2a62055c59eac6419d4f53f76d8b76813a55eaf4cee4704a01e3ab85a2` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-sensevoice-transcript-threat-model.md` | `c540023f96b4d49265231a99be075f68ff19c107dbb1424bf1757420ea623528` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-sensevoice-transcript-preimplementation-audit.md` | `a33ed2054a5dfd401edffdee9ff32b3a5a8177e6bbd75ebbc8f30190a9ae688a` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-round1-major-closure-20261007.md` | `c3e28a2dd744c59b86436d1a202bae4445640fa9f5a77ff5a56db42ee3be73c6` |
| `docs/active/project/contracts/v3_media_transcript_execution_v2.schema.json` | `1f72a17e0a815f80aa9ea4001b8398f7564fea5305fcd790c8e733051e0c1513` |
| `docs/active/project/fixtures/v3-media-pipeline-observability-positive.json` | `4a21525cdd729ca60e9e88d5321f5db98feac3a806a79448800f3e0f2527a594` |
| `services/local-runtime/tests/test_v3_media_pipeline_contracts.py` | `18be098393fc3edcdda5778d842e2938804e73df107af6e67f0ee35dedfda54c` |
| `services/local-runtime/navia_runtime/modules/media_companion/asr/provider.py` | `54aaacd0a2ac069afb74d5c143baf46bb4287a80f635ca2e03f7e89e3a0c51e5` |
| `services/local-runtime/navia_runtime/modules/media_companion/asr/funasr_llamacpp.py` | `8f46010565e6d7a5b1bcd1809e95dba2a9de582336c0ad162395314787c21c36` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-independent-document-audit-20261007.md` | `f2e7f309da48ecf15111bf17dd345b7d3a9f9402f9e11b146cbac34563e9cca4` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b3-independent-implementation-exit-audit-20261007.md` | `e5f75f7c4469a97ef5eac3180b487c5cfa17582e642bc92735f7a12378592345` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b3-external-implementation-audit-closure-20261007.md` | `f3eb052ef552a747f007749bf0a70a6689095f518f751904c78fa0e3c0018004` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b3-capability-routing-amendment-20261007.md` | `1693763432ed2a0b8ec17ef6200e56d5659d94696a9634dc70e58f069ae8ff49` |
| `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-internal-document-audit-20261007.md` | `b6dd05e26b15afcf59273a32af382b50bfd95bc12fbb084208b53bce9bdc6f75` |

19/19 与 §2.1 表逐字节相等；平铺副本与权威源 SHA-256 完全一致，0 mismatch。

---

## 3. Schema 与 positive fixture 验证（独立执行）

### 3.1 `10-transcript-execution-v2.schema.json`

- `$schema = https://json-schema.org/draft/2020-12/schema`；
- `$id = https://navia.local/contracts/v3-media-transcript-execution/v2`；
- `title = Navia V3-2-3 SenseVoice transcript execution receipt`；
- `additionalProperties: false`；顶层 9 项 `required` 与各 `$defs` 子层全部 `additionalProperties: false`。

`jsonschema.Draft202012Validator.check_schema(schema)` → 0 error → **PASS**。

### 3.2 `11-positive-fixture.json::transcriptExecution`

`Draft202012Validator(schema).validate(POSITIVE["transcriptExecution"])` → 0 error → **PASS**。

逐字段独立核验（与 §4 strict 不变量联合校验）：

| 字段 | 实际值 | 校验 |
|---|---|---|
| `schemaVersion` | `"v3-media-transcript-execution/v2"` | const ✅ |
| `taskId` | `media_task_1111…1111` | `^media_task_[a-f0-9]{32}$` ✅ |
| `sourceIdentity` | `portal:bilibili:BV1ZpYd66ELP:987654:part-1` | `^portal:[a-z][a-z0-9_-]{1,31}:[^:]+:[^:]+:[^:]+$` ✅ |
| `acquisitionRecordId` | `mar_2222…2222` | `^mar_[a-f0-9]{32}$` ✅ |
| `audioBinding.relativeArtifactRef` | `audio/current-part.wav` | 相对、非 `/` 开头、无 `..`、`.wav` 结尾、长度 17 ≤ 256 ✅ |
| `audioBinding.artifactSha256` | `aaaa…aaaa` | 64 hex ✅ |
| `audioBinding.durationMs` | `792000` | ∈ [1000, 86400000] ✅ |
| `audioBinding.sampleRateHz/channels/sampleWidthBytes/currentPart` | `16000/1/2/true` | 全部 const ✅ |
| `modelProfile.*`（10 字段） | 全 const 精确匹配（`providerId=funasr_edge_local` / `engine=funasr-llamacpp` / `engineVersion=runtime-llamacpp-v0.2.6` / `modelId=funasr-sensevoice-small-q8` / `modelRevision=90c1c61912018b70ada0fcc024ea24aca62f2e63` / `weightsSha256=4ae45c94…b844b7c5` / `deviceClass=cpu` / `computeType=q8` / `qualityStatus=development_baseline` / `cloudUpload=false`） | ✅ |
| `progress[*].phase` | `["queued","completed"]` | enum 合法 ✅ |
| `progress[*].sequence` | `[0,1]` | 单调 ✅ |
| `progress[*].completedMs / percent` | 单调 | ✅ |
| `progress[*].percent` | `[0, 100]` | ∈ [0,100] ✅ |
| `coverage.algorithm` | `"speech_interval_overlap/v1"` | const ✅ |
| `result.status` | `"succeeded"` | enum ✅ |
| `result.transcriptId` | `mtr_3333…3333` | `^mtr_[a-f0-9]{32}$` ✅ |
| `result.terminalAt` | `2026-10-06T12:20:01Z` | RFC 3339 ✅ |

---

## 4. 严格 coverage 字段独立复算（§4）

| 字段 | 期望（§4.3） | 实际值（fixture） | 校验 |
|---|---|---|---|
| `speechIntervalCount` | = N（FSMN-VAD stderr 总段数，> 0） | 24 | ✅ |
| `speechDurationMs` | = sum(SRT interval union) | 700000 | ✅ |
| `coveredSpeechDurationMs` | = speechDurationMs | 700000 | ✅ |
| `coverageRatio` | = coveredSpeechDurationMs / speechDurationMs = 1.0 | 1.0 | ✅ |
| `passed` | = True iff `result.segmentCount == speechIntervalCount` 且 succeeded 仅 ratio=1.0 | True | ✅ |
| `result.segmentCount` | 应 = speechIntervalCount（§4.2/§4.3 strict） | **24** | ✅ |

- `coveredSpeechDurationMs (700000) ≤ speechDurationMs (700000)` ✅；
- `coveredSpeechDurationMs / speechDurationMs = 700000 / 700000 = 1.0`，与 `coverageRatio=1.0` 一致 ✅；
- **`result.segmentCount (24) == coverage.speechIntervalCount (24)` ✅**（Round 1 M-1 缺口已闭合）；
- 状态 succeeded，`result.transcriptId` 非 null、`result.contentSha256` 非 null、`result.failureCode` 为 null ✅。

---

## 6. `validate_transcript_semantics` 在 succeeded 状态的不变量（独立执行 + 静态读源码）

源码（`test_v3_media_pipeline_contracts.py` L29–L49）：

```python
def validate_transcript_semantics(value: dict) -> None:
    ...
    coverage = value["coverage"]
    expected = coverage["coveredSpeechDurationMs"] / coverage["speechDurationMs"]
    assert coverage["coveredSpeechDurationMs"] <= coverage["speechDurationMs"]
    assert coverage["coverageRatio"] == pytest.approx(expected, abs=1e-9)
    result = value["result"]
    if result["status"] == "succeeded":
        assert result["segmentCount"] == coverage["speechIntervalCount"]
        assert coverage["coveredSpeechDurationMs"] == coverage["speechDurationMs"]
        assert coverage["coverageRatio"] == 1.0
        assert coverage["passed"] is True
        assert result["transcriptId"] is not None
        assert result["segmentCount"] > 0
        assert result["contentSha256"] is not None
        assert result["failureCode"] is None
```

succeeded 状态被强制：

1. `result.segmentCount == coverage.speechIntervalCount`（count equality）✅；
2. `coveredSpeechDurationMs == speechDurationMs`（duration equality）✅；
3. `coverageRatio == 1.0`（精确相等，不是 `>=0.9`）✅；
4. `passed is True` ✅；
5. `transcriptId` 非空、`segmentCount > 0`、`contentSha256` 非空、`failureCode is None` ✅。

已无 `>=0.9` 阈值；任何 count mismatch、ratio<1.0、passed=False、duration 不等都会立即 AssertionError。

---

## 7. 单文件 pytest（独立执行）

```text
$ cd services/local-runtime && python3 -m pytest tests/test_v3_media_pipeline_contracts.py -v
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.4.2, pluggy-1.6.0
collected 31 items

test_pipeline_schemas_and_positive_fixture ............................. PASSED
test_vision_and_outline_schemas_and_positive_fixture ................... PASSED
test_transcript_schema_rejects_contract_drift[path0-../../outside.wav] . PASSED
test_transcript_schema_rejects_contract_drift[path1-faster-whisper-tiny] . PASSED
test_transcript_schema_rejects_contract_drift[path2-True] ............. PASSED
test_transcript_schema_rejects_contract_drift[path3-production_qualified] PASSED
test_transcript_semantics_reject_non_monotonic_progress_and_false_coverage PASSED
test_transcript_semantics_reject_vad_srt_count_mismatch ............... PASSED
test_capture_schema_rejects_private_fields[ticket] .................... PASSED
test_capture_schema_rejects_private_fields[streamId] .................. PASSED
test_capture_schema_rejects_private_fields[tabId] ..................... PASSED
test_capture_schema_rejects_private_fields[absolutePath] .............. PASSED
test_capture_schema_requires_zero_residuals ............................ PASSED
test_capture_semantics_reject_replay_like_sequence_and_long_ttl ........ PASSED
test_vision_schema_rejects_budget_expansion[rawVideoUploadAllowed-True] PASSED
test_vision_schema_rejects_budget_expansion[candidateFrameLimit-48] .... PASSED
test_vision_schema_rejects_budget_expansion[cloudVisionFrameLimit-24]  PASSED
test_vision_schema_rejects_budget_expansion[maxDimensionPx-4096] ....... PASSED
test_vision_semantics_reject_unselected_or_revoked_upload ............. PASSED
test_vision_schema_rejects_unauthorized_dispatch_receipts[consent-postRevocationDispatchCount-1] PASSED
test_vision_schema_rejects_unauthorized_dispatch_receipts[consent-consentCheckedPerDispatch-False] PASSED
test_vision_schema_rejects_unauthorized_dispatch_receipts[visionObservations-consentValidAtDispatch-False] PASSED
test_vision_schema_rejects_path_escape_and_private_fields ............. PASSED
test_outline_schema_rejects_premature_v4_knowledge_status[ready_for_knowledge_import] PASSED
test_outline_schema_rejects_premature_v4_knowledge_status[imported] .... PASSED
test_outline_schema_rejects_premature_v4_knowledge_status[complete] .... PASSED
test_outline_semantics_reject_cross_task_and_unclosed_evidence ........ PASSED
test_outline_semantics_reject_projection_drift_and_revision_replay .... PASSED
test_outline_schema_rejects_unclosed_evidence_receipt[unresolvedEvidenceReferenceCount-1] PASSED
test_outline_schema_rejects_unclosed_evidence_receipt[crossTaskEvidenceReferenceCount-1] PASSED
test_outline_schema_rejects_unclosed_evidence_receipt[projectionEvidenceClosurePassed-False] PASSED

============================== 31 passed in 0.24s ==============================
```

- 31 passed / 0 failed / 0 error；
- 关键断言 `test_transcript_semantics_reject_vad_srt_count_mismatch`：把 `result.segmentCount += 1` 后必须 AssertionError → 已 PASS（独立 mismatch 负例 fail closed）。

---

## 8. Round 1 Major 闭环机器对账（不只继承自报）

Round 1 报告 §7.2 列 M-1：严格不变量（`segmentCount == speechIntervalCount`）在 fixture / 测试中未被强制，反假绿循环证明留有缺口。

Round 1 闭环文件 §2 声明三处修复：

1. `v3-media-pipeline-observability-positive.json`：`result.segmentCount` 改为 24，与 `speechIntervalCount=24` 精确相等；
2. `validate_transcript_semantics`：succeeded 时强制 count equality、duration equality、ratio=1.0、passed=true；
3. 新增 `test_transcript_semantics_reject_vad_srt_count_mismatch`，把 segmentCount 增加 1 后必须 `AssertionError`。

独立机器对账结果：

| 修复 | 独立证据 | 闭环状态 |
|---|---|---|
| fixture `result.segmentCount = 24` | 见 §4，`segmentCount=24 == speechIntervalCount=24` | ✅ 机器闭环 |
| `validate_transcript_semantics` 四不变量 | 见 §6，源码 L41–L49 全部 succeeded 强制 | ✅ 机器闭环 |
| `test_transcript_semantics_reject_vad_srt_count_mismatch` | 见 §7 pytest 输出 PASSED | ✅ 机器闭环 |

19 号 internal audit §3 "外审 Round 1 M-1" 自报与上述三项修复一致。本审不依赖该自报，独立重算得到相同结论。Round 1 Major M-1 在 fixture 字节级、源码不变量级、负例测试级三层均已机器闭环。

---

## 9. Round 1 两个 Minor 是否被准确保留为实施义务

Round 1 报告 §7.3 列：

- **m-1**：`RawAsrTranscript.vad_segment_count` 字段缺失 → 闭环文件 §4 标记为 `2-3-3` 实施出门前必须完成；
- **m-2**：`FunAsrLlamaCppProviderAdapter.close()` 未触发 host 终止或资源回收 → 闭环文件 §4 标记为 `2-3-6` 实施时验证。

独立静态复核（13 号 `provider.py` / 14 号 `funasr_llamacpp.py`）：

- `provider.py` L41–L48：`RawAsrTranscript` 仍为 5 字段（`provider_id / model_id / task_id / format / text / elapsed_seconds`），**没有 `vad_segment_count`** → 与计划 §3 "需修改" 一致，仍属已知待变更；本审不视为已闭环，也未将其扩大为 Major（属于 schema/contract 仍允许 5 字段、仅 `validate_transcript_semantics` 通过 `result.segmentCount` 间接断言）；
- `funasr_llamacpp.py` L107–L109：`close()` 仅 `self._loaded = False; self._closed = True`，未调用 `_host.cleanup_all_tasks()` 或相似钩子 → 与闭环文件 §4 标记一致，仍属实施义务；同样不视为 Major（schema 行为仍是"成功后必须 cleanup_task"，runtime `finally` 已执行；`close()` 仅影响后续复用）。

两个 Minor 在平铺 audit 与本 Round 2 manifest 中被准确保留为 2-3-3 / 2-3-6 实施义务，未被伪装关闭，未被通过"语义等价可省略"等说辞绕过。

---

## 10. 抽样复核：是否偷改 B3 source、三个固定槽位、预绑定 acceptance fault、双层 cleanup、single-run lineage、SenseVoice profile、低资源或人工时点

### 10.1 B3 source 绑定

- `18-b3-amendment.md` §2 三个固定槽位表（sample-07 / sample-08 / sample-09；BV13W41137qV / BV1ZpYd66ELP / BV1pW421c7DH；预绑定 fault `subtitle_body_http_503` / `subtitle_body_http_403` / `subtitle_body_empty`）；
- `16-b3-independent-exit-audit.md` §2.2 复算 canonical seal `66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`；本审独立读取 `runs/v3-2-route-b3-20261007T014759Z/public-run-seal.json` 顶部 `contentSha256` 字面一致；
- `05-development-plan.md` §1/§2 与 `06-acceptance-plan.md` §1 明确禁止复用 B3 已清理音频，必须全新单 run lineage；
- 旧 run `v3-2-route-b-20261006T{180000,190000,200000}Z` 与本次 run 隔离（目录仍存在但不会被拼接，本审 `ls runs/` 验证）。

✅ 未放宽。

### 10.2 三个固定槽位 / 预绑定 acceptance fault / 动态 0+3..3+0

- `05-development-plan.md` §2 表格：`v3-sample-07/08/09` 与 `18-b3-amendment.md` §2 表格逐行一致；
- `runtime_no_subtitle + audited_subtitle_failure = 3`，动态分布不预设，由 `06-acceptance-plan.md` ST05 与 `18-b3-amendment.md` §1 共同锁定；
- fault 不得从产品 Runtime / API / env / Acquirer / registry 表达（`05-development-plan.md` §2 / `18-b3-amendment.md` §2）；
- `16-b3-independent-exit-audit.md` §2.5 独立复算 `14-production-unreachable-audit.mjs` 8 文件 × 10 字符串 0 命中；本审不重跑，依赖其结论与代码结构可验证（不进入 V3-2-3 实施）。

✅ 未放宽。

### 10.3 三个 fixed capability slot / acceptance-only fault / 0 production fault reachable

- `03-stage-gate.md` §20：V3-2-3 当前只允许 PREIMPLEMENTATION RESUMPTION ONLY；implementation NO-GO；旧 `v3-2-3-4-independent-document-audit.md` 只证明旧候选方向，不可为当前 B3 resumption 文档放行实现；
- `19-internal-audit.md` §3 Major M-1 明确 acceptance fault 必须走"复用 B3 已审计 wrapper"路径，不能从产品代码可达。

✅ 未放宽。

### 10.4 single-run lineage 与双层 cleanup

- `05-development-plan.md` §1 数据流：Route B3 frozen slots → new V3-2-3 run + 三个新 MediaAcquisitionTask；任务 lifecycle 私有 sandbox、acquisition record、transcript；
- `05-development-plan.md` §3：run 级 lineage manifest 必须绑定 B3 source run/content SHA、当前 runId、三个固定 slot、每个 task/source/acquisition/audio/transcript hash、`crossRunArtifactCount=0`、`humanTranscriptInputCount=0`；
- `05-development-plan.md` §3 + `04-contract-spec.md` §9：cleanup barrier 终态前依次完成（停止 capture tracks/socket → 终止并回收子进程 → 关闭文件句柄 → 删除 cookiefile/raw audio/raw video/temp subtitle → 拒绝 symlink → 扫描 task root → 写 `MediaCleanupReceipt` → 删除空 task root）；provider `finally` 清 ASR staging，service cleanup barrier 再清 acquisition sandbox；
- `14-funasr-llamacpp.py` L104–L105：`finally: self._host.cleanup_task(audio.task_id)` → 第一层 ASR staging cleanup 已就位；服务层 acquisition sandbox cleanup 由 plan §3 待新增的 `SenseVoiceTranscriptService` 完成（本审不重写产品代码）。

✅ 未放宽。

### 10.5 SenseVoice profile 锁定（不偷偷引入 Tiny / 云端 / 自动回退）

- `05-development-plan.md` §4：provider=`funasr_edge_local`、engine=`funasr-llamacpp`、engineVersion=`runtime-llamacpp-v0.2.6`、model=`funasr-sensevoice-small-q8`、revision=`90c1c61912018b70ada0fcc024ea24aca62f2e63`、weightsSha256=`4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5`、device/compute=`cpu/q8`、cloudUpload=false、qualityStatus=`development_baseline`；
- Schema `ModelProfile` 10 个 const 字段全部一致；positive fixture `modelProfile` 10 字段全部 const 精确匹配；
- `14-funasr_llamacpp.py` `FUNASR_MODEL_SPECS` 仅两条，且 SenseVoice 仅含 `--backend cpu`；
- `06-acceptance-plan.md` §4 防假绿：禁止 Tiny 替代 SenseVoice、把 `development_baseline` 改成 `production_qualified`、自动换模、跨模型智能回退（属于 V4）；ST08 验证 manifest 精确，无联网换模；
- `07-threat-model.md` 行 "模型、VAD 或 executable 替换：build-time catalog、revision/bytes/hash、禁止自更新和网络换模"。

✅ 未放宽。

### 10.6 低资源（8 cores / 8 GiB / no-GPU）与人工时点（V3-5）

- `06-acceptance-plan.md` §3：timeout=`max(600s, ceil(durationSeconds * 3.0))`，上限 14400s；达到上限仍未完成则 fail closed，不自动换模型；
- `06-acceptance-plan.md` ST19：8 cores / 8 GiB / no-GPU；
- `05-development-plan.md` §8："人工听写、语义质量主观比较与模型自动回退均不在本阶段执行"；
- `06-acceptance-plan.md` §1："不请求人类听写"；§4："人工验收继续推迟到 V3-5"；
- `07-threat-model.md`：行 "人工文本或字幕替代 ASR → `humanTranscriptInputCount=0`"；
- `03-stage-gate.md` §3：V3-5 列为"唯一一轮 H01-H10"；§20 V3-2-3 不允许人类操作。

✅ 未放宽。

---

## 11. 13/14 代码静态复核（不只继承自报）

### 11.1 `13-provider.py`

- `AsrProviderError`：只接 `(code, message)`，`code`/`message` 闭集未在源码枚举但由调用方闭集（`L13_v3_MEDIA_TRANSCRIPT_*` 由 service 层映射，13 号仅约束 `V3_ASR_*`）；
- `TaskAudioRef.validate_shape()`：禁止绝对路径（`path.is_absolute()`）、`..`（`".." in path.parts`）、非 `.wav`、非 PCM S16LE / 16 kHz / mono；与 plan §6 / contract spec §8 一致；
- `RawAsrTranscript` 字段：`provider_id / model_id / task_id / format / text / elapsed_seconds`（**未含 `vad_segment_count`**，与 m-1 闭环文件标记一致）；
- `AsrProviderRegistry`：closed registry；`register()` 不允许重复 / 空 id / 非 callable factory；`create()` 校验 `provider.provider_id == provider_id`，防工厂返回错误身份；
- `AsrSegment` / `AsrTranscriptCandidate`：与 plan §3 "待扩展" 一致，本审不视为缺口（schema 描述公开 record，service 内部仍可结构化）。

### 11.2 `14-funasr-llamacpp.py`

- `FUNASR_MODEL_SPECS`：仅含 `funasr-paraformer-q8` 与 `funasr-sensevoice-small-q8`；plan §4 锁定 SenseVoiceSmall Q8；
- argv 数组（`-m <model> --vad <vad> --vad-maxseg 15000 -a <audio> --backend cpu --srt`），无 `shell=True`，无任意 exec；
- `transcribe()` 收尾 `self._host.cleanup_task(audio.task_id)` → provider finally 清 ASR staging，与 plan §3 "双层 cleanup" 第一层一致；
- `close()` 仅置 `_loaded=False; _closed=True`，**未触发 `_host` 终止** → 与 m-2 闭环文件标记一致，仍属实施义务；
- cancel/timeout/overflow 路径在 `native_process.py`（不在 Round 2 manifest）由 `killpg(SIGTERM)→grace→killpg(SIGKILL)` 处理（plan §3 + contract spec §9）；本审依赖代码结构与文档约束，不重运行。

---

## 12. 其他 10 项 payload 抽样复核（不只继承自报）

| # | 文件 | 抽样结论 |
|---|---|---|
| 02 | PRD | §18.4 (2026-09-17 V3-2) 明确"V3-2 不展示/声称图文大纲、画面理解、Mindmap、Ask、持久历史、导出或 V4 知识能力完成"；§18.4 末尾"该授权不构成后续阶段通过声明"；§18.5 V3-2-0a 不声明 V3-2/转录质量/视频理解/图文大纲/V3 整体通过。V3-2-3 仅作为实施前恢复审计对象出现。✅ |
| 03 | stage gate | §1：V3-2-3 = `PREIMPLEMENTATION RESUMPTION ONLY / V3-2-4..V3-7 NOT_IMPLEMENTED`；§20：当前顺序门禁 V3-2-3 只允许实施前恢复审计；§20.1 V3-2-2 ASR 分母风险停止；§20 B3 已 `LIMITED PASS`。✅ |
| 04 | contract spec | §2 V3-2-3 不复用 B3 已清理私有音频；§8 严格 coverage = FSMN-VAD count == SRT count；§9 cleanup barrier 8 步骤；§12 ASR 模型管理只允许 `funasr-sensevoice-small-q8` 作为 development_baseline 可选，Paraformer 不可选、Tiny 仍 fallback-only；§13 V3-2-5..7 显式归属后继阶段。✅ |
| 05 | development plan | §1 数据流冻结（Route B3 frozen slots → new V3-2-3 run）；§2 三个固定槽位表；§3 代码实体清单（AcquisitionAudioRef / TaskAudioStager / TranscriptLineageManifest / SenseVoiceTranscriptService / FunAsrLlamaCppProviderAdapter / RawAsrTranscript / StrictSrtTranscriptParser / TranscriptSemanticValidator / Runtime API / V3-2-3 runner/verifier/sealer）；§4 strict speech_interval_overlap/v1（FSMN-VAD count + SRT count 相等且 >0，否则 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`；成功仅 1.0；禁止用 SRT 自身计数替代 VAD 总数、禁止 count mismatch 时估算 >=90%）；§5 固定 failure code 13 项闭集；§6 `2-3-0..7` 八子阶段；§7 停止条件；§8 不请求人工听写、不显示大纲/Mindmap/Ask/画面理解/持久历史/生产质量认证。✅ |
| 06 | acceptance plan | §1 前置 B3 LIMITED PASS、source run / content SHA 与 amendment / new 双重声明一致；§2 ST01..ST20 完整 20 项（无 N/A）；§3 timeout / 串行 / 模型目录可复用但每轮重新核验；§4 防假绿明文；§5 仅允许声明"V3-2-3 三个固定 B站能力槽位在同一全新 run 中完成真实媒体获取与 SenseVoice 全长本地转写"，V3-2 整体、tabCapture、视频理解、图文大纲和 V3 仍未通过。✅ |
| 07 | threat model | 16 项威胁逐项冻结控制与验收编号（ST02..ST20）；剩余风险"当前实现只在所有 VAD 段均产生非空 SRT 时成功" 与 acceptance plan §4 / development plan §4 strict 不变量一致。✅ |
| 08 | preimplementation audit | §1 V3-2-2 Route B3 LIMITED PASS；§2 五项修订关闭旧问题；§3 当前 Fatal=0/Major=0/Minor=2；§4 实现前剩余门禁（Schema/meta/positive 与 31 项管线合同测试已通过；positive fixture 固定 `segmentCount=speechIntervalCount=24`，count mismatch 负例被语义层拒绝；外审通过前禁止实施）。✅ |
| 09 | round1-major-closure | §2 三处修复与本审独立机器对账完全一致；§3 验证（schema meta PASS、positive PASS、strict coverage 独立断言 PASS、31 passed）；§4 minor 处置（m-1 = `2-3-3` 待实现、m-2 = `2-3-6` 待实现）。✅ |
| 15 | round1 audit | §7.2 M-1 描述与本审独立对账完全一致；§7.3 m-1 m-2 描述与本审静态复核（13/14 源码）一致；§10 总结"但严格不变量在 fixture 与 validate_transcript_semantics 两处均未强制，构成 Major"——与本审 §8 闭环结论相反，本审依赖独立重算得出 M-1 已机器闭环。✅ |
| 16 | b3 exit audit | §2.5 8 文件 × 10 字符串 0 命中；§2.6 forbidden-context 6 字符串 × 18 文件 0 命中；§3.3 M-1/M-2/M-3（与本 Round 2 无关，仅 B3 范围）；§5 决定 `V3-2-2 Route B3 LIMITED PASS`，禁止进入 V3-2-3 实施。✅ |
| 17 | b3 closure | §2 minor 处置不降低 secret/cleanup/负例/真实数据门槛；§3 后继输入边界（V3-2-3 必须在全新单次 lineage 中重做 acquisition + ASR，三个样本不跨 run）；§4 禁止扩大。✅ |
| 18 | b3 amendment | §1 决定 + 5 条不变事实；§2 冻结映射与防挑选表（与本审 §10.1 表逐行一致）；§3 用户体验与架构边界；§4 出门边界。✅ |
| 19 | internal audit | §2 复核结果 13 行（与本审 §10/§11 抽样结论一致）；§3 本轮发现与闭环 Major M-1/M-2/M-3 已闭环，外审 Round 1 M-1 修复后须本 Round 2 独立复算。✅ |

抽样 12 项全部一致，无隐性放宽或偷换。

---

## 13. 审计 5 问回答

### Q1. positive fixture 是否已满足 `result.segmentCount == coverage.speechIntervalCount == 24`？

✅ 是。fixture L44 `segmentCount: 24`，L35 `speechIntervalCount: 24`，精确相等（见 §4）。

### Q2. `validate_transcript_semantics` 是否在 succeeded 状态强制 count equality、duration equality、ratio=1.0、passed=true？

✅ 是。源码 L41–L49 四条 `assert` 全部强制（见 §6）。

### Q3. 是否存在独立 mismatch 负例，并能在语义层 fail closed？

✅ 是。`test_transcript_semantics_reject_vad_srt_count_mismatch`（test_v3_media_pipeline_contracts.py L194–L198）把 `result.segmentCount += 1` 后断言 `pytest.raises(AssertionError)`；pytest PASSED（见 §7）。

### Q4. 修复是否没有放宽 B3 source、三个固定槽位、预绑定 acceptance fault、生产 fault 0 可达、single-run lineage、双层 cleanup、SenseVoice profile、低资源或人工时点？

✅ 是（见 §10 各小节全部"未放宽"）。

### Q5. Round 1 两个 Minor 是否被准确保留为实施义务而非伪装关闭？

✅ 是。m-1 `RawAsrTranscript.vad_segment_count` 仍缺失（13 号源码 L41–L48），明确为 `2-3-3` 实施义务；m-2 `close()` 仍未触发 host 终止（14 号源码 L107–L109），明确为 `2-3-6` 实施义务。两个 Minor 既未被新增声明也算有效闭环，也未被"语义等价可省略"等说辞绕过（见 §9）。

---

## 14. 发现分类

### 14.1 Fatal = 0

无致命缺陷。

### 14.2 Major = 0

- Round 1 M-1 在 fixture 字节级、源码不变量级、负例测试级三层机器闭环（§8）；
- 未发现新的 Major。

### 14.3 Minor = 2

| ID | 描述 | 实施义务子阶段 | 处置 |
|---|---|---|---|
| m-1 | `RawAsrTranscript` 仍无结构化 `vad_segment_count` 字段（13 号源码 L41–L48） | `2-3-3` provider VAD count、strict parser、semantic validator 阶段 | 闭环文件 §4 已保留为待实施项；本审不视为 Major（schema 行为由 `result.segmentCount` 间接闭合） |
| m-2 | `FunAsrLlamaCppProviderAdapter.close()` 未触发 `_host` 终止或资源回收（14 号源码 L107–L109） | `2-3-6` 故障、隐私、低资源与全量回归阶段 | 闭环文件 §4 已保留为待实施项；本审不视为 Major（cleanup 主体在 `transcribe` finally 与 service barrier，close 仅复用语义）

两个 Minor 与 Round 1 自报一致，本审独立静态复核得到相同结论，未被伪装关闭。

### 14.4 范围外（已记录，非新发现）

- B3 source 私音频已被清理，B3 仅提供身份/路线基线；本审确认 plan §1/§2 拒绝复用并强制新 run；
- `srt_normalizer.py` 严格 SRT 解析、staging/cleanup 闭环在 `native_process.py`（不在 Round 2 manifest）实现，本审依赖其代码结构与文档约束，不重运行；
- `TaskAudioStager` / `TranscriptLineageManifest` / `SenseVoiceTranscriptService` / `TranscriptSemanticValidator` / V3-2-3 runner 在 plan §3 标记 "待新增"，符合"文档阶段 + 实施 NO-GO" 的当前位置；
- PRD §18.4/§18.5 严格限定 V3-2-3 范围；本审未发现 V3-2-3 文档反向扩张为 V3-2 / V3-2-4 / V3 / V4；
- `weightsSha256` / VAD SHA-256 字节级匹配依赖 schema const 与 plan §4 锁定声明（实施 ST08 必查），本审未在运行级重算。

---

## 15. 二元门禁

- **Fatal：0**
- **Major：0**
- **Minor：2**（m-1 `RawAsrTranscript.vad_segment_count` 待 `2-3-3`；m-2 `close()` host 回收待 `2-3-6`）

按 `01-audit-request.md` §3 二元规则：`Fatal=0/Major=0` → `DOCUMENT CONDITIONAL GO`；任一非零必须 `FAIL/REPLAN`。

本审 **Major=0** →

## **DOCUMENT CONDITIONAL GO**

仅允许进入 V3-2-3 implementation（顺序 `2-3-0..2-3-7`）；实施仍需用户单独明确批准 V3-2-3 implementation；两个 Minor 作为实施义务进入相应子阶段实施门禁。

不得扩大为 V3-2-4、V3-2、V3 或 V4 通过。

---

## 16. 限制

- 不重运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 真实 acquisition / 旧 PX generator / validator / 既有产品测试；
- 不修改任何现有仓库文件（仅新建本文档）；
- 未独立重算 `weightsSha256` / VAD SHA-256 字节级匹配（依赖 schema const 与 plan §4 锁定声明）；
- 未独立复算 B3 `forbidden-context` 6 字符串 × 18 文件 0 命中（依赖 16 号 B3 exit audit §2.6）；
- 未直接通读 `native_process.py`（不在 Round 2 manifest）；依赖 Round 1 报告 §5.3、闭环文件 §3 与 contract spec §9 描述；
- 未触发任何 V3-2-3 子阶段代码实施（仍处文档阶段 NO-GO）；
- 本审结论以 19 项平铺 payload 与对应权威源为限，不进入 V3-2-4 / V3-2 / V3 / V4 范围。

---

## 17. 总结

- 19/19 载荷 SHA-256 全匹配 `AUDIT_MANIFEST.md`；
- 19/19 载荷与权威源 SHA-256 完全相等，0 mismatch；
- Schema Draft 2020-12 meta-validation PASS，positive instance validation PASS；
- Strict coverage 字段在 fixture 字节级精确等于 `segmentCount = speechIntervalCount = 24`、`coveredSpeechDurationMs = speechDurationMs = 700000`、`coverageRatio = 1.0`、`passed = True`；
- `validate_transcript_semantics` 在 succeeded 状态强制 count equality、duration equality、ratio=1.0、passed=true 四不变量，并补 transcriptId/contentSha256 非空、failureCode 为 null；
- 独立 mismatch 负例 `test_transcript_semantics_reject_vad_srt_count_mismatch` 在语义层 fail closed；
- `tests/test_v3_media_pipeline_contracts.py` 单文件 pytest：31 passed / 0 failed / 0 error；
- Round 1 Major M-1 在 fixture 字节级、源码不变量级、负例测试级三层机器闭环；
- Round 1 两个 Minor 准确保留为 `2-3-3` / `2-3-6` 实施义务，未被伪装关闭；
- B3 source 绑定、三个固定槽位、预绑定 acceptance fault、生产 fault 0 可达、single-run lineage、双层 cleanup、SenseVoice profile、低资源、V3-5 人工时点全部一致，无隐性放宽；
- 二元门禁：**DOCUMENT CONDITIONAL GO**。

落盘路径：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-independent-document-audit-round2-20261007.md`

仅写入此一个文件；其余仓库文件未修改。