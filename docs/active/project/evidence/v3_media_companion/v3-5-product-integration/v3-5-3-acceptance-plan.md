# V3-5-3 三视图与视觉证据验收计划

日期：2026-10-08。输入必须是全新真实 B站任务，不接受 fixture、旧 run 拼接或手工伪造 evidence。

## 1. 固定门槛

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 同一 task 在转写成功后申请视觉 lease | lease.taskId 精确相等；显式 leaseId；Cookie/撤销令牌不进入 UI/日志 |
| A02 | 调用视觉物化 API | task、lease、sourceIdentity 三重绑定；错 task/过期/撤销 lease 均 fail-closed |
| A03 | 下载真实 B站媒体切片 | 0–8 秒、最高 480p、私有 task sandbox；真实字节与哈希可复算 |
| A04 | 执行采样与抽帧 | frozen policy；至少 1 个 selected frame；帧 <=1280px |
| A05 | 执行本地 OCR | 至少一个真实 OCR observation；`localOnly=true`；不发生网络 OCR |
| A06 | 执行 MiniMax 画面理解 | verified selected Provider；单 task 1 次、总量 <=8；仅上传选中帧 |
| A07 | evidence 分型 | 同 task 同时间轴含 transcript/frame/ocr_block/vision_caption；ID 与引用闭合 |
| A08 | 打开 Outline/Timeline/Mindmap | 同 taskId/revision/outlineId；三视图内容哈希稳定；direct/reload 后一致 |
| A09 | 打开 Evidence Drawer | 显示类型、时间、来源、hash、jumpback 状态；不显示 Cookie/key/path/raw bytes |
| A10 | 视觉不可用负例 | 缺 lease/Provider/consent/下载失败均结构化失败或诚实 degraded，不能伪 ready |
| A11 | lease 与媒体清理 | 新 lease 终态撤销；Cookie temp、video、frame、non-evidence frame residual=0 |
| A12 | 原子性与重放 | 单次 commit；相同 idempotency key 字节一致；禁止覆盖既有 terminal task |
| A13 | 全量回归 | Runtime、Frontend、typecheck、build、V3-5-1/2 route 回归全部通过 |
| A14 | 公开材料扫描 | secret/path/raw media 0 hit；仅保留脱敏摘要与必要产品截图 |

## 2. 真实端到端步骤

1. 启动隔离 Runtime、独立 DB、媒体根目录和 Chrome profile。
2. 打开固定真实 B站视频并通过真实 Side Panel 完成五项授权、安全会话和 Cookie lease。
3. 运行现有真实 acquisition + SenseVoice；完成后为相同 task 申请新的视觉 lease。
4. 物化视觉产品，等待 ready；记录 route、evidence 类型计数、三投影 hash 和清理 receipt。
5. 在 Workspace 依次 direct-open、reload 大纲/时间线/导图/证据；核对同 task/revision/outline。
6. 运行负例、全量测试、secret scan；删除 raw DB、profile、日志、视频、音频、帧和过程截图。

## 3. 假绿拒绝

- transcript-only degraded task 不计 A05–A09 PASS。
- 只验证 schema shape、不复算 evidence 闭合与 projection hash 不计 PASS。
- 只调用 MiniMax 文本接口或上传占位图片不计画面理解 PASS。
- run 结束后任何 `.mp4/.media/.wav/.png/.jpg/.webp/cookies.txt` 残留均 FAIL。
- 任一自动门槛失败，回到计划阶段；不得进入 V3-5-4。
