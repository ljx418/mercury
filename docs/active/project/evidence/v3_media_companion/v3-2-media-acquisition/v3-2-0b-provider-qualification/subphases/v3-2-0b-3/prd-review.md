# V3-2-0b-3 PRD 规格检视

日期：2026-09-22

- 时间轴完全由 SRT 与受控音频 duration 交叉验证，不信任模型汇总。
- 不改写文本、不补段、不重排、不合并，因此不会隐藏 VAD/ASR 缺陷。
- Parser 不含 portal/Cookie/URL；继续支持未来任意 Portal 的通用 TaskAudioRef。
- 本阶段仅 contract fixture；未声称真实 B站三样本时间轴已通过。

规格偏差=0，假绿修复=0。允许进入 `0b-4` 计划与审计。
