# V3 Media Companion 风险与架构决策记录

状态：`ROUTE A ACCEPTED / DOCUMENT REFREEZE`  
日期：2026-09-17

## ADR-V3-12：主路径收敛、显式文件 fallback 与 tabCapture 降级（2026-10-19）

**状态**：Accepted，覆盖 ADR-V3-03、ADR-V3-05 与 ADR-V3-09 中把 `tabCapture` 作为 V3 必需最终回退的部分；其余安全决定继续有效。

**背景**：WP0 已完成 relay 所有权、背压、重启、清理和大量负向边界证明，但 owned Chrome 正控中原生 action 无法稳定让生产 Controller 消费已 armed capture。继续把该路径作为 V3 出门硬依赖，会增加可见窗口、浏览器版本和 UIAutomation 成本，却不提升字幕/受控下载/本地 ASR 主路径的用户价值。

**决定**：V3 首版输入顺序收敛为凭据/公开字幕、受控任务期下载、本地 ASR。三者失败时诚实 blocked，不静默 capture。`tabCapture` 代码与 relay v11 合同保留、默认关闭、标记 experimental，不作为 V3-7 immutable candidate 的必需成功路径。后续“选择已下载视频”采用用户显式单文件授权，作为独立 workpack 设计，不允许默认本地文件扫描。

**升格门槛**：只有在至少两个受支持 Chrome 版本上，以 owned profile、真实 Side Panel、可信用户动作和真实 Runtime 连续完成 start/stop/navigation/tab-close/restart，且原始音频与 sink 零残留，才能把 capture 从 experimental 恢复为受支持 fallback。

**代价**：自动下载被平台拒绝且用户尚无本地文件时，V3 会明确 blocked，覆盖率低于原承诺；换取的是主路径更可重复、权限更少、等待更短且不会让用户误以为浏览器卡死或正在后台录音。

## ADR-V3-13：媒体依赖聚合管理与 verified generation（2026-10-19）

**状态**：Accepted for WP-A implementation gate。

**背景**：SenseVoice 已有完整模型管理器，但 `build_media_downloader()` 仅在 `yt-dlp` 和 `ffmpeg` 文件存在且摘要匹配时返回 downloader，否则静默返回 `None`。用户只能在任务失败后看到笼统错误；Runtime 也无法区分缺失、摘要错误、系统工具缺失和模型未生效。

**决定**：新增 `MediaDependencyManager`，聚合 managed `yt-dlp`、system-verified `ffmpeg/ffprobe` 与 delegated `AsrModelManager`。Settings 通过版本化 Runtime API 读取状态并启动单一 repair job。`yt-dlp` 只允许既有冻结 URL、长度、版本和 SHA-256；`ffmpeg/ffprobe` 仅验证，不允许 Runtime 自动安装系统包；SenseVoice 不复制安装状态机。全部必需项 ready 后发布不可变 `VerifiedDependencySnapshot(generation, verifiedAt, tool paths, hashes, effectiveModelId)`，新任务按 generation 构造 downloader。

**并发与恢复**：安装使用私有暂存文件、file fsync、原子 replace 和 parent-directory fsync；失败或取消不覆盖旧 ready 版本。单进程只允许一个 repair job，重启后删除未提交暂存并根据最终文件重新验证，不把 `downloading/installing` 伪恢复为成功。已经运行的 acquisition 不热切换 generation；下一次执行或显式重试才消费新 generation。

**代价**：新增一组 loopback API/schema、失败码、Runtime 管理器和 Settings 组件，需要合同 refreeze；但不改变媒体任务、Cookie、SourceAuthority、Provider 或 relay v11 公共合同。系统 ffmpeg 缺失时用户仍需修复本机伴侣安装，首版不提供一键 apt。

**拒绝**：复用 ASR Manager 存放非模型工具；让 Extension 直接下载二进制；接受客户端 URL/path/hash；依赖文件存在即 ready；安装成功后修改运行中任务；以 WP-A 绕过 WP-B 或重新启用 capture。

## ADR-V3-14：显式单文件字节导入与同任务多消费者屏障（2026-10-19）

**状态**：Accepted for WP-B document gate。

**背景**：WP-A 已让受控下载成为稳定自动输入，但平台拒绝或用户已有本地副本时，现有 blocked 页面没有接续路径。让用户输入路径会引入任意本地文件访问与 Windows/WSL 路径歧义；继续依赖 tabCapture 则保留可信动作、浏览器版本和实时播放成本。

**决定**：采用浏览器原生单文件选择器，Extension 只把本次 `File` 的字节通过认证 loopback 原始流传给 Runtime，不发送文件名或路径。Runtime `LocalMediaImportManager` 持有一次性内存 token、状态、writer、取消和清理；字节写入既有 `TaskArtifactSandbox`，经 ffprobe/ffmpeg 和 WP-A task snapshot 验证后，以 `explicit_local_media_asr` 原子绑定原 task/source identity。禁止新建 `file:*` SourceAuthority。

**多消费者屏障**：本地视频同时服务 ASR 与截图。原视频只有在 16 kHz mono WAV 和候选帧/视觉 handoff 均 durable 后删除；任一消费者失败走统一 cleanup，不能以“只转写成功”冒充图文产品完成，也不能为截图再次调用平台 downloader。原始视频、WAV 与未选帧保持本地并按终态清理；Provider 仍只接收既有授权的 selected frame。

**恢复与代价**：Runtime 重启无法恢复浏览器 File 权限，因此由 SQLite import store 保留无秘密状态、将未完成记录标记 `RUNTIME_RESTARTED`，再按 owner manifest 清理并要求重选；GET 不得退化为 404。新增四个 privileged loopback API、18 个 import failure code、内部分片 writer、ImportedVisualReceipt 和 ASR/视觉双消费者 durable barrier。只有 input bind、audio owner receipt、visual receipt 均 durable 后可删原视频；两个消费者均 terminal 后才由 barrier 单点清理。目录、批量、路径输入、断点续传和云上传均拒绝。

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
