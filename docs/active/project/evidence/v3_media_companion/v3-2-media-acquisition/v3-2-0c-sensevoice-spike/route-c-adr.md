# V3-2-0c 路线 C ADR：SenseVoiceSmall 真实最小 Spike

日期：2026-09-22  
状态：`FROZEN FOR ISOLATED SPIKE / PRODUCTION NO-GO`

## 1. 决策

在 Paraformer 长窗和固定 15 秒窗均出现非静音完整遗漏后，选择官方 FunASR llama.cpp `runtime-llamacpp-v0.2.6` 中的 `llama-funasr-sensevoice` 与官方 `SenseVoiceSmall-GGUF` Q8 权重，执行隔离、CPU-only、真实音频最小 spike。

该决策不修改产品 Provider registry、模型设置页、默认 Tiny fallback、`TaskAudioRef`、门户适配器或 V3-2 固定生产分母。spike 成功只证明路线值得进入生产候选文档冻结；失败则关闭本候选并保持 Tiny 生效。

## 2. 已冻结事实

| 对象 | 冻结值 |
|---|---|
| Runtime tag / source commit | `runtime-llamacpp-v0.2.6` / `a57c05bfe2a91b5e0cb0983479634eba3e28ede5` |
| Linux portable archive | `8014474` bytes / SHA-256 `779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52` |
| SenseVoice binary | `2442392` bytes / SHA-256 `c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd` |
| Runtime license | MIT |
| Model repository / revision | `FunAudioLLM/SenseVoiceSmall-GGUF` / `90c1c61912018b70ada0fcc024ea24aca62f2e63` |
| Model file | `sensevoice-small-q8.gguf`, `254208320` bytes, SHA-256 `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` |
| Model card license | Apache-2.0 |
| VAD | 既有 `fsmn-vad.gguf`, SHA-256 `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` |
| 资源边界 | 8 cores、8 GiB address space、no GPU、安装资产总量 <= 512 MiB |

官方 CLI 支持 `--srt`；SenseVoiceSmall 无 VAD 时只产生覆盖整个输入的单条时间段，因此 spike 必须使用冻结 FSMN-VAD，不得把整窗边界宣传为语音级时间戳。

## 3. 开放架构边界

未来生产路线仍为 `TaskAudioRef -> AsrProviderRegistry -> LocalAsrAdapter -> NativeAsrProcessHost`。门户 URL、Cookie、BVID、YouTube ID、小红书签名均在 `TaskAudioRef` 之前终止传播。SenseVoice 只能成为新的 provider descriptor；不得在通用 ASR 层新增 B站字段。

## 4. 备选与否决

- 不继续 Paraformer 上下文裁剪：缺少词级时间戳，中心归属可能造假或漏字。
- 不升级 Faster-Whisper 大模型：当前低资源/512 MiB约束下成本过高。
- 不直接接入 SenseVoice：未经 24-bin、双 reviewer、状态 UI、回归和独立审计，不具备生产资格。

## 5. 出门边界

最小 spike 仅可得到 `SPIKE_FEASIBLE` 或 `SPIKE_FAILED`。禁止输出 `qualified`、`production_ready`、`V3-2 PASS` 或改变用户可选模型。
