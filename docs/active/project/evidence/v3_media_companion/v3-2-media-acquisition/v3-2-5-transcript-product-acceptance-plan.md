# V3-2-5 Transcript 双容器产品化验收计划

日期：2026-10-07。固定分母 `V3-2-5-A01..A14`，不得 N/A、缩减或用原型/fixture 代替真实 Runtime task。2026-10-06 外审分母保持不变。

| ID | 用户场景与操作 | 必须结果 |
|---|---|---|
| A01 | 从真实 B站页在 Side Panel 点击开始 | 创建唯一 Runtime task；页面 identity、adapter、当前分 P 一致 |
| A02 | 同时打开 Side Panel 和 Workspace | 两容器从 Runtime `MediaTranscriptProjection` 读取同一 taskId/revision；无前端第二事实源 |
| A03 | 观察字幕/媒体/公开字幕路线 | 当前 route、阶段、进度和机器原因与 Runtime observation 一致 |
| A04 | 进入本地 SenseVoice 转写 | 显示模型定位、进度、可取消；不显示 Tiny 等价质量承诺 |
| A05 | 前三路线失败 | 显示等待捕获及影响；不自动启动 tabCapture |
| A06 | 点击捕获按钮 | 必须是真实 `isTrusted=true`；焦点可见；旧 grant/replay 失败 |
| A07 | 处理中点击取消 | 先 cleaning；子进程/track/socket 停止且 receipt 通过后才 cancelled |
| A08 | 失败后点击重试 | 创建新 taskId；旧 artifact/ticket/lease 不复用 |
| A09 | Workspace 查看 transcript | segment 有序、可滚动、route/provenance 可见；本阶段不启用 seek |
| A10 | restricted/low-signal/failed/cancelled | 文案与唯一终态一致；不显示伪 transcript 或成功图标 |
| A11 | reload/back/reopen/invalid task | 按 taskId 或当前 sourceIdentity 从 Runtime 恢复；跨来源/无效 task 回到媒体首页；不从 localStorage 伪恢复 |
| A12 | 四视口与 200% zoom | 360/420 Side Panel、768/1280 Workspace 无根溢出和遮挡 |
| A13 | Axe 与键盘主流程 | serious=0、critical=0；开始/捕获/取消/重试/打开 Workspace 均可键盘完成 |
| A14 | 隐私、PRD 与独立审计 | Cookie/path/ticket/streamId 公开命中 0；禁止提前声明；Fatal=0/Major=0 |

## 证据

使用 `v3_media_transcript_exit_v1.schema.json` 的 `ProductUiAcceptance`。保存四张真实 PNG、DOM overflow、Axe JSON、键盘轨迹、task observation index、双容器相同投影快照、取消 cleanup receipt、重试新旧 task binding 和 secret scan。固定 states 正好覆盖 acquiring、awaiting trusted capture、transcribing、cleaning、terminal。

## 失败处理

任一项失败即 `FAIL / REPLAN`；不得删除视口、隐藏失败状态、跳过真实 capture 操作或把组件测试升级为 E2E。
