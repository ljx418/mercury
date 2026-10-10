# V3 Media Companion 开发及验收计划

日期：2026-09-16。状态：`DOCUMENT CANDIDATE / CODE IMPLEMENTATION NOT AUTHORIZED`。

## 1. 目标体验

V3 首批只面向 B站详情页。用户从当前视频页一次性授权 B站会话与任务期媒体处理，再点击启动分析。Navia 优先通过同任务短期 Cookie 租约获取用户有权访问的字幕、音频和必要视频；权限或平台失败时依次回退公开/页内字幕与可信 `tabCapture`。本地 ASR、关键帧、本地 OCR 和受治理云端 VLM 的证据汇入一个 `VideoOutline`，再派生图文大纲、时间线、Media Mindmap、Ask Video 和时间跳回。

V3 结果保存在本地 `MediaTaskStore` 并支持 Markdown ZIP/JSON 导出。V2/PX-6/RKM 暂停且不再阻塞 V3；知识库导入、Query、Graph、Durable Forget 和自动维护属于 V4。

## 2. 顺序开发工作包

| 阶段 | 实现范围 | 阶段前文档 | 真实验收 | 出门条件 |
|---|---|---|---|---|
| `V3-0` | 权威文档、Schema、fixture、原型、BiliNote `reference_only` allowlist、12 页分母与样本注册表合同冻结 | 本计划、验收矩阵、风险 ADR、Draw.io、至少两轮内部审计 | Schema/fixture/HTML/Draw.io/allowlist 静态检查与新鲜浏览器原型 QA | Fatal=0、Major=0、外部审查通过、用户代码授权 |
| `V3-1` | `MediaPortalRegistry`、`MediaPortalAdapter`、`BilibiliMediaPortalAdapter`、`PortalSessionRegistry`、`PortalSessionBroker`、`BilibiliPortalSessionAdapter`、`PortalCredentialLease`、通用 `MediaPageContext`、路线 A 入口 | 独立开发/验收计划、实施前审计 | 12 个真实 B站页，真实 Chrome 登录/未登录态与普通网页 activeTab | B站 identity 映射准确；普通网页按需能力保留；0 全站静态匹配；0 Cookie 值落盘或进入证据 |
| `V3-2` | `BilibiliMediaAcquirer`、字幕 resolver、任务期 yt-dlp/临时目录、`MediaCaptureController` 回退、`LocalAsrAdapter`、取消与清理 | 同上 | 6 个凭据或公开字幕样本 + 3 个 ASR 样本，至少 1 个 tabCapture 回退 | 每段 timestamp/hash 完整；只下载当前会话有权内容；0 cookiefile/临时媒体/原始音频残留 |
| `V3-3` | FFmpeg/OpenCV 关键帧、RapidOCR、`MediaVisionProvider`、选帧预算；`V3-3-0a` 由 Settings 选择 MiniMax/OpenAI 与闭集模型、临时录入各自密钥，Runtime 写入系统凭据库并维护已验证的当前路由 | 同上 | 10 个应成功样本完成真实本地 OCR，其中至少 8 个完成真实云端 VLM | Provider、模型、授权、请求 hash 可审计；密钥隔离且不进入扩展存储/SQLite/日志/证据；未验证 Provider 不可选；画面结论有证据 |
| `V3-4` | `MediaTaskStore`、状态机、`VideoOutline`、时间线、Mindmap projection | 同上 | 同 task 的断点恢复、取消、失败重试 | 一个 outline 派生三视图；跨对象 identity/顺序校验通过 |
| `V3-5` | Side Panel、Media Workspace、Ask Video、证据抽屉、jumpback、导出；完成后执行唯一一轮可见 Chrome 人工验收 | 同上 + 人类验收说明与回填表 | 360/420/768/1280，真实播放器 seek，H01-H10 全执行 | 5 次 seek 误差 <=2 秒；Axe 0 serious/critical；Keyboard 通过；人类签署无阻断项 |
| `V3-5.1` | 语义章节、图文时间线、播放游标、层级大纲、交互导图和 grounded Ask 体验补强 | 独立 v3 合同、组件 spike、开发/验收计划、隐私增量与实施前审计 | 3 个真实 B站视频；timeline wheel/drag/seek、三层导图、固定 12 问、四视口、低资源预算 | 0 mock/跨 run；引用支持率 >=90%；Axe 0 serious/critical；最小人类复核无阻断；Fatal=0/Major=0 |
| `V3-6` | 12 页生产矩阵、故障注入、隐私与 evidence package；只重放已签署 H01-H10 和 V3-5.1 最小体验签署，不新增人工步骤 | 同上 | 全新单 run，真实 Chrome/ASR/OCR/VLM，并使用 V3-5.1 最终投影和 UI | 分母完整；无 mock；不跨 run；机器审计 Fatal=0/Major=0 |
| `V3-7` | 最终独立出门审计与限定声明 | 最终 manifest、审计请求、V3-5 与 V3-5.1 签署引用 | 只读复算 V3-6、V3-5 H01-H10 与 V3-5.1 最小体验签署 | 独立复审 Fatal=0/Major=0；不得自动代签或补写人工项 |
| `V3-Y1` | YouTube collector 映射 | V3 B站出门后另行冻结 | 12 个 YouTube 页 | 复用合同；不得建立平行事实模型 |

每阶段必须先冻结本阶段开发计划、验收计划与实施前审计；完成后保存真实 evidence、PRD review、false-green audit 和独立出门审计。出现产品方向偏差、真实数据不足、假绿或隐私风险时停止并回到计划阶段。

## 3. 固定接口与所有权

- Extension content script：`MediaPortalRegistry` 选择 `BilibiliMediaPortalAdapter`；adapter 只读取当前页面与控制当前播放器，输出通用 `MediaPageContext`。未来门户只能新增独立 adapter。
- Extension session：`PortalPermissionClient -> PortalSessionBroker -> PortalSessionRegistry -> BilibiliPortalSessionAdapter`先产生无秘密候选会话能力；V3-1.3 再经一次性 envelope 签发同任务短租约。`MediaCaptureController` 只在 Cookie/公开字幕路径失败且可信点击后启动当前 tab 音频 capture。
- Runtime media acquisition：`BilibiliMediaAcquirer` 在租约内使用内存 Cookie 或任务期随机 `0600` Netscape cookiefile；只获取用户当前会话可访问内容，终态强制清理。
- Runtime media context：任务、字幕/ASR、关键帧、OCR、VLM、综合生成和本地 `MediaTaskStore`。
- D Adapter/Governance：`LocalAsrAdapter`、`MediaVisionProvider` 和文本生成 Provider；记录 scope、能力、模型与调用 trace。
- A/C：A 生成强类型 `VideoOutline`；C 只从 outline 生成 `MediaMindmapProjection`。
- B：Side Panel 和 Workspace 只经 `runtimeClient` 消费合同，不直接访问模型、B站接口或 V4 服务。

## 4. 授权和清理

首次授权包含五项 scope：B站会话访问、任务期临时媒体下载、本地音频处理、本地画面/OCR、选定证据帧云端视觉理解。授权持久到主动撤销，不按任务重复弹窗。每个主路径任务仍需短期 `PortalCredentialLease(adapterId=bilibili)`；只有 tabCapture 回退需要可信点击生成短期 `MediaCaptureGrant`。

- 撤销立即阻止新租约、下载、capture 和云端上传；在途调用记录已出站边界并不伪称可撤回。
- Cookie 值不得写入配置、数据库、EventStore、Trace、日志或公开证据；租约只含 ID/hash/时间。
- Cookie 只由 Background 按冻结名称白名单读取，经现有认证 loopback 的一次性 `BilibiliCredentialEnvelope` 送入 Runtime 内存；Side Panel/Workspace 不接触值，endpoint 不记录 request body。
- 完成、失败、取消、租约到期、撤销均删除任务期 cookiefile 和临时媒体；残留计数非零不得成功。
- ASR 成功、失败或取消后删除原始音频。
- OCR/VLM 终态后删除非证据帧；证据缩略图保留到任务删除或导出。
- 清理失败阻止成功终态。
- 视觉 Provider API Key 只能在 Settings 密码框短暂存在；MiniMax 与 OpenAI 使用不同 `secretRef`。Runtime 只把引用与当前选择写入 SQLite，实际值写入原生 keyring 或 Windows Credential Vault。安全 backend 不可用时 fail-closed，禁止回退明文。Provider base URL 与模型必须来自闭集注册表；禁止用户自定义地址。

## 5. B站 12 页固定分母

- 6 个公开或页内字幕可用样本。
- 3 个本地 ASR 能力槽位；当前 Revision 5 固定为 `BV13W41137qV`、`BV1ZpYd66ELP`、`BV1pW421c7DH`。每槽先做真实 task-time 字幕发现：0 候选直接获取媒体，存在候选时仅由验收编排器执行预绑定字幕体故障一次，再获取真实当前分 P 媒体。三个槽位必须同一 run、全部走真实媒体与 SenseVoice 全长转写；Revision 3 的 1200 秒自然无字幕样本约束为历史规则，不适用于 Revision 5。
- 固定锚点 `BV1ZpYd66ELP` 必须包含在 12 页中；生产体验仍优先使用真实可用字幕，只有验收分母通过预绑定且生产不可达的故障稳定证明媒体回退能力，不向产品加入“强制 ASR”入口。
- 1 个多 P 样本。
- 1 个登录、地区、会员或风控受限样本，预期可为正确 blocked。
- 1 个低信号样本，预期可为正确 degraded。

上述是 12 个互不重复 URL 的主分类，不允许一个 URL 同时占两个名额。多 P、受限和低信号样本即使也有字幕，只能计入其主分类。V3-1 实施前计划必须根据真实 Chrome 探测固化 `sampleId/url/bvid/primaryClass/expectedOutcome/observedAt` 注册表；注册表未满 12 个唯一 URL 时 V3-1 仍为 NO-GO。

应成功样本中至少 10 个必须完成关键帧和本地 OCR；其中至少 8 个必须完成真实云端 VLM。其余若因受限/低信号进入 blocked/degraded，不得缩小分母。样本 URL、类别、预期和观测日期在 V3-0 外审后冻结为 revision 1；内容变化创建新 revision，不静默替换。

## 6. 自动验收分母

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 在 12 个页面读取媒体身份 | 每页通用 mediaId/playbackUnitId/part/duration 与当次真实 B站 bvid/cid/分P观测一致；UI/Runtime 不读取平台专用字段 |
| A02 | 首次授权、刷新、重开、撤销 | 五项授权持久且可撤销；每 task 租约短期有效；撤销后 0 新租约/下载/capture/上传 |
| A03 | Cookie 主路径分析 | 同 task 租约存在且无 Cookie 值；凭据字幕或临时媒体有 request/hash；不启动 tabCapture |
| A04 | Cookie/平台失败后回退 | 先记录公开/页内字幕结果；需要 tabCapture 时必须有本次 trusted grant；本地 ASR 输出可追溯分段 |
| A05 | 提取关键帧与 OCR | 帧时间和 OCR block 可回读；非证据帧已清理 |
| A06 | 调用真实视觉 Provider | capability、provider/model、请求/响应 hash 和 evidence 绑定齐全 |
| A07 | 生成 outline/timeline/mindmap | 三视图同源，章节顺序和 evidence ID 闭合 |
| A08 | Ask Video | 已回答结果至少一个有效引用；证据不足正确拒答 |
| A09 | 点击章节/节点/引用 | 至少 5 次真实 seek，误差 <=2 秒；失败明确 fallback/blocked |
| A10 | 取消、关页、Runtime 离线、Provider 失败 | 终态和清理正确，无幽灵任务或后台上传 |
| A11 | 双容器四视口与路由恢复 | Side Panel 360/420、Workspace 768/1280；8 条冻结 route 均覆盖 direct-open/reload/Back/reopen，恢复相同 task/evidence 与焦点，不用旧缓存冒充 Runtime 状态 |
| A12 | 导出 | Markdown ZIP/JSON hash 可重算；`knowledgeImportStatus=deferred_to_v4` |
| A13 | 隐私、权限与清理扫描 | public evidence、配置、数据库、EventStore、Trace、access/error log、retry payload 中 0 token/Cookie 值/原始音频/非证据帧；终态 0 cookiefile/临时媒体残留；静态桥接仅 B站详情页窄域；普通网页仅 action/command `activeTab`；无 `<all_urls>`/等价全站匹配；Cookie 名称不超冻结白名单 |
| A14 | 独立重算 | 单 run、固定分母、输入/输出/hash/版本可重算，0 Fatal/0 Major |

## 7. 人类验收 H01-H10（仅在 V3-5 执行）

V3-2、V3-3、V3-4 不请求人类操作；这些阶段只允许真实数据自动验收和机器/独立审计。H01-H10 在 V3-5 双容器功能完整、Axe/键盘自动门槛通过之后一次性执行。V3-5.1 只新增一次结构清晰度和交互质量的最小复核，不重复听写或重做 H01-H10。V3-6/V3-7 只能引用并校验正式签署，不得要求人类重复采集或为机器缺口补证。

1. H01 打开锚点页，确认标题、作者、单 P、约 792 秒和无公开字幕提示。
2. H02 首次查看五项授权说明并授权；刷新后不重复弹窗，设置中可撤销；页面只显示会话可用性，不显示 Cookie 值。
3. H03 点击“开始分析”，确认主路径显示“受控会话获取”；人为使 Cookie 路径不可用后，确认系统说明原因并允许可信点击进入标签页采集回退。
4. H04 查看图文大纲和时间线，抽查至少 8 个章节/证据是否对应真实内容。
5. H05 查看关键帧、OCR 和 VLM 描述，确认字幕推断没有冒充画面事实。
6. H06 查看 Media Mindmap，确认节点与大纲一致且可追溯。
7. H07 提问至少 3 个有答案问题和 1 个无证据问题，验证引用和拒答。
8. H08 点击 5 个章节/节点/引用，核对真实播放器跳转。
9. H09 取消一次任务、模拟一次 Provider 不可用，核对清理和恢复提示。
10. H10 导出并检查文件；确认界面没有“已保存到知识库”或 V2/V4 完成声明。

每项回填实际结果、PASS/FAIL/BLOCKED、截图路径和备注。任何未执行项均不得记 PASS。

## 8. False-green 与允许声明

以下任一项为 Major 或 Fatal：使用标题/简介/常识补 transcript；复用同一 segment 凑 evidence；使用 BiliNote 输出、fixture、静态原型或 mock Provider 计 production pass；跨 run 拼接；持久化/记录/公开 Cookie 值；无租约下载、跨任务复用凭据、绕过平台限制；tabCapture 无可信点击；取消后继续处理或残留临时媒体；无证据的 VLM/Ask 结论；缩小 12 页分母；把 V3 导出称为知识库持久化。

2026-10-10 追加：用户本轮报告的人工流程通过只证明 V3-5 基础路径可用，不替代正式 H01-H10 submission，也不证明章节语义、问答质量、时间线交互或导图层级达到目标。V3-5.1 必须拒绝以下假绿：固定时间窗冒充语义章节、纵向列表冒充时间轴、静态 `<ul>` 冒充交互导图、原文拼接冒充回答、占位图冒充证据帧、只有视觉动画但没有真实 seek/playback sync。完整分母见 `v3-workspace-comprehension-ux-optimization-plan.md`。

V3-0 外审通过后只允许声明：`V3 Bilibili-first implementation specification ready for explicit authorization.`

V3-7 出门后最多允许声明：`V3 Bilibili-first media companion passed the frozen subtitle/local-ASR/keyframe/OCR/authorized-cloud-VLM acceptance matrix.`

不得声明全平台、直播、无限期/跨任务下载、绕过平台限制、跨视频 RAG、V4 知识能力或完整 Monica/BiliNote parity。

## 9. 合同负例与确定性语义算法

`v3-media-companion-contract-fixtures.json` 的 requirement registry 是封闭集合。Runner 必须先验证 registry 与 case 的 `requirementId/requirementKey/enforcementLayer/expectedFailureCode` 精确相等，再逐项应用变异。5 个 Schema case 必须被 Draft 2020-12 拒绝；20 个 semantic case 必须先保持 Schema-valid，再由下列算法拒绝：

| requirementKey | 确定性检查 |
|---|---|
| `completed_cleanup` | `task.state=completed` 时四个 cleanup 布尔值必须均为 true |
| `mindmap_same_outline` | `mindmap.outlineId == outline.outlineId` |
| `evidence_identity_closed` | outline、mindmap、Ask 中每个 evidenceId 都属于同一 `task.evidence` 集合 |
| `timeline_ordered_non_overlapping` | segment order 从 1 连续递增；每段 `start<=end`；后一段 `start >` 前一段 `end` |
| `vision_provider_real` | production acceptance 中 `executionMode=real`，provider/model/request/response hash 均存在；`evidenceClass=contract_fixture` 永远不能支持生产声明 |
| `credential_access_authorized` | `unauthorizedCredentialAccessEvents=0` |
| `seek_reads_real_player_time` | located observation 必须回读播放器 currentTime，且 `abs(observed-requested)<=2` 秒 |
| `credential_lease_same_task` | 非空 `acquisition.credentialLease.taskId == task.taskId`，且租约未过期 |
| `outline_same_task` | outline.taskId 与 task.taskId 相等 |
| `ask_same_task` | askResult.taskId 与 task.taskId 相等 |
| `evidence_within_media_duration` | 每条 evidence 满足 `0<=start<=end<=mediaPageContext.durationSeconds` |
| `revoked_policy_blocks_acquisition` | `status=granted` 时 revokedAt 必须为空；`status=revoked` 时 revokedAt 必须存在，且其后不得出现新租约/下载/grant/上传事件 |
| `completed_has_no_failure` | `task.state=completed` 时 failureCode 必须为空 |
| `cookie_value_not_persisted` | `cookieValuePersistenceEvents=0` |
| `cookie_value_not_in_evidence` | `cookieValueEvidenceEvents=0`，且公开 artifact 扫描无 Cookie 值 |
| `temporary_media_removed` | `temporaryMediaResidualCount=0` |
| `credential_route_requires_lease` | `route=credentialed_media` 时必须有同 task、未过期租约以及 `bilibili_session_access/temporary_media_download` scope |
| `tab_capture_requires_trusted_grant` | `route=tab_capture` 时 `task.captureGrant` 必须非空、同 task 且 `trustedUserGesture=true`；`MediaAcquisitionRecord` 不得保存第二份 grant |
| `portal_adapter_binding` | `mediaPageContext.adapterId/platform` 必须属于构建期 registry 的同一 descriptor；未注册或错绑 fail closed |
| `source_identity_matches_page_context` | `task.sourceIdentity` 必须等于 `portal:<adapterId>:<mediaId>:<playbackUnitId>:<part.id>` |

`portal_adapter_binding` 的机器输入固定为 `contracts/v3-media-portal-registry.json` 原始字节及 SHA-256。validator 必须同时比较 adapterId、platform、adapterRevision、静态 match、capabilities 和实现目标；不能只检查字符串 `bilibili` 是否出现。

生产 validator 还必须 fail closed：输入根对象 `evidenceClass=contract_fixture`、原型路径、fixture 路径、mock Provider 或跨 run artifact 时，不得仅因结构和上述算法通过而生成 V3 成功声明。

## 10. 当前恢复工作包：V3-2-0b-5.3

原 Paraformer 长窗候选已因一个非静音 bin 完整遗漏而 `FAIL / REPLAN`。恢复路线不改变本文件的 V3 总体分母，而是在 V3-2-A06 前增加固定窗口资格门：三个真实 source 各切 8 个 15 秒 chunk，单并发顺序推理，24/24 非空，三样本总耗时分别 <=16360/14760/16280ms，随后才允许生成新的双人 48 项盲评。

实施输入为 `v3-2-0b-fixed-window-adr.md` 与 `subphases/v3-2-0b-5.3/` 文档包；机器输入为 fixed-window Schema/registry/manifest/fixtures。文档外审和用户授权已完成，5.3-0..4 PASS；5.3-5 真实 run 因 sample03/chunk4 非零音频输出 0 segment 而 `FAIL / REPLAN`。不得勾选 V3 A01..A14 或人类 H01..H10，5.3-6/7 不启动。

## 11. 路线 C 最小 Spike 与下一工作包

V3-2-0c 已按 `document freeze -> internal audit -> isolated real spike -> PRD review` 完成。固定三个 15 秒真实窗口全部非空，目标遗漏已恢复，低资源与隐私门槛通过；该结果不改变 Tiny fallback，也不注册 SenseVoice。

下一工作包必须先文档化 SenseVoice production candidate：完整 3x120 秒/24-bin、双 reviewer 48 判断、时间粒度、三平台资产、安装/取消/恢复、Settings requested/effective/fallback、故障清理和独立出门。外部文档审查 Fatal=0/Major=0 与用户新授权前，不进入产品代码。
