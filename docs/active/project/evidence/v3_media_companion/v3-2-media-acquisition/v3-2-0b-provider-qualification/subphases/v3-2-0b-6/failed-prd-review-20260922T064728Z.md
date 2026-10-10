# V3-2-0b-6 PRD 检视失败：20260922T064728Z

状态：`INVALIDATED AFTER STRUCTURAL 18/18 / REPLAN`

真实 Chrome 四视口、Axe、键盘、合同与 hash 验证均通过，独立 verifier 为 18/18；但截图人工检视发现固定 15 秒 bin 与 Paraformer 默认 30 秒 VAD segment 不对齐。样本 1、2 的第一个候选 bin 为空，整段文本被中点算法放入下一个 bin；样本 3 也存在同类空 bin。

这会让两名 reviewer 对同一真实有语音的空 bin 都判 `candidateMeaningPreserved=false`，从而每样本最多 14/16，可能不是模型文本质量而是证据分桶造成的失败。把 30 秒文本复制到两个 bin 或按字符比例切开同样会制造假证据，均禁止。

官方 `modelscope/FunASR` 的 `funasr-paraformer.cpp` 明确声明 `--vad-maxseg` 且默认 `30000`。最小、产品一致修复是由 `FunAsrLlamaCppProviderAdapter` 固定传入 `--vad-maxseg 15000`，重新执行三段完整 120 秒推理，再按同一 midpoint 规则分桶。来源：`https://github.com/modelscope/FunASR/blob/main/runtime/llama.cpp/paraformer/funasr-paraformer/funasr-paraformer.cpp`。

当前 run 的 label map、baseline、bundle、页面和 QA 结果全部不得作为人类审查输入；结构绿色不能覆盖 PRD 质量风险。
