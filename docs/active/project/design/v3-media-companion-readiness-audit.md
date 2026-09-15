# V3 Media Companion Readiness Audit

日期：2026-09-15。性质：主代理内部文档复核；仍需外部独立审查。

## 1. 本轮触发

用户要求把 BiliNote 研究固化到 V3，并以 BV1ZpYd66ELP 为首个 B站样本。实际能力探测发现该视频公开字幕为空；同时 PX-6 H01 本地页面显示 Mock adapter 和 data_service unchecked。

原“V3.0 只做 transcript-first、ASR 全部延后”的计划不能让指定样本生成可信大纲；原 H01 wording 也不足以证明真实持久化。本轮因此同步修订产品、架构、计划、验收和 Draw.io。

## 2. 已闭环的文档问题

- 平台顺序改为 B站优先，YouTube 后续映射。
- 首个 BV 的 bvid/cid/时长/字幕事实和不可替换规则已冻结。
- 本地 ASR 作为 V3.0 限定 fallback；trusted user action、取消、清理和禁止自动下载已写入。
- BiliNote 的字幕/ASR/后台任务/时间戳图文路线已映射，marker 正则权威和自动下载路线被拒绝。
- MediaPageContext、MediaCaptureGrant、MediaTranscript、MediaIngestRun、VideoOutline、MediaEvidenceRef、MediaJumpbackTarget 及具体代码所有权已定义。
- 12 页 B站固定分母、指定 BV 的操作步骤、seek 误差、四视口、Axe、Keyboard 和网络日志门槛已定义。
- H01-RDS 被设为 V3 持久化前置；Mock 不能冒充 real data_service。

## 3. 实现与剩余边界

H01-RDS real adapter 已形成实现候选。定向测试、真实 `data_service` source import/build/trace、同快照重复保存零 build、Runtime 重启后同一 source 和非空 trace已通过；全新 Windows Chrome profile 的 extension-page 冒烟已显示 `data_service connected`、无 Mock/unchecked、无页面错误。该冒烟不是原生 Side Panel 三入口人工操作，Side Panel、Workspace Library、Source Detail 三入口一致性仍待 H01 人工验收。

BilibiliMediaCollector、tabCapture/Local ASR、VideoOutline/Media Mindmap、Media renderer/jumpback 和 12-page real Chrome evidence 均未实现或未采集。

本轮文档不把 bilinote 克隆、bilibili_learning 实验目录、普通 pageContext.ts B站 DOM 识别或 data_service HTTP spike 计为 V3 产品实现。

## 4. 内部静态审计项目

- [x] PRD/架构/开发/验收/stage gate/gap 使用同一 B站优先顺序。
- [x] Draw.io 8 页以内，XML 可解析，页面/节点 ID 无重复、无越界、边引用完整。
- [x] 指定 BV、H01-RDS、BiliNote 研究、V3-B0..B6 和 No-Go 在 MD/Draw.io 中一致。
- [x] 文档无“V3 implemented”“ASR ready”“real RAG ready”等过度声明。
- [x] 现有 PX-6 sealed evidence 未被修改或并入新结论。
- [x] H01-RDS 实现候选与 H01 真实 Chrome 待验收状态分离。

### 4.1 交叉审计修订

本轮在最终对账中发现并关闭四个文档漂移，未以“已有内部 PASS”掩盖问题：

- `04-acceptance-plan.md` 残留旧联合矩阵的 `16/24`，已改为 B站首批 `10/12` 内容时间轴分母，并明确 blocked/degraded 两页不得抵扣十个成功样本。
- `03-development-plan.md` 曾把本地 ASR 误归 `V3-B2`，已统一为 `V3-B3`；B2 只负责页内字幕。
- `02-architecture.md` 的旧概览链仍写 YouTube/B站并行，已改成 B站字幕优先、本地 ASR 回退链；YouTube 只保留为 B6 后的 Y1 合同映射。
- `LocalTabAudioAsrAdapter` 与 `LocalAsrAdapter` 命名已统一为 `LocalAsrAdapter`；标签页捕获生命周期由 `MediaCaptureController` 所有。

修订后静态交叉检查为 Fatal 0 / Major 0；外部审查仍未执行。

## 5. 当前结论

V3 Bilibili-first document candidate: INTERNAL STATIC AUDIT PASS；EXTERNAL REVIEW RECOMMENDED。
Implementation: NO-GO。
H01 under real-persistence expectation: UNBLOCKED FOR HUMAN CHROME EXECUTION；NOT PASSED。
External independent document audit: REQUIRED。

H01 人工执行必须使用 real mode，并完成 RDS-03/04；V3-B0..B6 代码仍需独立文档审查达到 Fatal=0/Major=0 及用户明确授权。
