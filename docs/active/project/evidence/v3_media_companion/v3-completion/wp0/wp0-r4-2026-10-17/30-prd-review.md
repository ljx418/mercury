# WP0 R4 PRD / 架构不变量检视（2026-10-17）

Candidate: `wp0-r4-2026-10-17`
状态：**R4 AWAITING CODEX CHECKPOINT**

## 1. `61-codex-r4-development-and-acceptance.md` §2 逐条落实

| 工作包 | 要求 | 本轮结果 | 判定 |
|---|---|---|---|
| **R4-1** 真实 Uvicorn capture integration | 本轮临时根、随机空闲端口、owned Uvicorn；真实 WebSocket 连 `/v1/media/capture-stream`，走 bootstrap/session、ticket、start、非空 PCM、ACK、stop/finalize；ticket 一次性、Origin/CSP、绑定、sequence/length/backpressure、WS loss、Runtime rejection 返回固定码；**TestClient 只能作单测补充** | **62 个真实独立进程**（62 唯一 PID、62 唯一随机端口 44665–48583），客户端为真实 `httpx` + `websockets.sync.client`。19 例覆盖 session、ticket、start、非空 PCM、ACK 精确对应、stop/finalize、Origin 精确匹配、缺失 Origin、ticket replay、binding、sequence、length、WS loss、7 种 stop reason、cleanup。**TestClient / mock WS = 0**。所有进程、socket、数据库、staging 与 sandbox 均属本轮并在结束时清理 | ✅ |
| **R4-2** 六个 handoff / product 注入点 | 逐点注入 `after_sink_finalize`、`transcript_create`、`before_stage`、`after_stage_before_worker`、`handoff_completed_frame_send`、`commit_then_runtime_restart_before_background_observe`；前 3 点由 Runtime capture handler 独占 cleanup；第 4 点在 fsync + SQLite FULL receipt 后、worker 前**真实 hard kill**；第 5 点只保留 handoff；第 6 点只有 SQLite `ready\|degraded` 才恢复为 published | **6 / 6 逐点执行**。第 1-4、6 点用 `os._exit(137)`（跳过全部 finally），第 5 点进程存活且 `completed` 帧从未送达。处置分别为 `abandoned`×5 与 `published`×1 | ✅ |
| **R4-3** owner manifest / receipt / hard-crash recovery | 发布顺序 temp `O_EXCL` → file fsync → atomic replace → 父目录 fsync → SQLite `BEGIN IMMEDIATE` + `synchronous=FULL` receipt commit → worker start；hard kill 后不假定 finally；新进程只凭 validated authoritativeTaskId 定位 `owner.json`；**八类损坏**全部 fail-closed；existing recover composite cleanup 后**四项残留为零**，fresh begin 保持单 sink | 发布顺序由既有生产代码承担（R1 已实现），本轮在**真实进程**上验证其结果。八类（missing / torn / corrupt / uncommitted / identity / hash / length_shape / path_escape）**8/8 fail closed** 且不删除未验证证据。composite cleanup 后四残留全零；fresh begin 为单 sink | ✅ |
| **R4-4** restart phase owner | connecting 且 valid start 未成立：新 session → authenticated DELETE → GET；runtime-alive 其他 phase 由唯一 owner finally 收口再 GET，不重复清理；hard crash/SIGTERM 走 existing recover，不伪造 finally；GET 404 停止轮询并进入 recovery pending；marker expiry 只清 marker；新 worker 不写旧 task，不恢复旧 PCM/ticket/sequence/bearer token | 重启后的 Runtime **进程内状态清空**：新 session 必须自举；旧 ticket 无法启动任何 capture；旧 grant 的 GET **恰轮询 1 次**即停并返回 recovery pending，绝不被读作成功；对未知 grant 的 DELETE 被拒而非伪造撤销。SIGTERM 只作用于本轮 PID，退出码 0。hard crash 一律走 existing recover | ✅ |
| **R4-5** 安全与回归 | CSP/Origin、ticket replay/binding、secret scan、私有路径、cleanup ownership、SIGTERM、hard kill、重复 recover 幂等；taskId/sourceIdentity 跨层一致 | Origin 精确匹配 + 缺失 Origin 被拒；ticket replay 与 binding 均返回冻结码；secret scan 证明 ticket / session token / master token / scratch 绝对路径 / 原始 PCM **均不进入任何 WS 帧**；cleanup ownership 以**连接**为单位（§1 缺陷修复）；SIGTERM 与 hard kill 均只作用于 owned PID；重复 recover 非第二 cleanup owner | ✅ |

## 2. §3 十条强制行为 oracle 逐条落实

| # | oracle | 落点 | 判定 |
|---:|---|---|---|
| 1 | 真实 Uvicorn 收到非空 PCM，ACK 与 sequence/length 精确对应 | R4-1 #1 | ✅ |
| 2 | Runtime started 前 0 chunk；Runtime stop 后 0 新 chunk | R4-1 #2 | ✅ |
| 3 | 六注入点逐项产生冻结 disposition、failure/terminal 和唯一 cleanup owner | R4-2 | ✅ |
| 4 | hard kill 发生在 durable receipt 后、worker 前；不执行 finally 仍可恢复 | R4-2 #4（由将死进程自证） | ✅ |
| 5 | 八类 manifest/receipt 损坏全部拒绝且不删除非 owned 路径 | R4-3 | ✅ |
| 6 | composite cleanup 四项残留均为 0，fresh begin 后 active sink 恰为 1 | R4-3 | ✅ |
| 7 | completed frame 发送失败不能被解释成 durable success | R4-2 #5 | ✅ |
| 8 | SQLite `ready\|degraded` 存在才 published；否则 abandoned | R4-2 #1-5 vs #6 | ✅ |
| 9 | GET 404 停轮询，marker expiry 只清 marker | R4-4 | ✅（404 分支实测；marker expiry 属 Background 侧冻结逻辑，由 R1 既有静态门禁与 vitest 覆盖） |
| 10 | secret/raw PCM/ticket/私有路径不进入公开 evidence | R4-5 | ✅ |

## 3. §2 R4 的四条硬约束逐条核对

| 约束 | 核对 |
|---|---|
| after_stage hard kill 必须发生在 owner manifest 父目录 fsync 与 SQLite FULL receipt commit **之后**、worker **之前** | child 在 `SenseVoiceTranscriptService.start()` 入口自证：`ownerManifestExists=true`、`receiptState=ownership_committed`、`receiptDurability=sqlite_transaction_synchronous_FULL_committed`，且 receipt 摘要与落盘 manifest 字节逐字一致；worker 线程此刻尚未创建 |
| **不得假定 finally** | 五个硬杀点使用 `os._exit`，跳过 `finally`、atexit 与 context manager；恢复只凭 authoritativeTaskId |
| 重启只凭 authoritativeTaskId 发现 manifest/receipt | 第二个 owned 进程从同一 scratch 根启动，进程内无任何继承状态，全凭磁盘 + SQLite 发现 |
| completed frame 只是 handoff；只有 SQLite `ready\|degraded` 是 durable published | 非 durable handoff 的 `media_tasks` 中不存在 `ready\|degraded`；只有注入点 6 的 durable commit 产生 `published` |

## 4. 公共合同与冻结材料

| 项 | 状态 |
|---|---|
| 公共 endpoint / API | 未改 |
| Origin | 未改（精确匹配语义未动） |
| ticket TTL | 未改 |
| v10 schema / fixture | **未修改** |
| FailureCode registry（20 码） | 未改；本轮所有新失败均复用既有冻结码 |
| 40 / 20 inventory | 未改（verifier 自身报告 inventory 本身 40/40、20/20 一致） |
| 固定阈值 | 未改；R4 未引入任何新阈值 |
| SourceAuthority | 未改 |
| 产品 terminal 定义 | 未改（`ready\|degraded` 仍为唯一 durable 成功） |

**唯一触碰**：`services/local-runtime/navia_runtime/app.py` 的**字节**被 fixture 的
`sourceInventoryEvidence.scopes[].sha256` 冻结，R4 为关闭 §1.1 的跨连接归属缺陷必须改它。
本轮**未**修改 fixture 来自行重冻结。

已独立验证：`app.py` 中唯一受影响的码 `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` 仍存在 2 处；
本轮三处改动只引入一个布尔标志与一个 `and` 子句，未新增/删除/重命名任何 `V3_MEDIA_*`
常量，故**失败码集合未变，变的只是文件字节**。

## 5. 架构不变量（`02-target-architecture-and-boundaries.md` §3）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background / Runtime 单一 owner | 强化：cleanup 归属改为**连接级**，未握手的连接不再能 abort 他人 capture | ✅ |
| Offscreen 直接联网（不允许） | 不变（R4 只驱动 Runtime） | ✅ |
| 音频生产 / downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变，并在真实进程上验证其 durable 顺序 | ✅ |
| barrier 后 cleanup 归 transcript service | 强化：缺失 staging 的恢复不再误判为不可验证 | ✅ |
| streamId 仅一次性 | 不变（R3 已闭合） | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 不变（R3 已闭合） | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | 不变（R2 已闭合） | ✅ |
| 单一 capture control plane | 强化：非法连接不再拥有 cleanup 权力 | ✅ |
| restart 不恢复旧音频 / ticket / 序列 / bearer token | **本轮以真实进程证明**：旧 ticket、旧 grant 与旧 session 在新进程中全部失效 | ✅ |
| restart 通过真实 authenticated Runtime | 强化：恢复必须使用**新进程自举的新 session** | ✅ |
| 唯一 durable 产品成功 = SQLite `ready\|degraded` | **本轮以真实进程证明**：非 durable handoff 永不 published | ✅ |

## 6. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major（已修复） | 0（两个生产缺陷，见 receipt §1.1、§1.2） |
| Minor | 0 |
| 待重冻结 | **1**（`app.py` 摘要，待 Codex 决策） |
