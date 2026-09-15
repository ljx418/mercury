# V3 优先与 V4 知识能力迁移开发大纲

状态：`APPROVED DIRECTION / OUTLINE ONLY`  
日期：2026-09-15  
范围：阶段优先级、开发顺序与边界；不是细化开发计划、实施授权或完成声明。

## 1. 阶段决策

用户已确认暂停 V2 剩余开发，优先推进 V3 视频可视化与视频理解。阶段口径冻结为：

| 阶段 | 当前状态 | 后续定位 |
|---|---|---|
| V2 Memory / External Brain / PX-6 / RKM | `PAUSED / INCOMPLETE` | 保留现有代码、合同、run、审计和限定 PASS；不继续 H01..H07、G7/final、Query、Graph、Durable Forget 与 RKM 实施，不宣称 V2/RAG ready |
| V3 Media Companion | `ACTIVE PRIORITY / DOCUMENT MIGRATION PENDING` | 先完成 B站视频页的采集、转写、结构化理解、图文大纲、时间轴、Media Mindmap 与时间反跳 |
| V4 Personal Knowledge and Agent Workspace | `PLANNED SUCCESSOR` | 承接真实记忆、查询、Knowledge Graph、Durable Forget、RKM，以及后续个人秘书/研究任务能力；进入实现前重新冻结范围与合同 |

本决策只改变后续优先级，不追溯修改 V2 已封存证据的事实、哈希、结论或阶段名称。

## 2. 产品主线

V3 首个目标体验固定为 B站视频页：

```text
用户打开受支持的 B站视频
-> Navia 识别视频、分P、播放器与可用字幕
-> 用户主动开始分析；无字幕时可主动授权本地音频转写
-> 同一份带时间戳证据生成图文大纲、章节时间轴和 Media Mindmap
-> 用户点击章节、节点或证据回到视频对应时间
-> 用户可取消任务、查看失败原因并导出本地结果
```

V3 不以完整 V2 知识服务作为前置。V3 结果先由独立的媒体任务与本地导出边界承载；“保存到个人知识库”、跨资料 Query/Graph/Forget 和自动维护统一留给 V4 接入。

## 3. 架构方向

V3 沿用 Navia 的 Chrome Extension + Local Runtime 主栈，新增独立媒体上下文，不让媒体页面、BiliNote 代码或前端直接写入 V2/V4 知识事实：

```text
B站页面与播放器
-> Extension Media Bridge（页面身份、字幕、播放器控制）
-> Runtime Media API（任务、取消、进度与产物）
-> Transcript Pipeline（公开字幕优先；用户授权后本地 ASR 回退）
-> Media Understanding（章节、摘要、关键证据与可视化模型）
-> Side Panel / Media Workspace（大纲、时间轴、Mindmap、反跳、导出）
-> V3 本地 MediaTaskStore

V4 Knowledge Adapter（未来）
<- 仅接收用户主动选择的 V3 结构化产物
```

BiliNote 采用“固定上游 commit + 许可证审查 + 选择性迁移 + Navia 防腐层”的路线。可复用其字幕/ASR/LLM 编排与 Markdown 生成思路，不整仓嵌入其应用壳、账号体系、数据库、下载策略或部署拓扑，也不后台复用用户 cookie 下载受限媒体。

## 4. 推荐开发顺序

### V3-0 权威文档与合同迁移

- 将 active PRD、目标架构、里程碑、stage gate、验收计划和不超过 8 页的中文 Draw.io 同步为“V2 暂停、V3 优先、V4 承接知识能力”。
- 冻结 B站首发范围、媒体任务状态、证据模型、隐私/版权边界、BiliNote 上游 commit 与允许迁移清单。
- 移除 V3 对 PX-6/H01 完成态的阻塞依赖，同时保留“不得用 mock 证明真实持久知识”的边界。

### V3-1 B站页面与字幕基线

- 建立 B站 URL、BV/CID、分P、标题、UP 主、时长、播放器和公开字幕的稳定采集路径。
- 以指定 B站视频作为首个真实样本，明确登录态、无字幕、分P变化和页面结构变化的降级行为。

### V3-2 用户授权的本地音频转写

- 通过受信任用户操作启动标签页音频采集，仅发送本机 Runtime。
- 建立本地 ASR、进度、取消、临时文件清理、重试与不可用状态；禁止自动下载媒体流或绕过平台限制。

### V3-3 媒体任务与生成管线

- 建立可恢复的 MediaTaskStore 和字幕/ASR 统一输入。
- 选择性迁移 BiliNote 的任务编排与生成思路，通过 Navia Adapter 输出同一份结构化媒体事实。
- 同一任务派生图文大纲、章节时间轴和 Media Mindmap，避免三套结果各自生成而互相矛盾。

### V3-4 视频可视化与交互

- 在 Side Panel 提供快速启动、进度、取消和摘要入口。
- 在宽屏 Media Workspace 提供图文大纲、时间轴、Mindmap、证据详情和任务历史。
- 章节、节点和证据均支持时间反跳；定位失败时显示可解释的 fallback/blocked 状态。

### V3-5 画面理解增量

- 在用户明确授权和采样预算内增加关键帧、OCR 与可选 VLM 分析。
- 将画面证据与字幕证据分开标识；没有画面证据时不得把字幕推断表述为已理解画面。

### V3-6 真实数据自动验收

- 使用真实 B站页面、真实 Chrome、真实字幕或本地 ASR、真实生成服务和真实截图执行自动验收。
- 覆盖有字幕、无字幕、分P、取消、失败恢复、四视口、可访问性、隐私清理和时间反跳。
- 证据必须绑定运行输入、模型/引擎配置、产物 hash 与页面身份；禁止跨 run 拼接和 mock 冒充。

### V3-7 人类验收与阶段出门

- 人类按可见 Chrome 流程核查内容质量、章节可用性、反跳准确性、视觉层级、取消与失败提示。
- 自动化与人类验收均通过后，只声明限定的 B站 Media Companion 能力，不扩大为全平台视频理解或 V4 知识能力完成。

### V4-0 知识能力重新冻结

- V3 出门后，基于现有 V2/PX/RKM 资产重新盘点可继承实现和失效假设。
- 将 Query、Knowledge Graph、Durable Forget、真实持久化、权限治理和 RKM 迁移为 V4 权威文档与合同。
- V4 只有在新 PRD、架构、迁移策略和真实数据验收门禁独立通过后才进入代码实施。

### V4-1+ 知识与 Agent 能力

- 顺序恢复真实来源持久化、可引用 Query、服务侧 Graph、Durable Forget、可逆维护和对话记忆。
- 再评估深度研究、任务图谱、PPT 和个人秘书能力；这些目标不得反向扩大 V3 出门声明。

## 5. 高层出门条件

V3 进入实现前：V3-0 的 PRD、架构、合同、Draw.io、开发/验收门禁和 BiliNote 迁移边界必须完成内部审计及独立文档审查，Fatal=0、Major=0，并取得用户实施授权。

V3 完成时：指定真实 B站样本及扩展样本能够从字幕或用户授权的本地 ASR 生成一致的大纲、时间轴和 Mindmap，支持可验证时间反跳、取消、清理、错误恢复、可访问性与人工质量签署。

V4 进入实现前：V2 遗留实现只能作为候选资产，不能沿用旧限定 PASS 代替 V4 的真实数据、迁移、权限、删除和恢复验收。

## 6. 本大纲不包含

- 不定义具体文件改动、API 字段、Schema 版本、测试命令、样本数量和性能阈值。
- 不授权 V3 或 V4 代码开发，不修改现有产品行为。
- 不修改或删除已封存 V2 证据，不补签 PX-6 Human Review，不宣称 V2、V3 或 V4 已完成。
- 细化开发计划、验收矩阵、风险 ADR 和 Draw.io 更新统一属于 V3-0 后续文档工作。
