# V3-4 MiniMax 中性图实时复验

日期：2026-10-08。性质：真实外部能力探针，不含用户页面、视频帧、音频、Cookie 或正文。

## 结果

- Provider：`minimax-cn-openai-vision`
- 模型：`MiniMax-M3`
- 区域：中国区受控端点
- 结果：PASS
- Provider latency：9775 ms
- 端到端 wall time：9779 ms
- usage：input 262 / output 43 / total 305 tokens
- 返回结构：`containsText`、`dominantColors`、`summary`
- `containsUserContent=false`

探针通过证明当前 API Key、区域、模型和多模态接口可用。它不构成 V3-4 真实视频帧授权，也不替代 12 页 production run。
