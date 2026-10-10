# V3 Media Companion 组件、路由与交互设计

状态：`ROUTE A DOCUMENT REFREEZE / IMPLEMENTATION PENDING REAUDIT`  
日期：2026-09-17  
权威来源：`01-prd.md` §18、`02-architecture.md` §22、`v3_media_companion_contracts.schema.json`。

## 1. 双容器职责

| 容器 | 用户任务 | 必须组件 | 禁止承担 |
|---|---|---|---|
| Side Panel 360/420 | 识别当前视频、查看会话/字幕状态、首次授权、启动分析、查看采集路线与进度、取消、打开快速摘要 | `MediaQuickSurface`、`MediaConsentPanel`、`MediaAcquisitionStatus`、`MediaRunProgress`、`MediaQuickSummary` | 完整大纲编辑、长时间线、完整证据审查、历史任务管理 |
| Media Workspace 768/1280 | 阅读完整产物、切换任务、查看图文大纲/时间线/思维导图/画面证据、Ask Video、跳回和导出 | `MediaWorkspaceShell`、`MediaTaskHistory`、`VideoOutlineReader`、`MediaTimeline`、`MediaMindmap`、`VisionEvidenceGallery`、`AskVideoPanel`、`MediaEvidenceDrawer`、`MediaExportPanel` | 直接调用模型、ASR、OCR、B站接口或 V4 知识服务 |

Side Panel 和 Workspace 只能通过共享 `runtimeClient` 读取同一个 `MediaTask`。不得各自维护第二份任务状态或根据 UI 文案推断完成态。

### 1.1 门户适配器合同

`MediaPortalRegistry` 是构建期显式 registry，只接受 `contracts/v3-media-portal-registry.json` 中绑定本仓库实现并通过审计的 adapter，不加载远程脚本。V3 首批只注册 `BilibiliMediaPortalAdapter`。每个 adapter 必须实现：

| 接口 | 责任 | 禁止 |
|---|---|---|
| `match(url)` | 返回确定性的 supported/unsupported 与匹配优先级 | 网络探测、模糊多适配器同时命中 |
| `collect(document, location)` | 返回通用 `MediaPageContext` 和来源 observation | 返回 Cookie、调用模型/Runtime、持久化 |
| `readPlayback()` | 回读 currentTime/duration/播放器可用性 | 根据 UI 文案猜测时间 |
| `seek(targetSeconds)` | 操作当前播放器并回读实际时间 | 未回读即声明 located |
| `capabilities()` | 声明 identity/subtitle/session/seek 等能力 | 自动继承其他门户的权限或通过状态 |

通用 context 字段为 `platform/adapterId/adapterRevision/canonicalUrl/mediaId/playbackUnitId/part/title/author/durationSeconds/currentTimeSeconds/transcriptAvailability/observedAt`。B站 adapter 内部把 bvid/cid 映射到 `mediaId/playbackUnitId`；UI、Runtime 与证据不得依赖 `bvid`/`cid` 属性。YouTube、小红书后续各自新增 adapter 和窄域权限，复用现有 route、组件和 Runtime 合同。

## 2. 路由合同

| RouteIntent | 稳定路径 | 默认焦点 | 无效上下文处理 |
|---|---|---|---|
| `media_current` | `#/media/current` | 当前视频标题 | 无当前视频时显示 `V3_MEDIA_CONTEXT_MISSING`，不得展示旧任务冒充当前页 |
| `media_tasks` | `#/media/tasks` | 任务列表标题 | 空列表显示可操作空状态 |
| `media_outline` | `#/media/tasks/:taskId/outline` | 大纲标题 | task 不存在回任务列表并显示错误 |
| `media_timeline` | `#/media/tasks/:taskId/timeline` | 时间线标题 | task 未完成显示真实进度，不使用示例章节 |
| `media_mindmap` | `#/media/tasks/:taskId/mindmap` | 导图标题 | projection 缺失显示 blocked/degraded |
| `media_ask` | `#/media/tasks/:taskId/ask` | 问题输入框 | 无证据只能返回 `insufficient_evidence` |
| `media_evidence` | `#/media/tasks/:taskId/evidence/:evidenceId` | 证据标题 | evidence 不属于 task 时拒绝打开 |
| `media_settings` | `#/media/settings` | 媒体授权标题 | 撤销只阻止后续上传，不隐式删除本地任务 |

所有 route 必须支持 direct-open、reload、Browser Back 和 reopen。`taskId`、`evidenceId` 与 `sourceIdentity` 由 Runtime/MediaTaskStore 读取，不允许前端重新生成。

## 3. 组件输入输出

| 组件 | 输入 | 用户操作 | 输出/事件 | 可见失败态 |
|---|---|---|---|---|
| `MediaQuickSurface` | `MediaPageContext`、当前 task | 刷新识别、打开 Workspace | `MEDIA_CONTEXT_REFRESH`、`OPEN_MEDIA_WORKSPACE` | 不支持页面、身份变化、Runtime 离线 |
| `MediaConsentPanel` | `MediaConsentPolicy` | 授予五项 scope、跳转设置撤销 | `GRANT_MEDIA_POLICY`、`REVOKE_MEDIA_POLICY` | policy 版本变化、Cookie 权限拒绝、写入失败 |
| `MediaAcquisitionStatus` | `MediaAcquisitionRecord`、租约元数据 | 查看主路径/回退原因、在提示后启动标签页回退 | `START_MEDIA_ACQUISITION`、`START_TAB_CAPTURE_FALLBACK` | Cookie 缺失/过期、平台拒绝、媒体受保护、临时文件清理失败 |
| `MediaRunProgress` | `MediaTask.state`、阶段进度 | 取消、失败后重试 | `CANCEL_MEDIA_TASK`、`RETRY_MEDIA_TASK` | 正在清理、取消失败、provider 不可用 |
| `VideoOutlineReader` | `VideoOutline` | 选择章节、打开证据 | `SELECT_TIMELINE_SEGMENT` | 无证据章节、低信号结果 |
| `MediaTimeline` | `TimelineSegment[]` | 点击时间、前后章节 | `SEEK_MEDIA_TIMESTAMP` | tab 丢失、播放器受限、seek 误差过大 |
| `MediaMindmap` | `MediaMindmapProjection` | 选择节点 | `SELECT_MEDIA_NODE` | projection 与 outline 不一致 |
| `VisionEvidenceGallery` | `FrameEvidence/OcrEvidence/VisionEvidence` | 选择证据帧 | `OPEN_MEDIA_EVIDENCE` | 仅 OCR、VLM 拒绝、帧已按策略删除 |
| `AskVideoPanel` | task、问题、证据索引 | 提问、点击引用 | `ASK_VIDEO`、`OPEN_MEDIA_EVIDENCE` | 证据不足、provider blocked、答案无引用 |
| `MediaEvidenceDrawer` | evidence、jumpback 状态 | 跳回视频 | `SEEK_MEDIA_TIMESTAMP` | fallback/blocked，禁止伪装 located |
| `MediaExportPanel` | `MediaExportManifest` | 导出 Markdown ZIP/JSON | `EXPORT_MEDIA_TASK` | 导出失败；知识库导入固定显示“V4 提供” |

## 4. 状态与操作约束

状态主线固定为：

```text
detected
-> consent_required（仅首次或已撤销）
-> ready
   +-> acquiring_credentials -> downloading_media -> transcribing（Cookie 主路径）
   +-> collecting_subtitle -> MediaTranscript（公开/页内字幕回退）
   +-> capturing -> transcribing -> MediaTranscript（可信 tabCapture 最终回退）
-> extracting_frames
-> ocr_running
-> vision_running
-> synthesizing
-> completed
```

终态为 `completed/degraded/blocked/cancelled/failed`。重试创建新 attempt，但保持同一 task 的审计链。以下约束不能由 UI 自行放宽：

- 产品授权不等于无限期 Cookie 导出。每次 `credentialed_media` 必须绑定同一 task、未过期的 `PortalCredentialLease`；B站租约的 `adapterId=bilibili`，且不包含 Cookie 值。
- 持久产品授权不等于音频捕获授权。只有 `tab_capture` 回退的 `capturing` 必须绑定本次可信点击产生的 `MediaCaptureGrant`。
- `MediaTask.captureGrant` 是 capture grant 唯一事实源；`MediaAcquisitionRecord` 只记录 route、credential lease、下载类型和回退原因，不复制 grant。
- 采集顺序固定为受控 Cookie 主路径、公开/页内字幕、可信标签页采集；任何回退都必须记录机器可读原因。
- 字幕可用时允许跳过音频 capture，但关键帧/OCR/VLM 仍必须遵守授权 scope。
- 未配置视觉 Provider 时，若字幕/ASR 足以形成文本大纲，可以标记 `degraded`，不得声称画面理解完成。
- 用户取消后先进入清理过程；只有任务期 cookiefile、临时媒体、原始音频和非证据帧全部删除后才能显示 `cancelled`。
- 每个大纲章节、导图节点和已回答的 Ask 结果至少绑定一个同 task 的 evidence ID。

## 5. 视觉与可访问性

- 延续现有 `#182522` 深色工作区导航、`#0b765f` 主操作和白/冷灰内容面；B站青仅用于来源标识。
- 卡片圆角不超过 8px，按钮最小高度 44px，图标采用 Lucide 语义，不手绘替代图标。
- Side Panel 单列，不放水平滚动操作条；Workspace 在 768px 时收起证据检查器为抽屉。
- 进度不只依赖颜色；状态同时提供文字、图标与 `aria-live`。
- 导图节点、时间线项、证据帧均可键盘选择；抽屉关闭后焦点返回触发元素。
- 普通文本对比度至少 4.5:1，Axe serious/critical 必须为 0。

## 6. 审查原型边界

当前产品基线截图必须呈现真实 Mock/未实现状态；目标总体设计、组件和流程以确定性 HTML/CSS 原型为权威。AI 生成位图不得定义组件、路由、锚点视频事实、证据或完成状态，出现合同外模块时必须从审查权威中移除。

`v3-media-companion-prototype-review/index.html` 是可操作的评审模拟，不运行 Chrome capture、ASR、OCR、VLM 或真实 B站 seek。所有模拟内容必须标为“目标示例”，不得作为 production evidence。真实实现只能按本文件的事件和合同接入。外审使用已内联图像与图标的 `v3-media-companion-prototype-self-contained.html`，不能因离线资源失败而跳过视觉审查。
