# V3-2-0b-1 真实 CLI 探测

日期：2026-09-22

## 输入身份

- 归档：`funasr-llamacpp-linux-x64.tar.gz`
- SHA-256：`779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52`
- executable：`llama-funasr-paraformer`，归档内 bytes=`2424840`

## README 合同

```text
llama-funasr-paraformer -m paraformer.gguf --vad fsmn-vad.gguf -a audio.wav --srt
```

stdout 用于 SRT，progress/timing diagnostics 位于 stderr；不带 `--srt` 时输出普通文本。

## Binary 探测

执行 `llama-funasr-paraformer --help`：输出 usage，exit code=`1`。这说明上游 binary 没有独立的成功 help 路径，不能把 exit 0 写成硬门槛。探测没有传模型或音频，因此未加载模型、未执行推理。

## 文档修订

B01-14 已从“exit 0”改为“usage 形状匹配且接受冻结的 exit 1 基线”。修订没有降低真实推理门槛；后续 load/self-test 仍必须使用实际模型和音频并要求成功。
