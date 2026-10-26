# V3 Media Companion Stage Gate

> **2026-10-07 上位边界**：本文件及既有 `V3-0..V3-7` 媒体计划继续有效，不被 Chat + Know 收敛方案替换。B站媒体子链成为 Chat 当前上下文的技术主干；新增 `V3-1.4` 本机伴侣、`V3-4.1` KnowledgeDraft/Know 投影，并在既有 V3-5..V3-7 上追加整合验收。V3 总门禁同时读取 `design/v3-chat-know-product-convergence.md`、`v3-chat-know-development-plan.md` 和 `v3-chat-know-acceptance-plan.md`。媒体 LIMITED PASS 不等于 Chat/Know 或 V3 PASS；原合同、12 页分母、H01-H10 与历史证据均不得缩减或改写。

> **2026-10-19 WP0 范围修订**：历史 `tabCapture` 实现、矩阵和证据保持只读，不从分母中删除；但它不再是 V3 当前产品候选的必需成功输入。R6 以 `58/65 supported + 0/7 experimental visible lifecycle` 受限收口，不能宣称原 R6 PASS。R7 可封存“主路径候选 + experimental capture limitation”，但必须证明生产默认不会静默进入 capture。后续显式本地视频导入属于独立 workpack，不得在 R7 中冒充已实现。

> **2026-10-19 WP-A 实施门限**：R7 之后先完成“媒体依赖就绪”，再进入显式本地文件导入。WP-A 只管理冻结 `yt-dlp`、验证系统 `ffmpeg/ffprobe`、聚合既有 SenseVoice 状态，并让新媒体任务消费 verified generation；不实现文件导入、不升格 tabCapture、不改变媒体内容或秘密上传范围。WP-A 文档、原型、合同、开发计划和验收矩阵通过 Codex 审查后，才允许 ClaudeCode CLI 修改产品代码。

> **2026-10-19 WP-A 文档结论**：实施前包 verifier `42/42`，隔离审查遗留项定向闭环为 Fatal=0/Major=0/Minor=0；当前坐标 `WP-A IMPLEMENTATION MAY START`。仅允许按唯一 ClaudeCode goal 实施 WP-A，并在 `WP-A AWAITING CODEX CHECKPOINT` 停止；WP-B/WP-C 与 V3 PASS 未授权。

> **2026-10-19 WP-A 实施结论**：Codex 纠正 A24 探针整秒截断、错误 route/endpoint 读取，并关闭 redirect/retry/deadline、repair job 重启持久化、终态不可逆、task snapshot 篡改和 Settings 恢复缺口。A01-A24 为 `24/24 PASS`，A23 fresh 下载与 A24 公开 API `credentialed_media_asr -> SenseVoice` 真数据通过，v11 为 `50/50 + 16/16`，Fatal/Major/Minor=`0/0/0`。当前坐标 `WP-A PASS / WP-B DOCUMENTATION NEXT`；WP-B 产品实现仍未授权。

> **2026-10-19 WP-B 文档门限**：WP-B 只新增用户手势单文件字节导入、privileged Runtime 流式会话与 `explicit_local_media_asr` 同任务接线；不接收路径、不扫描目录、不上传原始媒体、不改变自动 route/SourceAuthority/relay v11/tabCapture 支持级别。实施前包冻结两个公共 schema、一个内部 durable schema、五个 fixture、真实资产 registry、18 个失败码、SQLite store、B01-B30 与 ASR/视觉双消费者 barrier。focused Codex 审查 Fatal/Major 清零且 verifier 全绿前，产品实现 NO-GO。

> **2026-10-19 WP-B 实现入口**：实施前 verifier `95/95`、Archify showcase `9/9`，独立审查问题经单批闭环后 Fatal/Major/Minor=`0/0/0`。当前坐标 `WP-B IMPLEMENTATION MAY START`；只授权唯一 ClaudeCode goal，完成后须停在 `WP-B AWAITING CODEX CHECKPOINT`，不得进入 WP-C 或宣布 V3 PASS。

日期：2026-10-10。状态：`V3-1.4 LIMITED PASS / V3-2 LIMITED PASS / V3-3 LIMITED PASS / V3-4 LIMITED PASS / V3-5 functional flow implemented but formal H01..H10 pending / V3-5.1 MACHINE CANDIDATE PASS + HUMAN QUALITY REVIEW PENDING / V3-6..V3-7 BLOCKED`。

## 1. 范围与当前事实

- V2/PX-6/RKM：`PAUSED / INCOMPLETE`，保留证据但不阻塞 V3。
- V3：B站优先，首版包含受控 Cookie 会话、公开字幕、受控任务期媒体下载与本地 ASR；可信 tabCapture 降为默认关闭的实验回退。关键帧、本地 OCR、持久授权下的云端 VLM、大纲、时间线、Media Mindmap、Ask、反跳、任务历史和本地导出仍在范围内。
- V4：承接真实知识持久化、Query、Graph、Durable Forget 和维护。
- V3-1.1 已实现开放 `MediaPortalAdapter`、仅 B站注册的 build-time registry、窄域自动 bridge、通用页面身份、字幕能力发现、播放读取与 seek；V3-1.2 会话能力已 `QUALIFIED PASS`，V3-1.3 Browser-to-Runtime 一次性凭据通道和短期进程内租约已通过独立实施出门审查。新增 V3-1.4 Manual Companion Runtime 已完成一次配置、桌面手动启动、扩展自动建立短期会话、显式停止和重启换实例闭环；2026-10-08 新鲜真实 Chrome 再验证仍为 7/7 PASS。历史 Small/Base/Paraformer 比较失败保持只读；SenseVoiceSmall Q8 已成为 V3 `development_baseline`。V3-2-1 Runtime acquisition core、V3-2-2 Route B3 和 V3-2-3 三槽位真实媒体获取/全长转写均保留限定通过。V3-2-4 的 production route orchestration 历史失败已由 V3-2.4a..V3-2.7 修复、重采、生产出门和独立审查闭环；当前 V3-2 为 `LIMITED PASS`，不得把历史失败描述为当前阻塞，也不得扩大为 V3 整体通过。

## 2. V3-0 文档出门

必须同时满足：

1. PRD、架构、开发/验收计划、合同、原型、Stage Gate、BiliNote clean-commit allowlist 和 8 页 Draw.io 使用同一范围；真实 Mock 基线与目标原型必须清晰分开。
2. `v3_media_companion_contracts.schema.json` v3 通过 Draft 2020-12 元校验，正例通过；25 项 requirement registry 与 25 个 case 精确一致，5 个 schema negatives 被拒绝，20 个 semantic negatives 在 Schema 层保持合法并绑定唯一失败码。
3. 审查原型在 360/420/768/1280 可操作，五项授权和 Cookie 主路径可见，Axe serious/critical=0，键盘主流程通过；过期三项授权截图和越界 AI 样张不得计入。
4. 两轮内部审计 Fatal=0/Major=0，平铺外审包不超过 20 文件且 hash 全匹配。
5. Claude Code CLI 独立文档审查 Fatal=0/Major=0。
6. 用户另行明确批准产品代码实施。

未完成第 6 条时，任何 V3 产品代码开发均 NO-GO。

## 3. 顺序门禁

| Gate | 固定产物 | 出门判定 |
|---|---|---|
| V3-0 | 权威文档、合同、真实基线、确定性原型、图纸、BiliNote allowlist、12 页分母/注册表合同、审计包 | 文档候选通过，不代表具体样本已探测或产品已实现 |
| V3-1P | 真实 Chrome 样本发现、12 页 revision 1 注册表、截图、隐私/清理/PRD 审计 | `PASS`；只关闭 V3-1 输入门禁，不代表 collector/session 已实现 |
| V3-1 | collector/session broker/credential lease/context/双容器入口 | 锚点 + 5 页真实 Chrome 身份与会话能力准确；0 Cookie 值持久化 |
| V3-2 | credentialed acquirer/subtitle/local ASR/tabCapture fallback | 6 字幕 + 3 ASR + 至少 1 回退；0 cookiefile/临时媒体/音频残留 |
| V3-3 | frame/OCR/vision provider | 10 OCR、8 真实 VLM；授权和证据闭合 |
| V3-4 | task store/outline/timeline/mindmap | 状态可恢复，三视图同源 |
| V3-5 | renderer/Ask/evidence/jumpback/export + 唯一一轮 H01-H10 | 四视口、5 次 seek、Axe/Keyboard、人类签署 |
| V3-5.1 | Workspace 理解质量与交互补强 | 语义章节、图文时间线 wheel/drag/playback sync、层级大纲、三层导图、grounded Ask；3 个真实视频和最小人类复核，0 Major |
| V3-6 | 12 页生产矩阵 | 使用 V3-5.1 最终投影/UI；单 run、真实数据、0 mock、0 Major |
| V3-7 | 最终独立审计 | 只读复算 V3-5、V3-5.1 人类签署与 V3-6 单 run，Fatal=0/Major=0 |

## 4. 锚点与固定分母

锚点：`https://www.bilibili.com/video/BV1ZpYd66ELP`。

2026-09-17 正式真实 Chrome run `v3-1p-bilibili-probe-20260917T041114Z` 观测：`bvid=BV1ZpYd66ELP`、`cid=41828944992`、单 P、`duration=792`、匿名 WBI/legacy subtitle item 均为空。2026-09-18 授权态重探测出现 4 个字幕项，2026-10-06 有效授权会话再次观测到 3 个 API 字幕项；锚点保留并在 Revision 3 Amendment 1 明确归入 subtitle。平台事实变化不得改写 revision 1，也不得强制走 ASR。

Revision 3 Amendment 1 曾将三个自然无字幕样本限制为当前分 P 不超过 1200 秒；该约束只适用于 Revision 3 历史矩阵。用户随后接受的 Route B 与 Route B3 ADR 已用三个固定 ASR 能力槽位替代“短且永久无字幕”的不稳定分母。Revision 5 允许长媒体，但不得放宽 8 CPU、8 GiB、无 GPU、串行执行和全长转写门槛，只允许增加 wall-clock；匿名旧 run 与 Revision 3 的 1200 秒结果均不得和当前 Revision 5 拼接。

12 页固定分母：6 字幕、3 ASR 能力槽位、1 多 P、1 受限 blocked、1 低信号 degraded；必须是 12 个互不重复 URL，一个样本不得重复占位。10 个应成功样本完成 OCR，至少 8 个完成真实 VLM。Revision 1..4 均为历史只读；当前媒体获取与转写使用 Revision 5，保留身份/分P/页面、task-time 字幕发现、真实媒体 hash/shape、授权证据和 SenseVoice baseline，跨模型比较明确 `deferred_to_v4`。Revision 5 不代表 V3-3 的 OCR/VLM 或 V3 整体已经完成。

## 5. 产品出门体验

```text
打开 B站视频 -> Navia 识别身份、会话和字幕状态
-> 首次授权五项 scope（持久到撤销）
-> 用户点击开始，建立短期 Cookie 租约
-> 凭据字幕/临时媒体；失败时公开字幕；仍失败则明确 blocked，不静默 capture
-> 本地 ASR + 关键帧/OCR + 授权云端 VLM
-> 图文大纲/时间线/Mindmap/Ask/证据
-> 点击证据跳回真实播放器
-> 本地历史与导出
```

## 6. No-Go

以下任一项阻止出门：mock 或 fixture 计生产结果；Cookie 值持久化/进入日志或证据；`<all_urls>` 或未审计 Cookie 名称；秘密 request body 被记录/重放；无租约下载、跨任务凭据复用或绕过平台限制；tabCapture 无可信点击；无授权上传帧；无证据生成画面结论/Ask；跨 run 拼接；缩小 12 页分母；凭据/临时媒体清理失败仍成功；Side Panel 和 Workspace 使用不同 task；把本地导出声明为 V4 知识持久化。

V3-1 路线 A 已由用户选定：B站详情页使用窄域自动桥接；普通网页只在 action/command 用户手势后通过 `activeTab` 打开原生 Side Panel；未来门户经 `MediaPortalAdapter`、独立窄域权限和真实样本矩阵接入。V3-1.1 外部独立实现审计为 Fatal=0/Major=0/Minor=0，限定 PASS；V3-1.2 涉及 Cookie 权限和会话能力，必须单独完成详细计划、威胁建模、外部文档审计及用户高风险授权。

## 7. V3-1.1 外部限定 PASS

- 生产代码：`apps/chrome-extension/src/modules/media_companion/`、B站 MAIN/isolated content bridge、background action/command 路径。
- 最终 run：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.1-media-page-collector/runs/v3-1.1-media-page-20260917T060500Z/`。
- 绑定：build tree `c95c67dc…e428d`；portal registry `c96ab0d3…eab6`；sample registry `b7158892…d8c1`。
- 结果：12 个唯一真实页面 12/12；6 字幕能力、3 ASR 路径、1 多 P、1 restricted、1 low-signal；锚点无字幕假阳性；p2 identity、真实 seek 和非法 seek fail-closed；普通页 0 静态注入；秘密扫描 0；profile/进程残留 0。
- 外部审计：`evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.1-implementation-audit.md`，结论 Fatal=0/Major=0/Minor=0。
- 状态：允许声明 `V3-1.1 Bilibili media page context collection passed the frozen real-Chrome matrix.`；V3-1.2 Cookie/session、V3-1 整体、V3-2 和 V3 仍未通过。

## 8. 允许声明

V3-0 外审通过后：`V3 Bilibili-first implementation specification ready for explicit authorization.`

V3-7 完成后：`V3 Bilibili-first media companion passed the frozen subtitle/local-ASR/keyframe/OCR/authorized-cloud-VLM acceptance matrix.`

禁止扩大为全平台、直播、无限期/跨任务下载、绕过平台限制、跨视频 RAG、V4 或完整 BiliNote/Monica parity。

## 9. V3-1.2 实施前门禁

- 详细计划：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.2-session-broker-development-plan.md`。
- 验收计划：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.2-session-broker-acceptance-plan.md`，固定 V3-1.2-A01..A15，不允许 N/A。
- 威胁模型：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.2-session-broker-threat-model.md`。
- 机器权威：`contracts/v3-media-session-policy-registry.json` + `contracts/v3_media_session_contracts.schema.json`。
- 架构固定为通用 `PortalPermissionClient -> PortalSessionBroker -> PortalSessionRegistry -> PortalSessionAdapter`，B站只是策略 plugin；未来 YouTube/小红书需独立权限、secret policy 和真实矩阵。
- V3-1.2 仅输出 `serverValidated=false` 的浏览器内会话候选能力；不实现 envelope、lease、Runtime 传输或媒体下载。
- 外部文档审计：`evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.2-document-audit.md`，结论 Fatal=0/Major=0/Minor=3，文档 PASS。
- 用户已明确批准 Cookie 高风险实施；授权记录与一次性验收会话种子边界分别见 `v3-1.2-implementation-authorization.md` 和 `v3-1.2-user-session-bootstrap-addendum.md`。本条是 V3-1.2 实施前历史门禁；V3-1.2 已完成限定出门，V3-1.3 后续状态以第 11 节为准，V3-2 仍 NO-GO。

## 10. V3-1.2 本地出门候选

- 已通过：32 files / 230 tests、typecheck、build、V3 Route A 静态 13/13。
- 已通过：权威 run `v3-1.2-session-production-20260917T165700Z-final`；服务端输入 HTTP 200/code=0/isLogin=true；匿名与 live-seed 各 26/26；强化 verifier 36/36；Axe 0/0；10 张截图；最终扩大秘密扫描 644 文件 0 命中；profile/Chrome 清理完成。
- 已关闭：旧的服务端会话 `code=-101` 阻塞。历史失败证据保留，不作为当前输入。
- 已关闭：匿名字幕访问漂移不再被伪装成匿名 PASS。V3-1R run `v3-1r-authenticated-regression-20260917T180000Z-final` 使用 `user_authorized_live_session_seed_regression` 完成原 12 页 12/12；verifier 18/18；12 张 1280x900 截图均在写盘前裁去顶部账户区；秘密复扫 0 命中。
- 证据：`v3-1.2-6-acceptance-card.md`、`v3-1.2-6-implementation-audit.md`、`v3-1.2-6-prd-spec-review.md`、`v3-1r-authenticated-regression-acceptance-result.md`、`v3-1r-authenticated-regression-implementation-audit.md`、`v3-1r-authenticated-regression-prd-review.md`。历史风险记录继续保留。
- 外审：`independent-v3-1r-implementation-exit-audit.md`，Fatal=0/Major=0/Minor=1；唯一统计口径 Minor 已在 `v3-1r-external-minor-closure.md` 关闭。
- 门禁：V3-1.2 为 `QUALIFIED PASS`。其后 V3-1.3 已完成独立文档审查、用户高风险授权和本地实施候选；最终状态与下一步权限以第 11 节为准。

## 11. V3-1.3 文档与实施出门门禁

- 目标：`exact extension Origin + existing in-memory Runtime bearer -> 20s one-shot channel -> trusted Background 9-name envelope -> 60s Runtime process-memory lease`。
- 机器权威：`contracts/v3-media-credential-transport-policy-registry.json`、`contracts/v3_media_credential_lease_contracts.schema.json`、`fixtures/v3-media-credential-lease-contract-positive.json`、`fixtures/v3-media-credential-lease-contract-fixtures.json`。
- 计划：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-credential-lease-development-plan.md`、`v3-1.3-credential-lease-acceptance-plan.md`、`v3-1.3-credential-lease-threat-model.md`。
- 不复用通用 `runtimeClient`/`navia.runtimeFetch` 传 secret body；主 bearer 不进入 Background；Cookie 值不进入持久/公开产物或值 hash。
- 生产出门固定 `V3-1.3-A01..A20`；租约签发不证明服务端登录、媒体获取或视频理解。
- 放行实现的必要条件：外部独立文档审计 Fatal=0/Major=0，且用户明确批准 `V3-1.3 Browser-to-Runtime credential transport implementation`。
- 外部独立文档审计已完成：`evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1.3-document-audit.md`，结论 Fatal=0/Major=0/Minor=2。M-1（真实 Chrome Origin probe）和 M-2（60 秒仅覆盖本阶段）已在 `v3-1.3-external-document-audit-closure.md` 绑定到实施门禁；用户高风险授权记录见 `v3-1.3-implementation-authorization.md`。
- 唯一本地实施候选：`v3-1.3-credential-20260917T134817Z-final3`。动态生产观察 28/28、固定 A01-A20 20/20、四视口实际 PNG、Axe serious/critical=0、Side Panel/Workspace 键盘路径通过；合同 25 cases、前端 290、Runtime 338、V3-1.2 36/36、同 build V3-1R 12/12；最终 raw-value scan 140 files / 11,259,125 bytes / 0 hit。
- 证据入口：`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-7-acceptance-result.md`、`v3-1.3-7-prd-review.md`、`v3-1.3-false-green-exit-audit.md` 和 `v3-1.3-credential-transport/runs/v3-1.3-credential-20260917T134817Z-final3/`。
- 独立实施出门审查：`v3-1.3-independent-implementation-exit-audit.md`，结论 PASS，Fatal=0/Major=0/Minor=3。
- 当前允许：进入 V3-2 详细文档、机器合同、负例、威胁建模和独立文档审查。
- 当前禁止：进入 V3-2 代码、宣称服务端登录已由公开 lease 验证、媒体已获取或视频已理解。V3-2 代码仍需新的外部文档审查 Fatal=0/Major=0 和用户明确高风险授权。

## 12. V3-2 文档冻结门禁

- 范围仅含 `AcquisitionCoordinator`、`BilibiliMediaAcquirer`、`SubtitleResolver`、任务期临时媒体、可信 `MediaCaptureController` 回退、`LocalAsrAdapter`、取消与清理；不含关键帧/OCR/VLM、VideoOutline、Mindmap、Ask、MediaTaskStore 持久恢复或导出。
- 路由顺序固定为：`credentialed_subtitle -> credentialed_media_asr -> public_or_page_subtitle -> trusted_tab_capture_asr`。只有第一、二条路线消费同 task 有效 lease，第四条路线必须有本次可信点击创建的 30 秒 one-shot grant；实现不得静默跳过、并行竞速或把失败路径标成成功。
- 文档必须冻结 Acquisition/Transcript/CaptureGrant/ASR/Cleanup 机器合同、错误码闭集、临时路径规则、`0600` cookiefile、租约/grant 生命周期、Runtime/Chrome/关页/取消/撤销故障矩阵，以及 6 字幕 + 3 ASR + 至少 1 capture 回退的真实固定分母。
- V3-1.3 三项 Minor 进入 V3-2 外审义务：逐项复算所有验收子字段；抽样至少 5 类 observation payload；授权 Cookie 只由用户临时提供且不得进入公开证据。
- 放行代码的必要条件：V3-2 PRD 映射、架构、开发计划、验收计划、威胁模型、Schema/registry/fixtures、内部 false-green 审计和外部独立文档审查全部一致且 Fatal=0/Major=0；随后仍需用户单独明确批准 V3-2 implementation。
- 机器权威：`contracts/v3-media-acquisition-policy-registry.json`、`contracts/v3_media_acquisition_contracts.schema.json`、`contracts/v3_media_acquisition_sample_registry.schema.json`、`fixtures/v3-media-acquisition-contract-positive.json`、`fixtures/v3-media-acquisition-contract-fixtures.json`。
- 计划入口：`evidence/v3_media_companion/v3-2-media-acquisition/v3-2-contract-and-api-spec.md`、`v3-2-development-plan.md`、`v3-2-acceptance-plan.md`、`v3-2-threat-model.md`。
- 当前状态：独立文档审查 `Fatal=0/Major=0/Minor=3`；用户于 2026-09-18 明确授权 V3-2-0..7 顺序实施。三个 Minor 已进入 `v3-2-external-document-audit-closure.md`。V3-2-0 真实 small/base 比较材料、24 bin 页面、四视口、Axe 0/0、键盘和导出流程已通过机器 QA。2026-09-21 用户将 `reviewerId=123` 的结果指定为最终结论；原始 24 项通过 Schema，但含 1 个 critical、1 个 neither-acceptable，production 逐样本为 7/8、8/8、8/8。门禁以失败提前终止，不伪造第二 reviewer：D08 `FAIL / REPLAN`、V3-2-0 `FAIL / REOPENED`、V3-2-1 保持 NO-GO。

## 13. V3-2-0a ASR 模型管理限定通过门禁

- 固定分母：`V3-2-0a-A01..A16`，覆盖 Schema、bundled Tiny、设置页资源说明、requested/effective、真实安装进度、取消、故障、离线包、卸载、静态边界、低资源真实推理、四视口与 PRD/假绿审查。
- 本地候选事实：Tiny 四文件共 `78,203,619` bytes，manifest SHA-256=`b6713f1f...2afb`；8 cores/8 GiB/no-GPU 的 30 秒真实 B站音频窗口得到 17 个 timestamped segments，峰值 RSS `350200 KiB`，但固定为 fallback self-test，不计 A06。
- Small 真实安装事实：官方固定 revision 的四文件 `486,212,372` bytes 全部逐文件 SHA-256 匹配，经过 verify/local-load-self-test/atomic-publish 后 ready，管理器重启后 requested/effective 均为 Small。安装成功不改变其 `failed_current_gate` 质量标签。
- 真实 Chrome 候选：`v3-2-0a-2026-09-21T121500382Z`，17/17，result SHA-256=`397993e0...901`；Side Panel 360/420 与 Workspace 768/1280 无根溢出，五个 Axe 视图 serious/critical=0，安装弹窗、取消后焦点返回和键盘离线包选择通过。旧 `113130938Z` 候选被本次最新 build run 取代但保留历史字节。
- 独立审查：`evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0a-independent-implementation-exit-audit.md`，结论 `Fatal=0 / Major=0 / Minor=3`。
- 当前决定：`V3-2-0a LOCAL LIMITED PASS`，只覆盖本地 ASR provider/模型管理与低资源 fallback。V3-2-0/A06 仍 `FAIL / REOPENED`，V3-2-1..7 仍 `BLOCKED / NO-GO`。

## 14. V3-2-0b ASR Provider 资格恢复文档门禁

- 目标：在 8 cores/8 GiB/no-GPU 条件下，以官方 FunASR llama.cpp + Paraformer Q8 + FSMN-VAD 候选重新挑战既有三样本 A06，不修改样本、窗口、双 reviewer 或质量阈值。
- 机器权威：`contracts/v3_asr_provider_qualification_contracts.schema.json`、`contracts/v3-asr-provider-qualification-policy-registry.json`、`contracts/v3-asr-provider-qualification-candidate-manifest.json`、`fixtures/v3-asr-provider-qualification-fixtures.json`。
- 文档权威：`evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-provider-qualification-adr.md`、`v3-2-0b-development-plan.md`、`v3-2-0b-acceptance-plan.md`、`v3-2-0b-threat-model.md`。
- 固定分母：A01..A18；候选质量必须 44/48、每样本 15/16、critical=0、neither=0；双 reviewer 身份不同。
- 开放边界：门户 adapter 只提供通用 `TaskAudioRef`；未来 YouTube/小红书不得控制 provider，也不能继承 B站权限或 PASS。
- 实施事实：0b-0..0b-4、官方资产、Provider、Settings 和低资源真实推理已完成；15 秒 VAD 重跑在 sample 03 / bin 2 出现非静音完整遗漏。`v3-2-0b-5.1-20260922T072602Z` 以退出码 2 fail closed，失败证据 verifier 8/8，但质量固定分母 11/12。
- 风险传播闭环：0b-5.1a 已使失败诊断 8/8 可复算；0b-5.1b 在真实 Chrome 中以 7/7 固定分母、16/16 E2E 完成 `failed_current_gate`、不可选择、Tiny effective fallback 与红色失败状态传播。该子阶段 PASS 不改变质量门禁。
- 当前决定：`V3-2-0b FAIL / REPLAN`；人工盲评未启动，0b-6/0b-7 与 V3-2-1..7 BLOCKED。Paraformer 不可选择，effective model 保持 Tiny fallback-only。
- 重规划：单 bin 诊断证明固定 15 秒输入可得到非空输出，推荐统一预切片路线；该路线改变 candidate manifest、生产推理实体与威胁模型，必须重新完成详细文档、内外审和用户授权。不得用诊断输出或旧 run 拼接恢复 A06。

## 15. V3-2-0b-5.3 固定窗口文档门禁

- 决策：采用路线 A，三个冻结样本均从零切成 8 个固定 15 秒 chunk，顺序推理并按 offset 合并；编号 `5.3` 避免覆盖既有 `5.2` 私有诊断。
- 代码边界：`TaskAudioRef -> FixedWindowAsrOrchestrator -> FunAsrLlamaCppProviderAdapter -> NativeAsrProcessHost`；固定窗口层必须 portal-neutral。
- 机器权威：`contracts/v3_asr_fixed_window_contracts.schema.json`、`contracts/v3-asr-fixed-window-policy-registry.json`、`contracts/v3-asr-fixed-window-candidate-manifest.json`、`fixtures/v3-asr-fixed-window-contract-fixtures.json`。
- 文档权威：`v3-2-0b-fixed-window-adr.md` 及 `subphases/v3-2-0b-5.3/` 下合同、开发、验收、威胁模型。
- 固定分母：FW01..FW20；3 source、24 chunk、24/24 非空、0 overlap/gap、concurrency=1、0 文本改写、0 partial reuse、三样本分别 <=2x 长窗基线、双 reviewer 48 判断和独立出门审查。
- 实施结果（2026-09-22）：外部文档审查与用户授权均已完成；`5.3-0..4 PASS`，合同负例 20/20、专用测试 38/38、Runtime 330/330。真实 run `v3-2-0b-5.3-20260922T110455Z` 中 sample01/02 分别 8240/8380ms 且 8/8 非空，但 sample03/chunk4 在非零音频上稳定输出 0 segment。
- 当前状态：`V3-2-0b-5.3 FAIL / REPLAN`。5.3-6/7 未启动，Paraformer 仍 `failed_current_gate/selectable=false`，Tiny 保持 effective fallback；V3-2-1..7 BLOCKED。下一步仅允许新路线文档冻结与真实 spike，不得复用上下文诊断输出或降低 24/24 门槛。

## 16. V3-2-0c SenseVoice 路线 C Spike 门禁

- 文档权威：`evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0c-sensevoice-spike/` 下 ADR、计划、验收、威胁模型、manifest 和审计。
- 固定分母：已知 Paraformer 遗漏窗口 + 同源控制 + 跨源控制，共 3 个 15 秒真实窗口；SC01..SC15 不得 N/A。
- 实施结果：`v3-2-0c-spike-20260922T131329Z` 为 3/3 非空、SRT 合法、seccomp 网络阻断、低资源通过；Fatal=0/Major=0/Minor=3。
- 当前决定：`LIMITED PASS FOR PRODUCTION-CANDIDATE DOCUMENTATION ONLY`。SenseVoice 尚未注册到产品，不可选择；Tiny effective 不变；V3-2-A06 与 V3-2-1..7 继续 BLOCKED。
- 下一门槛：生产候选必须重新冻结 24-bin/48-review、时间粒度、跨平台资产、Settings 状态、故障/清理和独立审计，并取得外部文档审查与用户新授权。

## 17. V3-2-0c-1 SenseVoice 开发基线

- 用户于 2026-09-22 将 SenseVoiceSmall Q8 定为 V3 development baseline，并把跨模型退化检测及质量失败后的智能回退移入 V4；历史 Small/Base、Paraformer 失败不改写。
- 实施结果：官方资产远程下载/bytes/hash/self-test/原子发布通过；真实 sample03/chunk4 输出非空合法 SRT；Runtime 332、前端 293、Chrome 12/12 通过。
- 当前决定：`V3-2-0c-1 LIMITED PASS`，quality 状态仅为 `development_baseline`。V3-2-1 可进入详细计划与实施前审计；V3-2/V3 整体仍未通过。

## 18. V3-2-1 Runtime Acquisition Core

- 实现：通用 `MediaAcquisitionCoordinator`、`TaskArtifactSandbox`、create/get/cancel API、随机 0700/0600 artifact、配额、cleanup barrier 与 owner orphan recovery。
- 真实验收：私有真实 B站 WAV `3840078` bytes 完整写入/校验/取消清理；正式 run `v3-2-1-core-20260922T145000Z`；RC01..RC16 全通过。
- 回归：媒体合同 49/49，Runtime 346 passed。决定为 `V3-2-1 LIMITED PASS`，Fatal=0/Major=0/Minor=2。
- 下一门禁历史记录：当时等待 Revision 3 的全新 12 页 run；该路线因平台字幕漂移 fail closed，后由用户批准的 Route B/B3 与 Revision 5 取代。当前门禁见 §20.3 与 §20。

## 19. V3-2-2 Revision 3 与授权会话状态（历史）

- Revision 3 Schema、ADR、BA01..BA16、开发计划与威胁模型已经落盘；revision 2 未修改。
- 2026-10-06 全新 Chrome `154.0.8037.95` 临时 profile 完成 12/12 页面探测，公开 run 对 Cookie 真值扫描 0 命中，profile/进程已清理。
- 用户更新 Cookie 后，B站 `/x/web-interface/nav` 返回 HTTP 200、`code=0/isLogin=true`；原会话 Major 已关闭。随后真实探测发现冻结样本分类漂移，Amendment 1 已进入重新审计。
- V3-2-1 外部独立实施审查已关闭原 M-2；Revision 3 外部独立文档审查见 `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/independent-document-audit.md`，结论为文档 PASS、Fatal=0/Major=1/Minor=1。
- 当时决定：`AMENDMENT 1 DOCUMENT RE-AUDIT / IMPLEMENTATION NO-GO`。该分支随后因平台漂移 fail closed，并由 §20.2/§20.3 的 Route B/B3 决策替代；旧失败 run 与候选发现 run 继续不得拼接。
- H01..H10 只在 V3-5 自动 UI 门槛通过后执行；V3-2..V3-4 不请求人类操作。

## 20. V3-2-3 / V3-2-4 文档准备状态

- V3-2-3 原文档已完成过方向审查，但其输入假设早于 Route B3：曾依赖已清理的 V3-2-2 私有音频，并只定义 ST01..ST16。2026-10-07 已启动实施前恢复修订，改为三个固定能力槽位在全新单 run 内逐任务 acquisition->SenseVoice，固定 ST01..ST20、双层 cleanup 和 VAD-count fail-closed coverage。
- V3-2-4 可信 `tabCapture` 已冻结 grant/chunk/stop receipt、TC01..TC20、Offscreen/原声回放/停止清理边界和高风险重新授权条件。
- 旧外部报告 `v3-2-3-4-independent-document-audit.md` 只证明旧候选方向；当前 B3 resumption 文档已完成第二轮独立文档审查 Fatal=0/Major=0，并取得用户实施授权。
- 当前顺序门禁：B3 与 V3-2-3 均已 `LIMITED PASS`。V3-2-4 实现候选的 Runtime 486、前端 298、typecheck/build 与 extension-load smoke 通过，但 TC13 真实 capture→SenseVoice 未通过；V3-2-4a 文档冻结与审计是恢复实施的前置。

## 20.1 V3-2-2 ASR 分母风险停止（2026-10-06）

- Amendment 1 Round 2 外部文档审查为 Fatal=0/Major=0，允许全新单 run；该结论只证明文档可执行。
- production 候选 run `v3-2-sample-probe-20261006T103000Z` 的三个 ASR 候选均出现真实 `ai-zh` 字幕项，生成器按合同 fail closed，未生成 registry 或 `productionReady=true`。
- 多轮候选发现/复探证明 B站会异步补充 AI 字幕，短视频“首次无字幕”不能作为稳定生产分母。继续自动换 URL 有证据假绿风险。
- 当前 `V3-2-2 FAIL / REPLAN`；路线与权衡见 `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/asr-denominator-risk-stop-20261006.md`。用户选择前不得进入 V3-2-2 产品实现或后续阶段。

## 20.2 V3-2-2 Revision 4 路线 B 授权（2026-10-06）

- 用户已批准路线 B 规格修订与 V3-2-2 实施；Revision 1/2/3 与历史 run 保持只读。
- 新分母仍为 12 个唯一 URL 和 `6+3+1+1+1`，其中 ASR 路线精确为 1 个 `natural_no_subtitle` 与 2 个 `audited_subtitle_failure`。
- 两个故障分别为字幕体 403 与空体，只能由 E2E acceptance orchestrator 注入；生产 Runtime/API/env/Acquirer 不得表达或导入故障计划。
- 固定锚点 `BV1ZpYd66ELP` 保留；注入前真实字幕发现和注入后真实当前分 P 媒体必须同时可复算。
- 当前状态：`ROUTE B DOCUMENT FREEZE IN PROGRESS / IMPLEMENTATION WAITS FOR FATAL=0 MAJOR=0 DOCUMENT AUDIT`。V3-2-3 继续 BLOCKED。

## 20.3 V3-2-2 Revision 5 路线 B3 授权（2026-10-07）

- Revision 4 的修复后 run 因固定自然样本新增平台 AI 字幕而失败；旧 run 保持只读，不撤销下载器大小上限修复。
- 用户批准 B3：固定三个 ASR URL 和预绑定验收故障策略，运行时以 acquisition task 的真实字幕发现分类；自然无字幕与可审计字幕失败的计数可变，但总数精确为 3。
- 三个槽位必须全部获得真实当前分 P 的 16 kHz mono PCM；故障仍只可由 acceptance runner 表达，生产路径 0 可达。
- B3 文档与内部实施前审计 Fatal=0/Major=0。允许 B3-0..B3-7 实施和全新真实 Chrome 单 run；V3-2-3 只有在 B3 实施出门 Fatal=0/Major=0 后才可开始。
- 自动候选 run `v3-2-route-b3-20261007T014759Z` 已完成：12/12 Chrome、7 subtitle、3 real media、1 blocked、1 degraded，动态触发 `1+2=3`，B3 verifier 20/20，Runtime 449、前端 293、秘密/清理 0 异常。
- 独立实施出门审查已复算 19/19 载荷、18 个 seal 文件、Revision 5 Schema/instance、动态分母和 B3-01..B3-20，结论 Fatal=0/Major=0/Minor=3。
- 当前状态：`V3-2-2 ROUTE B3 LIMITED PASS / V3-2-3 LIMITED PASS / V3-2-4 ACCEPTANCE FAIL`。V3-2-4 高风险授权已消费；失败原因是生产 route orchestration 不完整，不是权限未授权。

## 21. V3-3 / V3-4 实施级文档候选

- V3-3 已补齐 `-0..-7` 开发计划、A01..A16 验收、威胁模型、实施前审计、`v3_media_vision_evidence_v1.schema.json` 与正负 fixture；采样预算固定为 24 个候选、12 个证据、8 个云端 VLM、最长边 1280 px，禁止原视频上传。
- V3-3 当前为 `DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / V3-3-0b MULTI-PROVIDER SETTINGS LIMITED PASS / REAL MINIMAX PROBE PENDING`。用户已批准一次中性图探测和最多 8 张冻结证据帧上传。`V3-3-0b` 已实现 MiniMax/OpenAI 闭集注册表、Provider/模型选择、独立系统凭据、已验证后切换当前路由、Companion 双门槛 API 与中性图 capability test；自定义地址、未知模型和未测试切换均 fail-closed。Runtime 589、前端 316、typecheck/build、真实 Chrome 360/420 键入检查与 Axe 0/0 已通过。当前唯一剩余门槛是用户在设置页录入 MiniMax 密钥并触发真实中性 probe；真实 probe 通过前不得实施 8 帧生产调用。
- V3-4 已补齐 `-0..-7` 开发计划、V401..V418 验收、SQLite aggregate/event/outbox 同事务、崩溃恢复威胁模型，以及 `v3_media_outline_taskstore_v2.schema.json` 的 ready/degraded/blocked 正负合同；v1 保持历史只读。
- V3-4 v2 合同独立审查见 `v3-4-contract-amendment-independent-document-audit.md`（SHA-256 `14b4a23137184ce8b58a5eae8c0b3b8c8b2800be5c526a9ba39ad2581ec60601`），结论 Fatal=0/Major=0/Minor=5。固定 12 页为 10 ready + 1 degraded + 1 blocked；Outline 冻结为本地确定性抽取。
- MiniMax 中国区 `MiniMax-M3` 中性图实时复验 PASS（9775 ms，305 tokens），只证明接口当前可用。代码实施与 V3-4 新 run 最多 8 张 selected frame 上传仍需用户明确授权；V3-3 旧授权不得继承。
- 用户已于 2026-10-08 显式授权 V3-4 实施、B站 Cookie 下载及 fresh-run 最多 8 张 selected frame 的 MiniMax-M3 任务级上传。production run `v3-4-outline-production-20261008T104258Z` 已完成：10 ready + 1 degraded + 1 blocked、8 次授权帧调用、12/12 Schema-valid、20/20 独立结构复算、Runtime 578、Extension 317、typecheck/build、secret/path/raw-media/截图残留均为 0。不同 Claude Code session 的实施出门审查结论为 `V3-4 LIMITED PASS`，Fatal=0/Major=0/Minor=4，报告 SHA-256 `faa268acb9f00d4e5e227f1e591e5836f3601a02c262ca95e675c77c437b81c0`。只放行 V3-5 详细实施前恢复，不等于 V3/Chat+Know/产品通过。
- V3-4 fresh run 观测到平台能力漂移：冻结 registry 的 01..06 属字幕样本，但实时 acquisition 均落到 `credentialed_media_asr`。这不违反 V409 的终态固定分母，故不撤销 V3-4 LIMITED PASS；但 V3-5 必须按真实 route 展示较长本地转写和资源占用，不得把 registry 分类当成本次实际字幕快路径，也不得在 UI/验收中承诺 6 个字幕成功。
- V3-3..7 五份 Schema meta、六个 positive instance、43 项定向合同测试和 Runtime 全量 414 passed；包内 `v3-3-7-semantic-verifier.py` 独立复算 10/10 跨字段负例，外部审查另构造 4/4 负例均 fail-closed。该结果只证明合同和文档可执行，不证明 OCR/VLM、SQLite/Outline 或用户体验已经实现。
- 顺序门禁保持：V3-2 -> V3-3 -> V3-4 -> V3-5。H01..H10 仍只允许在 V3-5 自动 UI 门槛通过后由人类执行。

## 22. V3-5 / V3-6 / V3-7 实施级文档候选

- V3-5 已补齐 `-0..-7` 组件/路由/Ask/seek/export 开发计划、自动 A01..A18、人工 H01..H10、签署与 UI 威胁模型、product acceptance v2/human review v1 合同和实施前审计。2026-10-08 外部独立复审结论为 `CONDITIONAL GO FOR EXPLICIT USER IMPLEMENTATION AUTHORIZATION`，Fatal=0/Major=0/Minor=2；v1 保持历史只读，fresh run 只接受带 `taskExecution` 的 v2。当前 `DOCUMENT PASS / IMPLEMENTATION AND HUMAN REVIEW NO-GO / WAITING USER AUTHORIZATION`；真实 build 和逐步截图验收页仍须在实施阶段生成。
- V3-5 实施依赖 V3-4 LIMITED PASS。旧 V3-0 umbrella fixture schema 不得覆盖最新阶段合同。
- V3-6/7 已补齐单 run 12 页 6+3+1+1+1、A01..A20、完整故障矩阵、public/private、seal、H submission binding、限定声明、威胁模型和实施前审计。当前 `DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`，Fatal=0/Major=3/Minor=0。
- V3-6/7 已新增 finalization candidate/disposition v1 双阶段合同并通过第三轮总文档复审；实现前置仍包括正式 V3-5 H submission、V3-5.1 体验补强出门、collector/verifier/tooling 冻结和同一可追溯生产 build。V3-6 不新增人工步骤，V3-7 不代签或改写 H01..H10/V3-5.1 体验签署。
- 这些文档使剩余阶段从方向大纲升级为通过独立审查的实施候选，但不等于代码授权或产品通过；每阶段 `-0` 仍须冻结当期真实 Schema/tooling/原型产物并执行实施前审计。

## 23. V3-3..V3-7 文档总准备度

- 剩余阶段均已有具体代码实体、`-0..-7` 顺序、固定自动/人工分母、威胁模型、实施前审计和版本化机器合同，不再只是方向性大纲。
- 第三轮独立只读文档审查已完成：19/19 payload hash、5/5 Schema meta、6/6 positive、包内 10/10 和独立 4/4 语义负例均通过；本次文档包 Fatal=0/Major=0/Minor=2。V3-3..7 文档门禁通过，但实现仍全部 NO-GO。
- V3-2 已以唯一生产 run `v3-2-production-20261007T174158Z` 取得 `LIMITED PASS`，19/19 审计载荷、A01..A20、12 页 `6+3+1+1+1`、3 个全长 SenseVoice、可信 capture、14 故障、secret/cleanup 和 seal 均由不同 session 独立复算通过，Fatal=0/Major=0/Minor=0。当前主要真实阻塞收敛为 RapidOCR/VLM 依赖冻结、V3-3 真实 collector/verifier/build 以及选定帧云端上传的显式用户授权。

## 25. V3-3 实施出门（2026-10-08）

- 唯一成功生产 run：`v3-3-vision-production-20261008T092933Z`；10 个样本分类 `6 subtitle + 3 asr + 1 multipart`，10/10 本地 OCR、固定前 8 个 8/8 MiniMax-M3、后 2 个 Provider dispatch=0。
- result SHA-256=`c63ac81261b5b82d8b9b91becfe8f9e3891077b7965537ecfe26dba1f057381e`；seal SHA-256=`ab99a529cfcb9d22e31018367587112810883e7da24bc389a904600d0c835645`；content SHA-256=`81b6b4a3fdfa0d1e5a05d15a083bd8c72f4c8f8e82c1525bbce0e7b1258208de`。
- 四个早期 timeout/529 run 均为 0 文件、无 result/seal、私有 root 已清理，不计入成功分母。
- 独立 verifier 正例通过；重算 seal 后伪造 non-target vision 的语义负例被 `SAMPLE_09_NON_TARGET_DISPATCH` 拒绝。
- 回归：Runtime 616 passed；Extension 默认 threads pool 47 files / 317 tests；typecheck/build PASS。标准 forks pool 的 worker 启动超时已通过固定 threads/4 workers 修复，不删减测试。
- 决定：`V3-3 LIMITED PASS`，Fatal=0/Major=0/Minor=2。只放行 V3-4 实施前恢复审计，不扩大为 V3 或最终用户体验 PASS。

## 24. V3-2-5..V3-2-7 实施级文档候选

- 原数行总括已经拆分为三套 `-0..-7` 详细开发计划、独立验收计划、威胁模型和实施前审计。
- V3-2-5 固定 A01..A14：Side Panel/Workspace 只读同一 Runtime task，四视口、Axe/键盘、可信 capture 操作、取消清理和新 task 重试。
- V3-2-6 固定 A01..A12 + F01..F14：每个故障独立 task，唯一终态、终态后零写、owner-root orphan recovery、零残留/零秘密。
- V3-2-7 固定总 A01..A20：全新 build/profile/runtime/task root，12 页 `6+3+1+1+1`、至少 1 真实 capture、3 全长 ASR、single-run seal 和候选 pending/false。
- 新增 `v3_media_transcript_exit_v1.schema.json`、positive fixture 与 19 项合同/假绿测试；联合 V3-3..7 定向合同回归 55 passed，Runtime 全量 407 passed。该结果只证明文档可表达、拒绝所列假绿且未破坏既有 Runtime，不证明 UI、fault tooling、collector/verifier/package 已实现。
- 外部独立文档审查 `v3-2-5-7-independent-document-audit.md` 已完成，最终包 19/19 payload hash、Schema、三个 positive、19 项合同测试及补充负例均通过，结论 Fatal=0/Major=0/Minor=0。
- 当前决定：`V3-2-5..7 DOCUMENT PASS / IMPLEMENTATION BLOCKED BY PREDECESSORS`。V3-2-5 依赖 V3-2-4 PASS；V3-2-6 依赖 V3-2-5；V3-2-7 依赖 V3-2-6 和 tooling freeze。H01..H10 继续只在 V3-5。

## 26. V3-5.1 三视频生产机器候选（2026-10-10）

- 唯一候选 run：`v3-5.1-production-candidate-20261010T210000Z`。三条真实 B站视频均完成 SenseVoice 全长转写、8 个分布式真实帧、MiniMax-M3 画面理解、12 章节、时间线、三层导图和 12 问。
- 真实 Chrome 对每候选五类入口各执行 2 次播放器 readback，总计 30 次；四视口无根溢出，Axe serious/critical=0，首交互最大 171 ms，主线程最长 181 ms，0 remote script/eval。
- Runtime 679、Extension 351、Workspace targeted 6、typecheck/build 全绿；raw media/audio/transcript/OCR 云上传 0，selected-frame upload 24，临时媒体和自动化截图残留 0。
- 内部假绿审计发现 Ask 的 `criticalMeaningError=false` / `citationSupported=true` 由生产者写入，不能单独作为含义正确的证据。production verifier 已追加独立人类质量 submission 门禁：无提交时固定 `machinePassed=true / status=HUMAN_REVIEW_PENDING / passed=false / exitCode=3`。
- 当前决定：`V3-5.1 MACHINE CANDIDATE PASS / HUMAN QUALITY REVIEW PENDING`。固定候选 3 x 12 问与锚点五步体验未由人类提交，旧 V3-5 H01..H10 正式 submission 也仍 pending；因此 V3-5.1 未 LIMITED PASS，V3-6/V3-7 不得启动。

## 27. V3-5.10 子阶段状态冻结（2026-10-14）

> 本节仅冻结当前权威状态词，不改写历史失败证据。完整诊断证据见
> `evidence/v3_media_companion/v3-5.10-experience-repair/` 下的
> `stage-a-*`、`stage-b-*`、`stage-b-route-2-*`、`stage-b-deepseek-strict-adapter-*`
> 和 `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md`。

- **Stage A** 固定负向旅程 NJ-01..NJ-10：`LIMITED PASS`（单 BVID `BV1hMpE6FEXG`、临时扩展预授权 fixture、四视口 bounded evidence）。独立审查 `stage-a-final-independent-exit-audit-2026-10-13.md` Fatal=0 / Major=0 / Minor=3；Orca worker `task_b307e1598b9e`。
- **Stage B B-0**：合同冻结 `PASS`。
- **Stage B B-1..B-4**：实现 `LIMITED PASS candidate`（不构成 Stage B 出门，不替代 B-5 fresh）。
- **Stage B Route 2（确定性 brief composer）**：文档 CONDITIONAL GO（外部独立审查 Fatal=0 / Major=0 / Minor=5，SHA-256 `b3db4ffc82283712c28737a0ee569403e1194ea280b74ab24408f2c66eb72079`），实现 LIMITED PASS；**B-5 真实 fresh 六视频分母仍 `FAIL/REPLAN`**（`stage-b-b5-route-2-risk-stop-2026-10-14.md`），其余五段 BVID 不得据旧候选拼接或移除。
- **DeepSeek strict adapter DS-1..DS-5**：`LIMITED PASS`（`deepseek-chat + /beta/chat/completions + strict tool` 资格 20/20）。结构成功仅证明 JSON 形状，不证明内容正确，亦不替代默认 Provider。
- **Chat Provider 默认**：`MiniMax`。`chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md` 显示 MiniMax / DeepSeek 均经 Windows Credential Vault 安全迁移、SQLite `api_key` 列清空、密钥命中 0；DeepSeek 模型 `deepseek-chat`、能力 `deepseek_beta_strict_tool_v1`、`selected=false`。保存 ≠ 选择；首次使用不诱导，不自动切换。
- **B-5..B-7、Stage C/D/E、V3-6/V3-7**：均 `NO-GO`。任何当前候选不得升格为 V3 PASS。
- **实施前必备边界**：单任务锁单一 Provider，禁止跨 Provider 拼接或隐式 fallback；真实 fresh run 必须使用 fresh Runtime/database/profile/task 与 `--mute-audio` Chrome 实例；0 原始视频/音频/帧/Cookie/密钥上传，派生 transcript/OCR/vision-caption 文本仅在既有授权范围内发送；用户对 DeepSeek 任务级选择与真实项目派生文本上传必须另行高风险授权。

## 2026-10-15 P0 Background Capture Relay 门禁补丁

真实诊断已把可信 capture 阻塞收敛到 Offscreen WebSocket 上下文；Background 和 Windows 到同一 Runtime endpoint 均可连接。路线冻结为 Background 持有 Runtime WebSocket、Offscreen 经受信 Port 发送有序 PCM，公共 API、ticket 和用户流程不变。v1-v9 均已被独立复核拒绝；当前唯一候选为 v10。

当前状态：`V10 DOCUMENT CANDIDATE / SINGLE CODEX REVIEW IN PROGRESS / P1 BLOCKED`。v10 baseline 50/50、mutation 15/15 已通过；用户已批准继续实际开发，单次 Codex 独立 Agent 文档审查 Fatal=0/Major=0 后直接进入 R0-R7，不再要求 Claude Code 或第二份文档外审。实现后仍必须通过单视频真实静音 canary、故障矩阵、secret/cleanup 和独立实施出门审查。Chrome 116 sender 身份不可弱化。同步 staging 屏障必须先于 daemon worker；owner manifest 必须原子发布并完成 parent-directory fsync，再以 SQLite FULL receipt 绑定 manifest canonical SHA-256；barrier 前后 cleanup owner 唯一，八类 manifest/receipt 缺失、未提交或损坏 fail-closed。hard crash 后 composite cleanup 必须使 acquisition/ASR/product/sink 四类残留全零；terminal frame 只通知 handoff，唯一持久产品成功是 SQLite ready/degraded。其余绕过项继续阻止通过。

## 28. V3-5.10 Stage B B-6 当前门禁（2026-10-25）

- B-5 grounded-comprehension recovery、发布物字节完整性、机器身份/权威绑定和离线聚合门禁已经完成；这些结果不等于 B-6 语义评审或 Stage B 出门。
- 首次 fresh GC-B6B 六源捕获批次结论为 `GC-B6 SEMANTIC REVIEW NO-GO`。order 1 与 order 2 均未形成可盲评 bundle，机器门为 negative，盲评未执行；不得把已发布 derivative、Provider 请求成功或历史 B-5 结果替代 B-6 bundle。
- order 1 暴露的 catalog 排序与捕获诊断丢失已在 `gc-b6b-capture-corrective-codex-2026-10-25` 中离线修复：catalog hash 对齐生产 `(start,end,id)` 排序，稳定诊断码进入私有机器收据，公开五键 capture receipt 不变。定向 43/43、Stage B 离线 584/584、Runtime 50/50 通过；未发生外部动作。
- order 2 的 `degraded + no PNG -> B6_CAPTURE_SEEK_UNCLOSED` 仍是未归因的真实产品/捕获边界。冻结裁决保持：无 PNG 的来源不可评审；不得采用 text-only、5/6、limited、reserve 替换或降低 seek closure。
- 下一授权包为 `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTATION`，且仅限离线实现：构造一个窄的单源诊断执行器，复用生产捕获/seek closure 代码，区分“产品未产出可评审 PNG”“workspace/thumbnail 路由不一致”“捕获器错误”三类稳定结果，并证明失败清理、公开证据脱敏和默认零外部动作。
- 本包必须停在 ClaudeCode 实施 checkpoint。任何真实 Chrome、Cookie 读取/注入、Provider、下载、真实 BVID 或授权消费均为越界。离线候选经 Codex 复核后，真实单源 canary 仍需新的显式授权；只有 canary 证明可捕获后，才可申请 fresh 六源 B-6 重跑。
- 权威计划与 ClaudeCode 提示词：
  - `evidence/v3_media_companion/v3-completion/gc-b6b-capture-corrective-codex-2026-10-25/03-order2-diagnostic-plan.md`
  - `evidence/v3_media_companion/v3-completion/gc-b6b-capture-corrective-codex-2026-10-25/04-claudecode-prompt.md`
- 2026-10-25 ClaudeCode 离线实现经 Codex checkpoint 发现并修复四项 Major 假绿：正常存活的 owned 后代被提前锁存为泄漏、显式 stage root 未传给 child、child 非零退出/陈旧 observation 可被解释为 READY、离线 fixture 可直接产出 READY。同步收紧错误码/字段/计数、收据写失败与 run/task 绑定。最终 B6C 聚焦 29/29、lifecycle 10/10、Stage B 离线 615/615、Runtime 定向 50/50；外部动作仍为 0。
- 当前状态：`GC-B6C CORRECTIVE PASS / ONE ORDER-2 VISIBLE DIAGNOSTIC MAY RUN WITH FRESH EXPLICIT INPUTS`。该授权仅覆盖一个 owned、`--mute-audio` 的 order-2 canary；结果无论 READY/BLOCKED 都必须回到 Codex，不自动授权 fresh 六源 B6B。缺 stage/private/Cookie/run/authorization 任一输入时必须在 Chrome 和授权消费前停止。
- 该一次性可见诊断已执行并消费：preflight 34/34，随后仅启动 1 个 owned `--mute-audio` Chrome、1 个 Runtime、1 个媒体任务和 1 次 synthesize；实际 Provider HTTP 尝试 8 次，命中全局上限。产品在 B6 捕获前以冻结质量码 `V3510B_CHAPTER_IMBALANCE` fail closed，`sourceCompletion=0`，无 bundle、projection、review row 或 sentinel。下载/导入/音频/tabCapture 均为 0；owned 进程和端口最终为 0。
- 本次也暴露一个 harness Major：早期产品失败没有写 canary observation，外层错误地只报 `CANARY_OBSERVATIONS_MISSING`。Codex 已修为正常异常路径始终写严格、非候选、带 `CANARY_OWNER_FAILED` 的最小观察；冻结章节错误码进入只读 allowlist，null task id 仅在 owner-failed 时可接受。聚焦合同 30/30、真实 runner lifecycle 11/11、合并 Stage B 离线 617/617 全绿。历史可见结果不被补签或改写。
- 当前状态：`GC-B6C VISIBLE DIAGNOSTIC BLOCKED / AUTHORIZATION CONSUMED / GC-B6D OFFLINE IMPLEMENTATION AUTHORIZED`。下一包只处理章节平衡恢复：让 adapter 的 pre-validator enforcement 与独立 validator 共用同一平衡语义和指标，在硬上限 8 内由同一 Provider 有界重生成，并保留 fail closed。禁止降低 `concentration`/`maxChapterSpanRatio` 阈值、扩大请求预算、在本地重排或改写 Provider 章节、发起任何真实 Chrome/Cookie/Provider/BVID 动作，或重开 B6B。
- GC-B6D 的详细架构、验收计划与 ClaudeCode 提示词：`evidence/v3_media_companion/v3-completion/gc-b6c-visible-diagnostic-and-b6d-handoff-2026-10-25/04-claudecode-prompt.md`。
- GC-B6D ClaudeCode 候选经 Codex checkpoint 复现并修复三项 Major：runner 的形状型字符串净化可泄漏短 secret/title；平衡重生成没有携带已授权语义上下文，会要求 Provider 凭时间索引猜测全文；DeepSeek strict 作为可选生产 adapter 无法执行共享的 shape/balance regeneration task。另修正提示仅声明当前实际生效的冻结平衡规则，不在 4–5 章时附加 validator 不要求的集中度约束。
- 纠偏后：GC-B6D 聚焦 26/26，GC-B5R/comprehension 合并聚焦 199/199，runner/B6C/lifecycle 43/43，Stage B 离线 619/619，Runtime 全量 1282 passed / 3 skipped。外部动作、Chrome、Cookie、Provider、真实 BVID、授权消费均为 0；公开合同、阈值、失败码、八次预算与分母均未变。
- 当前状态：`GC-B6D CORRECTIVE PASS / FRESH ORDER-2 RECOVERY CANARY REQUIRES NEW EXPLICIT AUTHORIZATION`。下一动作仅允许一个 fresh order-2 canary，用真实产品路径验证失衡候选是否在八次上限内恢复并形成可闭合 B6 bundle；无论 READY/BLOCKED 都回到 Codex。不得直接重开六源 B6B，不得补签历史运行，不得执行盲评/B7/Stage C。
- Codex 纠偏证据：`evidence/v3_media_companion/v3-completion/gc-b6d-codex-checkpoint-corrective-2026-10-25/`。
- 新授权的单源 recovery canary 已执行且仅执行一次。产品恢复路径通过：order 2 到达 `ready`，发布有效 V2.1 derivative，形成 transcript 49、frame 8、OCR 8、vision-caption 8 与可读 PNG 8；synthesize 1 次、Provider HTTP 4 次，未触及八次上限。上传原始视频/音频/帧、音频播放和 tabCapture 均为 0，owned 进程与端口最终为 0。
- B6 捕获仍未通过：捕获器在写 bundle 前以 `B6_BUNDLE_ABSOLUTE_PATH` 拒绝。Codex 定位为 harness 确定性缺陷：隐私扫描把 PNG 压缩字节与 manifest 的重复二进制 payload 解码成 UTF-8，随机形成路径形状。历史运行保持 `BLOCKED`，不得因根因已知而补签 bundle、review row 或 Stage B 结果。
- Codex 已离线修复：隐私扫描仅遍历结构化语义字符串并显式扫描 textual artifact；不再解码 thumbnail 或 manifest payload；PNG validator 只放行必需结构与 ffmpeg 固定 9 字节 `pHYs`，其余 ancillary chunk 全拒，避免二进制排除成为隐私旁路。新增 4 条反假绿，focused 76/76、最终 PNG 组合 39/39、完整 Stage B 离线 623/623 全绿；公开合同、rubric、prompt、阈值、registry 与分母不变。
- 当前状态：`GC-B6D PRODUCT RECOVERY PROVEN / GC-B6E CAPTURE BINARY CORRECTIVE PASS / AUTHORIZATION CONSUMED`。下一动作不是新的 ClaudeCode 实现包，而是一个 fresh order-2 capture confirmation；它需要新的明确可见运行授权、fresh owned roots/grant，只允许一个 owned `--mute-audio` Chrome。无论 capture closed 或 blocked 都必须回到 Codex；不得直接启动六源 B6B、盲评、B7 或 Stage C。
- 本轮证据：`evidence/v3_media_companion/v3-completion/gc-b6d-recovery-canary-capture-corrective-2026-10-25/`。
- fresh order-2 capture confirmation 已按授权执行一次且未重试。zero-action preflight 34/34；随后仅启动一个 owned `--mute-audio` Chrome、一个隔离 Runtime 和一个媒体任务。运行在 8 次 Provider HTTP 硬上限处以 `V3510B_PROVIDER_RESPONSE_INVALID` fail closed，任务未到 ready，证据/PNG/bundle/sourceCompletion 均为 0；原始视频/音频/帧/Cookie/密钥/路径上传为 0，清理闭合且 owned leak 为 0。
- 结构诊断显示候选依次在 `brief_shape`、`brief_value_domain`、时间边界/递增锚点之间回归；最后一次仍为 `brief_value_domain`。这次没有到达 B6 capture，因此既不能验证也不能否决上一包的 PNG 二进制修复。历史第一次 recovery canary 的产品成功事实保留，但不得替代本次失败或 B6 bundle。
- 当前状态：`GC-B6E VISIBLE CONFIRMATION BLOCKED BEFORE CAPTURE / AUTHORIZATION CONSUMED / GC-B6F OFFLINE IMPLEMENTATION AUTHORIZED`。GC-B6F 只允许把初始生成、shape/temporal/balance regeneration 与 repair_v2 的完整冻结不变量收敛到一个 owner，增加只含类型/长度类别/计数/布尔的值域诊断，并以本次真实违规序列做离线回归。禁止提高八次预算、本地重排或改写 Provider 内容、放宽合同、启动 Chrome/Cookie/Provider/真实 BVID、重开 B6B、执行盲评/B7/Stage C。
- GC-B6F 架构与 ClaudeCode 提示词：`evidence/v3_media_companion/v3-completion/gc-b6e-visible-confirmation-and-b6f-handoff-2026-10-25/04-claudecode-prompt.md`。
- GC-B6F ClaudeCode 候选经 Codex checkpoint 复现三项 Major 假绿：brief/claim 外来 evidence ID 只进入诊断而不触发 adapter 拒绝；空 `evidenceIds` 在 claim/chapter 诊断中被错误报告为 0 个无效项；runner 虽声明复数值域数组键，却未加入对象键白名单和复数 enum，真实边界会静默丢弃。另发现结构信任允许 evidenceIds 内嵌对象回传 Provider。
- Codex 窄纠偏关闭上述问题：membership 在 adapter value-domain 阶段 fail closed；空数组使用 `empty_list` 稳定类并计为无效 collection；repair context 只接受字符串 item；runner 双层 allowlist 完整保留复数 enum 且继续丢弃未知键/值。无公开合同、失败码、阈值、请求上限、Provider 锁或分母变更。
- 纠偏验证：GC-B6F Python 41/41、GC-B5R/B6D/B6F 合并 241/241、runner/lifecycle 46/46、Runtime 全量 1324 passed / 3 skipped、Stage B 离线 626/626。Chrome/Cookie/Provider/真实 BVID/授权消费均为 0。
- 当前状态：`GC-B6F CORRECTIVE PASS / FRESH ORDER-2 CONFIRMATION REQUIRES NEW EXPLICIT AUTHORIZATION`。下一动作仅允许一个 fresh order-2 canary 验证完整不变量是否在八次上限内形成 ready 产品并穿过修正后的 B6 capture；无论 READY/BLOCKED 都返回 Codex。不得直接重开六源 B6B、盲评、B7 或 Stage C。
- Codex 纠偏证据：`evidence/v3_media_companion/v3-completion/gc-b6f-codex-checkpoint-corrective-2026-10-25/`。
- 2026-10-26 的 order-2 收口按预先声明的三次上限完成。第一次产品 `ready` 且形成 49 transcript、8 frame、8 OCR、8 vision-caption，但严格 PNG 校验拒绝冻结 ffmpeg 的 BT.709 `cICP/cHRM/gAMA` 固定块；校验器仅按精确固定 payload 放行并继续拒绝任意 ancillary/text/ICC/EXIF。第二次已证明 8/8 PNG，却因 writer 以输入顺序、reader 以文件名字典序重建八张缩略图而触发 `B6_BUNDLE_MANIFEST_DRIFT` 与 `B6_BUNDLE_RECEIPT_INVALID`；receipt 与 manifest 现统一按 `evidenceId` 规范排序，多缩略图正反输入测试证明字节一致。
- 两项 harness 纠偏后，focused review-bundle 31/31、capture 组合 86/86、完整 Stage B 离线 629/629。第三次也是最后一次 fresh order-2 可见确认通过 zero-action preflight 34/34 后执行：产品 `ready`，Provider HTTP 4 次，73 条派生证据、8/8 PNG、6 章，capture `captured`；私有 manifest 全量摘要通过，生产 `readReviewBundle()` + `validateReviewBundle()` 重读为 `ok:true`。cleanup 闭合、owned leak 0，原始视频/音频/帧/Cookie/密钥/本地路径上传均为 0。
- canary 固定为 `candidate:false / semanticReviewPerformed:false / stagePass:false`，所以该结果只证明单源产品与 B6 capture 路径，不得宣布 B6、Stage B 或 V3 通过，也不得把三次 order-2 结果拼成六源候选。
- 当前状态：`GC-B6 ORDER-2 CAPTURE PATH PROVEN / FRESH B6B SIX-SOURCE CANDIDATE REQUIRES SEPARATE AUTHORIZATION`。下一包必须使用 fresh run/authorization/stage/private roots 按冻结 registry 顺序执行六个 primary source；只有六行机器权威与 bundle 全部闭合、aggregate machine gate 为正，才允许按预承诺顺序进行盲评与双 session sentinel。负机器门禁止盲评；不得使用 reserve、历史行或重试拼接。B7/Stage C 继续 blocked。
- 收口证据与下一 ClaudeCode 包：`evidence/v3_media_companion/v3-completion/gc-b6g-order2-capture-closure-2026-10-26/`。
- fresh GC-B6B 六源候选 `gc-b6b-20261025T175243Z` 已执行且授权已消费。机器结果为 `2 complete / 3 limited / 1 blocked`：order 1/4 为 `V3510B_EVIDENCE_CONFLICT_UNRESOLVED`，order 3 为 `V3510B_BRIEF_COVERAGE_INSUFFICIENT`，order 2 在 synthesis 前 blocked，order 5/6 complete。机器门为 negative，盲评、projection、分数和 sentinel 均未执行；这一停止行为正确，历史负结果保持只读。
- Codex checkpoint 发现该包不能作为可复现的正候选基础：16 文件锁未覆盖实际 Runtime/Extension/build/config/contract 执行闭包且同期间存在并发修改；private rubric/prompt 相比上一 precommit 已换摘要但无仓库内规范字节；Stage A 常量为 authority 5 分钟/media 20 分钟而错误文本与公开摘要写 7 分钟，机器码退化为 `Error`；公开证据为手写投影且已发生事实抄写错误。另需为 negative run 私有产物建立明确 owner/deadline/delete receipt，且永禁作为未来候选或盲评输入。
- 当前状态：`GC-B6B MACHINE NEGATIVE ACCEPTED / CLOSEOUT CANDIDATE INVALID / GC-B6H OFFLINE CORRECTION AUTHORIZED`。GC-B6H 必须完成完整执行闭包快照与前/逐源/后置摘要校验、仓库内规范 rubric/prompt 与严格 precommit builder、从原始收据生成的确定性公开证据、Stage A 稳定错误码与精确 identity 绑定、brief/conflict 隐私安全结构诊断、以及私有产物留存生命周期。不得把 limited 强制改成 complete，不得放宽 V2.1/质量阈值/八次上限/六源 registry 或分母。
- GC-B6H 是零外部动作包：禁止 Chrome、Cookie、Provider、下载、真实 BVID、盲评、sentinel 和授权消费。离线候选必须停回 Codex checkpoint；任何后续可见候选需要新的 Codex GO 和用户显式授权。B7/Stage C 继续 blocked。
- Codex 决定、架构计划与 ClaudeCode 提示词：`evidence/v3_media_companion/v3-completion/gc-b6b-codex-checkpoint-no-go-2026-10-26/`。
- GC-B6H 离线候选的报告测试与 7/7 manifest 完整，但 Codex 独立变异复现得到 `Fatal 1 / Major 4 / Minor 1`，结论为 NO-GO。Fatal 假绿为：公开证据构建器接受六行全 limited、调用方声明 machine-positive/已盲评、无 bundle、无效 ledger/scan、任意 lock/precommit，仍返回 `ok:true`；删除所有受检 payload 的 run id 后仍通过。
- H1 未形成执行架构：snapshot 物化函数只有测试调用，Runtime、Extension fixture 和 child harness 仍从工作树执行；closure manifest 缺失时 fail-open；首次校验晚于 grant/Cookie；post-source 漂移被忽略且可在 closeout 前恢复后消失。H2 canonical protocol 未接 preflight/sequencer/review，且篡改实际 first/second pass position 为 99、删除 run id 后 validator 仍通过。H4 的 `stageADiagnostic/executionClosure` 虽列入 merge allowlist，却未写入 runner receipt。H6 的 raw private root 可原样进入公开 retention payload 并通过校验。
- 当前状态：`GC-B6H OFFLINE CANDIDATE NO-GO / GC-B6H-R CORRECTIVE AUTHORIZED`。纠偏必须让唯一入口从独占 snapshot 执行并在授权/Cookie 前强制校验，锁存逐源漂移；把 canonical protocol 接到唯一评审路径；由 production aggregate/authority/artifact/bundle/ledger/scan owner 复算公开证据而非信任 caller boolean；持久化诊断；将私有 retention 与无路径公开投影分离；修正 brief partial-coverage 结构计数。
- GC-B6H-R 继续是零外部动作包，禁止 Chrome、Cookie、Provider、下载、真实 BVID、盲评、sentinel 与授权消费。rubric/prompt 提案本 checkpoint 不冻结。任何后续可见候选仍需新的 Codex GO 与用户显式授权；B7/Stage C 继续 blocked。
- GC-B6H-R 计划、独立复现与 ClaudeCode 提示词：`evidence/v3_media_companion/v3-completion/gc-b6h-codex-checkpoint-no-go-2026-10-26/`。
- GC-B6H-R ClaudeCode 候选经 Codex checkpoint 复现并关闭三条剩余假绿：正常 B6 capture 过去可在未设置开关时绕过 snapshot；公开证据 publisher 忽略 builder 的非正结果且 validator 可接受 positive machine gate 配零 review/sentinel；依赖“树摘要”过去只绑定包名与版本而未绑定实际执行树。候选权威也改为由原始机器收据与生产 bundle reader 重建，sequencer summary 只作为必须逐字一致的 mirror。
- 正常 B6 capture 现在在授权/Cookie/Chrome 前强制 sealed snapshot；Runtime venv 与 Playwright 执行树具有内容/元数据身份，工作树或执行依赖漂移均 fail closed；公开 publisher 对 builder、写前 validator、写后重读 validator 三层任一非正即拒绝。完整 Stage B 离线套件 `688/688`、GC-B6H-R 聚焦 `34/34`、B6 lifecycle `11/11`，最终 prepare-only 从仓库外 0700 根封存 `499` 文件且 `unresolved=0`；外部动作与授权消费均为 0。
- Codex 首次冻结规范盲评协议字节：rubric `60a32cd9a9334a702a6b588ae864194426c82c7130d43cd2f979748e1255f5de`（3838 bytes），prompt `6c1f53f2aab1981937aa0f97f8c95a9102ed0ff763e30212bc65ae89826e87d2`（5353 bytes）。loader 与 precommit 对固定路径、字节数和摘要做硬校验，调用方自洽替换不能通过。
- 当前状态：`GC-B6H-R CODEX CORRECTIVE PASS / FRESH GC-B6B CANDIDATE REQUIRES NEW EXPLICIT AUTHORIZATION`。下一次候选必须通过 `prepare_candidate.mjs` 从新 snapshot 启动，使用 fresh run/authorization/stage/private roots；机器门非正立即停止且禁止盲评，机器门为正才按预承诺顺序交给独立 host evaluator，执行六行盲评与 order-3 双 session sentinel。不得把独立评审实现成当前实现会话的自评分器。B7/Stage C 继续 blocked。
- Codex checkpoint、冻结摘要、验证结果与下一阶段 ClaudeCode 交接：`evidence/v3_media_companion/v3-completion/gc-b6hr-codex-checkpoint-corrective-2026-10-26/`。
- 用户明确授权的 fresh sealed GC-B6B 候选已执行一次且授权已消费。zero-action preflight 为正，但 sealed snapshot child 把默认视觉 Provider 数据库解析到 snapshot 根，而 preflight 验证的是原 tool/worktree 根；因此六个 primary source 各启动一个 owned `--mute-audio` Chrome 后均以“configured vision Provider database is missing”在 Runtime 前失败。机器门为 `0 complete / 0 limited / 0 blocked / 6 failed`，盲评、projection、分数和 sentinel 均未执行。
- 动作账本：sourceAttempt 6 / chromeLaunch 6 / visibleWindow 6；runtimeStart、mediaTask、runtimeSynthesize、providerCall、download、import、cookieInjection、audio、tabCapture、focusEvent、sourceCompletion 均为 0。六行上传计数全 0，cleanup 的 profile/scratch 均删除，owned process leak 0，17861 无监听。确定性公开 no-go 包由 sealed publisher 生成、写后重读并签名，secret/绝对路径/raw-media 均为 0。
- Codex 诊断确认这是候选环境接线缺陷：`candidateEnvironment()` 只传 snapshot/tool/repo 根，没有把产品默认的 managed-tools、ASR 与 vision Provider database 解析结果传给 snapshot child；production preflight 又没有以 candidate child environment 复验同一组输入。另有两项 closeout 缺陷：外部输入失败被收据退化为 `Error`；`collectArtifactDigests()` 返回重复摘要，导致合法 retention ledger 首次被 publisher 拒绝（本次私有台账以集合去重后成功发布，候选事实未改）。
- 当前状态：`GC-B6B SEALED MACHINE NEGATIVE / AUTHORIZATION CONSUMED / GC-B6J OFFLINE CORRECTIVE AUTHORIZED`。GC-B6J 仅修复 snapshot dependency parity、preflight/child 同源解析、稳定失败码和 retention digest 去重；必须用进程级负例证明缺数据库时在授权/Cookie/Chrome 前阻塞，并证明 snapshot child 使用的依赖摘要等于 preflight 收据。禁止 Chrome、Cookie、Provider、下载、真实 BVID、盲评、sentinel、授权消费或重跑六源。B7/Stage C 继续 blocked。
- 运行公开证据与 GC-B6J 计划/ClaudeCode 提示词：`evidence/v3_media_companion/v3-completion/gc-b6b-sealed-machine-negative-2026-10-26/` 与 `evidence/v3_media_companion/v3-completion/gc-b6b-sealed-machine-negative-codex-2026-10-26/`。
- GC-B6J ClaudeCode 候选在 Codex checkpoint 中发现四条会使下一候选失真的 harness 缺陷：依赖环境按枚举成员而不是实际环境变量名读取，正例又预先注入变量而掩盖缺陷；官方准备入口未对 prepared object 做同源 preflight；sequencer 重写候选锁时丢失依赖身份；runner 的 identity 探针引用未定义目录并把稳定拒绝降级成通用失败。Codex 已修复并将对应进程级与精确形状负例加入门禁。
- 依赖私有对象现在要求精确键集、绝对路径与 child environment 四方一致；prepare、preflight、sequencer、runner 均使用同一 owner，sequencer/runner 比较 Provider metadata 摘要而不只比较文件存在性；无 prepared object 的 preflight 也会对缺失依赖 fail closed。官方 prepare-only 从仓库外 0700 根封存 `501` 文件并通过 prepared-object parity；聚焦 B6J `20/20`、受影响组合 `148/148`、最终完整离线 Stage B `708/708`。
- 当前状态：`GC-B6J CODEX CORRECTIVE PASS / FRESH SEALED GC-B6B CANDIDATE REQUIRES NEW EXPLICIT AUTHORIZATION`。下一候选必须使用全新 run/authorization/stage/private/evidence roots，只能经 `prepare_candidate.mjs` 启动；禁止重试、reserve、替换或历史产物拼接。机器门非正立即停止并禁止盲评；机器门为正才可进入冻结的独立 host review 与 order-3 双 session sentinel。B7/Stage C 继续 blocked。
- GC-B6J 提交包与 Codex checkpoint：`evidence/v3_media_companion/v3-completion/gc-b6j-offline-corrective-2026-10-26/`、`evidence/v3_media_companion/v3-completion/gc-b6j-codex-checkpoint-corrective-2026-10-26/`。

## 29. V3-CLOSEOUT-R 阶段复盘出门门槛

V3 技术实现与验收通过后，必须完成一次独立的阶段性项目复盘。该复盘不改变 V3 产品合同，也不得用于补签任何缺失的产品证据；它是“V3 已完成并正式关闭/归档”声明的必要条件。V3-7 技术 PASS 与 V3 行政 closeout 必须分开记录：技术门槛未通过时不得提前复盘代替验收，复盘未通过时不得宣布 V3 已正式关闭。

执行顺序固定为：

1. V3 所有技术门槛、人工验收和独立出门审查完成，候选证据封存。
2. 新建只读输入清单，覆盖计划、门禁决定、失败/纠偏批次、真实运行账本、授权消费记录与最终验收，不修改历史证据。
3. 复算计划与实际偏差、返工轮次、外部运行次数、缺陷发现阶段、假绿来源、证据成本和关键等待时间。
4. 对最高成本的返工执行根因分析，至少区分：合同/权威不清、合成夹具与真实路径差异、oracle 缺失、实现所有权错位、外部依赖漂移、并发脏工作树、门禁粒度不当和职责交接失败。
5. 将已接受的改进写回 `project-stage-workflow.md`、相关模板和 onboarding；未接受项进入带 owner、优先级和目标阶段的后续 backlog。
6. 由 Codex 做一次独立 closeout 复核；发现产品 Fatal/Major 时重开所属技术门槛，不得仅登记为流程建议。

复盘证据包至少包含：

```text
00-retrospective-summary.md
01-plan-vs-actual.json
02-rework-root-causes.md
03-gate-and-cost-metrics.json
04-accepted-process-changes.md
05-follow-up-backlog.md
06-independent-closeout-review.md
PAYLOAD_MANIFEST.sha256
```

固定验收要求：

- 每个结论可追溯到已有证据或动作账本，不凭会话记忆补事实，不改写历史状态。
- 至少列出前五项返工根因，并为每项给出预防门槛、检测门槛、责任角色和可验证的完成条件。
- 对“开发门限、计划粒度、Codex/ClaudeCode/人工分工、真实运行预算、证据保留和脏工作树并发策略”逐项形成明确决定。
- 统计值必须区分离线测试、真实 canary、可见批次、Provider 调用和人工验收；未知值保持 unknown，不以 0 替代。
- 已接受流程变更必须落到权威文档并由测试或结构化校验覆盖；只写复盘报告但不更新流程不算通过。
- 复盘本身不得发起新的产品实现、真实 Provider/Chrome 运行或合同 refreeze；这些动作必须回到对应技术门槛重新授权。

V3 最终可声明状态固定为：`TECHNICAL PASS / RETROSPECTIVE PENDING`、`CLOSEOUT REOPENED` 或 `V3 CLOSED`。只有技术验收通过、复盘包完整、流程改进已落盘且独立 closeout 复核无 Fatal/Major 时，才允许 `V3 CLOSED`。
