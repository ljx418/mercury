# V3-2-0b-5.3 固定窗口合同与 API 规格

日期：2026-09-22  
状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 作用域

本规格只定义 Runtime 内部的固定窗口 ASR 资格路线。无 Extension 公共 API 变化，无新 Cookie 权限，无新门户路由，无新用户功能。Settings 继续真实显示 Paraformer“已安装 · 质量未通过”，直到本工作包和后续独立实施审查通过。

## 2. 代码实体与分层

| 层 | 计划实体 | 状态 | 职责/禁止事项 |
|---|---|---|---|
| Acquisition boundary | `TaskAudioRef` | 已有概念，需复用 | 只含 task/audio identity 与受控私有引用；禁止 portal secret |
| Orchestration | `FixedWindowAsrOrchestrator` | 待新增 | 固定计划、顺序执行、合并、取消、cleanup barrier |
| Value objects | `FixedWindowPlan`、`ChunkAudioRef`、`ChunkInferenceResult`、`FixedWindowSampleResult` | 待新增 | 不可变、可校验；不得暴露正文和绝对路径到公共证据 |
| Provider boundary | `FunAsrLlamaCppProviderAdapter` | 已开发，需调用 | 每次只接收一个 chunk；禁止知道 portal/BVID/Cookie |
| Process host | `NativeAsrProcessHost` | 已开发，需复用 | tuple argv、`shell=False`、进程组、资源限制、脱敏诊断 |
| Qualification harness | `v3-asr-fixed-window-*` runner/verifier | 待新增 | 从零生成 24 chunk、机器门禁、盲评包、公开 evidence |

依赖必须单向：`Acquirer -> TaskAudioRef -> Orchestrator -> Provider -> ProcessHost`。UI、门户 adapter 和 Provider 均不得直接切片或合并。

## 3. 私有调用合同

建议内部接口：

```python
class FixedWindowAsrOrchestrator:
    def transcribe(
        self,
        audio: TaskAudioRef,
        *,
        plan: FixedWindowPlan,
        provider_id: str,
        attempt_id: str,
        cancellation: CancellationToken,
    ) -> FixedWindowSampleResult: ...
```

固定不变量：

- `plan.windowDurationMs=120000`
- `plan.chunkDurationMs=15000`
- `plan.chunkCount=8`
- `plan.overlapMs=0`
- `plan.maxConcurrency=1`
- `plan.expectedFrameCount=1920000`
- `plan.maximumTailPadFrames=16`
- `plan.tailPaddingPolicy=zero_pad_final_chunk_only_for_frozen_frame_shortfall`
- `audio.format=pcm_s16le_mono_16000hz`
- `provider_id=funasr_edge_local`

任何调用方传入其他值都以 `V3_ASR_FW_CHUNK_PLAN_DRIFT` 拒绝；不能由设置页或门户覆盖。

真实冻结输入的帧数为 `1919997/1920000/1920000`。实现必须先校验源文件 SHA-256 和上述帧数；只允许 sample 01 的最终 chunk 尾部补 3 个 PCM 零帧。源 WAV 不修改，24 个 `chunkSha256` 对实际发给 Provider 的完整 WAV 字节计算。源音频超长、缺失超过 16 帧、非最终 chunk 补帧或非零补帧均以 `V3_ASR_FW_AUDIO_FORMAT_INVALID` 拒绝。

## 4. 公共记录

公开记录只允许：

```text
runId / attemptId / sampleId
sourceAudioSha256
chunkIndex / startMs / endMs / chunkSha256
segmentCount / outputTextSha256
elapsedMs / peakRssBytes / exitCodeClass
cleanup counts / secretScan hitCount
policy/manifest/schema hashes
```

禁止公开：audio bytes、transcript text、Cookie、cookiefile、绝对路径、argv 中私有路径、stderr 原文、profile path、B站凭据或可逆 hash。

## 5. 时间与文本合同

每个 local segment 必须满足 `0 <= startMs < endMs <= 15000`。合并后：

```text
globalStartMs = chunk.startMs + localStartMs
globalEndMs   = chunk.startMs + localEndMs
segmentId     = fw_<sampleIndex>_<chunkIndex>_<localIndex>
```

全局结果必须位于 `[0,120000]`，严格按 `(globalStartMs, globalEndMs, segmentId)` 排序，0 重叠、0 重 ID。ASR 原文逐 segment 保留；只允许空白标准化，不允许拼接修辞、语义重写、相邻复制或推测缺词。

## 6. Attempt 与恢复合同

- `attemptId` 唯一绑定 run/sample/source hash/plan hash/provider manifest hash。
- 任一 chunk 失败，attempt 终止；新的 attempt 从 chunk 0 开始，不可引用旧 chunk 输出。
- 资格 runner 必须校验 3 个 source audio SHA-256 与冻结值精确一致。
- 原 T02/V3/0b-5/0b-5.1/5.2 证据只读；新 run 不覆盖、不链接、不拼接。
- 只有全部 24 chunk 通过机器门禁才允许生成 review bundle。

## 7. 延迟、资源与进程合同

三样本基线与上限：

| sampleId | 长窗基线 | 2x 上限 |
|---|---:|---:|
| `v3-asr-comparison-01` | 8180ms | 16360ms |
| `v3-asr-comparison-02` | 7380ms | 14760ms |
| `v3-asr-comparison-03` | 8140ms | 16280ms |

每个 sample 的 8 次推理总 wall time（包括切片、进程启动、解析和合并）不得超过对应上限。峰值 RSS <= 8 GiB，安装资产 <= 512 MiB，GPU 不可见，推理期网络不可用。禁止用并发换延迟。

## 8. 状态与 FailureCode

机器权威为：

- `contracts/v3_asr_fixed_window_contracts.schema.json`
- `contracts/v3-asr-fixed-window-policy-registry.json`
- `contracts/v3-asr-fixed-window-candidate-manifest.json`
- `fixtures/v3-asr-fixed-window-contract-fixtures.json`

`FW01..FW20` 与 registry 20 项一一对应。任何失败均使 `machinePassed=false`；人工 review 不生成。实现状态只允许：`document_candidate_not_authorized -> implementation_authorized -> machine_candidate -> human_review_pending -> qualified | failed_current_gate`。

## 9. 门户开放性

固定窗口层只处理 `TaskAudioRef`。新门户接入需要独立 `MediaPortalAdapter/MediaAcquirer`、permission/credential policy 和真实样本门禁；不得在本类中添加 B站 URL 解析、Cookie 名称、YouTube token 或小红书签名逻辑。共享的是音频格式与 ASR 结果合同，不共享权限与平台 PASS。
