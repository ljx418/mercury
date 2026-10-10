# V3 Media Companion 架构差异与图纸索引

状态：`DOCUMENT CANDIDATE`。图纸：`v3-media-companion-gap.drawio`，固定 8 页中文页。

## 1. 当前与目标

| 状态 | 当前代码实体 | V3 目标实体 | 差异 |
|---|---|---|---|
| 已实现保留 | `pageContext.ts`、Side Panel shell、Workspace shell、`runtimeClient`、Evidence Card、Reading Map | 作为容器、普通页面与呈现基线 | 不能冒充媒体身份、字幕、ASR 或画面理解 |
| 已实现 | 无独立媒体门户层 | `MediaPortalRegistry`、`MediaPortalAdapter`、`MediaPageContext` | V3-1.1 外部限定 PASS；通用 URL/identity/playback/seek 合同；平台实现不得泄漏到 UI/Runtime |
| 已实现 | 无 B站 adapter | `BilibiliMediaPortalAdapter` | V3-1.1 外部限定 PASS；窄域自动注入；读取 bvid/cid/分P并映射通用 context |
| 已实现 | 无通用门户会话层 | `PortalPermissionClient`、`PortalSessionBroker`、`PortalSessionRegistry`、`PortalSessionAdapter` | V3-1.2 QUALIFIED PASS；通用 policy/capability、未注册 fail closed、平台秘密不进核心 |
| 已实现 | 无产品级 B站会话桥接 | `BilibiliPortalSessionAdapter`、`PortalCredentialChannel`、`PortalCredentialLease` | V3-1.2 候选会话能力与 V3-1.3 exact-Origin、20 秒 channel、专用 envelope、60 秒 Runtime 内存租约均已通过限定出门 |
| 已实现但质量失败 | 无第二本地 ASR 引擎 | `AsrProviderRegistry`、`FunAsrLlamaCppProviderAdapter`、`NativeAsrProcessHost` | 官方资产与低资源推理已落地；长窗遗漏导致 `failed_current_gate`、不可选择，Tiny 继续 effective |
| 文档候选/代码未开发 | 无固定窗口编排 | `FixedWindowAsrOrchestrator`、`FixedWindowPlan`、`ChunkAudioRef`、offset merge | 计划 3 样本 x 8 个 15 秒顺序推理；FW01..FW20 和每样本 <=2x 延迟；外审及新授权前 NO-GO |
| 文档候选/代码未开发 | 无受控媒体获取 | `MediaAcquisitionCoordinator`、`BilibiliMediaAcquirer`、`SubtitleResolver`、`TaskArtifactSandbox`、`MediaAcquisitionRecord` | V3-2 冻结凭据字幕 → 凭据媒体 ASR → 公开/页内字幕 → 可信 capture ASR 的唯一顺序；实现仍 NO-GO |
| 文档候选/代码未开发 | 无可信媒体 capture 回退 | `MediaCaptureController`、`MediaCaptureOffscreen`、`MediaCaptureGrant` | 仅前三条路线失败后，由 Side Panel/Workspace 可信点击创建 30 秒一次性授权并捕获当前标签页音频 |
| 文档候选/代码未开发 | 无媒体 Runtime | `LocalAsrAdapter`、`FasterWhisperLocalAsrAdapter`、五终态 cleanup barrier | V3-2 只产生强类型 `MediaTranscript`；Cookiefile/临时媒体/原始音频和 active capture 终态必须为 0 |
| 待新增 | 无画面 Runtime 与任务持久化 | frame/OCR pipeline、`MediaVisionProvider`、`MediaTaskStore` | V3-3/V3-4 才产生画面证据、可恢复任务和导出；不得计入 V3-2 成功 |
| 待新增 | 网页大纲/导图 | `VideoOutline`、`TimelineSegment`、`MediaMindmapProjection` | 三视图共享同一语义事实源 |
| 待新增 | DOM jumpback | `MediaJumpbackController` | 真实播放器时间 seek 与误差观测 |
| 迁移到 V4 | PX-6/RKM 候选 | Knowledge Import、Query、Graph、Forget、维护 | 不参与 V3 门禁，不宣称完成 |

## 2. 八页图纸

1. **用户入口与目标体验**：B站锚点、Side Panel、Workspace、最终体验、V4 边界。
2. **当前与目标代码实体**：路线 A 权限、现有实体、门户 adapter registry、B站实现、V4 延后实体和依赖方向。
3. **双容器路由与组件**：具体路由、组件、输入输出、响应式职责和焦点。
4. **Cookie/字幕/音频/OCR/VLM 数据流**：五项持久授权、精确 Origin + bearer bootstrap、20秒一次性 channel、60秒 Runtime 内存 lease、公开字幕与可信 capture 回退、本地处理、选帧云调用、清理。
5. **任务/证据/Ask/反跳**：状态机、`VideoOutline`、投影视图、引用和真实 seek。
6. **BiliNote 迁移与治理**：clean commit、MIT license hash、六文件 `reference_only` allowlist、清单外默认拒绝、隐私和 fail-closed。
7. **开发及自动验收**：V3-0..V3-7、真实数据分母、阶段产物和停止条件。
8. **人类验收与出门条件**：H01-H10、操作步骤、回填、允许声明和 No-Go。

## 3. 状态颜色

- 绿色：已实现且保留。
- 蓝色：V3 待新增。
- 黄色：现有实体需修改或需要治理。
- 灰色：明确迁移到 V4。
- 红色：禁止路径、假绿或停止条件。

## 4. 文档映射

| PRD 体验 | 架构实体 | 开发阶段 | 自动验收 | 人工验收 |
|---|---|---|---|---|
| B站识别与无字幕提示 | collector/context | V3-1 | A01 | H01 |
| 授权、租约、启动、回退、取消 | consent/session broker/acquirer/capture/task | V3-1/V3-2/V3-4 | A02-A04/A10/A13 | H02/H03/H09 |
| 本地转写与画面理解 | ASR/frame/OCR/VLM | V3-2/V3-3 | A03-A06 | H04/H05 |
| 大纲、时间线、导图 | outline/projection | V3-4/V3-5 | A07 | H04/H06 |
| Ask 与引用 | Ask/evidence index | V3-5 | A08 | H07 |
| 视频反跳 | jumpback controller | V3-5 | A09 | H08 |
| 本地历史与导出 | MediaTaskStore/export | V3-4/V3-5 | A12 | H10 |
| 隐私与证据 | governance/cleanup/package | V3-6/V3-7 | A10/A13/A14 | H09/H10 |

## 5. 图纸门禁

Draw.io 必须保持 8 页、每页 ID 唯一、节点不越出 1600x900、边引用存在。图中不得出现“真实 data_service 是 V3 前置”“VLM 延后到 V3.x”“V3 已实现”“持久化 Cookie 值”或“无租约/跨任务下载”描述。

V3-1.3 图纸还必须显示：通用 Runtime 调用不能承载 secret；UI bearer 只用于创建短期 channel；Background 只通过专用 fetch 发送白名单 envelope；同 body 不重试；公开 lease 不含 token/name/value；Runtime restart、撤销与 TTL 均 fail closed。

V3-2 图纸还必须显示：四条 acquisition route 的固定顺序；同 task lease；30 秒 one-shot capture grant；Background 与 Offscreen 的专用流；本地 ASR；五种终态 cleanup barrier；`V3-2-A01..A20` 固定分母。外部文档审查和用户实施授权前，相关代码实体必须明确标为 `DOCUMENT CANDIDATE / NOT_IMPLEMENTED`。

路线 A 图纸还必须明确：B站详情页窄域自动桥接；普通网页 action/command + `activeTab` + 原生 Side Panel；`MediaPortalRegistry` 只注册审计过的 adapter；未来 YouTube/小红书复用通用 context 但单独审批权限和样本。图中不得出现 `<all_urls>` 或语义等价全站匹配。

## 6. 2026-09-21 V3-2-0a 图纸增量

现有 8 页原位更新，不增加分页：图 02 把 ASR 模型管理标为独立审查限定通过，同时保留 acquisition/capture 未开发；图 04 在四路线前标明 Tiny fallback/Small 校验安装不等于生产 ASR；图 07 增加 V3-2-0a A01-A16 已通过和 V3-2 A06 失败边界；图 08 明示模型管理通过不得扩大为 V3-2 出门。绿色只用于已通过实体，黄色表示有限通过与仍需后续门禁，红色表示 A06 失败和 V3-2-1+ 阻塞。

## 7. 2026-09-22 V3-2-0b 图纸增量

原 0b 图纸增量已进入历史状态：`AsrProviderRegistry -> FunAsrLlamaCppProviderAdapter -> NativeAsrProcessHost` 已实现，但长窗 sample03/bin2 完整遗漏使 0b 为 FAIL/REPLAN。图 02/04/07/08 不得再把 0b 标为待实现文档候选，也不得因资产和进程层完成而使用生产通过绿色。

该增量保持门户开放性：B站/YouTube/小红书只通过通用 `TaskAudioRef` 向 ASR 层交付音频；图中不把 B站 Cookie、bvid/cid 或门户权限带入 Provider 层。ASR 资格通过只能更新 provider quality status，不能替代任一门户的真实页面、媒体获取、许可或清理验收。

## 8. 2026-09-22 V3-2-0b-5.3 图纸增量

仍保持 8 页：图 02 标出 0b FAIL/REPLAN 与 `FixedWindowAsrOrchestrator` 文档候选；图 04 显示 `TaskAudioRef -> 8x15秒无重叠 -> Provider -> ProcessHost` 的单向链和 <=2x 延迟；图 07 固定 FW01..FW20、24 chunk 和外审/授权边界；图 08 固定机器门禁先于 48 项双人判断。黄色表示文档候选，红色保持 A06/V3-2-1..7 阻塞，绿色不得用于 5.3。
