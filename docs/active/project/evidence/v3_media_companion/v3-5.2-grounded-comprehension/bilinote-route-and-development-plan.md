# V3-5.2 全片结构化理解与 BiliNote 路线对照

日期：2026-10-11。状态：`IMPLEMENTED CANDIDATE / MACHINE 36/36 / HUMAN QUALITY REVIEW PENDING`。

## 1. 触发事实

V3-5.1 三视频机器候选虽满足引用闭合、交互和 fail-closed 合同，但用户人工复核确认问答大面积错误、无关且缺乏概括性，大纲、截图、时间线和导图也不能表达完整视频结构。因此该候选的人类质量结论为 `FAIL / REPLAN`，不得进入 V3-6。

根因已定位到语义权威层：`MediaComprehensionService` 只用局部相似度与转折词切章，`MediaAskService` 只从最多两段命中证据抽一句。两者可以证明“答案来自证据”，不能证明“理解了完整视频”。

## 2. BiliNote 事实路线

本地参考仓固定为 `bilinote@be3889395afb5346aa4339ae933d3ba2e08f25a8`，MIT。其成功体验来自以下组合：

1. 平台字幕优先，无字幕才下载音频并使用 Whisper 等 ASR。
2. 将完整带时间戳 transcript 与正向格式要求交给 LLM；长输入按请求大小分块，再用 merge prompt 合并去重。
3. 要求 LLM 在 Markdown 中生成章节、`Content-[mm:ss]` 和 `Screenshot-[mm:ss]` marker。
4. 后处理把 Content marker 替换为原片跳转，把 Screenshot marker 对应时刻抽帧后插入正文。
5. 导图从结构化 Markdown 派生，因此章节、正文、时间跳转与导图的可读主题一致。
6. 提供 minimal/detailed/academic/tutorial 等提示词风格；请求侧有三次重试、长文分块、部分结果检查点和分层归并。

BiliNote 的截图可以参与多模态 prompt，也可按模型选出的时刻插入正文，但其代码没有独立的“截图证明 ASR 正确”判定器。视觉结果仍可能幻觉；不能把 marker 或模型判断直接当作证据真值。

## 3. Navia 采用与拒绝

采用：全文上下文、分块提炼、全局归并、正向/负向/导向提示词、章节时间绑定、模型选择代表证据、同一结构派生大纲/时间线/导图/问答索引。

拒绝：Markdown marker 作为权威合同、未校验模型输出、截图静默覆盖字幕、上传原始视频/音频/Cookie/路径、失败后覆盖本地结果。

Navia V3-5.2 路线：

```text
真实字幕/SenseVoice ASR + OCR + 已授权画面描述
-> 派生文本 evidence（ID + 类型 + 时间 + 文本）
-> 18k 字符分块提炼
-> 全片结构化归并（正向 + 负向 + 导向 prompt）
-> JSON / evidence ID / 时间顺序 / 章节数 fail-closed 校验
-> Grounded VideoOutline V2
-> 同源大纲 / 时间线 / 导图 / grounded Ask 索引
-> 人类三视频质量复核
```

视觉只执行三类动作：补充字幕未表达但画面直接可见的信息、支持字幕中的可见事实、记录视觉与字幕冲突。它不能证明纯语音事实，也不能自动改写 ASR 原文。

## 4. 技术路线对比

| 路线 | 质量 | 延迟/费用 | 隐私 | 架构成本 | 结论 |
|---|---|---|---|---|---|
| 旧本地抽取 | 低；局部原句易无关 | 最低，0 网络 | 最佳 | 已有 | 只保留离线预览 |
| 直接整段单次 LLM | 中高；短视频有效 | 一次调用，长视频易超限 | 派生全文出站 | 低 | 不足以覆盖长视频 |
| BiliNote Markdown + marker | 高可读性，成熟 | 分块与 merge 有成本 | transcript/图片出站 | 中；marker 脆弱 | 仅借鉴体验，不照搬合同 |
| Navia 结构化分块 + 全局 merge | 目标最高；可校验、可同源派生 | 2..N 次调用 | 仅显式授权的派生文本 | 较高；需 Schema/校验/版本化 | **主路径** |
| 本地小 LLM | 质量取决于模型，8 GiB 约束明显 | 首次下载大、CPU 慢 | 最佳 | 最高；模型管理/量化/兼容 | V4 备选 |

体验回退判断：高质量路径会增加首次生成等待和模型费用，但章节、概括和跨章回答预期显著提升；本地预览仍立即可用。页面必须明确两种模式，不能把等待或失败伪装成成功。

## 5. 实施范围

- 新增 `MiniMaxGroundedSynthesisProvider`：派生文本分块、全局归并、请求 hash 与 usage receipt。
- 新增 `MediaComprehensionService.synthesize`：任务级显式授权、私有原子落盘、失败不覆盖。
- 新增 v2 projection：`quality.mode=grounded_model`、Provider/model/hash、`rawMediaUploadCount=0`。
- 新增结构化 Ask：从全片章节 thesis/keyPoints 检索，不再直接拼接两段字幕；视觉问答继续使用视觉证据路径。
- Ask 使用独立 system prompt、`temperature=0`、最多三次合同级纠错重试；普通/视觉最多 4 块，跨章最多 6 块，正文禁止泄漏内部 ID。
- 参考 BiliNote 风格设计但收敛为精简/结构化/详细/教程四种；每种结果在设置处显示覆盖遗漏、过度纳入或步骤化重组风险。
- Workspace 明示“本地提取预览”，提供单次“生成高质量图文大纲”授权弹窗。
- 新投影生成后清除同 task/revision 的旧 Ask 缓存。

## 6. 出门门槛

1. 三个既有真实 B站视频全部重新生成，不复用 V3-5.1 人工结论。
2. 12 问/视频；无关键含义错误，相关性与概括性人工通过，引用支持率不低于 90%。
3. 每个章节 2..5 个关键点且至少一个真实证据；所有 evidence ID、时间范围和 task/revision 闭合。
4. 至少抽查 8 个视觉节点：一致/补充/冲突标签符合实际，截图不得替代语音事实。
5. 原始音视频、截图二进制、Cookie、绝对路径的文本 Provider 上传计数均为 0。
6. 360/420/768/1280、键盘、Axe、滚轮/拖动/seek 回归保持通过。
7. 模型失败、无授权、无 Provider、无效 JSON、未知证据和时间重叠全部 fail closed，并保留本地预览。

## 7. 真实实施结果

- 三视频结构化投影：`3/3`，分别为 8/7/10 章，全部 `rawMediaUploadCount=0`；公开摘要见 `three-video-synthesis-summary.json`。
- 最终单 run：`v3-5.2-quality-candidate-20261011T040000Z`，36 问 `36/36`，6 个证据不足陷阱全部拒答，视觉引用类型、引用闭合和正文内部 ID 泄漏均通过；公开无正文摘要见 `three-video-quality-machine-summary.json`，SHA-256 `a4ade25a5920e6964df0192606d0af5830b9f1414a23f8776e733f42fbfaa992`。
- 最短视频四风格真实对照：精简 6 章/20 点，结构化 8 章/32 点，详细 8 章/31 点，教程 10 章/30 点；见 `style-comparison-summary.json`。风格差异不改变证据闭合合同。
- 全量回归：Runtime `694 passed`；Extension `52 files / 351 passed`；typecheck/build/diff-check PASS。
- MiniMax-M3 的 JSON mode 不作为架构前提；依据 MiniMax 官方社区的 [JSON mode / JSON object 路线讨论](https://www.minimax.io/community/m/1512023552507773089)，当前采用提示词约束、多对象解析、强语义校验与合同重试。

## 8. 当前停止边界

代码与真实机器候选已完成，但不能声称最终质量通过。至少还需独立人类审阅 36 个回答及 8 个视觉节点。同步高质量大纲实测约 36–345 秒，最终问答候选中内容题中位数约 4.6 秒、跨章中位数约 23.4 秒且最大约 31.5 秒；V3-5.3 必须设计后台任务、进度与可恢复检查点后再允许进入 V3-6。旧 V3-5.1 人工 FAIL 不得被本轮机器结果覆盖。
