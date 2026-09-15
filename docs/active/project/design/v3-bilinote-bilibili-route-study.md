# V3 BiliNote 与 B站视频页路线研究

日期：2026-09-15。状态：V3 产品与架构输入，不代表功能已实现。

## 1. 研究对象与可复核事实

- BiliNote 仓库：`https://github.com/JefferyHcool/BiliNote`。
- 本地研究快照：`be3889395afb5346aa4339ae933d3ba2e08f25a8`。
- Navia 首个 B站锚点样本：`https://www.bilibili.com/video/BV1ZpYd66ELP`。
- 2026-09-15 通过 B站公开 metadata API 观测：单 P、792 秒、`cid=41828944992`，公开字幕列表为空。
- 该样本因此不能用标题、简介或评论替代视频转录；仅字幕路线必须返回 `transcript_unavailable`，若要生成可信大纲，必须由用户显式授权当前标签页音频采集并在本地 ASR。

公开 API 只作为页面能力探测输入，不作为稳定产品合同。产品采集以用户当前已打开的 B站页面、浏览器可见状态和显式授权为边界，不依赖匿名服务端爬取。

## 2. BiliNote 的视频到图文大纲链路

BiliNote 当前实现的核心链路如下：

```text
POST /generate_note
-> 后台串行任务
-> 转录缓存 / 平台字幕 / 下载音频后 ASR
-> 可选下载视频并用 FFmpeg 按间隔抽帧
-> 相邻帧 MD5 去重、时间戳标注和拼图
-> transcript + 图片交给多模态模型
-> 模型生成带 *Content-[mm:ss] / *Screenshot-[mm:ss] 标记的 Markdown
-> 正则后处理为时间跳转和截图
-> 任务文件 / SQLite / 静态图片持久化
-> Chroma 按 metadata、标题层级和 transcript window 建索引
-> 前端轮询任务并渲染 Markdown；Markmap 是去图片后的文本投影
```

可复核代码入口：

- `backend/app/routers/note.py`：`/generate_note`、后台任务、任务状态轮询。
- `backend/app/services/note.py`：字幕优先、ASR fallback、模型生成和 Markdown 后处理。
- `backend/app/utils/video_reader.py`：FFmpeg 抽帧、相邻帧去重、时间戳拼图和 base64。
- `backend/app/gpt/prompt_builder.py`：时间与截图 marker 的提示词格式。
- `backend/app/utils/screenshot_marker.py`、`note_helper.py`：marker 正则解析和平台时间链接。
- `backend/app/services/vector_store.py`：Chroma 索引。

BiliNote 的优势是链路短、用户很快得到可读图文 Markdown。主要风险是结果协议依赖模型按约定输出 marker，截图与大纲没有统一的强类型证据对象；Markmap 又是 Markdown 的二次投影，图片、证据和导图可能发生语义漂移。

## 3. Navia 采纳与拒绝

| BiliNote 做法 | Navia 决定 | 原因 |
|---|---|---|
| 平台字幕优先，缺失时 ASR | 采纳，但 ASR 只允许用户显式启动当前标签页音频采集或选择本地媒体 | 指定 BV 无公开字幕；只做字幕会直接失败 |
| 后台任务和可轮询阶段 | 采纳为 `MediaIngestRun` 状态机 | 长任务必须可暂停、取消、恢复和审计 |
| 固定间隔抽帧、拼图送模型 | 延后到 V3.x | V3.0 不自动下载媒体流，也不声明已理解画面 |
| Markdown marker 驱动截图与跳转 | 不采纳为权威协议 | 正则 marker 容易被模型格式漂移破坏 |
| 图文 Markdown + Markmap | 采纳体验，不采纳数据权威 | Navia 用同一 `VideoOutline` 派生文章和 Media Mindmap |
| Chroma 对笔记和转录切片索引 | 只在 V2 真实知识服务完成后通过 Runtime Adapter 接入 | B 前端不得直连索引或 `data_service` |

## 4. 选定的 B站优先架构

```text
Bilibili 当前视频页
-> BilibiliMediaCollector
   metadata / bvid / cid / currentTime / player state / subtitle availability
-> TranscriptResolver
   A. 页内或公开字幕
   B. 用户点击授权后 chrome.tabCapture 当前标签页音频
-> LocalAsrAdapter（Runtime 内，经 D Adapter / Governance）
-> MediaTranscript + TranscriptEvidenceRef
-> A MediaPagePerception
-> VideoOutline + TimelineSegment
-> C MediaMindmapProjection
-> B MediaCompanionRenderer
-> MediaJumpbackController seek(timestamp)
```

强类型对象：

- `MediaPageContext`：平台、`bvid/cid`、URL、标题、UP 主、时长、分 P、当前时间和可用性。
- `MediaCaptureGrant`：用户动作、tabId、授权范围、开始/结束时间、撤销和删除状态。
- `MediaTranscript`：来源类型、语言、分段时间、文本、置信度和原始证据 hash。
- `MediaIngestRun`：`queued/capturing/transcribing/summarizing/ready/degraded/failed/cancelled`。
- `VideoOutline`：摘要、章节、关键点、适合人群、限制和 evidence bindings。
- `TimelineSegment`：开始/结束时间、标题、摘要和 transcript evidence IDs。
- `MediaEvidenceRef`：字幕、ASR、页面 metadata 或用户可见帧的来源与 hash。
- `MediaJumpbackTarget`：目标 timestamp、播放器定位方式和 `located/fallback_shown/blocked`。

## 5. 隐私、版权和平台边界

- 不在页面打开后自动读取音频；必须由用户点击“开始本地转写”。
- 不自动下载 B站视频或音频 URL，不复用 cookie 在后台抓取媒体流，不绕过地区、会员、登录或风控限制。
- 标签页音频只发送给本机 Runtime；默认不上传模型，原始音频默认不持久化。
- 用户取消、关闭页面或撤销授权后立即停止 capture；残留临时音频必须删除并记录结果。
- 只有结构化 transcript、outline 和必要证据 hash 可进入知识服务；保存仍需用户主动触发。

## 6. 首个样本的预期结果

对 `BV1ZpYd66ELP`：

1. 页面识别必须得到 `bvid=BV1ZpYd66ELP`、`cid=41828944992`、时长约 792 秒和单 P。
2. 未授权音频采集时，公开字幕为空必须显示“无公开字幕，需要开始本地转写”，不得生成伪大纲。
3. 用户授权后，播放器正常播放期间采集当前标签页音频并在本地转写；取消时任务进入 `cancelled` 且无残留音频。
4. 转写完成后，同一 `VideoOutline` 同时派生图文大纲、章节时间轴和 Media Mindmap。
5. 点击章节或证据后播放器跳到目标时间附近；失败必须显示明确 fallback 或 blocked reason。

## 7. 与 H01 真实知识服务的关系

V3 产生的 transcript、outline 或证据不能保存到 `MockKnowledgeServiceAdapter` 后再声称持久知识已完成。2026-09-15 H01-RDS Runtime 候选已能显式选择真实 `data_service` adapter，并完成真实页面来源持久化、重启重读和重复保存零 build；V3 实施前仍须由真实 Chrome H01 证明三入口读取同一 `workspaceId/sourceId`。该前置只证明持久化入口，不自动证明 Ask、Graph、Forget 或 RKM 全部完成。
