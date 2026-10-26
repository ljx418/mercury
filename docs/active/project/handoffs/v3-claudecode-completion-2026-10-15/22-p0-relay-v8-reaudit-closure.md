# P0 Relay v8 修订候选再审闭环

日期：2026-10-15。状态：`V8 REVISED DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## 1. 触发原因

v8 首轮 Claude 文档审查为 PASS，但严格 reviewer 给出 Fatal=0/Major=2/Minor=2。按更严格结论，首轮 v8 候选已拒绝：ASR staged root 在 hard crash 后没有 recover owner；36 项 source inventory 的 scope、hash 与实际 emit 文件不一致；删除 handoff case 时 verifier 以 `IndexError`/exit 1 退出。首轮外审报告保留为历史证据，不适用于修订候选。

## 2. 修订内容

1. `TaskAudioStager.stage()` 的目标合同增加私有 owner manifest，字段固定为 taskId、pid、process start token、源/暂存 SHA-256 与 state；ownership transfer 前必须 fsync。
2. existing recover 的内部 cleanup callback 冻结为 `MediaRecoveryCleanupCoordinator`：按 acquisition sandbox -> ASR staged root -> unpublished product evidence 顺序清理，并验证 active sink。四类 residual 任一异常或非零都返回既有 `V3_MEDIA_CLEANUP_INCOMPLETE`；不增加公开响应字段。
3. 新增 8 步 `after_stage_before_worker -> hard crash -> restart -> recover -> abandoned -> fresh begin` trace。只有 SQLite ready/degraded 产品提交允许 `published`；completed frame 仍只表示 handoff 通知。
4. source inventory 改为 9 个带 SHA-256 的精确 scope：Python 使用 AST module/symbol selector，TypeScript 使用字符串字面量扫描；两个 discovery root 拒绝未登记文件出现冻结 source code 或新 `V3_MEDIA_CAPTURE_*` code。
5. verifier 改为按 injectionPoint 安全索引，不再在数组缺项时越界；实际推导 emit set 并要求其精确等于冻结 36 项 inventory。
6. 主实施提示删除“completed send 后 task succeeded/GET recoverable”的 v7 语义，改为六注入点、四类残留归零和 SQLite 产品终态语义。

## 3. 机器证据

- v8 verifier：47/47 PASS，exit 0。
- 关键增删变异：8/8 均输出结构化 `passed=false`、非空 `failedChecks`、exit 2。
- 覆盖：handoff case 删除、source scope 增删、registry code 增删、已登记源码 emit 增删、未登记文件新增 capture code。
- 源码推导：9 个 scope SHA-256 匹配；actual emit set=36；frozen inventory=36；差集均为空；unlisted boundary emit=0。
- Archify：showcase 9/9，composition error=0/warning=0；spec SHA-256 `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968`，HTML SHA-256 `8e815df4b70f8d7fd6e5ec301fd896d34355c37b4499a0bfc69f42ea03346f77`。Chrome unavailable，因此 browser visual-check 仍为 skipped、人工视觉审阅 pending，未宣称视觉 PASS。

## 4. 当前门禁

当前只允许归档首轮 v8 审计包、从权威源重建不超过 20 文件的平铺包，并执行新的 ClaudeCode CLI 与严格 reviewer 双重只读审查。两份新报告均 Fatal=0/Major=0 后，仍需用户明确授权 R0-R7 才能修改产品代码。P1 六视频、Runtime/Chrome/Provider/媒体真实运行保持阻塞。
