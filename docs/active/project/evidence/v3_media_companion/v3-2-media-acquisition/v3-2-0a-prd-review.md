# V3-2-0a PRD 规格检视

日期：2026-09-21。审查对象：V3-2-0a 本地实现候选与 PRD §18.2/18.4/18.5。

## 结论

本子阶段没有扩大 V3 产品承诺。实现只覆盖用户明确要求的多 Provider 开放接口、模型选择与资源影响、最低资源 Tiny 兜底、一键校验安装、进度/取消和 `.navia-asrpack` 手动恢复。门户 adapter 与 ASR provider 分离，后续 YouTube/小红书不会继承 B站 Cookie/DOM 逻辑。

## 对账

- 用户体验：Settings 中可见模型、质量、资源、requested/effective/fallback；安装弹窗可操作；失败后有自动重试和手动恢复说明。
- 架构：Extension 只经 `runtimeClient` 调 Runtime；模型源、文件、hash、自检和发布由 `AsrModelManager` 权威控制。
- 低资源：Tiny 在 8 cores/8 GiB/no-GPU 下完成真实音频推理，发布增加量小于 100 MiB。
- 安全：客户端不能提供 URL/hash/path/provider；redirect 每跳校验；离线包拒绝 link/traversal/错误 identity/hash/超限。
- 质量：Tiny 固定为 fallback-only，Small 固定为 failed-current-gate；V3-2-A06 未通过事实完全保留。
- 未实现：媒体获取、字幕正文、可信 tabCapture、生产 transcript、关键帧/OCR/VLM、VideoOutline/Mindmap/Ask/反跳/历史/导出。

## 规格偏移判断

Fatal=0，Major=0。没有以安装成功替代 ASR 质量，没有引入云端 ASR、任意 provider 代码或全站门户权限。正式发行物如何携带已准备的 Tiny 资产仍需在 release/installer 阶段冻结，不能把开发候选目录称为已发布安装包。
