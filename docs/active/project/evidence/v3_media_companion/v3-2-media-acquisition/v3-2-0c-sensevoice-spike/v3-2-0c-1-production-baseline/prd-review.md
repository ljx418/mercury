# V3-2-0c-1 PRD 规格检视

日期：2026-09-22  
结论：`PASS / NO MATERIAL DRIFT`

## 1. 已实现体验

用户在“设置 > 媒体与语音”可看到 SenseVoiceSmall Q8 的下载、平台包、硬盘、内存、CPU、显存和安装空间成本。未安装时只能安装，不能提前选择；官方资产完成 hash 校验、自检和原子发布后才能选择。选中后 UI 与 Runtime 同时显示 requested/effective 为 SenseVoice，重启不回退。

真实 B 站私有音频的已知遗漏窗口已经由正式 Adapter 输出非空、时序合法的 SRT，证明 spike 能力已接入正式 catalog/manager/adapter/settings 链路。

## 2. 与 PRD 的一致性

- 符合 PRD 18.9：SenseVoice 是 V3 本地转写开发基线，不冒充 `production_qualified`。
- 保持低资源方向：CPU-only、无需 GPU；实际目标窗口约 1.17 秒完成。
- 保持隐私边界：音频、转写正文和私有绝对路径不进入公开 evidence。
- 保持开放 provider/model 接口：选择由 catalog modelId 和闭集 runtime spec 驱动，没有把 B 站 Cookie、portal identity 或页面对象传入 ASR Adapter。
- 未进入媒体下载、视频理解、图文大纲或其他门户适配，未扩大本工作包。

## 3. 明确延期到 V4

- 跨模型质量退化检测。
- SenseVoice 失败后的自动质量判定和智能模型回退。
- 24-bin 比较与后续质量提升不作为本次 V3 基线 PASS 的必要条件。

Tiny 仍是技术安全兜底，但本阶段不承诺它在 SenseVoice 质量失败时自动保持同等转写质量。

## 4. 偏差判断

Fatal=0，Major=0。未发现缩小本阶段固定分母、复用旧 spike 冒充正式安装、公开敏感内容或把开发基线夸大成 V3 整体完成的情况。

