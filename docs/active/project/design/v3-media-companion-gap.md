# V3 Media Companion Gap Companion

日期：2026-09-15。状态：B站优先文档候选；H01-RDS Runtime 实现候选已完成，V3 媒体功能未开始。

## 1. 用户目标

打开 B站视频详情页 -> Navia 识别视频、字幕和播放器状态 -> 有字幕则直接组织 -> 无字幕则等待用户启动本地转写 -> 显示图文大纲、章节时间轴和 Media Mindmap -> 点击证据跳回视频时间点 -> 用户主动保存到真实 data_service。

首个锚点是 BV1ZpYd66ELP。公开字幕为空，因此它必须验证本地 ASR fallback，不能以 degraded 样本替换。

## 2. 当前到目标差异

| 状态 | 代码实体 | 当前事实 | V3 目标 |
|---|---|---|---|
| 已实现/需修改 | apps/chrome-extension/src/pageContext.ts | 能识别 B站详情页并读取 DOM metadata；标记 media_dom_limited | 保留通用读取，新增独立 B站媒体合同 |
| 未开发 | BilibiliMediaCollector | 无 bvid/cid/分P/播放器/字幕稳定采集 | 当前页内采集和变化诊断 |
| 未开发 | MediaPageContext | 无媒体强类型上下文 | 冻结 platform/video/availability 字段 |
| 未开发 | MediaCaptureController | 无用户授权标签页音频采集 | trusted click、取消、关页、清理 |
| 未开发 | LocalAsrAdapter | Runtime ASR 当前 unavailable | 本地分段转写、confidence、hash |
| 未开发 | VideoOutline | 无统一图文大纲对象 | 图文、时间轴、导图的唯一权威 |
| 未开发 | MediaMindmapProjection | 网页 Mindmap 不能表达媒体时间轴 | 只从 outline 派生并保留 evidence IDs |
| 未开发 | MediaCompanionRenderer | Side Panel 只有网页 Chat/Knowledge | 视频状态、概览、时间轴、导图、证据 |
| 未开发 | MediaJumpbackController | 只有 DOM/text jumpback | 用户触发 player seek 和三态结果 |
| 已实现候选/待 Chrome 验收 | Runtime knowledge adapter | 显式 real mode 已完成真实 source import/build/trace、重复保存和重启恢复 | H01 三入口真实 Chrome 仍需证明同一 workspaceId/sourceId |
| V3.x | frame/VLM/OCR | 无 | 另起授权、成本、隐私和验收门禁 |

## 3. BiliNote 研究转化

采纳：字幕优先、ASR fallback、后台任务、时间戳图文结果和可继续问答。

拒绝直接复制：后台下载媒体流、用 prompt marker/正则作为证据协议、图文 Markdown 与 Markmap 分别生成。Navia 使用 VideoOutline + MediaEvidenceRef，并把本地 ASR 限定在用户授权的当前标签页音频。

详见 v3-bilinote-bilibili-route-study.md。

## 4. 依赖与顺序

H01-RDS -> V3-B0 -> B1 -> B2 -> B3 -> B4 -> B5 -> B6 -> V3-Y1。

- H01-RDS 只关闭真实持久化入口，不证明完整 RAG。
- B2 字幕和 B3 ASR 不能产生两个事实权威；统一输出 MediaTranscript。
- B4 之前不能实现 renderer，以免 UI 自行拼接大纲。
- YouTube 在 B站出门后映射，不新建第二套合同。

## 5. 验收门槛

- 12 个真实 B站详情页，固定 6 字幕 + 3 ASR + 1 多P + 1 blocked + 1 degraded。
- 指定 BV 完整 ASR、至少 8 个证据节点、至少 5 次 seek，误差不超过 2 秒。
- 360/420/768/1280 四视口；Axe serious/critical=0；键盘路径全过。
- 自动媒体下载、cookie 导出、未授权 capture、取消后残留任一出现即不能出门。
- 图文/时间轴/Mindmap 的 outlineId、segmentId、evidenceId 集合一致。
- data_service connected，保存后 Runtime 重启可读，重复入口 ingest=0。

## 6. 当前门禁

V3 documentation revision: INTERNAL STATIC AUDIT PASS；EXTERNAL REVIEW RECOMMENDED。
H01-RDS: RUNTIME E2E CANDIDATE PASS；RDS-03 与三入口范围的 RDS-04 PENDING HUMAN CHROME。
V3-B0..B6: NOT IMPLEMENTED。
V3-Y1: BLOCKED BY V3-B6。

不得把当前 B站 DOM metadata 支持声明成视频理解，也不得把 BiliNote 克隆或 bilibili_learning 实验脚本计入 Navia 产品实现。
