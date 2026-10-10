# V3 BiliNote 与 B站视频页路线研究

日期：2026-09-15。状态：V3 产品与架构输入，不代表功能已实现。

## 1. 研究对象与可复核事实

- BiliNote 仓库：`https://github.com/JefferyHcool/BiliNote`。
- 本地研究快照：`be3889395afb5346aa4339ae933d3ba2e08f25a8`。
- Navia 首个 B站锚点样本：`https://www.bilibili.com/video/BV1ZpYd66ELP`。
- 2026-09-15 通过 B站公开 metadata API 观测：单 P、792 秒、`cid=41828944992`，公开字幕列表为空。
- 该样本因此不能用标题、简介或评论替代视频转录；仅公开字幕路线必须返回 `transcript_unavailable`。V3 首先在用户一次性授权后使用当前 Chrome B站会话获取用户有权访问的字幕或临时媒体；平台仍拒绝时才由可信点击采集当前标签页音频并在本地 ASR。

公开 API 只作为页面能力探测输入，不作为稳定产品合同。产品采集以用户当前已打开的 B站页面、当前 Chrome profile 的 B站登录态和显式授权为边界，不依赖匿名服务端爬取，也不绕过平台访问限制。

## 2. BiliNote 的视频到图文大纲链路

BiliNote 当前实现的核心链路如下：

```text
POST /generate_note
-> 后台任务
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
| Cookie + 平台字幕，缺失时下载音频后 ASR | 采纳能力，不采纳全局明文 Cookie 存储；使用任务期短租约和临时媒体目录 | 指定 BV 无公开字幕；凭据路径可避免强迫用户完整播放 |
| 后台任务和可轮询阶段 | 采纳为 `MediaTask` 状态机 | 长任务必须可取消、恢复和审计；V3 不额外承诺未定义的暂停语义 |
| 固定间隔抽帧、拼图送模型 | 采纳“临时媒体 + 关键帧辅助理解”思路 | V3 在用户授权与平台允许时下载任务期临时视频，用 FFmpeg/OpenCV、本地 OCR 与授权 `MediaVisionProvider`；终态强制清理 |
| Markdown marker 驱动截图与跳转 | 不采纳为权威协议 | 正则 marker 容易被模型格式漂移破坏 |
| 图文 Markdown + Markmap | 采纳体验，不采纳数据权威 | Navia 用同一 `VideoOutline` 派生文章和 Media Mindmap |
| Chroma 对笔记和转录切片索引 | 拒绝迁移到 V3 | V3 使用 `MediaTaskStore` 与任务内 evidence index；跨视频知识索引统一进入 V4 |

## 4. 选定的 B站优先架构

```text
Bilibili 当前视频页 + 当前 Chrome B站会话
-> MediaPortalRegistry -> BilibiliMediaPortalAdapter
   metadata / bvid / cid / currentTime / player state / subtitle availability
-> BilibiliSessionBroker（Background，最小 Cookie 读取）
-> PortalCredentialLease(adapterId=bilibili；同 task、短期、无 Cookie 值)
-> BilibiliMediaAcquirer（Runtime）
   A. 凭据字幕或任务期临时音频/视频
   B. 页内或公开字幕
   C. 平台拒绝时由可信点击 chrome.tabCapture 当前标签页音频
-> LocalAsrAdapter（Runtime 内，经 D Adapter / Governance）
-> MediaTranscript + TranscriptEvidenceRef
-> MediaFramePipeline -> LocalOcrAdapter + 受治理 MediaVisionProvider
-> OCR / vision frame evidence
-> A MediaPagePerception
-> VideoOutline + TimelineSegment
-> C MediaMindmapProjection
-> B MediaCompanionRenderer
-> MediaJumpbackController seek(timestamp)
```

强类型对象：

- `MediaPageContext`：通用平台、adapter、mediaId/playbackUnitId、URL、标题、作者、时长、分段、当前时间和可用性；bvid/cid 只保留在 B站 adapter observation。
- `MediaCaptureGrant`：用户动作、tabId、授权范围、开始/结束时间、撤销和删除状态。
- `PortalCredentialLease`：同任务的短期会话租约，只含 adapterId、ID、profile hash、credential 名称集合 hash 和有效期，不含秘密值；B站实例固定 `adapterId=bilibili`。
- `MediaAcquisitionRecord`：记录 `credentialed_media/public_or_page_subtitle/tab_capture` 路线、下载类型和机器可读回退原因。
- `MediaTranscript`：来源类型、语言、分段时间、文本、置信度和原始证据 hash。
- `MediaTask`：从 detected/ready/capturing/transcribing/extracting/vision/synthesizing 到 completed/degraded/blocked/cancelled/failed 的唯一任务状态机。
- `VideoOutline`：摘要、章节、关键点、适合人群、限制和 evidence bindings。
- `TimelineSegment`：开始/结束时间、标题、摘要和 transcript evidence IDs。
- `MediaEvidenceRef`：字幕、ASR、页面 metadata 或用户可见帧的来源与 hash。
- `MediaJumpbackTarget`：目标 timestamp、播放器定位方式和 `located/fallback_shown/blocked`。

## 5. 隐私、版权和平台边界

- 页面打开只做身份和能力探测；用户授予 `bilibili_session_access` 与 `temporary_media_download` 后，点击“开始分析”才允许创建任务期租约和临时下载。
- 只获取用户当前会话本来有权访问的字幕/媒体，不绕过地区、会员、登录、DRM 或风控限制；平台拒绝时进入明确 fallback/blocked。
- Cookie 值不写入配置、数据库、EventStore、Trace、日志或公开证据。需要 yt-dlp 时只生成随机任务期 `0600` cookiefile，任何终态均删除。
- 标签页音频只发送给本机 Runtime；默认不上传模型，原始音频默认不持久化。
- 画面先在本机选帧和 OCR；只有用户已授予 `selected_frame_cloud_vision` 且 Provider 能力通过校验时，选定证据帧才可上传，非证据帧不得上传。
- 用户取消、关闭页面或撤销授权后立即停止 capture；残留临时音频必须删除并记录结果。
- 结构化 transcript、outline、证据缩略图和 hash 只进入本地 `MediaTaskStore` 与本地导出；V3 不调用知识服务，V4 未来仍需用户主动导入。

## 6. 首个样本的预期结果

对 `BV1ZpYd66ELP`：

1. 页面识别必须得到 `bvid=BV1ZpYd66ELP`、`cid=41828944992`、时长约 792 秒和单 P。
2. 未授权会话访问时，公开字幕为空必须显示“需要授权 B站会话以获取完整内容”，不得生成伪大纲。
3. 用户授权后优先以短期租约获取字幕或临时媒体并在本地处理；若 Cookie 失效或平台拒绝，显示原因并允许可信点击切换到标签页采集。取消时任务进入 `cancelled`，且 cookiefile、临时媒体和原始音频均无残留。
4. 转写完成后，同一 `VideoOutline` 同时派生图文大纲、章节时间轴和 Media Mindmap。
5. 点击章节或证据后播放器跳到目标时间附近；失败必须显示明确 fallback 或 blocked reason。

## 7. 与 V4 知识能力的关系

V3 产生的 transcript、outline 或证据不能保存到 `MockKnowledgeServiceAdapter` 后再声称持久知识已完成。V3 只写本地 `MediaTaskStore` 并导出 Markdown ZIP/JSON，合同固定 `knowledgeImportStatus=deferred_to_v4`。2026-09-15 的 H01-RDS 候选及其 pending 人工项保持封存但不再阻塞 V3；V4 启动时重新冻结知识导入、Query、Graph、Forget 与 RKM。

## 8. 固定来源与许可证

- 研究来源固定为本地 clean commit `be3889395afb5346aa4339ae933d3ba2e08f25a8`。
- 本地 BiliNote 工作树存在未提交修改；这些 dirty diff 不属于允许迁移来源。
- 上游许可证为 MIT。V3-0 文件级允许清单冻结在 `design/v3-bilinote-migration-allowlist.json`，逐项记录 clean commit 原始字节 SHA-256、用途和 `reference_only` 策略；清单外默认拒绝。
- 当前清单不授权复制实质代码。未来复制前必须另行取得阶段授权、保存原版权与许可证文本、补齐 Navia 目标文件映射并通过独立实施前审计。
- 当前 V3-0 只采纳处理流程和边界，不复制 BiliNote 产品代码，因此没有生产依赖或运行时归属声明。
- BiliNote 的 `CookieConfigManager` 和 `config/downloader.json` 不在允许迁移清单；只迁移 yt-dlp 接口与媒体处理思路，并以 Navia 的短租约和清理层重写秘密生命周期。
