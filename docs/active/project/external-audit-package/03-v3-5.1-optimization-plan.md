# V3-5.1 Media Workspace 理解质量与交互优化计划

日期：2026-10-10。状态：`PLAN CANDIDATE / IMPLEMENTATION NOT AUTHORIZED`。

## 1. 触发原因与阶段边界

用户本轮报告的 V3-5 人工流程已经可以完成采集、转写、视觉证据、投影、问答、跳回和导出，但复核确认产品质量仍明显低于 BiliNote：时间线只是纵向文本列表，图文大纲没有稳定章节与逻辑层级，导图只是根节点加一层子节点，问答仅做关键词命中和证据原文拼接。该反馈属于新的体验缺口，不撤销 V3-2、V3-3、V3-4 或 V3-5 已取得的限定实现结果，也不替代仓内仍需按既有合同保存的正式 H01-H10 submission。

本工作包编号固定为 `V3-5.1`，插入既有 `V3-5 -> V3-6` 之间。V3-6 的 12 页生产矩阵必须使用 V3-5.1 的最终合同和 UI；V3-5.1 未通过时，V3-6/V3-7 保持阻塞。

本轮只冻结优化计划，不修改产品代码，不新增 Provider 调用，不上传 transcript、音频、视频或截图。

## 2. 当前实现复核

### 2.1 可工作的基线

- `MediaTaskStore`、`VideoOutline`、timeline、mindmap 和 evidence catalog 具备同 task/revision 身份闭合。
- 大纲、时间线、导图、问答引用均可调用 `MediaJumpbackController`，真实 seek 合同继续复用。
- 视觉证据已经区分 frame、OCR、vision caption，任务期秘密和临时媒体清理边界保持不变。
- 2026-10-10 定向回归：`MediaWorkspaceShell`、router、Ask race 共 20/20 tests PASS。

### 2.2 已确认的体验缺口

| 编号 | 当前事实 | 用户影响 | 根因 |
|---|---|---|---|
| `UX-G01` | timeline 由普通 `<article>` 纵向排列 | 没有时间尺度、章节区间、滚轮横移、鼠标拖动、播放游标或截图预览 | renderer 没有时间轴引擎，`TimelineSegment` 也缺少展示元数据 |
| `UX-G02` | outline 按固定时间窗分组，标题取首句，摘要拼接证据文本 | 章节边界和标题不代表语义主题，长段文字难扫读 | `DeterministicExtractiveOutlineGenerator` 只按时间窗切片 |
| `UX-G03` | mindmap 只有 root + section 一层 | 看不到章节内关键点、因果/并列/步骤关系，无法折叠或平移缩放 | projection 没有二至四层层级，renderer 只是 `<ul>` |
| `UX-G04` | Ask 用关键词打分，最多拼接两段原文 | 对跨章节问题、归纳问题和视觉问题回答弱，答案不像自然问答 | 没有 query plan、跨证据检索或 grounded synthesis |
| `UX-G05` | evidence 页面只显示类型、时间和 hash | 用户不能在时间线直接看代表帧，也不能快速确认文字与画面是否一致 | 缺少受控 thumbnail endpoint 与 frame card |
| `UX-G06` | 当前播放位置不反馈到 Workspace | 播放器、时间线、大纲、导图之间只有单向点击，没有双向同步 | page bridge 只在 seek 时回读，没有 task-scoped playback cursor |

现有 V3-5 人工截图也印证该问题：大纲只显示一个 0:00 长文本块，视觉描述、OCR 和转写直接混在同一摘要内。该页面满足“有输出、可追溯”，但不满足“可快速理解、可导航、结构清楚”。

## 3. BiliNote 与开源方案检视

### 3.1 BiliNote 可借鉴部分

BiliNote 的体验优势来自完整链路：LLM 生成带章节和时间 marker 的 Markdown，按 marker 截取图片并插入正文，原片时间链接可直接跳转，再从 Markdown 派生可平移缩放的 Markmap。Navia 继续拒绝把脆弱 marker 当权威合同，但采纳以下体验：章节标题层级、正文内代表帧、时间入口贴近内容、导图与大纲同源。

### 3.2 组件评估与选择

| 候选 | 结论 | 用途与理由 | 约束 |
|---|---|---|---|
| [`vis-timeline`](https://github.com/visjs/vis-timeline) | 推荐进入隔离 spike | 原生支持时间轴、拖动平移、滚轮缩放/横移、自适应时间刻度和 HTML item template；MIT/Apache-2.0 双许可 | 只做只读导航；禁用 item 编辑；必须增加 React lifecycle wrapper、键盘替代路径、CSP/包体/Axe 检查 |
| [`markmap`](https://github.com/markmap/markmap) | 推荐进入隔离 spike | BiliNote 已验证 Markdown/树到交互 SVG 的路径，支持 pan、zoom、折叠和 fit；MIT | 不让 Markdown 成为权威源；从 `MediaMindmapProjectionV2` 生成树并保留 node/evidence/seek 映射；禁止 CDN |
| [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction) | 条件采用 | marker/章节很多时做横向或纵向虚拟化，保持 Navia 自有样式 | 仅在真实 2 小时视频 DOM/内存压测证明需要时引入，不与 vis-timeline 重复控制滚动 |
| [Video.js chapters/text tracks](https://videojs.org/docs/framework/html/reference/feature-text-tracks) | 只参考交互语义 | chapter range、active chapter、thumbnail cue 是成熟播放器语义 | Navia 不拥有 B站播放器，禁止替换或注入 Video.js；仍通过 `MediaPortalAdapter` seek/read |
| React Flow | 暂不采用 | 适合节点编辑器和任意图 | 当前 Media Mindmap 是只读层级树，引入编辑状态、edge layout 和较高包体会扩大范围 |

最终技术路线为：`vis-timeline` 负责只读时间导航，`markmap` 负责只读层级导图，Navia 强类型投影仍是唯一事实源。两者必须先完成隔离 spike；任一组件不能满足 Chrome Extension CSP、键盘、Axe、低资源或包体门槛时，回退到相同 adapter 接口下的自研 DOM/SVG renderer，而不是降低验收标准。

## 4. 目标体验

1. 用户进入时间线时立即看到视频总时长、章节色带、分钟刻度、当前播放游标和带代表截图的关键节点。
2. 鼠标滚轮在时间线区域横向浏览，按住并拖动可平移；缩放、适应全片、上一/下一章节均有按钮和键盘路径。
3. 点击章节、时间节点、截图或问答引用后，B站播放器跳到对应时间；播放器继续播放时，时间线游标和当前章节同步更新。
4. 图文大纲按“视频摘要 -> 章节 -> 关键点 -> 证据”组织；章节可折叠，代表帧与对应文字并排，字幕、OCR、VLM 事实有清楚标签。
5. 导图至少呈现 root、chapter、key point 三层；支持平移、缩放、折叠、适应画布和键盘树形替代视图；点击有时间绑定的节点可跳回视频。
6. Ask 先解析问题范围，再从 transcript/OCR/vision/章节中选择证据并生成简洁回答；每个结论都能回到时间点和证据。证据不足继续拒答。

## 5. 目标架构与合同增量

```text
真实 transcript + OCR + vision caption + selected frame
-> ChapterBoundaryDetector（本地候选边界，确定性回退）
-> GroundedMediaSynthesisProvider（可选、需单独授权的文本合成）
-> VideoOutlineV3
   -> ChapterNode[]（2..4 层、顺序、父子、时间范围、论点、关键点）
   -> EvidenceFrameRef（thumbnail、时间、来源、hash）
   -> TimelineProjectionV2（chapter bands + moments + playback cursor binding）
   -> MediaMindmapProjectionV2（树、折叠、seek/evidence binding）
   -> MediaAskIndexV2（章节/时间/证据类型索引）
-> Renderer adapters
   -> VisTimelineRendererAdapter
   -> MarkmapRendererAdapter
   -> SemanticOutlineRenderer
-> MediaPortalAdapter.readPlayback / seek
```

必须新增版本化合同，不能原地改变已封存的 `v3-media-outline-taskstore/v2`：

- `ChapterNode`：`chapterId/parentChapterId/depth/order/startMs/endMs/title/thesis/keyPoints/evidenceIds/representativeFrameEvidenceId`。
- `TimelineMoment`：`momentId/chapterId/timestampMs/kind/title/evidenceIds/frameEvidenceId`；kind 封闭为 chapter/key_point/frame/quote。
- `EvidenceFrameRef`：只引用 Runtime 私有证据和受控缩略图 API，不把绝对路径或 base64 写入公共 task JSON。
- `MediaMindmapNodeV2`：`nodeId/parentNodeId/depth/label/chapterId/timestampMs/evidenceIds`，树必须无环且所有引用闭合。
- `MediaAskResultV2`：结构化 `answerBlocks[]`、每块 citation、`retrievalPlanHash/synthesisProvider/executionMode`；无证据不得生成回答。
- `PlaybackCursorObservation`：task/source identity、observedMs、paused、observedAt；只存短期 UI 状态，不写历史 EventStore。

问答与章节质量采用混合路线：本地算法始终能生成可追溯的确定性回退；若用户另行授权发送“任务期 transcript/OCR/VLM 派生文本”给已验证文本 Provider，则允许 grounded synthesis。该授权与现有“最多 8 张选定帧云端视觉”不是同一 scope，实施前必须单独冻结隐私、成本、撤销和日志边界。

## 6. 子阶段开发顺序

| 子阶段 | 实现内容 | 阶段出门条件 |
|---|---|---|
| `V3-5.1-0` | 冻结 v3 Schema、positive/negative fixtures、BiliNote 对照基线、3 个真实视频 UX/质量 benchmark、组件许可证与 bundle/CSP spike | 文档/合同审计 Fatal=0、Major=0；用户显式授权实现 |
| `V3-5.1-1` | `ChapterBoundaryDetector`、`VideoOutlineV3`、层级章节和代表帧选择；grounded synthesis 的 adapter 与确定性 fallback | 章节时间闭合、无重叠/越界/孤儿证据；Provider 未授权时 0 网络调用 |
| `V3-5.1-2` | `TimelineProjectionV2`、私有缩略图 API、`VisTimelineRendererAdapter` | 滚轮、拖动、缩放、fit、章节带、节点、截图、游标全部可操作；真实 seek 误差 <=2 秒 |
| `V3-5.1-3` | `SemanticOutlineRenderer`：章节目录、折叠、关键点、图文证据和 sticky current chapter | 章节/关键点/代表帧/证据标签同源；视觉事实不冒充 transcript |
| `V3-5.1-4` | `MediaMindmapProjectionV2`、`MarkmapRendererAdapter`、无障碍树形替代视图 | 3 层以上样本可 pan/zoom/collapse/fit；节点 seek 和 evidence 闭合 |
| `V3-5.1-5` | `MediaAskIndexV2`、query planning、跨章节 retrieval、grounded answer synthesis | 固定问集的 citation precision、完整性和拒答门槛通过；答案不得只是原文拼接 |
| `V3-5.1-6` | 四视口整合、播放双向同步、低资源性能、Axe/Keyboard/scroll/drag E2E | 360/420/768/1280 无遮挡；低资源预算、Axe 0 serious/critical、键盘主流程通过 |
| `V3-5.1-7` | 3 个真实 B站视频的新鲜单 run、PRD review、false-green audit、一次最小人类体验复核、独立出门审计 | 自动分母全绿，人类无阻断项，Fatal=0/Major=0；才放行 V3-6 |

## 7. 固定验收分母

### 7.1 真实样本

- 3 个内容结构不同的真实 B站视频：现有锚点、一个教程/演示类、一个叙事/评论类。
- 每个视频必须使用当次真实 transcript 和真实视觉证据重新生成，不复用 BiliNote 输出或静态 fixture 作为 production evidence。
- 至少一个视频时长 >=30 分钟，用于验证长时间线、虚拟化判定和低资源交互。

### 7.2 自动验收

1. 每个 ready/degraded 视频有 3..12 个语义章节；章节覆盖有效媒体范围，顺序单调，不交叠，不强行用固定分钟窗凑数。
2. 每章至少 1 个关键点和 1 个 evidence binding；有 frame evidence 的章节展示真实缩略图，无 frame 时显示明确文本证据态，不用占位图伪装。
3. 时间线具备时间刻度、章节带、至少 8 个 moment、当前播放游标、wheel pan、pointer drag、fit、zoom、Home/End/Arrow/Page 键盘路径。
4. 在章节、moment、frame、mindmap node、Ask citation 五种入口各执行至少 2 次真实 seek；总计 >=10 次，误差均 <=2 秒。
5. 播放器时间变化后 1 秒内更新 cursor/current chapter；页面身份变化时立即停止同步，不跨视频控制。
6. 导图至少 root/chapter/key-point 三层，节点无环、无孤儿、无重复 ID；pan/zoom/collapse/fit 和等价键盘树均可用。
7. 固定 12 问：6 个事实、2 个视觉、2 个跨章节、2 个证据不足。可回答问题的每个 answer block 至少 1 个有效 citation；不足问题 2/2 拒答。
8. 人工复核 12 问时，critical meaning error=0；引用支持结论 >=90%；章节标题/边界/逻辑关系不得出现阻断级错配。
9. 8 GiB RAM/no GPU 基线：投影数据到首个可交互视图 <=2 秒；拖动/滚轮期间没有持续 >=200ms 主线程阻塞；长视频 DOM 节点预算和内存增量在 `V3-5.1-0` spike 后冻结。
10. Chrome Extension 生产包不使用 CDN/eval/远程脚本；新增依赖许可证、版本、integrity 和 bundle delta 可审计。

### 7.3 最小人类体验复核

自动验收通过后只请求一次体验复核：在锚点视频完成“拖动时间线 -> 点截图跳转 -> 展开章节 -> 点击导图节点 -> 提 1 个跨章节问题”。人类只判断结构是否清楚、操作是否顺畅、答案是否有用，不承担听写、造数据或补机器证据。

## 8. False-green 与停止条件

以下任一项为 Major/Fatal 并停止进入下一子阶段：

- 把 BiliNote 生成结果、手工 Markdown、mock frame 或静态截图计入真实质量分母。
- timeline 看起来可拖动但没有实际时间尺度或不能真实 seek；截图点击只打开图片而不绑定时间。
- 仍用固定时间窗标题冒充语义章节，或用 LLM 输出覆盖/删除原始证据绑定。
- Markmap/vis-timeline 成为事实源，导致 outline、timeline、mindmap 三份独立内容漂移。
- Ask 无引用、引用不支持结论、把字幕推断当画面事实，或在无新授权时上传 transcript/OCR 文本。
- 为追求动画引入不可接受的低资源回退、键盘阻断、滚轮劫持、CSP 放宽或远程脚本。
- 只在 1280 宽屏可用，360/420 Side Panel 或 768 Workspace 无法完成核心路径。

## 9. 当前决定

- `V3-5`：用户报告的人工流程通过已记录，但本轮不伪造或补写正式 H01-H10 submission，也不扩大为体验质量通过。
- `V3-5.1 plan candidate`：已建立，implementation NO-GO，等待文档/合同细化、内部审计、外部审计和用户授权。
- `V3-6/V3-7`：在 V3-5.1 出门前保持 BLOCKED，未来生产矩阵必须使用新投影和新 UI。
- `V4 knowledge/query/graph/forget`：边界不变，不得借体验优化提前引入跨视频 RAG 或知识维护。
