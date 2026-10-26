# WP0 R4 测试结果（2026-10-17）

Candidate: `wp0-r4-2026-10-17`
状态：**R4 AWAITING CODEX CHECKPOINT**

## 1. 验收分层执行记录（§5.1A）

| 层 | 动作 | 次数 |
|---|---|---:|
| 实现内循环 | 仅跑受影响 pytest | 多次（每次修改只跑受影响文件/单例） |
| 子阶段 checkpoint | 一次集中回归（61 §4，共 13 项） | **1** |
| 阶段 closeout | **未执行** | 0 |

无文档外审、无阶段 closeout、无 immutable candidate 重打。**未重复 R3 审计。**

## 2. 真实 Uvicorn 运行证据（脱敏）

本轮所有 Runtime 行为都由**真实独立进程**验证。harness 的 ownership ledger 只记录
PID、loopback 端口与 scratch 根**目录名**，从不记录 ticket、session token、PCM 或绝对
路径。

| 指标 | 值 |
|---|---:|
| 真实 owned `uvicorn` 进程总数 | **62** |
| 唯一 PID | **62**（无复用） |
| 唯一端口 | **62**（无固定端口复用） |
| 端口区间 | `44665` – `48583`（全部随机分配） |
| 真实 WebSocket 客户端连接 | `httpx` + `websockets.sync.client` over 真实 TCP |
| `TestClient` / mock WebSocket | **0** |
| 真实 hard kill（`os._exit(137)`） | **6 个注入点中 5 个** |
| 结束后遗留 owned 进程 | **0** |
| 结束后遗留 owned scratch 根 | **0** |
| 浏览器进程 | **0**（`/proc/<pid>/exe` 断言为 python 解释器） |
| 声音播放 | **0**（PCM 为固定不可闻波形，仅落盘） |

## 3. R4-1 真实 capture integration（19 / 19）

| # | 用例 | 关键 oracle |
|---:|---|---|
| 1 | 真实进程完成一次非空 capture | 真实 ticket ≥43 字符；grant 不含 ticket/tabId；`chunkAccepted` 的 `sequence=0`、`byteLength` **精确等于**所发字节数；`completed` 的 `chunkCount/byteLength` 一致；`nonZeroSampleCount > 0`；`activeCaptureCount=0`、`residualRawAudioCount=0`；**handoff 帧的 transcript 仍是 `queued`** |
| 2 | started 前 0 chunk、stop 后 0 新 chunk | `stop` 后 `chunkCount` 恰为 1，无新块被计入 |
| 3 | Origin 必须精确匹配 | 3 个非法 Origin（错误 id、前缀截断、http）全部被拒且从不交付 `started`；随后精确 Origin 仍可用（证明是边界而非服务坏掉） |
| 4 | 缺失 Origin 必须被拒 | 无 Origin 头被拒（Origin 是强制的，不是通配） |
| 5 | ticket 一次性 + 重放冻结码 | 首次 `started`；重放返回 `V3_MEDIA_CAPTURE_TICKET_REPLAYED` |
| 6 | ticket 与 binding 绑定 | 改 `tabId` 后返回 `V3_MEDIA_CAPTURE_*` 冻结码 |
| 7-8 | start 形状违规（缺字段 / 多字段） | 均返回 `V3_MEDIA_CAPTURE_BINDING_INVALID` |
| 9 | 奇数字节 chunk | 返回 `V3_MEDIA_CAPTURE_CHUNK_INVALID`，且无 receipt、无 staged audio 残留 |
| 10 | 空 capture | 返回 `V3_MEDIA_CAPTURE_EMPTY`，无残留 |
| 11 | WebSocket 丢失 | 无 stop 直接断开后，**无任何私有临时 WAV 残留**、无 receipt、无 staged audio；服务仍健康 |
| 12-18 | 七种非 completed 停止原因 | `cancelled` 帧的 `reason` **恒等于**原始 reason（cancelled/navigation/tab_closed/consent_revoked/runtime_disconnected/timeout/failed），`activeCaptureCount=0`、`residualRawAudioCount=0`，且无 staging/receipt |
| 19 | PCM 确定且非空 | 16000 帧 × 2 字节 = 32000；存在非零采样；两次调用字节相同 |

## 4. R4-2 六个注入点（8 / 8）

五个 hard kill 用例均断言：进程退出码恰为 **137**、`os._exit` 跳过全部 `finally`、
child 自记录的 fault observation 携带自身 PID 与 taskId。

| # | 注入点 | 断言的处置 |
|---:|---|---|
| 1 | `after_sink_finalize` | `abandoned` + composite cleanup；四残留全零；authority ∈ {failed, cancelled} |
| 2 | `transcript_create` | 同上 |
| 3 | `before_stage` | 同上 |
| 4 | `after_stage_before_worker` | **关键 oracle**，见下 |
| 5 | `handoff_completed_frame_send` | 进程**存活**（不 kill）；child 记录 `completed_frame_send` 被拒；`completed` 帧从未送达客户端；durable 表中**不存在** `ready|degraded`；`abandoned` + 四残留全零 |
| 6 | `commit_then_runtime_restart_before_background_observe` | durable `ready|degraded` 已提交、authority **尚未**翻成 published；kill 后重启 → `published` |

### Oracle 4 —— after_stage 的硬杀落点由将死的进程自证

```json
"durable": {
  "ownerManifestExists": true,   "ownerManifestBytes": 419,
  "receiptPresent": true,       "receiptState": "ownership_committed",
  "receiptDurability": "sqlite_transaction_synchronous_FULL_committed",
  "receiptManifestSha256": "<64 hex>",
  "stagedAudioExists": true,    "stagedAudioBytes": 32044
}
```

且测试用**落盘 manifest 字节的 SHA-256** 与 receipt 中的摘要逐字比对，证明 receipt 确实
绑定到幸存的 manifest——重启只凭 authoritativeTaskId 即可同时定位二者。

### Oracle 6 —— 重复 recover 幂等

首轮 recover 返回 `abandoned` 并清空 receipt；重复 recover 返回 ≥400（不是第二个
cleanup owner）；receipt 表最终为空。

### Oracle 7 / 8 —— handoff 不等于产品成功

非 durable 的 handoff 帧永不使 `media_tasks` 呈现 `ready|degraded`；只有注入点 6 的
durable commit 才会，且它是**唯一**返回 `published` 的路径。

## 5. R4-3 八类损坏矩阵（9 / 9）

每一类都从「真实 capture 被真实 owned 进程硬杀在 durable receipt 之后」开始，在磁盘上
施加**恰好一种**损坏，再由**第二个 owned 进程**执行真实 recover。

| # | 损坏类 | 施加方式 | 结果 |
|---:|---|---|---|
| 1 | `missing` | 删除 owner.json | fail closed `CLEANUP_INCOMPLETE` |
| 2 | `torn` | manifest 截断为一半 | fail closed |
| 3 | `corrupt` | 非法 JSON | fail closed |
| 4 | `uncommitted` | 删除 receipt 行 | fail closed |
| 5 | `identity` | manifest 的 taskId 改成别的 task | fail closed |
| 6 | `hash` | 翻转 staged WAV 的最后一个字节 | fail closed |
| 7 | `length_shape` | manifest 的 byteLength +4 | fail closed |
| 8 | `path_escape` | staged WAV 换成指向根外的符号链接 | fail closed |

**8 / 8 fail closed**，且 fail-closed 的 recovery **不得删除**它无法验证的证据：
除 `missing`/`path_escape`（这两类本就是本轮自己移除或搬走的）外，manifest 必须仍在；
除 `uncommitted`（本轮自己删的行）外，receipt 必须仍在。

其余两例：
- **composite cleanup**：真实 recover → `abandoned`，ASR staging 与 acquisition sandbox
  均不存在，product-evidence 为空；重复 recover 不得二次清理。
- **fresh begin 保持单 sink**：在同一 scratch 根上重新启动 owned 进程并开始新 capture，
  第二个 capture 的 ticket 重放被拒，主 capture 的 chunk 正常被 `chunkAccepted`。

## 6. R4-4 / R4-5 restart、security 与 cleanup ownership（9 / 9）

| 用例 | 断言 |
|---|---|
| connecting phase | 重启后的 Runtime **不认识**旧进程的 grant（grant registry 是进程内状态）；GET 返回 404，`ok=false`、码为 `V3_MEDIA_CAPTURE_GRANT_INVALID`，**不含**任何 `ready`/`degraded`；轮询**恰好 1 次**后停止（不得无限重试）；对未知 grant 的 DELETE 被拒而非伪造撤销 |
| 新 worker 不复活旧 ticket | 旧进程签发的 ticket 在新进程中无法启动任何 capture |
| GET 404 语义 | 单独覆盖：停轮询、记录 recovery pending、绝不当成成功 |
| SIGTERM | 只向本轮记录的 PID 发信号；退出码 0；`/proc/<pid>` 消失 |
| 重复 recover 幂等 | 第二次 ≥400；receipt 表为空 |
| secret / 私有路径扫描 | ticket、session token、master token、scratch 绝对路径**均不出现在**任何 WS 帧中；原始 PCM 前 64 字节的十六进制不回显；公开 grant 不含 ticket/tabId；完成的 capture 不留 owner receipt |
| scratch 清理 | owned scratch 根在轮次结束时不存在 |
| 无浏览器 | `/proc/<pid>/exe` 解析为 python 解释器，argv[0] 基名不含 chrome |

## 7. 集中回归（61 §4，一次）

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | **0** | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | **0** | **229 / 229**（23 files） |
| 3 | `npx vitest run --maxWorkers=2` | **0** | **562 / 562**（67 files） |
| 4 | `npm run build` | **0** | PASS（Σ 4.66 MB） |
| 5 | `pytest tests/test_wp0_r4_real_uvicorn.py` | **0** | **19 / 19** |
| 6 | `pytest tests/test_wp0_r4_injection_points.py` | **0** | **8 / 8** |
| 7 | `pytest tests/test_wp0_r4_manifest_matrix.py` | **0** | **9 / 9** |
| 8 | `pytest tests/test_wp0_r4_restart_and_security.py` | **0** | **9 / 9** |
| 9 | 四个 R4 suite 合并复跑（带 ownership ledger） | **0** | **45 / 45** |
| 10 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | **0** | **6 / 6** |
| 11 | `pytest -k "capture or transcript or outline or fault or product" -q` | **0** | **187 passed** / 643 deselected |
| 12 | `node --test scripts/…/relay_ownership_contract.node-test.mjs` | **0** | **42 / 42** |
| 13a | `python3 -B …/verify-…-v10-contract.py` | **2** | **46 / 50** ← 阻塞 |
| 13b | `python3 -B …/verify-…-v10-mutations.py` | **2** | **14 / 15** ← 级联 |

### 7.1 第 13 项的可归类性

```
failedChecks = ["sourceEvidenceHashesCurrent",       ← 唯一真实失败
                "sourceScopeExtractorsValid",        ┐
                "sourceEmitSetEqualsFrozenInventory",├ 全部由第 1 项级联
                "discoveredCodeUniverseClosed"]       ┘
sourceInventoryDiff.missing = ["V3_MEDIA_CAPTURE_ORIGIN_MISMATCH"]
```

verifier 在摘要不匹配时 `continue` 并跳过该文件的 AST 抽取，故该码「消失」。实测该码在
修改后的 `app.py` 中**仍存在 2 处**；本轮三处改动只增加一个布尔标志与一个 `and` 子句，
**未新增、未删除、未重命名任何 `V3_MEDIA_*` 常量**。

mutations 唯一失败用例 `non_boundary_lexical_string_control` 期望 baseline `exit 0`，
观察到 `exit 2` 且 observedChecks 恰为上述四项——同一根因的级联。

## 8. secret scan 与清理

- R4 六个新文件扫描 `cookie` / `api[_-]?key` / `bearer <值>` / `authorization:` /
  `sk-…` → **0 个真实命中**（仅命中文档字符串中的 “bearer token” 一词）。
- 测试数据全部为固定占位（`media_task_` + 32 位、`BV1TEST`、`cap_` 风格 session、
  `doc-N`）；**不写真实域名、token、原始媒体或绝对私有路径**。
- ownership ledger 只写 PID、端口与 scratch 根**目录名**。
- 无外部网络访问；62 个 owned 进程全部由 harness 终止，结束后遗留 **0**。
- `/tmp/pytest-of-administrator` 与临时 ledger 已清理。

## 9. 环境事实（与产品无关）

本轮中途主机 `/` 曾被其它并发会话的 `/tmp/dlv3-*` scratch 占满至 100%，导致一段时期内
无法执行任何命令。恢复后另发现：把 pytest `--basetemp` 放在 `/mnt/c`（Windows NTFS
挂载）会让 `stat()` 无法呈现 `0700`，从而触发 sandbox 的私有目录校验失败——这是**测试
scratch 位置**问题，不是产品缺陷；改为使用原生文件系统后全绿。两者均已记录为环境事实。
