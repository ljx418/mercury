# V3-2-0b-5.1b PRD 规格检视

日期：2026-09-22。

## 结论

本子阶段与 PRD 一致：安装成功、生产质量资格和实际生效模型是三个独立状态。Paraformer 可下载安装和诊断，但真实质量门禁失败后必须不可选择；用户在 Settings 看见明确失败原因，系统继续实际使用 Tiny fallback-only。

真实 Chrome 证明：质量失败未被绿色 ready 文案掩盖、未被安装成功升级为 production-qualified、未静默切换 effective model；资源披露、离线安装恢复、键盘焦点、四视口和 Axe 均未回归。

## 边界

- 不声称 V3-2-A06 通过。
- 不启动双人盲评，不生成可供绕过机器门禁的人类评审包。
- 不实现媒体获取、生产 transcript、关键帧、OCR/VLM、大纲、Mindmap 或 Ask。
- 不改变三样本、24 bin、双 reviewer、critical/neither 或每样本 15/16 阈值。

因此 V3-2-0b 保持 `FAIL / REPLAN`；0b-6/0b-7 与 V3-2-1..7 保持 NO-GO。
