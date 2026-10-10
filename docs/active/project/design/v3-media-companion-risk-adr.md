# V3 Media Companion 风险与架构决策记录

状态：`ROUTE A ACCEPTED / DOCUMENT REFREEZE`  
日期：2026-09-17

## ADR-V3-01：V3 不依赖 V2 知识服务出门

**背景**：PX-6、Query、Graph、Durable Forget 与 RKM 尚未完成。若 V3 等待真实知识服务，会继续阻塞首要的视频理解体验。  
**决定**：V3 使用本地 `MediaTaskStore` 和可校验导出；知识库导入固定为 `deferred_to_v4`。  
**代价**：V3 不能承诺跨视频 Query/RAG；V4 需要显式导入适配器。

## ADR-V3-02：B站首发，YouTube 后置

**背景**：用户指定 `BV1ZpYd66ELP`，且当前代码对 B站已有普通 DOM 基线。  
**决定**：固定 12 个 B站详情页先出门；YouTube 只能复用同一合同，不参与首批分母。  
**代价**：不能声明全平台视频理解。

## ADR-V3-03：受控 Cookie 会话主路径，公开信息与标签页采集回退

**背景**：锚点页面公开字幕为空。只依赖公开字幕或要求用户完整播放，会导致内容缺失、长视频等待和不可重复验收。  
**决定**：用户一次性授予 B站会话访问和临时媒体处理 scope 后，`PortalSessionBroker` 调度 `BilibiliPortalSessionAdapter` 从当前 Chrome profile 最小读取白名单 Cookie；V3-1.3 经一次性 envelope 签发短期 `PortalCredentialLease(adapterId=bilibili)`。Runtime `BilibiliMediaAcquirer` 在租约内获取用户本来有权访问的字幕、音频和必要视频临时文件。公开/页内字幕是无凭据回退；两者不可用时，可信点击启动 `chrome.tabCapture` 作为最终回退。  
**拒绝**：持久化原始 Cookie、把 Cookie 写入日志/Trace/证据、后台无限下载、绕过登录/会员/地区/DRM/风控限制、上传原始音频。  
**代价**：需要最小权限、租约、临时文件权限和确定性清理合同；平台拒绝仍必须显示 blocked，不能以抓取技巧伪装成功。

## ADR-V3-04：本地 OCR 与经治理的云端 VLM 同属首版

**背景**：仅转录无法证明画面内容，用户要求首版包含画面理解。  
**决定**：FFmpeg/OpenCV 采样，RapidOCR 本地识别；只把选定证据帧发送到具备 vision capability 的 `MediaVisionProvider`。首个参考适配器兼容 OpenAI 多模态协议，但合同不绑定厂商。  
**失败策略**：Provider 未配置、无 capability、授权缺失或调用失败时 fail closed；可降级为文本大纲，但画面理解验收失败。  
**代价**：增加成本、隐私、延迟和真实 Provider 验收义务。

## ADR-V3-05：产品授权、凭据租约与可信捕获分离

**背景**：用户不接受每任务重复弹窗，但 Chrome 音频捕获需要用户手势。  
**决定**：五项产品 scope 持续到主动撤销：B站会话访问、任务期临时媒体下载、本地音频处理、本地画面处理、选定帧云端视觉。每个主路径任务签发短期 `PortalCredentialLease(adapterId=bilibili)`；只有最终回退到标签页采集时才由可信点击创建 `MediaCaptureGrant`。撤销立即阻止新租约、下载、capture 和云端上传，不删除既有本地任务。  
**代价**：UI 必须分别表达产品 policy、当前 credential lease 和 fallback capture grant，不能合并成一个布尔值。

## ADR-V3-06：一个大纲事实源派生所有视图

**背景**：BiliNote 的 Markdown marker 便于渲染，但不能作为可靠机器合同。  
**决定**：`VideoOutline` 是语义权威；图文、时间线和 `MediaMindmapProjection` 都从它派生。Ask 只消费证据索引。  
**代价**：生成后需要严格结构验证，不能直接显示任意 Markdown。

## ADR-V3-07：选择性借鉴 BiliNote

**背景**：本地 `bilinote/` 固定上游 HEAD 为 `be3889395afb5346aa4339ae933d3ba2e08f25a8`，但其工作树存在未提交修改。  
**决定**：研究干净 commit 中的字幕/ASR/任务/画面采样和 yt-dlp 临时 Cookie 文件流程；V3-0 的 `v3-bilinote-migration-allowlist.json` 只授权六个 clean-commit 文件作 `reference_only` 研究，清单外默认拒绝。任何未来代码迁移必须取得阶段授权、补齐源到目标映射、保留 MIT attribution 并经 Navia 防腐层适配。  
**拒绝**：整仓嵌入、数据库迁移、账号体系、BiliNote `downloader.json` 明文 Cookie 持久化，以及使用本地 dirty diff 作为来源。受控临时下载由 Navia 的租约和清理合同重新实现，不直接照搬其全局下载策略。  
**代价**：迁移速度低于整仓复制，但避免许可证、权限与架构污染。

## ADR-V3-08：凭据、临时媒体、证据保留与删除

**决定**：Cookie 值只存在于浏览器 Cookie Store、进程内存和任务期随机 `0600` Netscape cookiefile；任务完成、失败、取消、租约到期或撤销时必须删除 cookiefile 和全部临时媒体。ASR 终态后删除原始音频；OCR/VLM 终态后删除非证据帧；选定证据缩略图和 hash 保存至任务删除或导出。公开证据不得包含密钥、Cookie 值、原始音频或未选定帧。  
**失败策略**：清理失败时任务不得进入成功终态。

## ADR-V3-09：BiliNote Cookie 路线只迁移能力，不迁移秘密存储

**背景**：BiliNote 通过 `CookieConfigManager` 和 yt-dlp cookiefile 获得更完整的字幕或媒体，但其长期保存原始 Cookie 的方式不符合 Navia 的本地权限与证据边界。  
**决定**：采用“浏览器权威 + 短租约 + Runtime 内存 + 任务期 `0600` cookiefile + 强制清理”。`PortalCredentialLease` 只保存 `adapterId/leaseId/taskId/profile hash/credential-name-set hash/credential policy revision/one-shot transport/issuedAt/expiresAt`，禁止包含 Cookie 值；B站实例固定 `adapterId=bilibili`。  
**回退**：权限未授予、Cookie 缺失/失效、平台拒绝或媒体受保护时，依次尝试公开/页内字幕和可信点击 `tabCapture`；回退原因必须机器可读。  
**停止条件**：发现 Cookie 值持久化、出现在公开证据、跨任务复用、清理残留或绕过平台限制时立即停止实现与验收。

秘密传输固定经现有认证 loopback Runtime 通道使用一次性 `BilibiliCredentialEnvelope`，请求体不得进入 access log、EventStore、Trace、异常转储或重试队列；响应只返回 `PortalCredentialLease(adapterId=bilibili)` 元数据。Chrome 会话权限为可选 `cookies` + `https://*.bilibili.com/*`，Broker 仍须按架构 §22.5 的版本化 Cookie 名称白名单过滤，禁止 `<all_urls>` 或静默新增名称。

## ADR-V3-10：路线 A 最小页面权限与开放门户适配器

**状态**：Accepted，用户于 2026-09-17 明确选择路线 A。  
**背景**：V1 全站静态注入支持普通网页默认 launcher，但与 V3 无 `<all_urls>` 门禁冲突；同时 V3 后续需要适配 YouTube、小红书等门户。  
**决定**：首批静态 content script 只匹配 `https://www.bilibili.com/video/*`；Chrome MV3 的 `web_accessible_resources.matches` 依规范使用 origin 级 `https://www.bilibili.com/*`，且不得据此在非视频路径自动注入。普通网页通过 action/command 用户手势取得 `activeTab` 并打开原生 Side Panel。新增 `MediaPortalAdapter` 与构建期 `MediaPortalRegistry`，B站平台字段只在 `BilibiliMediaPortalAdapter` 内部映射到通用 `MediaPageContext`。后续门户新增独立 adapter、窄域权限、identity 语义和真实验收，不加载远程实现。  
**代价**：普通网页不再安装后自动显示 launcher；用户需点击扩展或快捷键。每个新门户增加一轮权限与兼容性审查。  
**拒绝**：使用 `http://*/*`、`https://*/*`、可选全站 host 或其他等价方式恢复全站注入；让通用 UI/Runtime 依赖 bvid/cid；让新门户继承 B站 Cookie 权限或验收通过声明。

## ADR-V3-11：页面适配与会话适配分离

**背景**：`MediaPortalAdapter` 已为未来 YouTube、小红书保留页面身份与播放控制接口，但 B站 Cookie 名称、host permission 和授权文案不能进入该通用接口。  
**决定**：新增独立的 `PortalSessionAdapter` / `PortalSessionRegistry` / `PortalSessionBroker`。`PortalPermissionClient` 只在扩展页面的真实用户点击中请求可选权限；Background 只复核权限、调度 session adapter 并返回无秘密 `PortalSessionCapability`。B站的 Cookie 名称与判定语义只在 `BilibiliPortalSessionAdapter` 和 `v3-media-session-policy-registry.json` 的 B站项中。V3-1.2 只派生浏览器内候选会话状态，固定 `serverValidated=false`；一次性 envelope 与租约后置到 V3-1.3。  
**代价**：需要两份 build-time 闭集注册表并做 adapterId/hash 对账；新门户需额外实现独立 session adapter。  
**拒绝**：从前端消息传入任意 host/Cookie names；Background 自动请求权限；新门户继承 B站策略；在 V3-1.2 宣称服务端会话已验证。

## 风险登记

| 风险 | 影响 | 文档防线 | 实施停止条件 |
|---|---|---|---|
| B站 DOM/API 变化 | collector 错识别 | 页面身份多源对账、观测 revision | bvid/cid/part 无法一致解析 |
| Cookie 泄漏或过期 | 账号安全、任务失败 | 浏览器权威、短租约、值不落盘、日志脱敏、到期 fail closed | 任一值进入持久存储/证据，或过期租约仍可调用 |
| 临时下载残留 | 隐私与磁盘污染 | `0600` cookiefile、任务目录、终态清理与残留计数 | cookiefile/原始媒体残留或跨任务复用 |
| 标签页 capture 受浏览器限制 | 无字幕样本无法转写 | 可信点击、tab 生命周期、取消清理 | 无法证明本次 grant 或出现后台 capture |
| VLM 幻觉 | 画面描述失真 | 帧/OCR/VLM evidence 分型，答案绑定 evidence | 无证据内容进入大纲/Ask |
| 成本与隐私 | 未授权出站 | 持久 scope、Provider trace、选帧预算 | 无授权上传或 secrets 泄漏 |
| Mock 假绿 | 文档通过但产品未实现 | production profile 拒绝 mock/fixture | mock provider 或静态结果进入分母 |
| 跨阶段污染 | V3 被误报为外脑完成 | `knowledgeImportStatus=deferred_to_v4` | V3 声称 Query/Graph/Forget/RKM |
