# WP0 R4 Runtime / Worker Recovery Handoff（2026-10-17）

Candidate: `wp0-r4-2026-10-17`
阶段结论：**R4 AWAITING CODEX CHECKPOINT —— 命中 61 §5 停止条件**
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r4-2026-10-17/`

## 0. 需要 Codex 决策的唯一事项

R4-1..R4-5 的实现与测试全部完成并通过（**62 个真实独立 Uvicorn 进程**），但
**v10 verifier 退化**：baseline **46/50**、mutations **14/15**。根因单一且可归类：

fixture 的 `sourceInventoryEvidence.scopes[]` 用 **SHA-256 冻结了
`services/local-runtime/navia_runtime/app.py` 的字节**，而 R4 为关闭一个真实的跨连接
cleanup 归属缺陷必须修改它。

| | SHA-256 |
|---|---|
| fixture 冻结值 | `518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8` |
| R4 当前值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |

另外三个失败检查是**级联**：摘要不匹配时 verifier `continue` 跳过该文件的 AST 抽取，
于是恰好一个码「消失」：

```
sourceInventoryDiff.missing = ["V3_MEDIA_CAPTURE_ORIGIN_MISMATCH"]
```

该码在修改后的 `app.py` 中**仍存在 2 处**。本轮三处改动只引入一个布尔标志
(`owns_capture`) 与一个 `and` 子句，**未新增、未删除、未重命名任何 `V3_MEDIA_*` 常量**，
公共 endpoint / API / Origin / ticket TTL / 阈值 / SourceAuthority / 产品 terminal 定义
全部未变。**失败码集合未变，变的只是文件字节。**

mutations 的唯一失败用例 `non_boundary_lexical_string_control` 期望 baseline exit 0，
观察到 exit 2 且 observedChecks 恰为上述四项——同一根因的级联。

请 Codex 择一：

1. **授权重冻结**该 scope 的 `sha256` 为 `51791f05…d3f0a`（本轮倾向此项：改动只把
   cleanup 归属从「进程」收紧为「连接」，未改变任何码、阈值、消息或对外合同；受影响
   码可逐字复核）；
2. 或其它指示。

在得到指示前不做进一步修改。

## 1. changed files

### 新增（6 个，全部为测试资产，无一进入冻结 discovery roots）

```
services/local-runtime/tests/wp0_r4_child.py
  5a26abaa614a9a8a6e0d7f796c2dcf8fbb4cf7d8677f287e1da986b735309af9
services/local-runtime/tests/wp0_r4_harness.py
  75facae9b68c31fe6714fda43e98a089ae1ce12863c6935b15006e4a3bb4584a
services/local-runtime/tests/test_wp0_r4_real_uvicorn.py
  3522957d163d951c096e95f1b29394f189c7b95b61003f7ba138da63451236dd
services/local-runtime/tests/test_wp0_r4_injection_points.py
  9029976d3ac36b7bd67cea1a45c38193db512afbf2197c2433112a820b01c86e
services/local-runtime/tests/test_wp0_r4_manifest_matrix.py
  1d619c9d8b140998d8a7476b0e7dc85e5294dd2da351fc78fbc9ac36efbe3754
services/local-runtime/tests/test_wp0_r4_restart_and_security.py
  43255e2b45393a89003354a4eba6a56d2533f6b820c4e8b41f6a73218d6d6a2c
```

### 修改（生产代码 2 个）

```
services/local-runtime/navia_runtime/app.py          ← SHA 冻结
  51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a
  本轮改动仅 3 个 hunk：owns_capture 声明 / begin 后置位 / finally 的 and 子句
services/local-runtime/navia_runtime/modules/media_companion/acquisition/audio_ref.py
  99455d5e3d9260bfc9a0bc1c7db92add1423647e93b147c9eaabbbd083f25b2f
  本轮改动仅 1 个 hunk：recover_cleanup 的缺失 staging root 分支
apps/chrome-extension/chrome-mv3-unpacked/**           （npm run build 产物）
```

### 明确未修改

v10 schema、v10 fixture、20/40 inventory、FailureCode registry、固定阈值、公共 API、
Runtime endpoint、Origin、ticket TTL、SourceAuthority、产品 terminal 定义；
`services/local-runtime` 其余模块；全部 extension 源码；
以及 R0/R1/R1 纠偏 ×3/R2/R2 纠偏/R2 最终纠偏/R3 的全部历史证据目录。

## 2. 合同变化

- **内部合同变化**：有 2 项
  1. **连接级 cleanup 归属**：capture handler 仅在 `owns_capture` 时 abort 进程单例
     sink。未握手的连接（重放 ticket、binding 不符、第二个 socket）不再能终止他人
     capture。
  2. **缺失 staging 的零残留收据**：`recover_cleanup` 对「根本不存在 staging root」
     返回 `{"removed": false, "residualCount": 0}`，与 `cleanup()` 自身的缺失分支一致；
     消除 barrier 前中断 capture 永久不可恢复的问题。
- **公共合同变化**：**none**。
- **冻结材料**：**未修改**（schema / fixture / inventory 均未动）。触碰的是 fixture 所
  **冻结**的一个实现文件字节，见 §0。

## 3. 全部命令与退出码（61 §4，集中回归一次）

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **229 / 229** |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **562 / 562** |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `pytest tests/test_wp0_r4_real_uvicorn.py` | 0 | **19 / 19** |
| 6 | `pytest tests/test_wp0_r4_injection_points.py` | 0 | **8 / 8** |
| 7 | `pytest tests/test_wp0_r4_manifest_matrix.py` | 0 | **9 / 9** |
| 8 | `pytest tests/test_wp0_r4_restart_and_security.py` | 0 | **9 / 9** |
| 9 | 四个 R4 suite 合并复跑（带 ownership ledger） | 0 | **45 / 45** |
| 10 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 11 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **187 passed** |
| 12 | `node --test …/relay_ownership_contract.node-test.mjs` | 0 | **42 / 42** |
| 13a | `python3 -B …/verify-…-v10-contract.py` | **2** | **46 / 50** ← 阻塞 |
| 13b | `python3 -B …/verify-…-v10-mutations.py` | **2** | **14 / 15** ← 级联 |

## 4. 真实 Uvicorn 运行证据（脱敏）

| 指标 | 值 |
|---|---:|
| 真实 owned `uvicorn` 进程 | **62** |
| 唯一 PID | **62** |
| 唯一端口 | **62**（随机，区间 `44665`–`48583`） |
| 真实 hard kill（`os._exit(137)`） | 5 个注入点 |
| `TestClient` / mock WebSocket | **0** |
| 浏览器 | **0** |
| Provider / 六视频 | **0 / 0** |
| 声音播放 | **0** |
| 结束后 owned 进程 / scratch 残留 | **0 / 0** |

ledger 仅记录 PID、loopback 端口与 scratch 根**目录名**，不记录 ticket、token、PCM 或
绝对路径。

## 5. 逐工作包关闭证据

| 工作包 | 关闭证据 |
|---|---|
| **R4-1** | 19 例，62 个真实进程中的主体。ACK 的 `sequence`/`byteLength` 与所发字节精确对应；Origin 精确匹配且缺失亦拒；ticket 一次性 + replay 冻结码；binding 不符返回冻结码；奇数字节与空 capture 各自返回冻结码且零残留；WS 丢失后无任何私有临时 WAV；七种 stop reason 恒等保留 |
| **R4-2** | 6 个注入点逐点执行。5 个 `os._exit(137)` 硬杀，处置 `abandoned` + 四残留全零；注入点 5 进程存活且 handoff 帧从未送达；注入点 6 durable `degraded` 已提交而 authority 尚未 published，重启后 `published`。after_stage 的落点由**将死进程自证**：manifest 已 fsync、receipt 为 `sqlite_transaction_synchronous_FULL_committed`、worker 未启动，且 receipt 摘要与落盘 manifest 字节逐字一致 |
| **R4-3** | 八类损坏 8/8 fail closed，且 fail-closed recovery 不删除未验证证据。composite cleanup 后 acquisition / ASR / unpublished-product / active-sink 四残留全零；fresh begin 为单 sink，重放被拒而主 capture chunk 正常 |
| **R4-4** | 重启后 grant registry 为空：旧 ticket 无法启动 capture，旧 grant 的 GET 恰轮询 1 次后停并返回 recovery pending（绝不当作成功），未知 grant 的 DELETE 被拒而非伪造撤销；SIGTERM 只作用于 owned PID 且退出码 0；hard crash 一律走 existing recover，不伪造 finally |
| **R4-5** | secret scan 证明 ticket / session token / master token / scratch 绝对路径 / 原始 PCM 前 64 字节均不进入任何 WS 帧；公开 grant 不含 ticket/tabId；重复 recover 非第二 cleanup owner；`/proc/<pid>/exe` 断言为 python 解释器 |

## 6. PRD 覆盖

见 `30-prd-review.md`：61 §2 五个工作包、§3 十条 oracle、§2 四条硬约束逐条对照；
12 条架构不变量全部维持，其中 5 条本轮被强化（cleanup 归属、barrier 后 cleanup、
restart 不恢复旧状态、authenticated recovery、唯一 durable 成功）。

## 7. secret / cleanup

- R4 六个新文件扫描 `cookie` / `api[_-]?key` / `bearer <值>` / `authorization:` /
  `sk-…` → **0 个真实命中**（仅命中文档字符串中的 “bearer token” 一词）。
- 测试数据全部为固定占位；**不写真实域名、token、原始媒体或绝对私有路径**。
- 62 个 owned 进程全部由 harness 终止；结束后 owned 进程 **0**、owned scratch **0**。
- `/tmp/pytest-of-administrator` 与临时 ledger 已清理。
- 未启动 Chrome，未播放声音，未调用 Provider，未运行六视频。

## 8. 剩余风险

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | `app.py` 冻结摘要与实现不一致，verifier 停在 46/50 | **高** | 阻塞出门，等 Codex 决策（见 §0） |
| 2 | `recover_cleanup` 的缺失分支把「无 staging」判为零残留 | 低 | 与 `cleanup()` 自身缺失分支一致；只要 staging root 存在，八类损坏仍全部 fail closed（R4-3 8/8 实测） |
| 3 | 连接级 `owns_capture` 依赖 begin 成功 | 低 | begin 抛错时 sink 未激活，abort 本就多余；begin 成功后所有权才成立 |
| 4 | R4 的 durable-product 分支使用确定性 in-process provider | 中 | 冻结 SenseVoice 模型本机未安装；**模型二进制**被替换以让 durable 边界可达。validator、SRT normalizer 与全部状态机仍为生产类。真实 PCM→SenseVoice 属 R5 |
| 5 | marker expiry「只清 marker」在真实进程侧未单独取证 | 低 | 该逻辑属 Background 侧冻结实现，由 R1 既有静态门禁与 vitest 覆盖；R4 未修改它 |
| 6 | 未做真实 Chrome composition | 中 | 依授权未启动浏览器；R5 才做，且须先获 Codex 放行并强制 `--mute-audio` |

## 9. 交接检查项

| 项 | 状态 |
|---|---|
| changed files | ✅ §1（含 SHA-256） |
| 合同变化 | ✅ 内部：2 项／公共：**none** |
| 测试 | ✅ 定向 + 一次集中回归；13 项中 11 项 exit 0，第 13 项阻塞（§0） |
| 真实 fixture / 真实 Chrome | ✅ 62 个真实 Uvicorn 进程；Chrome **0** 次 |
| PRD 覆盖 | ✅ `30-prd-review.md` |
| 剩余风险 | ✅ §8 |
| Fatal / Major / Minor | **0 / 0 / 0**；待重冻结 **1** |
| Chrome / Provider / 六视频 / 声音 | **0 / 0 / 0 / 0** |
| secret scan | ✅ 0 个真实命中 |
| 遗留进程 / 临时资源 | ✅ **0 / 0** |
| commit / push / reset / clean / checkout / revert | ✅ **均未执行** |
| HEAD | ✅ 未变（`a303551a5bf89c26ff36b24ac06c7e30c334db27`，`main`） |
| dirty worktree | ✅ 保留，未覆盖，历史失败证据未删除 |
| 冻结材料 | ✅ 未修改 schema / fixture / inventory / 阈值 / 公共合同 |

## 10. Automation 停止原因

1. **61 §5 停止条件**：「需要改变…固定分母」—— fixture 冻结的 `app.py` 摘要需要 Codex
   决策，本轮不越权重冻结；
2. **用户常设规则**：「若确实必须修改冻结材料，立即停止并报告 Codex」；
3. **61 §5 出门条件**未满足（v10 baseline / mutation 非 exit 0），不得宣布完成；
4. 无 `R-stage may start` 授权，不得进入 R5；
5. 未做独立文档外审，未做阶段 closeout，未重复 R3 审计。

状态写为 **R4 AWAITING CODEX CHECKPOINT**。不宣布 R4 PASS，不进入 R5。
