# V3-2-3 SenseVoice 全长转写开发计划

日期：2026-10-07。状态：`RESUMPTION DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / B3 LIMITED PASS`。

## 1. 目标与边界

对 Route B3 固定的三个 ASR 能力槽位重新创建三个全新任务，在每个任务的同一私有生命周期内完成“真实 B站当前分 P 获取 -> SenseVoiceSmall Q8 全长转写 -> 语义验证 -> 清理”，输出可复算的 `MediaTranscript`。B3 已封存 run 只作为样本身份和路线基线，不能提供音频输入。

V3-2-3 不实现新的下载器、不启动 `tabCapture`、不抽帧、不生成大纲，不执行跨模型比较或智能质量回退。获取动作仍由已通过的 V3-2-2 Acquirer 执行；本阶段新增的是 acquisition 与 transcript 的同 task 编排。

唯一数据流：

```text
Route B3 frozen slots (sample-07/08/09)
-> new V3-2-3 run + three new MediaAcquisitionTask
-> BilibiliMediaAcquirer (real credentialed current-part PCM)
-> task-private AcquisitionAudioRef
-> TaskAudioStager (hash/shape verified copy, no link)
-> FunAsrLlamaCppProviderAdapter(SenseVoiceSmall Q8 + FSMN-VAD)
-> strict SRT parser + VAD-count coverage guard
-> TranscriptSemanticValidator
-> LocalAsrRecord + MediaTranscript + public execution receipt
-> ASR staging cleanup + acquisition sandbox cleanup
```

三个任务属于一个全新 `v3-2-3-sensevoice-<timestamp>` run，但各自使用独立 `taskId`、lease、sandbox、acquisition record 和 transcript。禁止从三个不同 run 拼接。

## 2. 固定分母与 lineage

| slot | sampleId | bvid | B3 角色 | 本阶段要求 |
|---:|---|---|---|---|
| 0 | `v3-sample-07` | `BV13W41137qV` | ASR capability | task-time 0 字幕则直接媒体；存在字幕时只允许预绑定 `subtitle_body_http_503` acceptance fault 一次 |
| 1 | `v3-sample-08` | `BV1ZpYd66ELP` | ASR capability / anchor | task-time 0 字幕则直接媒体；存在字幕时只允许预绑定 `subtitle_body_http_403` acceptance fault 一次 |
| 2 | `v3-sample-09` | `BV1pW421c7DH` | ASR capability | task-time 0 字幕则直接媒体；存在字幕时只允许预绑定 `subtitle_body_empty` acceptance fault 一次 |

产品 Runtime/API/Acquirer 不允许表达 acceptance fault。真实验收 runner 必须复用 B3 已审计 wrapper：每个槽位先执行真实 task-time 字幕发现；0 候选不注入，存在候选时只应用该槽位预绑定故障一次，然后获取真实当前分 P 媒体并立即转写。三槽 `runtime_no_subtitle + audited_subtitle_failure = 3`，但动态分布不预设。不得换 URL、运行后改故障、复用 B3 音频或把字幕转成伪 ASR。

run 级 lineage manifest 必须绑定：B3 source run/content SHA、当前 runId、三个固定 slot、每个 task/source/acquisition/audio/transcript hash、模型 profile、清理 receipt、`crossRunArtifactCount=0`、`humanTranscriptInputCount=0`。

## 3. 代码实体

| 实体 | 目标路径 | 职责 | 状态 |
|---|---|---|---|
| `AcquisitionAudioRef` | `acquisition/contracts.py` | 绑定 task/source/acquisition/artifact hash、时长和 PCM shape | 待新增 |
| `TaskAudioStager` | `acquisition/audio_ref.py` | 从 `TaskArtifactSandbox.private_path()` 流式复制到 ASR 专用 0700 task root，目标 0600、单链接、hash/shape/bytes 精确相等 | 待新增 |
| `TranscriptLineageManifest` | `acquisition/transcript_lineage.py` | 固定三个 slot 与同 run provenance；拒绝跨 run、重复 task/source/audio | 待新增 |
| `SenseVoiceTranscriptService` | `acquisition/transcript_service.py` | 串行管理 acquisition input、进度、取消、provider 生命周期、验证和双层 cleanup | 待新增 |
| `FunAsrLlamaCppProviderAdapter` | `asr/funasr_llamacpp.py` | 复用冻结 native host；解析私有 stderr 中唯一 VAD 总段数，不公开原始 stderr | 需修改 |
| `RawAsrTranscript` | `asr/provider.py` | 增加结构化 `vad_segment_count`，不携带 stderr | 需修改 |
| `StrictSrtTranscriptParser` | `asr/srt_normalizer.py` | 严格解析时间、文本、顺序和边界；不改写正文 | 需扩展 |
| `TranscriptSemanticValidator` | `acquisition/transcript_validator.py` | 复算 segment/text/content hash、VAD 覆盖和三方绑定 | 待新增 |
| Runtime API | `navia_runtime/app.py` | closed-body create/read/cancel transcript API；不返回路径、stderr、模型目录 | 待新增 |
| V3-2-3 runner/verifier/sealer | `services/local-runtime/scripts/` | 单 run 真实 acquisition+ASR、故障、资源、秘密和 seal | 待新增 |

`TaskAudioStager` 必须复制而非 symlink/hardlink。ASR staging root 与 acquisition sandbox 分离；provider finally 清理 ASR staging，service cleanup barrier 再清理 acquisition sandbox。任一层残留都禁止终态成功。

## 4. 冻结 Profile 与覆盖算法

- provider：`funasr_edge_local`。
- engine/version：`funasr-llamacpp` / `runtime-llamacpp-v0.2.6`。
- model：`funasr-sensevoice-small-q8`。
- revision：`90c1c61912018b70ada0fcc024ea24aca62f2e63`。
- weights SHA-256：`4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5`。
- VAD：`fsmn-vad.gguf`，SHA-256 `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479`，`vadMaxSegmentMs=15000`。
- device/compute：`cpu/q8`；cloud upload=`false`；质量状态=`development_baseline`。

`speech_interval_overlap/v1` 的可实现语义冻结为：

1. provider 只接受 stderr 中精确一条 `VAD ready: N segments` 和精确一条终态 `N vad segments`，两者必须相等且 `N>0`；其余 stderr 不公开。
2. SRT 必须有 `N` 个非空、单调、不重叠、边界内 segment。由于冻结 runtime 只为非空识别结果写 SRT，`SRT count != N` 表示至少一个 VAD 语音段遗漏，直接 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`。
3. 仅当 `SRT count == N` 时发布成功 coverage receipt：`speechIntervalCount=N`，`speechDurationMs=sum(SRT interval union)`，`coveredSpeechDurationMs=speechDurationMs`，`coverageRatio=1.0`，`passed=true`。
4. 不允许用 SRT 自身计数替代 VAD 总数；不允许在 count mismatch 时估算缺失时长或声称 >=90%。该规则比 PRD 的 >=90% 更严格，以避免当前二进制不公开完整 VAD interval list 导致假绿。

## 5. 固定 failure code

`V3_MEDIA_TRANSCRIPT_TASK_INVALID`、`V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`、`V3_MEDIA_TRANSCRIPT_AUDIO_UNAVAILABLE`、`V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE`、`V3_MEDIA_TRANSCRIPT_MODEL_MISMATCH`、`V3_MEDIA_TRANSCRIPT_PROCESS_TIMEOUT`、`V3_MEDIA_TRANSCRIPT_PROCESS_FAILED`、`V3_MEDIA_TRANSCRIPT_OUTPUT_LIMIT`、`V3_MEDIA_TRANSCRIPT_EMPTY`、`V3_MEDIA_TRANSCRIPT_INVALID`、`V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`、`V3_MEDIA_TRANSCRIPT_CANCELLED`、`V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE`。

底层 `V3_ASR_*` 只能在 service 内映射到上述闭集，不得透传任意 stderr 或动态消息。

## 6. 子阶段顺序

| 子阶段 | 实施内容 | 自动出门 |
|---|---|---|
| `2-3-0` | 冻结 transcript v2 语义、lineage manifest、failure code 与 fixtures | Schema/meta、positive、negative、B3 source binding 全通过 |
| `2-3-1` | `AcquisitionAudioRef` / `TaskAudioStager` | task/source/hash/shape 精确；路径、link、cross-task、mutation 全拒绝 |
| `2-3-2` | `SenseVoiceTranscriptService` | 每任务单向状态；三个任务串行；取消和失败只终结一次 |
| `2-3-3` | provider VAD count、strict parser、semantic validator | VAD count 与 SRT count 相等；时间/hash/provenance 可复算 |
| `2-3-4` | Runtime API、进度与 cancel hook | closed body；幂等；终态后无晚到写入；无私有字段 |
| `2-3-5` | 全新单 run 三个真实能力槽位按 B3 wrapper acquisition+全长 ASR | 3/3 真实媒体、动态触发和=3、3/3 非空 transcript、固定 profile、coverage=1.0 |
| `2-3-6` | 故障、隐私、低资源和全量回归 | 负例分组独立 assertion；0 secret/residual；8 cores/8 GiB/no-GPU 实测 |
| `2-3-7` | PRD review、false-green、seal 与独立出门审计 | Fatal=0/Major=0；只放行 V3-2-4 实施前审计 |

## 7. 停止条件

任一固定槽位未走真实 `credentialed_media_asr`；fault 在生产代码可达、未先真实发现、非预绑定或执行超过一次；任何输入不属于当前 task/current part；模型/VAD身份漂移；VAD count 缺失/冲突；SRT 空或 count mismatch；取消后仍写 segment；双层 cleanup 有残留；公开证据含路径、原始音频、转写正文、Cookie 或 stderr；资源超过 8 GiB；或需要换 URL/模型/路线时，立即 `FAIL/REPLAN`。

## 8. 交付效果

用户只能看到真实获取路线、单调转写进度、可取消状态和最终带时间戳 transcript。不得在本阶段显示大纲、Mindmap、Ask、画面理解、持久历史或“生产质量认证”。人工听写、语义质量主观比较与模型自动回退均不在本阶段执行。
