# WP-B 纠偏 PRD / 不变量检视（2026-10-20）

状态：**WP-B CORRECTIVE NO-GO**

## 1. C0 冻结权威：本轮未改动

| 项 | 状态 |
|---|---|
| 三个 local-import schema | ✅ 未改 |
| 18 码闭集 | ✅ 未改 |
| B01–B30 分母 | ✅ 未改（本轮未重新证明） |
| T1–T4 顺序 | ✅ 未改（上传成功后原视频保留至 T4 删除，已由 C2 测试锁定） |
| 阈值 | ✅ 未改 |
| exact Origin/bearer/token 顺序 | ✅ 未改 |
| 资产 registry | ✅ 未改 |
| WP-A 工具/摘要 | ✅ 未改 |
| relay v11 合同 | ✅ 未改（仅报告源哈希漂移） |
| v10 历史证据 | ✅ 未改 |

## 2. 本轮修正是如何守住不变量的

- **Fatal 1** 修复只改**调用方式**（同步调用同步方法、异步迭代异步生成器），不改变任何
  拒绝顺序、码或阈值；新增的 `except Exception` 把任何传输/磁盘异常归一为
  `WRITE_FAILED`，不外泄原始异常文本（测试断言 `disk went away` 不出现在响应里）。
- **C1** 修复只把**版本与 id** 对齐冻结 schema，并把 `recoverable`/`media` 限定为**公开派生**；
  存储表回到冻结的 15 列。中途我曾把 `recoverable`/`prepared_media` 误加进存储表
  （会违反冻结 storeRecord），已当场回退——最终存储列经 `PRAGMA table_info` 核对与 schema 一致。

## 3. 仍然违反的不变量（对应 1 Fatal + 5 Major）

| 不变量 | 违反 | 计划 |
|---|---|---|
| 生产 Runtime 必须编排 preparer → barrier → transcript → materializer | 生产从未装配 | C4 / Fatal 2 |
| 浏览器可达性：精确 allow-origin、Runtime base URL + bearer、卡片挂载 | 三项均未做 | C6 / Major 1 |
| 双消费者终态必须持久、audio receipt 必须保留、cleanup 必须用真实 coordinator API | 仍为进程内 / 丢弃 / 签名不兼容 | C5 / Major 2 |
| 启动恢复必须在 T3/audio staging 之前不删共享输入 | 未接线 | C5 / Major 3 |
| create 必须在分配前证明 task/source 合格 | 未证明 | C3 / Major 5 |
| 测试必须用生产驱动与真 oracle | 仅 C2 达成 | C7 / Major 6 |

## 4. 严重度

Fatal **1** · Major **5** · Minor **0**。
