# WP0 R7 受限收口回执

日期：2026-10-19

状态：`WP0 LIMITED PASS / R7 CONSTRAINED CLOSEOUT`。

严重度：Fatal 0 / Major 0 / Minor 0。原 R6 未通过项不作为本轮缺陷消失，而是作为已批准的产品范围限制继续保留。

## 决定

本候选封存 V3 Bilibili-first 的已实现主输入路径：公开或凭据字幕、受控任务期媒体下载和本地 SenseVoice ASR。三条自动路线失败时，产品明确进入 blocked 状态，不再静默启动浏览器标签页音频采集。

`tabCapture` relay v11 的所有权、背压、重启、durable handoff 和 fail-closed 实现及历史证据全部保留；用户入口默认关闭并标记为实验能力。原 R6 固定分母仍为 G1 29/29、G2 0/7、G3 8/8、G4 21/21，共 58/65，不能改写为 R6 PASS。

显式本地文件导入尚未实现，不属于本候选能力。它已进入 R7 后续独立 workpack，必须先完成原型、PRD、API、SourceAuthority、隐私和清理合同再开发。

## 本轮产品变化

- `TrustedTabCaptureCard` 增加内部 `experimentalEnabled` 开关，默认 `false`。
- 两个生产调用点均未传入该开关，因此不会显示捕获开始、停止或取消命令。
- 自动输入进入 `awaiting_capture` 时，启动卡显示“当前输入不可用”，明确浏览器采集是实验能力且不会自动启动。
- PRD、风险 ADR 与 V3 stage gate 同步记录主路径收敛和受限状态。

## 合同变化

- 公共 API、Runtime endpoint、Origin、ticket TTL、relay v11 schema、消息集合、FailureCode registry、固定阈值：`none`。
- 产品范围与 UX：有。`tabCapture` 从 V3 必需最终回退降为默认关闭的实验能力。
- 历史证据：未修改。

## 变更文件

- `apps/chrome-extension/src/modules/media_companion/capture/TrustedTabCaptureCard.tsx`
- `apps/chrome-extension/src/modules/media_companion/MediaCompanionLaunchCard.tsx`
- `apps/chrome-extension/src/modules/media_companion/tests/TrustedTabCaptureCard.test.tsx`
- `docs/active/project/01-prd.md`
- `docs/active/project/design/v3-media-companion-risk-adr.md`
- `docs/active/project/stage-gates/v3-media-companion.md`
- `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-route-decision-2026-10-19/`
- `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-scope-amendment-2026-10-19/`
- `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r7-preimplementation-2026-10-19/`
- 本目录的 R7 收口证据。

## 边界

本回执只关闭 V3 completion 的 WP0/P0 输入链与 capture 安全工作包，不宣布整个 V3 完成。V3-5.10 B-5 六视频质量分母、人工质量项、Stage C/D/E 以及总 stage closeout 仍按上位文档状态执行。
