# V3-2-0b 低资源 ASR Provider 资格恢复开发计划

日期：2026-09-22。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. Objective

在不进入媒体获取的前提下，为现有 `AsrModelManager` 增加受控 `funasr_edge_local` 资格候选，并用原三个真实 B站样本重新完成机器证据和双人盲评。唯一成功条件是关闭 V3-2-A06；否则保持 V3-2-1..7 NO-GO。

## 2. Frozen boundaries

- In：Provider adapter、native host、资产校验/安装、统一 timestamped transcript、Settings 状态、低资源探测、私有比较 bundle、双人 review、adjudication、审计。
- Out：`AcquisitionCoordinator`、B站字幕/媒体产品获取、tabCapture、关键帧/OCR/VLM、大纲、Ask、V4。
- 不修改历史失败 run、V3-2-0a 审计包或 `faster-whisper-small` 质量标签。

## 3. Target entities and data flow

```text
Settings / AsrModelSettingsPanel
  -> existing /v1/asr/catalog|settings|installations
  -> AsrModelManager (closed catalog, requested/effective/fallback)
  -> AsrProviderRegistry
  -> FunAsrLlamaCppProviderAdapter
  -> NativeAsrProcessHost
  -> llama-funasr-paraformer + paraformer-q8.gguf + fsmn-vad.gguf
  -> AsrTranscriptCandidate(timestamped segments)

Qualification harness (not product route)
  -> frozen private audio windows
  -> Paraformer candidate + frozen Small baseline
  -> blind ComparisonBundle v2
  -> reviewer A + reviewer B
  -> adjudication -> quality.status
```

`NativeAsrProcessHost` 只接受 catalog 生成的 argv；stdin/file input 位于 task-private directory；禁 shell、禁客户端路径、禁继承代理和 hub token。stdout 只解析 SRT/text，stderr 只进入裁剪后的私有诊断。

`QualificationSemanticValidator` 必须直接读取两份不可变 `IndependentReview`，按 `(reviewerId, sampleId, binIndex)` 重算 48 个唯一键、按 `(sampleId, binIndex)` 重算 24 个键、逐样本 numerator、critical、neither 和分歧集合。它不得信任 `Adjudication.summary` 自报计数；自报值与重算值不一致即失败。Adjudicator 只给分歧附加解释记录，不能删除或覆盖原始判断。

## 4. Implementation stages after explicit authorization

| Stage | Work | Exit condition |
|---|---|---|
| 0b-0 | 独立下载并复算两平台 runtime、Paraformer Q8、FSMN-VAD、license；冻结 build/dependency manifest | 所有 bytes/hash/revision/license 一致；否则停止 |
| 0b-1 | `AsrProviderAdapter`、registry、native process host、取消/timeout/cleanup | adapter contract 正负例全通过；0 shell/任意路径 |
| 0b-2 | Catalog/manager/installer 接入；requested/effective/fallback 与 quality 状态分离 | 未资格化模型不可误标 production；Tiny 始终可恢复 |
| 0b-3 | 统一 SRT/segment normalizer；检测空段、逆序、重叠和越界 | 三份 contract fixture 和 fault fixture 通过 |
| 0b-4 | Settings 资源/质量/安装状态；真实 UI -> Runtime 安装链 | 真实下载、校验、ready/effective 由同一 Chrome run 观察 |
| 0b-5 | 8 cores/8 GiB/no-GPU 真实推理与资源证据 | 三个固定 120 秒窗口完整；推理期 0 网络；无 OOM |
| 0b-6 | 新 bundle、两名 reviewer、分歧复核 | 48 判断完整；无模型标签泄漏；清理/秘密扫描通过 |
| 0b-7 | PRD 检视、独立实施出门审查 | A01..A18 全通过且 Fatal=0/Major=0 |

## 5. Public contract changes planned

- 现有 `/v1/asr/*` 路径不变，只向 catalog/model 描述追加可选 `runtimeKind`、`capabilities`、`quality.gateVersion` 和 `quality.qualificationRunId`；旧前端可忽略。
- 新内部接口 `AsrProviderAdapter.load/selfTest/transcribe/close`，不得直接暴露给 Extension。
- 新证据类型 `AsrTranscriptCandidate`、`ResourceObservation`、`QualificationRun`、`IndependentReview`、`Adjudication`。
- `quality.status` 计划闭集：`fallback_only | failed_current_gate | not_evaluated | qualification_pending | production_qualified`。现有客户端继续识别前三项；新增状态必须先更新 Schema/类型并保持未知值 fail closed。安装完成最多进入 `qualification_pending`，只有 A01..A18 和独立出门审查通过后，stage-gate owner 才可写 `production_qualified`。

## 6. Stop conditions

出现任一情况立即停止并回到文档/ADR：上游资产漂移；许可不明；需要 remote code；Windows/Linux 任一目标无法启动；峰值超 8 GiB；无时间戳；真实样本不足；人工门槛失败；Cookie/音频/私有路径进入公开证据；只有 UI intercept 而无真实 Runtime 链；独立审计 Fatal/Major 非零。
