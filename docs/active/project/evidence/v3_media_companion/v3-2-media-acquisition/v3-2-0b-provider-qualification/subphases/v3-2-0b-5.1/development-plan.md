# V3-2-0b-5.1 15 秒 VAD 时间粒度修复开发计划

日期：2026-09-22  
状态：`AUTHORIZED UNDER V3-2-0b / PREIMPLEMENTATION AUDITED`

## 目标

修复真实 PRD 检视发现的 30 秒 segment 对 15 秒盲评 bin 的假阴性风险。生产 `FunAsrLlamaCppProviderAdapter` 固定向官方 CLI 传 `--vad-maxseg 15000`，随后从冻结资产、三个真实 120 秒 WAV 和同一低资源边界全量重跑候选输出。不得后处理拆字、复制跨 bin 文本或只重跑空 bin。

## 修改范围

- `services/local-runtime/navia_runtime/modules/media_companion/asr/funasr_llamacpp.py`：固定参数 `--vad-maxseg 15000`。
- Provider 单元测试：精确断言 argv、拒绝回退到默认 30000。
- 新的 0b-5.1 runner evidence：三样本全量推理、所有 segment 时长 `<=15000ms`、原 0b-5 音频 hash 不变、资源/断网/GPU/清理门槛不变。

## 边界

该修复改变候选转写的 VAD 切段粒度，不改变模型 bytes、文本解码模型、ASR 语言能力、用户设置、默认 Tiny 或可选状态。旧 0b-5 candidate 与 `064728Z` bundle 保留但作废，不能与新 lineage 拼接。
