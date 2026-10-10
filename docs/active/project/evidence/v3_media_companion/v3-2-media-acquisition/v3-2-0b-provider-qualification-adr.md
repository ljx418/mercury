# ADR-V3-2-0b：低资源中文 ASR 生产候选

日期：2026-09-22。状态：`Accepted for document freeze / implementation not authorized`。

## Context

V3-2-0 的 `faster-whisper-small` 在三个真实 B站样本上出现 `critical=1`、`neither-acceptable=1`，V3-2-A06 因此失败。V3-2-0a 已关闭模型选择、安装、离线恢复和 Tiny 兜底，但没有生产质量模型。用户要求继续以 8 CPU cores、8 GiB、无 GPU 为基线，并保留开放 Provider 接口。

## Options

| 路线 | 优点 | 代价 / 风险 | 决定 |
|---|---|---|---|
| A. FunASR llama.cpp + Paraformer Q8 + FSMN-VAD | 官方便携 CPU 二进制；约 226 MiB ASR 权重；无需 Python/Torch；中文优化；支持 VAD/SRT 时间段 | 新 native process 边界；必须冻结二进制/权重/许可并在 Navia 样本上重验 | **采用** |
| B. Python/PyTorch FunASR Paraformer | 上游接口成熟，组件丰富 | 依赖、镜像和内存显著增加；供应链/remote code 面扩大 | 不进入低资源首选；A 不可冻结时返回用户决策 |
| C. Whisper Medium/Large/Turbo | 复用现有 adapter 方向 | Large 超出 8 GiB/no-GPU 分母；Small 已失败 | 本轮排除 |
| D. 在线/平台 ASR | 本机资源低 | 上传隐私、凭据、网络和平台可用性改变 PRD | 本轮排除 |

## Decision

1. 生产候选固定为 `funasr-paraformer-q8-cpu-v1`，机器清单见 `contracts/v3-asr-provider-qualification-candidate-manifest.json`。
2. Runtime 通过 `AsrProviderAdapter` 启动受控 native child process；Extension 不接触 binary、model URL、路径或命令行。
3. `faster-whisper-small` 是冻结的失败基线；Tiny 继续是 bundled fallback。任何安装、自检或上游 CER 声明均不等于 V3-2-A06 通过。
4. 官方 runtime/model/VAD 资产必须匹配 byte length、SHA-256、revision 和 license；推理阶段网络关闭，`remoteCodeAllowed=false`。
5. 真实质量仍使用原三个样本、原窗口和原 48 判断阈值。不得挑窗、换样本、补造 reviewer 或跨 run 拼接。

## Consequences

- 增加一个 native-process 生命周期和跨平台 release 资产治理面，但避免把 PyTorch 引入最低资源安装。
- Windows 与 Linux 均要各自验证 Runtime 资产；当前文档冻结不声明这些资产已在 Navia 运行。
- 若时间戳、许可、哈希、8 GiB 限制或真实质量任一失败，V3-2-0b fail closed，V3-2-1 继续 NO-GO。

## Authoritative sources

- FunASR Runtime release `runtime-llamacpp-v0.2.6`。
- `FunAudioLLM/Paraformer-GGUF` revision `1a5063b305a2b4e418ccffaf7be2c02a3cac6c89`。
- `FunAudioLLM/fsmn-vad-GGUF` revision `6840bae4c5c92ee8c04faaf4db23dd0105098d7f`。
- Toolkit MIT；本轮两个 GGUF 仓库 Apache-2.0。实现前仍需逐字节复核下载资产与 license bytes。
