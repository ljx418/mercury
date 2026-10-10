# V3-2-0b 真实遗漏后的重规划路线

日期：2026-09-22。状态：路线 A 文档冻结已授权；实现仍 NO-GO。

## 已确认事实

1. Paraformer 在 120 秒长窗、`--vad-maxseg 15000` 下遗漏 sample 03 的一个非静音 15 秒 bin。
2. 同一 bin 单独输入同一模型时得到非空输出，根因与长窗 VAD/切段上下文强相关。
3. BiliNote clean commit `be388939...` 默认是 Faster-Whisper Tiny；Navia 已提供同等级 Tiny 作为 fallback-only，它不能计入生产质量门禁。
4. 当前所有候选仍不可生产选择，V3-2-1 保持 NO-GO。

## 路线对比

| 路线 | 做法 | 优点 | 风险/代价 | 决定 |
|---|---|---|---|---|
| A 固定 15 秒预切片 Paraformer | 对全部三段统一切成 24 个 15 秒私有 chunk，顺序推理，按 offset 合成时间戳；再完整双人盲评 | 复用已冻结约 230 MiB 资产；约 300 MiB RSS；诊断已证明失败 bin 可输出；继续满足无 GPU低资源 | 改变生产推理合同；边界词可能截断；命令数量扩大 8 倍；必须防重复/错位/取消残留 | **推荐** |
| B Faster-Whisper Medium CPU int8 | 在现有 Faster Whisper provider 增加固定 Medium revision/hash，重跑相同分母 | BiliNote 已支持该档位；复用现有 provider/安装 UI；MIT 路线简单 | 约 1.5 GiB 模型，CPU 更慢；质量未知；需新增 catalog/资产/资源实测 | 备选 |
| C SenseVoiceSmall GGUF CPU | 新增 SenseVoice provider/runtime，FSMN-VAD 或固定切片，重跑相同分母 | 官方强调中文/粤语与 CPU edge；模型路线适合中文 | 新 runtime/合同/许可证义务；时间戳与长音频切片需重新验证；攻击面最大 | 后备研究 |
| D 停止生产质量恢复 | 保留 Tiny fallback、Small/Paraformer 失败标签 | 无新增依赖和风险 | V3-2-A06 永久失败，V3-2-1..7 不能继续 | 可选停止 |

## 路线 A 必须冻结的新增合同

- `FixedWindowAsrOrchestrator`：只接受 Runtime 私有 `TaskAudioRef`，固定 15000ms、顺序执行、每任务最大 chunk 数与总时长。
- 每个 chunk 从原始 WAV 确定性导出，记录 source audio hash、chunk index/start/end/hash；0 跨 run、0 只补失败 bin。
- segment 先在 chunk 内归一化，再统一加 offset；禁止复制相邻文本、重写 ASR 文本或跨 chunk 猜测。
- 任一非静音 chunk 无输出、时间错位、重复 ID、取消残留、OOM/timeout 均 fail closed。
- 三样本必须全部从零生成 24 个 chunk，随后重建匿名 A/B bundle、两位独立 reviewer 48 判断和完整 A01..A18。

## 授权边界

路线 A 会改变 candidate manifest、生产推理实体和威胁模型，超出当前 0b-5.1 修复范围。需要用户明确批准后，先完成详细开发/验收计划、内部审计与外部文档审查，再实施代码。不得直接用单 bin 诊断替代三样本全量证据。

2026-09-22 用户已批准按推荐路线继续推进，当前授权只覆盖 `V3-2-0b-5.3` 文档撰写、内部审查与外部审计包。外部审查 Fatal=0/Major=0 后仍需新的明确实现授权；本次批准不得解释为代码实施授权。

来源事实：BiliNote clean commit 的 `TranscriberConfigManager` 固定默认 `fast-whisper/tiny`；Faster-Whisper 官方 README 给出 CPU int8 用法和 Small CPU内存基准；SenseVoice 官方仓库声明其 Small checkpoint 支持中文、粤语、英文、日文、韩文并提供 CPU/GGUF 路线。具体版本、hash、许可和资源必须在相应新路线文档冻结，不能由本比较表代替。
