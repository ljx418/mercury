# V3-5-4 Ask、播放器反跳与本地导出验收计划

日期：2026-10-08。只接受全新真实 B站任务；不得复用 V3-5-3 task 或拼接旧 run。

## 1. 固定门槛

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 对真实 ready task 提交有证据问题 | `answered`、非空 answer、至少 1 个同 task/revision citation |
| A02 | 提交无证据问题 | `insufficient_evidence`、空 answer、0 citation、明确 failureCode |
| A03 | 提交视觉问题 | 引用集合至少含 frame/ocr_block/vision_caption；不能仅 transcript |
| A04 | 错 task/revision/未知字段/超长问题 | fail-closed；不创建 Ask 结果 |
| A05 | 重放相同问题 | 同 task/revision/question 得到字节稳定结果；不得跨 task 复用 |
| A06 | 点击 outline 时间 | 当前页面 identity 匹配；真实播放器回读 delta<=2000ms |
| A07 | 点击 timeline 时间 | 同 A06 |
| A08 | 点击 mindmap 节点 | 同 A06；节点引用与时间来源闭合 |
| A09 | 点击 Ask citation | 同 A06；citation 属于当前 Ask/task |
| A10 | 点击 evidence drawer | 同 A06；evidence timestamp 未被前端改写 |
| A11 | 错页面/分P/越界/无播放器 | fallback/blocked typed failure；不得计 located |
| A12 | 生成 JSON export | schema、members、bytes、SHA-256 可独立复算；V4 deferred |
| A13 | 生成 Markdown ZIP | ZIP member allowlist、逐项 hash、无路径穿越、文件可读 |
| A14 | 重复导出/下载 | 同一 revision 内容稳定；下载仅限 manifest 绑定 artifact |
| A15 | 双容器与路由 | Side Panel/Workspace 同 task；Ask/export direct/reload/back/reopen |
| A16 | 全量回归 | Runtime/Frontend/typecheck/build 与 V3-5-1..3 不回归 |
| A17 | 清理与扫描 | profile、临时媒体、export staging 清理；secret/path/raw media 0 hit |
| A18 | PRD 检视 | 不声称知识入库、通用 Agent、跨站点完成或 V3 总通过 |

## 2. 真实端到端

1. 新隔离 Runtime/DB/profile，打开固定 B站视频，从 0 秒开始可信录音并生成 fresh ready task。
2. Ask 一个可由转写回答的问题、一个证据中不存在的问题；再问一个画面问题并核查视觉引用类型。
3. 从 outline/timeline/mindmap/Ask/evidence 五个 origin 分别点击；每次在 B站播放器回读 `currentTime` 并计算 delta。
4. 改到错误页面并提交一次 seek，必须 typed blocked/fallback。
5. 生成 JSON 与 Markdown ZIP，独立解包、重算 member/hash/schema，验证 V4 deferred。
6. 跑故障、全量测试、secret scan；摘录去敏结果后删除 DB、日志、媒体、帧、export 临时文件和过程截图。

## 3. 假绿拒绝

- Ask 引用存在但不属于当前 task/revision，FAIL。
- 有回答但 0 citation，或拒答仍有生成答案，FAIL。
- seek 只验证 content-script 返回值而未回读真实播放器，FAIL。
- 五次 seek 复用同一个 origin，FAIL。
- 导出只验证 HTTP 200、不解包和重算，FAIL。
- 任一门槛失败，回到开发计划；不得进入 V3-5-5。
