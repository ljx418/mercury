# V3 Media Companion 开发及验收计划

日期：2026-09-15。当前状态：B站优先文档已冻结并通过内部静态检查；H01-RDS Runtime 候选通过；V3 媒体代码未开始。

## 1. 目标与边界

V3.0 先让 Navia 在 B站详情页完成“识别视频 -> 获得可信转录 -> 图文大纲/时间轴/Media Mindmap -> 时间反跳 -> 用户主动保存”的完整路径，再复用合同扩展 YouTube。

指定锚点 BV1ZpYd66ELP 当前无公开字幕，因此 V3.0 不能只做字幕。限定 fallback 是用户显式启动的当前标签页音频本地 ASR；不自动下载媒体流，不后台复用 cookie，不上传原始音频。VLM/OCR/视频帧语义理解仍属于 V3.x。

## 2. 前置门禁

1. H01-RDS：Runtime 显式 real adapter、data_service connected、真实来源持久化、重启可读、重复入口零 ingest。服务级候选和 Windows Chrome extension-page 状态冒烟已完成；原生 Side Panel 的真实 Chrome 三入口 RDS-03/04 仍待人类签署。
2. V3-B0：PRD、架构、强类型合同、隐私/取消/清理规则和 12 页样本清单独立审计 Fatal=0/Major=0。
3. 旧 PX-6 machine candidate 只读；不得与新的 real-service/V3 evidence 拼接。

## 3. 顺序开发计划

| 阶段 | 实现范围 | 真实验收 | 出门条件 |
|---|---|---|---|
| V3-B0 | 冻结 MediaPageContext、MediaCaptureGrant、MediaTranscript、MediaIngestRun、VideoOutline、MediaEvidenceRef、MediaJumpbackTarget | 文档、Schema、fixture、Draw.io 静态复核 | 0 Fatal/0 Major |
| V3-B1 | BilibiliMediaCollector | 指定 BV + 5 个 B站页真实 Chrome 采集 | bvid/cid/分P/时长/当前时间/字幕可用性准确；页面变化可诊断 |
| V3-B2 | 页内字幕 resolver 与 transcript normalization | 6 个字幕可用 B站页 | 每段有 start/end/text/language/hash；缺字幕不生成大纲 |
| V3-B3 | MediaCaptureController、LocalAsrAdapter、run 状态机 | 指定 BV 完整本地转写；取消/关页/Runtime 离线 | trusted click；0 自动媒体下载；0 临时音频残留；转录可追溯 |
| V3-B4 | A VideoOutline + C MediaMindmapProjection | 指定 BV 和 10 个应成功内容样本 | 图文与导图同源；10/12 具备时间轴；关键节点 evidence 覆盖；无 marker 权威 |
| V3-B5 | B renderer + jumpback | 360/420 Side Panel、768/1280 Workspace | 至少 5 个真实 seek 误差不超过 2 秒；Axe 0 serious/critical；Keyboard 全过 |
| V3-B6 | 真实 B站出门矩阵和 data_service 保存 | 固定 12 页矩阵 | 分母完整；指定 BV 走 ASR；H01-RDS 通过；PRD/false-green 0 Fatal/0 Major |
| V3-Y1 | YouTube collector mapping | 12 个 YouTube 页 | 复用同一合同；不得建立平行事实模型 |

每阶段开始前单独落盘开发计划、验收计划和实施前审计；结束后落盘真实 evidence、PRD review、false-green audit 和独立出门审计。

## 4. B站 12 页固定分母

- 6 个公开或页内字幕可用样本。
- 3 个无字幕且需本地 ASR 的样本；必须包含 BV1ZpYd66ELP。
- 1 个多 P 样本。
- 1 个登录/风控/地区受限样本，预期可以是正确 blocked。
- 1 个低信号样本，预期可以是正确 degraded。
- 类别覆盖课程/知识、新闻评论、影视解说、生活/探店、游戏/赛事、长短视频。

样本 URL 和观测时间在 V3-B0 冻结。平台内容变化只能形成新 revision，不能静默替换分母。

## 5. 每页验收字段

platform/url/bvid/cid/partId；title/author/duration/currentTime；transcriptSource/transcriptAvailability/transcriptSha256；captureGrantId/asrRunId/cleanupResult；outlineId/timelineSegments/evidenceCoverage；mindmapProjectionId/projectionConsistency；jumpbackAttempts/seekDeltaSeconds；degradedReason/blockedReason；screenshotPaths/networkLog/eventTrace。

## 6. 指定 BV 的操作验收

1. 打开视频页，Navia 显示单 P、正确标题/UP 主/时长和“无公开字幕”。
2. 未点击授权前，不捕获音频、不启动 ASR、不生成内容大纲。
3. 点击“开始本地转写”，明确显示只处理当前标签页；可取消。
4. 播放期间显示 capturing/transcribing 进度，完成后展示图文大纲、时间轴和 Media Mindmap。
5. 抽查至少 8 个关键节点与 ASR segment 证据一致。
6. 点击至少 5 个章节，播放器跳转误差不超过 2 秒。
7. 用户点击保存后，真实 data_service 中存在 outline/transcript 来源；Runtime 重启后可读。

## 7. False-green 防线

- 标题、简介、评论或模型常识不得填充缺失 transcript。
- 同一 transcript segment 不得复制后计成多个独立 evidence。
- fixture、站外摘要和 BiliNote 输出不得计 production pass。
- fallback_shown/blocked 不得计 located。
- 网络日志出现自动视频/音频下载或 cookie 导出即 Fatal。
- capture 没有 trusted user action、取消后仍采集或临时音频未删除即 Major。
- H01-RDS 未通过时，任何 V3 persistence claim 均失败。

## 8. 允许与禁止声明

文档审查通过后只允许：V3 Bilibili-first implementation specification ready for explicit authorization.

V3-B6 独立验收通过后最多允许：V3 Bilibili-first local-transcript media companion passed the frozen 12-page acceptance matrix.

不得声明完整 Monica parity、通用视频/音频理解、VLM/OCR ready、直播理解、自动下载、跨视频 RAG 或 RKM 完成。
