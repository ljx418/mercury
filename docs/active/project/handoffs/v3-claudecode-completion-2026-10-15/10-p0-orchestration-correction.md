# P0 编排纠偏与下一实现切片

日期：2026-10-15 17:10 CST。性质：P0 文档补丁，不是 P0 PASS，不授权 P1 六视频。

## 1. 问题与证据

最新 muted Chrome canary 使用真实 B站页面、fresh Chrome profile、独立 Runtime/database/task、用户授权 Cookie 和产品端口 `17861`。它达到 resolve `201`、同源 authority active、outline `201`，但 outline task 在 180 秒内保持 `created`，最终 `stage-a-not-terminal` 非零退出。cleanup failure 为 0，Cookie leak 为 0。

这不是 Provider、B站或 Runtime 随机失败。runner 在 acquisition projection 尚处于 `awaiting_trusted_capture` 时自行创建 outline task，之后没有调用产品 materialize。产品 Side Panel 只在 acquisition projection 到达 `succeeded` 时自动调用 visual materialize，并在 visual 失败时调用基础 materialize。

## 2. 架构决定

采用单一编排者：

- `SourceAuthority/TaskStore`：唯一 task/revision/state 持久事实源。
- `AcquisitionCoordinator/TranscriptProjection`：媒体获取、可信捕获、ASR 和 acquisition terminal。
- `Side Panel materializeCurrentMediaTask effect`：日常成功路径唯一 materialize 编排者。
- `MediaProductMaterializer`：幂等写入 ready/degraded projection，不负责 UI 用户动作。
- runner：只做用户可达动作和观测，不调用 materialize、不写数据库、不伪造 projection。

放弃的方案：由 runner 在真实 UI canary 中 POST create/materialize。它虽易于测试，却形成第二编排者，无法证明用户路径可用，并可能与 UI effect 竞争。

## 3. 目标体验

有平台字幕时，一次“分析当前视频”自动完成 acquisition 与 materialize。无字幕时，用户只在浏览器安全边界要求下确认一次“捕获当前标签页”，完成后系统自动转写并生成受限或完整大纲。日常 UI 不展示 create/materialize 等内部步骤；只显示当前阶段、计时、取消和精确恢复动作。

自动化可对可见产品按钮执行可信点击，但 Chrome 必须 `--mute-audio`。测试不能播放声音，也不能用 API 伪造 user activation。

## 4. 下一开发切片

1. 从 canary 成功路径移除手工 `POST /outline-tasks` 和直接轮询 created task 的编排职责。
2. 增加 acquisition projection 观测；在 `awaiting_trusted_capture` 时定位 `media-capture-start` 并执行可信点击。
3. 达到冻结采集时长后点击 `media-capture-finish`；记录 capture 路径和 typed failures，不保存原始音频。
4. 等待 projection `succeeded`，观察 Side Panel 发出的 `materialize-visual`；允许同一 effect 的基础 materialize fallback。
5. 断言 authority、acquisition、outline、Workspace 使用同一 task ID/revision，并达到 `ready|degraded`。
6. 断言 UI 终止 busy、最终文件可复读、Chrome/Runtime/fixture/scratch/private media 全清理、secret/raw-media/path hit 为 0。
7. 再实现真实 crash/worker/permission/cleanup/SIGTERM 故障矩阵，封存 immutable candidate，交独立审查。

## 5. 验收与停止条件

通过要求：focused suites 全绿；真实 muted canary 非零失败分支与成功分支均可复算；成功路径无 runner 私造状态；故障矩阵均为真实边界；Fatal=0/Major=0 的独立报告。

立即停止：需要改公共 API/schema；产品出现第二 materialize 编排者；测试必须绕过 user activation；任何声音播放；任何 secret/raw-media/private-path 泄漏；cleanup 不完整；条件未改变的重复真实 run；Claude 429/529 未先 checkpoint；422 未回合同修复。

## 6. 当前结论

`P0 documentation: GO`。`P0 implementation: IN PROGRESS`。`P0 exit: NO-GO`。`P1-P9 implementation: BLOCKED BY THEIR GATES`。
