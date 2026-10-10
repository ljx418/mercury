# V3-3-2 确定性采样实施出门审计

日期：2026-10-08。

结论：`V3-3-2 LIMITED PASS`。Fatal=0，Major=0，Minor=1。

- 实现固定 `scene-change-plus-timeline-budget/v1`，Provider/UI 无预算参数。
- 候选、selected、cloudEligible 上限固定为 24/12/8；时间点升序去重并留出不超过 250ms 的容器尾部安全区。
- 首测发现 `duration-1ms` 可能落在最后可解码帧之后，现已 fail-closed 修复并加入尾部断言。
- 30 项抽帧/采样/Acquisition 回归 PASS。
- 真实 B站锚点结果：连续两次 receipt 完全相等；23 candidates、12 selected、8 cloudEligible；hash `b2bfb267...41fd24`；Provider dispatch=0。
- 机器证据：`v3-3-dependency-freeze/v3-3-2-real-bilibili-sampling-result.json`。

Minor M-1：此处只覆盖 1 个真实样本；10 页完整分母留给 V3-3-6 单 run，不能跨 run 拼接。

允许进入 V3-3-3；禁止声明 OCR/VLM 或 V3-3 PASS。
