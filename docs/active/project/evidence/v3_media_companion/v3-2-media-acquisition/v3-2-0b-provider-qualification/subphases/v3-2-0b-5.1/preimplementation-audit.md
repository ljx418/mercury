# V3-2-0b-5.1 实施前审计

日期：2026-09-22  
结论：`GO FOR V3-2-0b-5.1 ONLY`

- Fatal=0。
- Major M-1（30 秒 segment 对 15 秒 bin 的假阴性）已由官方 CLI 参数能力确认可在生产 Adapter 层关闭；禁止采用文本后处理猜切。
- 原 0b-5 运行与资源证据仍有效地证明候选能运行，但候选 transcript 不再是质量比较输入。
- 原 `v3-2-0b-6-20260922T064728Z` 已因 PRD 检视失败作废，即使其结构 verifier 为 18/18 也不得恢复。
- 新实现保持同一 Provider、模型、音频、资源和安全边界，只改变官方 FSMN-VAD 最大 segment 时长。

Fatal=0 / Major=0 / Minor=1。Minor M-1：`--vad-maxseg 15000` 保证单 segment 上界，不数学保证每个固定 bin 都非空；因此 B051-09 必须在真实输出上 fail closed。
