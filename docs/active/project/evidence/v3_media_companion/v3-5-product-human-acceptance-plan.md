# V3-5 双容器产品体验与人工验收计划

日期：2026-10-08。状态：`DOCUMENT RESUMPTION CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. 自动门槛 V3-5-A01..A18

所有 seek receipt 必须绑定 `TaskBinding.mediaDurationMs`；独立语义校验器必须证明 `deltaMs=abs(observedMs-requestedMs)`，且 `requestedMs/observedMs` 均不超过当前分 P 时长。越界时间、错误页面 identity 或 located 误差大于 2 秒均为失败，不能降级为通过。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 在锚点页打开 Side Panel | 正确标题/作者/分P/时长和 adapter，不显示旧 Mock 状态 |
| A02 | 查看并变更五项授权 | scope 清晰；授权/撤销持久；0 Cookie 值 |
| A03 | 点击开始 | 同 task 进入真实 V3-2/3/4 pipeline；显示 Runtime 实际 route；字幕转 ASR 时显示等待/CPU/内存/临时磁盘影响及取消，不能以 registry class 冒充字幕成功 |
| A04 | 需要 capture 时等待 | 只有可信按钮点击后启动，取消/过期明确 |
| A05 | 运行中取消 | UI 进入 cleaning 后终态；后端 residual=0 |
| A06 | 打开 Workspace | taskId/revision/outlineId 与 Side Panel 相同 |
| A07 | direct/reload/Back/reopen 8 条 canonical route，并打开旧 `#/media/transcript/:taskId` | 8 条均从 Runtime 恢复；旧路径只做 replace 迁移；invalid/forbidden 可回任务库；Knowledge routes 不回归 |
| A08 | 查看 Outline/Timeline/Mindmap | 三视图来自同一 outline，证据引用闭合 |
| A09 | 查看 OCR/VLM/Transcript/Frame | 标签分型，不互相冒充，私有帧不进入 public 包 |
| A10 | 提出有证据问题 | answered 且至少一个同 task citation |
| A11 | 提出无证据或纯视觉但无视觉证据问题 | `insufficient_evidence`，不编造答案 |
| A12 | 点击五类时间入口 | 5/5 回读播放器，located 误差 <=2 秒 |
| A13 | 页面/分P/播放器故障 | fallback/blocked，不计 located |
| A14 | 导出 Markdown ZIP 和 JSON | member/hash/schema 可复算，V4 状态 deferred |
| A15 | 任务历史与重启 | 重启后同 task/revision 可打开，无跨 task 内容 |
| A16 | Provider/Runtime/网络/磁盘故障 | 唯一终态、可恢复提示、无 secret/path 泄漏 |
| A17 | 四视口和键盘 | 无根溢出；Axe serious/critical=0；主流程与焦点返回通过 |
| A18 | 全量回归/秘密扫描/独立审计 | 0 mock、0 secret/path、Fatal=0/Major=0 |

任一自动门槛失败时，不生成可提交的人类 review bundle。

### A03 机器合同

V3-5 fresh run 只能生成 `v3-media-product-acceptance/v2`。`taskExecution` 必须满足：

- verifier 按固定映射独立复算 `routeDrift`：subtitle 只接受 subtitle route，asr/multipart 只接受本地 ASR/capture route，restricted 只接受 blocked，low_signal 只接受 visual_low_signal；
- `routeDrift=true` 必须至少一个结构化 fallback reason，`false` 时原因必须为空；
- observed route 为本地 ASR 或可信 capture ASR 时，资源提示必须已显示，等待级别和 CPU 影响不得为 none，内存与临时磁盘必须大于 0，取消必须可用，终态临时媒体必须已删除；
- Schema shape 通过但上述语义不成立时，语义 verifier 仍必须 FAIL，不能只做 JSON Schema 验证。

## 2. 人工验收 H01..H10

| ID | 人类可见步骤 | PASS 标准 |
|---|---|---|
| H01 | 打开锚点 B站页和 Navia | 页面身份、标题、作者、单 P、约 792 秒一致；无公开字幕提示诚实 |
| H02 | 查看五项授权说明并开始 | 能理解本地/云端范围、撤销影响和资源消耗；无 Cookie 操作 |
| H03 | 观察主路径并触发一次 capture 回退样本 | 路线、进度、等待点击、清理和终态可理解 |
| H04 | 抽查大纲和时间线 | 结构可读，关键章节有可见引用，没有明显无证据内容 |
| H05 | 打开 OCR/VLM/Transcript 证据 | 类型标签正确，缩略图/文字/时间关系可理解 |
| H06 | 操作 Mindmap | 节点结构与大纲一致，引用可打开 |
| H07 | 提问一个有证据问题和一个无证据问题 | 前者有引用，后者诚实拒答 |
| H08 | 执行五次反跳 | 播放器跳到预期附近；机器 receipt 的 `deltaMs<=2000` 且 `located` 必须页面身份一致；失败不伪成功 |
| H09 | 取消任务并观察一个 Provider 故障 | 不抢焦点、不无限 loading，状态和恢复动作明确 |
| H10 | 导出两种格式 | 文件可打开；界面没有“已保存到知识库”或 V4 完成声明 |

每项必须填写 `reviewerId/reviewerRole/reviewedAt/decision/screenshotRefs/note`。decision 只允许 PASS/FAIL/BLOCKED。不得由自动化生成 reviewer 或把未执行写 PASS。

## 3. 人工页面要求

- 每一步有基于当次 build 的新鲜截图、红框/编号和预期交互，不使用概念图冒充产品截图。
- 页面不要求人类听写、比较 ASR 模型、粘贴 Cookie、读取日志或判断 hash。
- 页面显示当前 task/run/build/bundle hash，并阻止提交不完整 10 项。
- 导出 submission 后只允许 append 新 revision，不原地篡改签署。

## 4. 出门

V3-5-A01..A18 全 PASS、H01..H10 全部执行且无 FAIL/BLOCKED、Schema 拒绝 judgment 与 overallDecision 不一致、review bundle/hash 有效、独立实施审计 Fatal=0/Major=0 后，V3-5 才可 LIMITED PASS。该结论只放行 V3-6，不等于 V3 最终通过。
