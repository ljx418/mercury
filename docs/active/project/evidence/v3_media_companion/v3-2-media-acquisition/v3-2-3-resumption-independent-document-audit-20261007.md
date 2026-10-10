# V3-2-3 实施前恢复独立文档审查（外部独立审）

日期：2026-10-07。审查员：外部独立 read-only reviewer。对象：`docs/active/project/external-audit-package/` 下 19 项载荷。模式：仅独立复算与静态检查，不运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 产品 pytest / 旧 PX 工具；不修改任何现有文件，仅写入本文档。

---

## 1. 审查方法

1. 对 19 项平铺载荷与 `AUDIT_MANIFEST.md` 声明的 SHA-256 逐项独立重算；
2. 用 `diff -q` 对平铺副本与权威源进行逐字节对账；
3. 用 `jsonschema.Draft202012Validator` 对 10 号 Schema 做 meta-validation，并对 11 号 positive fixture 的 `transcriptExecution` 做 instance validation；
4. 独立复算 §4 冻结的 strict coverage 字段（`speechIntervalCount` / `speechDurationMs` / `coveredSpeechDurationMs` / `coverageRatio` / `passed`），并比对 `result.segmentCount`；
5. 静态通读 13-15 号 Python 文件，确认与计划新增点的边界相容；
6. 校 B3 source 绑定、三个固定槽位、acceptance-only 预绑定 fault、双层 cleanup、低资源、2-3-0..7、ST01..ST20、failure code 闭集、V4 边界与 V3-5 人工时点；
7. 不重跑任何运行时，仅依赖公开证据与代码结构。

---

## 2. 19 项载荷 SHA-256 与逐字节对账

| # | 文件 | 重算 SHA-256 | 清单 | 一致 |
|---|---|---|---|---|
| 01 | `01-audit-request.md` | `c55892148ac8cb3f67e00dfe4dbabd24d8cd1828e38b926300bbf3d42e6b00ad` | 同 | ✅ |
| 02 | `02-prd.md` | `602a7664b5ee5a7cc625e96121f74334b95c3b658dd694b6b52a6e190eb786a5` | 同 | ✅ |
| 03 | `03-stage-gate.md` | `dd85777dd91b3b3ecc5a57e2c40b14bebdfba0395f76cd5d421d1841c13f9bb4` | 同 | ✅ |
| 04 | `04-contract-spec.md` | `4dcd310baed1888a9e8007f4ce861c8129caf49cbf6c7378798931490ac3e734` | 同 | ✅ |
| 05 | `05-development-plan.md` | `81dd2f29324490587b042cae727a72037e0a15fb131678beeb28ea58169d5b50` | 同 | ✅ |
| 06 | `06-acceptance-plan.md` | `ac894a2a62055c59eac6419d4f53f76d8b76813a55eaf4cee4704a01e3ab85a2` | 同 | ✅ |
| 07 | `07-threat-model.md` | `c540023f96b4d49265231a99be075f68ff19c107dbb1424bf1757420ea623528` | 同 | ✅ |
| 08 | `08-preimplementation-audit.md` | `4040f7037bf22b4552c8d829d56fa661684d0ac1886f563f96acd899a1e41c0c` | 同 | ✅ |
| 09 | `09-internal-audit.md` | `2722900a0fefa5718c0d284a9ef8789e3a3c8ad991905824c21bcbb300f00492` | 同 | ✅ |
| 10 | `10-transcript-execution-v2.schema.json` | `1f72a17e0a815f80aa9ea4001b8398f7564fea5305fcd790c8e733051e0c1513` | 同 | ✅ |
| 11 | `11-positive-fixture.json` | `b79268212576bcad12f1723c056c4a1b9a243800bf309e5f74bde60b0155210a` | 同 | ✅ |
| 12 | `12-pipeline-contract-tests.py` | `a588364e48cae4b64e8eb3829d123fab3a4b941a87b8d60ee6943bc07612485c` | 同 | ✅ |
| 13 | `13-provider.py` | `54aaacd0a2ac069afb74d5c143baf46bb4287a80f635ca2e03f7e89e3a0c51e5` | 同 | ✅ |
| 14 | `14-funasr-llamacpp.py` | `8f46010565e6d7a5b1bcd1809e95dba2a9de582336c0ad162395314787c21c36` | 同 | ✅ |
| 15 | `15-native-process.py` | `71d711880b1132911012f5b159980f3fbca7db97d9586a750b41d14bbdcdf35a` | 同 | ✅ |
| 16 | `16-b3-independent-exit-audit.md` | `e5f75f7c4469a97ef5eac3180b487c5cfa17582e642bc92735f7a12378592345` | 同 | ✅ |
| 17 | `17-b3-closure.md` | `f3eb052ef552a747f007749bf0a70a6689095f518f751904c78fa0e3c0018004` | 同 | ✅ |
| 18 | `18-b3-amendment.md` | `1693763432ed2a0b8ec17ef6200e56d5659d94696a9634dc70e58f069ae8ff49` | 同 | ✅ |
| 19 | `19-b3-acceptance-plan.md` | `a76856c83733249b2eaaec1cb041e050aca3665f2bda1c7547ecf64087f84f89` | 同 | ✅ |

- 19/19 SHA-256 全匹配；
- `diff -q` 逐字节对账 19/19 `MATCH`，0 mismatch。

---

## 3. Schema 与 positive fixture 验证（独立执行）

### 3.1 `10-transcript-execution-v2.schema.json`

```text
$schema = https://json-schema.org/draft/2020-12/schema
$id = https://navia.local/contracts/v3-media-transcript-execution/v2
title = Navia V3-2-3 SenseVoice transcript execution receipt
type = object
additionalProperties = false
required = [schemaVersion, taskId, sourceIdentity, acquisitionRecordId, audioBinding, modelProfile, progress, coverage, result]
```

`jsonschema.Draft202012Validator.check_schema(schema)` → 0 error → **PASS**。

### 3.2 `11-positive-fixture.json::transcriptExecution`

`Draft202012Validator(schema).validate(POSITIVE["transcriptExecution"])` → 0 error → **PASS**。

逐字段核验：
- `schemaVersion = "v3-media-transcript-execution/v2"` ✅
- `taskId = "media_task_1111…1111"` → `^media_task_[a-f0-9]{32}$` ✅
- `sourceIdentity = "portal:bilibili:BV1ZpYd66ELP:987654:part-1"` → `^portal:[a-z][a-z0-9_-]{1,31}:[^:]+:[^:]+:[^:]+$` ✅
- `acquisitionRecordId = "mar_2222…2222"` → `^mar_[a-f0-9]{32}$` ✅
- `audioBinding.relativeArtifactRef = "audio/current-part.wav"` → 相对、非 `/` 开头、无 `..` 段、`.wav` 结尾、长度 17 ≤ 256 ✅
- `audioBinding.artifactSha256` 64 hex ✅；`durationMs=792000` ∈ [1000, 86400000] ✅
- `audioBinding.sampleRateHz=16000` / `channels=1` / `sampleWidthBytes=2` / `currentPart=true` 全 const 匹配 ✅
- `modelProfile` 全 10 个 const 字段精确匹配（`providerId=funasr_edge_local`、`engine=funasr-llamacpp`、`engineVersion=runtime-llamacpp-v0.2.6`、`modelId=funasr-sensevoice-small-q8`、`modelRevision=90c1c61912018b70ada0fcc024ea24aca62f2e63`、`weightsSha256=4ae45c94…`、`deviceClass=cpu`、`computeType=q8`、`qualityStatus=development_baseline`、`cloudUpload=false`）✅
- `progress` 数组 `[0,1]`、monotonic sequence / monotonic completedMs / monotonic percent ✅
- `progress.phase` ∈ {queued, completed} ✅；`percent ∈ [0,100]` ✅
- `coverage.algorithm = "speech_interval_overlap/v1"` ✅
- `result.status = "succeeded"`、`transcriptId = "mtr_3333…3333"` → `^mtr_[a-f0-9]{32}$` ✅
- `result.terminalAt` RFC 3339 ✅

---

## 4. 严格 coverage 字段独立复算（§4）

| 字段 | 期望（§4.3） | 实际值 | 校验 |
|---|---|---|---|
| `speechIntervalCount` | = N（FSMN-VAD stderr 总段数，> 0） | 24 | ✅ |
| `speechDurationMs` | = sum(SRT interval union) | 700000 | ✅ |
| `coveredSpeechDurationMs` | = speechDurationMs | 700000 | ✅ |
| `coverageRatio` | = coveredSpeechDurationMs / speechDurationMs = 1.0 | 1.0 | ✅ |
| `passed` | = True iff `result.segmentCount == speechIntervalCount` | True | **⚠️ 见 §6** |
| `result.segmentCount` | 应 = speechIntervalCount（§4.2 "SRT 必须有 N 个非空…segment"，§4.3 "SRT count == N"） | 120 | **⚠️ 120 ≠ 24** |

比值 `coveredSpeechDurationMs / speechDurationMs = 700000 / 700000 = 1.0`，与 `coverageRatio=1.0` 一致；`coveredSpeechDurationMs (700000) ≤ speechDurationMs (700000)` ✅。

**严格不变量违反**：`result.segmentCount=120` 与 `coverage.speechIntervalCount=24` 不等；按 §4.2/4.3 严格语义，passed 只能为 True 当 `SRT count == N`，否则必须返回 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`。fixture 当前状态属于"count mismatch 但 passed=True"，是反例而非正例。

---

## 5. Python 代码静态检查（13 / 14 / 15）

### 5.1 `13-provider.py`

- `AsrProviderError`：`code` + `message` 闭集；
- `TaskAudioRef.validate_shape()`：禁止绝对路径、`..`、非 `.wav`、非 PCM S16LE/16 kHz/mono；
- `AsrProviderRegistry`：closed registry；`register()` 不允许重复；`create()` 校验 `provider.provider_id == provider_id`；
- `RawAsrTranscript` 当前字段：`provider_id / model_id / task_id / format / text / elapsed_seconds`；
- **缺失字段**：开发计划 §3 标注 `RawAsrTranscript` "需修改" 增加结构化 `vad_segment_count`；当前 dataclass 未含此字段，**与 §3 状态一致**（计划声明的待修改项）。属于已知变更。

### 5.2 `14-funasr-llamacpp.py`

- `FUNASR_MODEL_SPECS` 仅含 `funasr-paraformer-q8` 与 `funasr-sensevoice-small-q8`；plan §4 锁定 SenseVoiceSmall Q8；
- 锁定构造 argv：`-m <model> --vad <vad> --vad-maxseg 15000 -a <audio> --backend cpu --srt`；
- `transcribe()` 收尾 `self._host.cleanup_task(audio.task_id)` → provider finally 清 ASR staging，与 plan §3 "双层 cleanup" 第一层一致；
- `close()` 仅置 `_closed=True`，**未调用 host 终止逻辑**（Minor 实现细节，plan 未显式要求；但 cancel/timeout 路径已有 `killpg` SIGTERM/SIGKILL）。

### 5.3 `15-native-process.py`

- argv 数组 + `shell=False` + `start_new_session=True` + `cwd=task_root`；
- 敏感环境变量过滤：`SENSITIVE_ENV_FRAGMENTS = ("TOKEN","COOKIE","AUTH","PROXY","HF_","HUGGINGFACE","AWS_","AZURE_","GOOGLE_")`；构造 env 后再做一次反向校验；
- `_reject_link_components` 拒绝 symlink；`validate_audio` 检查 `st_nlink == 1` 拒绝 hardlink；
- `validate_audio` 用 `wave.open` 校验 shape `(16000, 1, 2, "NONE")`；不通过即 `V3_ASR_AUDIO_FORMAT_UNSUPPORTED`；
- `validate_install_file` 同样拒绝 link/多链接；只接受根级单文件名；
- bounded reader：`max_output_bytes` 截断并触发 `overflow` Event → `V3_ASR_PROCESS_OUTPUT_LIMIT`；
- 终止：cancel/timeout/overflow → `killpg(SIGTERM)` → grace → `killpg(SIGKILL)`；
- `cleanup_task` → `shutil.rmtree(task_root)`；残留路径已并入 plan §3 第二层 barrier。

**安全兼容性**：与现有 `provider.py` / `funasr_llamacpp.py` 边界相容；不引入联网、不引入动态模型加载、不引入 `shell=True`。实施可行性可。

---

## 6. 审计 10 问回答

### Q1. 19 项载荷 SHA-256 是否全部匹配 manifest，权威源与平铺副本是否 0 mismatch？

✅ 19/19 SHA-256 完全匹配；`diff -q` 逐字节 19/19 `MATCH`，0 mismatch。

### Q2. B3 source run/content SHA 与独立 `LIMITED PASS` 是否绑定准确，是否错误复用已清理音频或旧 run？

✅ 文档中明确：
- 权威 source run：`v3-2-route-b3-20261007T014759Z`（`16-b3-independent-exit-audit.md` §2.1 / `06-acceptance-plan.md` §1）；
- canonical content SHA-256：`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`；
- 计划明确禁止复用 B3 已清理音频（`05-development-plan.md` §1/§2；`17-b3-closure.md` §3）；必须全新单 run lineage；
- 旧 run `v3-2-route-b-20261006T{180000,190000,200000}Z` 与本次 run 隔离（B3 报告 §3.4 已记录）。

### Q3. 三个固定能力槽位、BVID、顺序、预绑定 fault 与动态触发和=3 是否和 PRD/Route B3 一致？

✅ 与 `18-b3-amendment.md` §2 表精确一致：
- `v3-sample-07` / `BV13W41137qV` / slot 1 / `subtitle_body_http_503`
- `v3-sample-08` / `BV1ZpYd66ELP` / slot 2（anchor）/ `subtitle_body_http_403`
- `v3-sample-09` / `BV1pW421c7DH` / slot 3 / `subtitle_body_empty`

顺序、URL、fault 在探测前冻结；动态 `runtime_no_subtitle + audited_subtitle_failure = 3` 由 `06-acceptance-plan.md` ST05 与 `19-b3-acceptance-plan.md` B3-06 共同锁定。

### Q4. acceptance wrapper 是否保持真实字幕发现先行、单槽最多一次预绑定 fault，并且产品 Runtime/API/env/Acquirer/registry 0 可达？

✅ `05-development-plan.md` §2 与 `06-acceptance-plan.md` §1 明确：
- 每槽先执行真实 `task-time` 字幕发现；0 候选不注入；
- 存在候选时只应用该槽位预绑定 fault 一次；
- `runtime_no_subtitle + audited_subtitle_failure = 3`，动态分布不预设；
- fault 不得从产品 Runtime / API / env / Acquirer / registry 表达；
- 生产静态审计命中或动态触发总数不等于 3，整轮 `FAIL/REPLAN`。

B3 报告 §2.5 独立复算 `14-production-unreachable-audit.mjs` 8 文件 × 10 字符串 0 命中；本审不重跑，依赖其结论与代码结构可验证。

### Q5. acquisition sandbox -> 私有流式 copy -> native ASR root -> 双层 cleanup 是否可由现有代码边界实现，是否存在 path/link/cross-task/残留风险？

✅ 设计可由现有代码边界实现，且 plan §3/§6/§7 已显式声明：
- `TaskAudioStager`：流式复制（不得 symlink/hardlink），目标文件 0600 / 目录 0700，hash/shape/bytes 精确相等；
- ASR staging root 与 acquisition sandbox 分离；
- provider `finally` 清 ASR staging（`14-funasr-llamacpp.py` 已包含 `cleanup_task`）；
- service cleanup barrier 再清 acquisition sandbox；
- 任一残留禁止终态成功；
- 路径遍历、绝对路径、symlink、hardlink、跨 task 全部 fail closed（`15-native-process.py` `_reject_link_components` / `nlink==1` / `validate_audio`）。

实施阶段需新增 `AcquisitionAudioRef` / `TaskAudioStager` / `TranscriptLineageManifest` / `SenseVoiceTranscriptService` / `TranscriptSemanticValidator`，与现有代码不冲突；安全假设（argv 数组、`shell=False`、敏感 env 过滤、link 拒绝）已就位。

### Q6. SenseVoice engine/version/model/revision/weights/VAD/CPU/Q8/development_baseline 是否精确一致，是否偷偷引入 Tiny、云端或自动回退？

✅ 锁定 `05-development-plan.md` §4 + `03-stage-gate.md` §17 + Schema `ModelProfile` 全部 `const`：
- provider=`funasr_edge_local` / engine=`funasr-llamacpp` / version=`runtime-llamacpp-v0.2.6`
- model=`funasr-sensevoice-small-q8` / revision=`90c1c61912018b70ada0fcc024ea24aca62f2e63`
- weights SHA-256=`4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5`
- VAD=`fsmn-vad.gguf`，SHA-256=`1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479`，`vadMaxSegmentMs=15000`
- device/compute=`cpu`/`q8`；`cloudUpload=false`；`qualityStatus=development_baseline`

`FUNASR_MODEL_SPECS` 仅两条且 SenseVoice 仅含 `--backend cpu`；`crossModelQualityGate=deferred_to_v4` 由 B3 schema 与 plan §8 共同保证；未引入 Tiny/cloud/自动回退。

### Q7. VAD start/end count + SRT count equality 是否真实消除 coverage 循环证明；成功 1.0、mismatch fail closed 是否比 PRD >=90% 更严格而非缩分母？

⚠️ 文档层面**是**比 PRD 严格（§4.2/4.3 明文 "SRT 必须有 N 个非空…segment"；"SRT count != N → V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE"；§4.4 禁止"用 SRT 自身计数替代 VAD 总数" / "count mismatch 时估算缺失时长或声称 >=90%"）。

但实施/测试层面存在 **Major 缺口**（详见 §7 Finding-1）：
- `11-positive-fixture.json` 的 `result.segmentCount=120` 与 `coverage.speechIntervalCount=24` 不等，fixture 进入"count mismatch 但 passed=True"状态，反例而非正例；
- `12-pipeline-contract-tests.py::validate_transcript_semantics` 使用 `assert coverage["passed"] is (coverage["coverageRatio"] >= 0.9)`（PRD 的 >=90% 阈值），未断言 `passed is (segmentCount == speechIntervalCount)`；
- 二者叠加 → 一份 `coverage.passed=true, coverage.coverageRatio=1.0, segmentCount != speechIntervalCount` 的伪造 transcript 既能通过 Schema 元校验也能通过 `validate_transcript_semantics`；
- §4.4 明确禁止在 count mismatch 时"声称 >=90%"，但测试代码正是以 >=0.9 作为 passed 的判定条件，与 §4.4 文字冲突。

文档语义比 PRD 严格，但 fixture/test 并未把严格规则落到机器断言上；这是反假绿"循环证明"在文档侧的缺口。

### Q8. `2-3-0..7`、ST01..ST20、failure code、timeout、低资源、秘密、资源、seal 和独立审计是否完整且无 N/A？

✅ 完整且无 N/A：
- `2-3-0..7` 共 8 个子阶段，全部具名（schema/lineage/fixtures → audio ref/stager → service → provider/parser/validator → API → 3 真实全长任务 → fault/privacy/low-resource/回归 → PRD/seal/独立出门审计）；
- `ST01..ST20` 共 20 项且无 N/A；
- failure code 闭集 13 项（`V3_MEDIA_TRANSCRIPT_{TASK_INVALID, SOURCE_MISMATCH, AUDIO_UNAVAILABLE, AUDIO_UNSAFE, MODEL_MISMATCH, PROCESS_TIMEOUT, PROCESS_FAILED, OUTPUT_LIMIT, EMPTY, INVALID, COVERAGE_INDETERMINATE, CANCELLED, CLEANUP_INCOMPLETE}`），底层 `V3_ASR_*` 仅在 service 内映射，不透传 stderr；
- timeout：`max(600s, ceil(durationSeconds * 3.0))`，上限 14400s；
- 低资源：8 cores / 8 GiB / no-GPU；
- 秘密与资源：cleanup 与 secret scan 全覆盖（ST18 / ST19）；
- seal 与独立审计：ST20 `Fatal=0/Major=0`，只声明 V3-2-3 limited pass。

### Q9. 是否仍把 24-bin 双 reviewer/V4 质量优化误作 V3 门槛，或反向把 `development_baseline` 扩大为 `production_qualified`？

✅ 未误作。`05-development-plan.md` §4 / `08-preimplementation-audit.md` / `06-acceptance-plan.md` §4 / `03-stage-gate.md` §17 共同固定：
- model `qualityStatus=development_baseline`；
- `crossModelQualityGate=deferred_to_v4`；
- 防假绿第 8 条："把 `development_baseline` 改成 `production_qualified`" 显式禁止；
- 24 bin / 48 reviewer 属于 V3-2-0b 实施历史，未出现在 V3-2-3 任何门槛；
- V4 知识持久化、Query、Graph、Durable Forget 与"跨模型智能回退"显式归属 V4。

### Q10. 人工听写/H01..H10 是否仍只在 V3-5，V3-2-3 是否保持自动真实数据验收？

✅ 未漂移：
- `05-development-plan.md` §8："人工听写、语义质量主观比较与模型自动回退均不在本阶段执行"；
- `06-acceptance-plan.md` §1："不请求人类听写"；§4："人工验收继续推迟到 V3-5"；
- `07-threat-model.md`：行 "人工文本或字幕替代 ASR → `humanTranscriptInputCount=0`"；
- `09-internal-audit.md` §2："人工边界 → V3-2-3 不请求听写；H01..H10 仍只在 V3-5"；
- `03-stage-gate.md` §3：V3-5 列为"唯一一轮 H01-H10"。

V3-2-3 全自动验收、真实当前分 P 媒体、零人类输入。

---

## 7. 发现分类

### 7.1 Fatal = 0

无致命缺陷。

### 7.2 Major = 1

**M-1 — 严格不变量（`segmentCount == speechIntervalCount`）在 fixture / 测试中未被强制，反假绿"循环证明"在文档侧留有缺口**。

证据：
1. `11-positive-fixture.json` 的 `result.segmentCount = 120`，但 `coverage.speechIntervalCount = 24`；
2. `12-pipeline-contract-tests.py::validate_transcript_semantics` 判定 `passed` 的条件为 `coverage["coverageRatio"] >= 0.9`（即 PRD >=90% 阈值），未断言 `result["segmentCount"] == coverage["speechIntervalCount"]`；
3. `05-development-plan.md` §4.2/§4.3/§4.4 明文："SRT 必须有 N 个非空…segment"、"SRT count == N 时发布成功 coverage"、"不允许用 SRT 自身计数替代 VAD 总数；不允许在 count mismatch 时估算缺失时长或声称 >=90%"。

影响：
- 一份 `coverage.passed=true, coverage.coverageRatio=1.0, segmentCount != speechIntervalCount` 的伪造 transcript 既能通过 Schema 元校验，又能通过 `validate_transcript_semantics` 验证；这是 §4.4 明确禁止的"声称 >=90%"路径；
- 即便 runtime 仍可能在后续 `TranscriptSemanticValidator`（plan §3 "待新增"）上拦截该 case，但 fixture / contract-test 层未把规则落到机器断言上；
- 测试套 `test_transcript_semantics_reject_non_monotonic_progress_and_false_coverage` 只篡改 `coverage.coverageRatio=0.91` 触发 `validate_transcript_semantics` 的 `pytest.approx` 失败，并未覆盖 `segmentCount != speechIntervalCount` 这条 strict invariant。

要求闭环（任一即可）：
- (a) fixture 的 `result.segmentCount` 改为 24 与 `speechIntervalCount` 相等，并保留 `coverage.passed=true / coverage.coverageRatio=1.0`；
- (b) `validate_transcript_semantics` 增加 `assert result["segmentCount"] == coverage["speechIntervalCount"]`；
- (c) 新增 contract test `test_transcript_semantics_reject_vad_srt_count_mismatch`：把 fixture 的 `result.segmentCount` 改成与 `speechIntervalCount` 不等的值，期望触发固定失败码（fixture 层）或 AssertionError（语义层）。

此项 Major 不得通过"fixture 只是 schema 演示而非 strict policy 演示"或"runtime 仍可拦截"等说辞关闭；fixture / contract-test 是文档层唯一可机器复算的"严格"门，必须反映 §4.2/§4.3/§4.4。

### 7.3 Minor = 2

**m-1 — `13-provider.py::RawAsrTranscript` 暂无结构化 `vad_segment_count` 字段**。

证据：`dataclass(frozen=True) RawAsrTranscript` 当前 5 字段（provider_id / model_id / task_id / format / text / elapsed_seconds），无 `vad_segment_count`。`05-development-plan.md` §3 行 "增加结构化 vad_segment_count，不携带 stderr | 需修改" 明示这是已知待修改项。

处置：本阶段属"已知变更"，但 V3-2-3 实施 `2-3-3` 之前必须把该字段加入 `RawAsrTranscript` 与 schema 文档，并新增 `validate_transcript_semantics` 对其与 `coverage.speechIntervalCount` 的相等性断言（同时是 M-1 的天然闭环路径）。

**m-2 — `14-funasr-llamacpp.py::FunAsrLlamaCppProviderAdapter.close()` 未触发 host 终止或资源回收**。

证据：`close()` 仅置 `self._loaded = False; self._closed = True`，未调用 `_host.terminate` 或类似钩子。plan §3 未显式要求该行为，但实施 `2-3-6` 时若同一 provider 实例被多次复用，存在 native host 资源/句柄残留风险。

处置：在 `close()` 中加入 `_host.cleanup_all_tasks()` 或终止句柄，并新增单测验证"连续 close 两次"与"close 后 transcribe 抛 `V3_ASR_PROVIDER_CLOSED`"。

### 7.4 范围外（已记录，非新发现）

- B3 source 私音频已被清理，B3 仅提供身份/路线基线；本审确认 plan §1/§2 拒绝复用并强制新 run；
- `srt_normalizer.py` 已实现严格 SRT 解析（ID 唯一、时间戳合法、范围有序、不重叠、不越界、字符上限），但 `V3_MEDIA_TRANSCRIPT_*` 闭集映射发生在 service 层（plan §5），不在本审范围；
- 三层 cleanup barrier 中 `TaskAudioStager` / `TranscriptLineageManifest` / `SenseVoiceTranscriptService` / `TranscriptSemanticValidator` 在 plan §3 标记 "待新增"，符合"文档阶段 + 实施 NO-GO" 的当前位置；
- PRD §18.4 明确 V3-2 不展示/声称图文大纲、Mindmap、Ask、持久历史、导出或 V4 完成；本审未发现 V3-2-3 文档反向扩张。

---

## 8. 二元门禁

- **Fatal：0**
- **Major：1**（M-1：严格不变量在 fixture / contract-test 中未被强制）
- **Minor：2**（m-1 RawAsrTranscript 缺 `vad_segment_count` 字段；m-2 provider.close() 未触发 host 资源回收）

按 `01-audit-request.md` §3 二元规则：`Fatal=0/Major=0` 才允许 `DOCUMENT CONDITIONAL GO`；任一非零必须 `FAIL/REPLAN`。

本审 **Major=1** →

## **FAIL / REPLAN**

必须回退到文档阶段闭环：先修复 M-1（fixture 与 `validate_transcript_semantics` 同步 §4.2/§4.3/§4.4），重做独立复算；M-1 闭环前**不得**进入 V3-2-3 实现。

---

## 9. 限制

- 不重运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 产品 pytest / 旧 PX 工具；
- 不修改任何现有仓库文件；
- 仅写入本报告一份新文件；
- 不进入 V3-2-4 / V3-2 / V3 / V4 范围；
- B3 私音频已清理，本审不重运行时 cleanup 路径；
- cookie 值扫描依赖 cookie 文件未公开，本审仅复算 forbidden-context（依赖 B3 报告 §2.6）；
- 本审不重算 `weightsSha256` / VAD SHA-256 字节级匹配，仅依赖 schema const 与 plan §4 锁定声明（实施阶段 ST08 必查）。

---

## 10. 总结

- 19/19 载荷 SHA-256 全匹配，逐字节 0 mismatch；
- Schema Draft 2020-12 meta-validation PASS，positive instance validation PASS；
- B3 source 绑定、三个固定槽位、acceptance-only fault 隔离、failure code 闭集、2-3-0..7、ST01..ST20、低资源、timeout、V4 边界、V3-5 人工时点全部一致无 N/A；
- 但严格不变量 `segmentCount == speechIntervalCount` 在 fixture (`120 ≠ 24`) 与 `validate_transcript_semantics` (`>= 0.9` 阈值) 两处均未强制，构成 Major；
- 二元门禁：**FAIL / REPLAN**。

落盘路径：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-independent-document-audit-20261007.md`

仅写入此一个文件；其余仓库文件未修改。
