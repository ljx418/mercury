# WP-B PRD / 不变量检视

候选：`wp-b-explicit-local-media-import-implementation-2026-10-19`
状态：**WP-B AWAITING CODEX CHECKPOINT**

## 1. 不可变边界逐条

| 边界 | 结果 | 取证 |
|---|---|---|
| 单文件来自用户手势；不扫描目录 | ✅ | `LocalMediaImportCard` 只接受单个 `File`，隐藏 input 仅由主按钮触发，`multiple=false` |
| 不接收/保存 `fileName/path/url/hash/lastModified/relativePath` | ✅ | 8 项 mutation 逐项 400；表无对应列；文件名仅存组件内存 |
| 不持久化 `File`/handle | ✅ | 组件仅持有 `File` 引用，终态与 unmount 都清空 |
| raw content 仅 `request.stream()` | ✅ | PUT 路由用 `request.stream()`；无 `request.body()`、无 Base64、无全量 multipart |
| writer 用 `memoryview` 切 ≤1 MiB | ✅ | 64 KiB / 1 MiB+1 / 8 MiB 传输块全部合法且切片 ≤1 MiB，累计与 SHA 与整块一致 |
| API 经 privileged exact Origin、bearer、one-shot token | ✅ | 中间件精确 Origin；端点 bearer；token 单次消费 |
| 拒绝发生在 writer 创建前 | ✅ | 每条负例断言 `_build_writer` 未被调用 |
| 原视频/WAV/未选帧不进 Provider、知识库、日志、Trace、公开证据 | ✅ | 失败归一为固定码；stderr 不出界；证据只含标识、相位、摘要与计数 |
| local route 不调 downloader/credential/tabCapture | ✅ | 绑定 JSON 中不出现这些词（测试断言） |
| 不建第二 SourceAuthority | ✅ | `bind_local_import` 只在既有 task 上加一个 selected route |
| 自动 route 顺序不变 | ✅ | `CAPTURE_FALLBACK_ROUTES` 未改 |
| 原视频在 T3 + 两个 receipt durable 后才删除 | ✅ | 五注入点 probe：T3 后未删，audio receipt 后才删 |
| 双消费者 terminal 后 barrier 才清共享输入 | ✅ | 两终态顺序皆合法；清理只 claim 一次 |
| 不改 WP-A 固定来源/摘要、relay v11 历史材料、Cookie/Provider 边界、WP-C | ✅ | 均未改 |
| 测试无声 | ✅ | 未播放声音 |
| 可见 Chrome 先通知用户 | ✅ | **未启动任何 Chrome**（B29/B30 未执行），无需通知 |
| 不 commit/push/reset/clean/checkout/revert | ✅ | HEAD 未变 |
| 不覆盖 dirty worktree 或历史证据 | ✅ | 完整保留 |

## 2. PRD §18.13 与 ADR-V3-14 对应

| 目标 | 实现 |
|---|---|
| 显式本地导入作为 blocked 后的用户出口 | `LocalMediaImportCard` 仅在 eligible blocked 态渲染 |
| 用户始终知道下一步 | 阶段文案 + 固定码分类恢复建议 |
| 不因站点能力限制而静默失败 | 三自动 route 失败后才提供导入入口 |
| 不引入第二依赖/第二权威 | 复用同 task 依赖 snapshot 与既有 coordinator |
| 崩溃可恢复且不误报成功 | 五注入点 hard-kill probe 全部 fail closed |

## 3. 架构冲击

- 公共新增：四个 loopback endpoint、两个公共 schema、18 个 import 失败码；**未扩张 relay v11 的 40/20 code universe**（`unlistedBoundaryEmits = {}`，target 仍 20/20）。
- 最大冲击：local route 的 acquisition cleanup 从 transcript 单消费者迁到持久双消费者 barrier，已由 B23/B26 hard-kill 证明。

## 4. 严重度

| 级别 | 数量 | 说明 |
|---|---:|---|
| Fatal | 0 | — |
| **Major** | **2** | `app.py` 摘要待重冻结；私有 seed 缺失阻塞 B29/B30 |
| Minor | 0 | — |
