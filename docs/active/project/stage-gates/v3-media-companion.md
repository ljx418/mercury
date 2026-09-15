# V3 Media Companion Stage Gate

日期：2026-09-15。权威顺序：B站优先，YouTube 后续映射。

## 1. 当前状态

V3 document candidate: INTERNAL STATIC AUDIT PASS；EXTERNAL REVIEW RECOMMENDED。
H01-RDS real persistence prerequisite: RUNTIME E2E CANDIDATE PASS；WINDOWS CHROME EXTENSION-PAGE SMOKE PASS；REAL CHROME THREE-ENTRY HUMAN CHECK PENDING。
V3-B0..B6: NOT IMPLEMENTED。
V3-Y1: BLOCKED。

当前 B站支持只限普通 DOM/metadata 读取，不能声明字幕、ASR、图文大纲、Media Mindmap 或视频理解已实现。

## 2. 产品出门体验

用户在 B站详情页可以确认视频身份和字幕状态。字幕可用时直接生成基于字幕的结构化内容；字幕不可用时，只有用户点击授权，Navia 才捕获当前标签页音频并在本机转写。完成后，图文大纲、时间轴和 Media Mindmap 来自同一 VideoOutline，节点可跳回视频时间点，结果可由用户主动保存到真实 data_service。

## 3. 首个锚点

https://www.bilibili.com/video/BV1ZpYd66ELP

冻结观测：bvid=BV1ZpYd66ELP、cid=41828944992、单 P、约 792 秒、公开字幕为空。实现时平台事实若变化，必须记录新 revision；不得用另一个有字幕视频替代该 ASR 验收。

## 4. 架构门禁

必须出现并保持以下单向关系：

BilibiliMediaCollector -> MediaPageContext；
TranscriptResolver -> MediaTranscript；
trusted click -> MediaCaptureController -> LocalAsrAdapter；
MediaTranscript -> A MediaPagePerception -> VideoOutline；
VideoOutline -> C MediaMindmapProjection；
D Adapter -> ToolResult/Artifact/Event/Trace；
B MediaCompanionRenderer -> MediaJumpbackController；
runtimeClient -> real data_service adapter -> data_service。

边界：B 不调模型/ASR/data_service；A/C 不调 Chrome；capture 只由 trusted user action 发起；Runtime 离线、取消和页面关闭必须停止；V3.0 不自动下载媒体流，不做 VLM/OCR 语义理解。

## 5. 顺序门禁

| Gate | 必须产物 | 出门判定 |
|---|---|---|
| H01-RDS | real adapter、真实 source/build/trace、重启与故障证据 | Runtime 级 RDS-01/02/05/06/07 和重复保存已过；RDS-03/三入口 RDS-04 待真实 Chrome |
| V3-B0 | PRD/架构/合同/计划/样本/Draw.io/审计 | 0 Fatal/0 Major |
| V3-B1 | B站采集器与真实页面证据 | 指定 BV + 5 页准确 |
| V3-B2 | 字幕 resolver | 6 个字幕样本，段落 hash 完整 |
| V3-B3 | capture + local ASR | 指定 BV 成功；取消/清理/网络边界全过 |
| V3-B4 | outline + mindmap projection | 同源、一致、可追溯 |
| V3-B5 | renderer + jumpback | 四视口、5 次 seek、Axe/Keyboard 全过 |
| V3-B6 | 12 页 production matrix | 分母完整，PRD/false-green 0 Fatal/0 Major |
| V3-Y1 | YouTube mapping | 复用合同且独立真实验收 |

## 6. 12 页固定分母

6 个字幕样本、3 个 ASR 样本、1 个多P、1 个受限 blocked、1 个低信号 degraded。指定 BV 必须属于 ASR 组。每个样本必须记录真实页面、观测时间、transcript/capture hash、outline/evidence IDs、jumpback、截图和网络日志。

## 7. False-green

以下任一项阻止出门：

- 无 transcript 时由标题、简介、评论或模型常识生成内容大纲。
- 用 BiliNote/站外摘要/fixture 作为 Navia production output。
- 图文与导图使用不同事实对象或 evidence 集合。
- fallback/blocked 计 located，或 seek 没有读取真实播放器时间。
- 自动下载 B站媒体流、导出 cookie、绕过登录/地区/会员/风控。
- 未授权 capture、取消后继续采集、临时音频未删除。
- Mock 或 data_service unchecked 支持 persistence pass。

## 8. Draw.io 门禁

design/v3-media-companion-gap.drawio 必须保持中文、不超过 8 页，展示目标体验、当前/目标代码实体、B站字幕与 ASR 双路径、强类型大纲/导图、反跳、H01-RDS 依赖、阶段计划、真实操作验收、里程碑和 No-Go。

## 9. 允许声明

文档独立审查通过后：V3 Bilibili-first implementation specification ready for explicit authorization.

V3-B6 完成后：V3 Bilibili-first local-transcript media companion passed the frozen 12-page acceptance matrix.

不得声明完整 Monica parity、通用视频/音频理解、VLM/OCR、直播、自动下载、跨视频 RAG 或 RKM 完成。
