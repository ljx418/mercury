# V3-5-3 PRD 规格检视

日期：2026-10-08。结论：`无 Fatal / 无 Major 规格偏差`。

## 覆盖结论

- 用户体验符合 V3：用户从 B站页面点击 Navia，完成一次任务授权后，得到同一 task 的图文大纲、时间线、导图和可审查证据。
- 画面能力未伪装：本轮使用真实短视频字节、本地选帧、本地 OCR 和 MiniMax 选定帧；四类 evidence 都由 Runtime 生成。
- 隐私边界保持：Cookie 只在短期 lease 内存和任务私有下载临时文件中使用；API key 仍在 OS Credential Vault；云端仅接收选定帧，不上传原视频、音频、完整转写或 OCR 全文。
- 开放架构保持：产品物化依赖 portal downloader、OCR adapter、vision provider registry，而不是把 B站或 MiniMax 逻辑写入 Workspace。
- V2 Know/RKM 与远期 Agent 未被误报为 V3 完成。

## 未扩大承诺

- Ask 页面仍是 V3-5-4 的待实现能力，当前仅证明路由壳可恢复。
- Evidence jumpback 当前明确显示为 V3-5-4，按钮禁用；未宣称已跳转视频。
- Export 当前仅为路由壳，不计导出完成。
- tabCapture 任意播放位置的绝对媒体时间映射尚未承诺；本轮固定从视频起点播放，确保转写与 0–8 秒视觉片段真实对齐。

## 风险

- Minor-1：视觉取帧和转写采集使用两个隔离 downloader 配置；后续应在部署文档中说明两者可指向同一冻结二进制，但生命周期不同。
- Minor-2：真实 run 仅覆盖一个固定 B站视频；多站点适配仍由 portal adapter 扩展，不属于 V3-5-3 出门范围。
