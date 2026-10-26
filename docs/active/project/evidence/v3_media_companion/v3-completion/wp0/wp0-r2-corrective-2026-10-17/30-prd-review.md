# WP0 R2 限定纠偏 PRD / 架构不变量检视（2026-10-17）

Candidate: `wp0-r2-corrective-2026-10-17`
状态：**R2 CORRECTIVE AWAITING CODEX CHECKPOINT**

## 1. Codex R2 Major 逐条关闭

| 编号 | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| M-R2-01 | `maxCaptureMs` 必须是 owner **主动**截止；即使没有新 chunk 也必须收口 | 新增单一 `#deadlineTimer` handle，`start()` 从 `#startedAt` 武装（与 marker 同源）；到点**自触发**，依次：① 仅一次 `DURATION_LIMIT` ② 通知 producer abort（既有冻结 Port）③ 关闭 Runtime WebSocket ④ settle 失败 terminal ⑤ 清理 restart marker ⑥ 清除 deadline/ACK/start/finalize timer；已有失败时不二次上报 | ✅ |
| M-R2-02 | 累计 512 MiB 必须用**低资源、确定性**方法证明 exact-boundary / one-sample-over；拒绝发生在 enqueue / sequence / counter **之前**；不得用 32-chunk 背压冒充 | 新增两个纯谓词 + 仅内部测试用 `maxCaptureBytes` seam（production 默认仍 `RELAY_V10`）；四个 exact-boundary 数值用例（不做 512 MiB 分配/循环）+ seam 行为用例 + 四项 counter 污染证明 + composition 收口证明；**删除** false-green 用例 | ✅ |

## 2. `61-codex-r2-corrective-…` §3 要求的测试逐条落实

| 要求 | 用例 | 判定 |
|---|---|---|
| fake clock **无任何后续 chunk**：deadline 前 active，到 deadline 主动 aborted | `the owner deadline self-fires with NO further chunk` | ✅ |
| deadline 与用户 stop / Runtime disconnect 竞争：failure、terminal、marker clear **均一次** | `races a user stop` / `races a Runtime disconnect` | ✅ |
| cumulative byte exact boundary 与 one-sample-over，断言 counters/sequence/backlog **不污染** | 4 个边界用例 + `refuses before enqueue, sequence and counters change` | ✅ |
| 通过真实 `OffscreenAudioPort` + `RuntimeCaptureTransport` composition 证明 producer 收到 abort、Runtime socket close、terminal 为固定码 | `the deadline notifies the producer and closes the Runtime socket` | ✅ |
| timer 在 success finalize、cancel、abort、start failure 后均清除；推进 fake clock 不产生二次失败 | `the deadline timer is cleared on success, cancel and abort` | ✅ |
| 保留 32/33 chunks 与 outstanding raw-byte 背压测试，**禁止**代替累计字节测试 | 全部保留并在证据中分列三类上限 | ✅ |

## 3. `61-codex-r2-…` §2 推荐最小实现的四项约束

| 约束 | 满足情况 |
|---|---|
| 单一 Background owner | deadline handle 只存在于 `RuntimeCaptureTransport`（Background service worker 侧），无第二 owner |
| 无第二 control plane | producer abort 复用**同一条冻结 `abort` Port 消息**（`OffscreenAudioPort.sendAbort`），不是新协议或直接调用 |
| 无公共合同变化 | 消息集合、FailureCode registry、阈值、schema、fixture、inventory 全部不变 |
| 低资源测试 | 512 MiB 边界以**数值谓词**验证；无 512 MiB 分配、无编码循环 |

## 4. 三类上限在证据中的明确区分

| 上限 | 冻结值 | 判定位置 | 失败码 |
|---|---|---|---|
| outstanding queue chunk cap | 32 | `admitChunk()` 入队前 | `BACKPRESSURE` |
| outstanding queue raw-byte cap | 1,572,864 | `admitChunk()` 入队前 | `BACKPRESSURE` |
| **whole-capture cumulative byte cap** | 536,870,912 | `offerChunkMessage()`，enqueue / sequence / counter **之前** | `BYTE_LIMIT` |
| **whole-capture wall-clock deadline** | 900,000 | owner timer **自触发** + enqueue 守卫 | `DURATION_LIMIT` |

R2 receipt 中「累计字节上限已完整强制并验证」与「单元测试 + 静态门禁双重
锁定」的表述**已撤回并重做**：原用例只撞到 32-chunk 背压，属 false green。

## 5. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | 不变；deadline 也由该 owner 持有 | ✅ |
| Offscreen 直接联网（不允许） | 不变 | ✅ |
| 音频生产/downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变；6 项 barrier 全绿 | ✅ |
| barrier 后 cleanup 归 transcript service | 不变 | ✅ |
| streamId 仅一次性 | 不变 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 不变 | ✅ |
| **超限 enqueue 前 abort，禁止静默丢块** | 累计字节与时长均在 enqueue/sequence/counter 之前拒绝 | ✅ |
| 单一 capture control plane | producer abort 复用冻结 Port 路径 | ✅ |
| restart 不恢复旧音频/票据/序列 | 不变 | ✅ |
| restart 通过真实 authenticated Runtime | 不变（R1-C3-01 已闭合） | ✅ |
| **采集时长/字节上限由 owner 强制执行** | **本轮强化**：时长为**主动** timer 收口，字节为累计纯谓词 | ✅ |

## 6. 冻结合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| v10 schema / fixture / 40-source / 20-target inventory | **未修改** | ✅ |
| FailureCode registry（20 码） | **未修改**（复用既有 `DURATION_LIMIT` / `BYTE_LIMIT`） | ✅ |
| 固定阈值（`maxCaptureMs` / `maxCaptureBytes` / 32 / 1,572,864） | **未修改** | ✅ |
| 消息集合（9 个） | **未修改** | ✅ |
| 公共 API / Runtime endpoint / Origin / ticket / Cookie-provider | 未修改 | ✅ |
| 冻结 source scope 文件 | **未修改**（R2 corrective 只改 target relay 实现） | ✅ |

两个 v10 verifier 保持 **50/50** 与 **15/15**（exit 0），未触发重冻结。

**内部合同变化**：有 —— owner 新增主动 wall-clock deadline handle、
`onCaptureAbort` hook、两个纯边界谓词、内部测试 seam。
**公共合同变化：none**。

## 7. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R2-01 与 M-R2-02 关闭；R2 的 false-green 声明已撤回并重做 |
| Minor | 0 | — |
| 待重冻结 | **0** | 50/50 + 15/15 保持绿 |

## 8. 未启动事项声明

- R3 未启动；WP1–WP7 未启动
- Chrome 0 次；Provider 0 次；六视频 fresh run 0 次；真实产品 run 0 次
- 声音播放 0 次；可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未 commit / push / reset / clean / revert；dirty worktree 全部保留
- 未修改任何冻结材料；未自行宣布 R2 PASS
