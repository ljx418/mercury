# WP0 R3 Controller Integration Handoff（2026-10-17）

Candidate: `wp0-r3-2026-10-17`
阶段结论：**R3 AWAITING CODEX CHECKPOINT —— 命中 61 §5 停止条件**
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r3-2026-10-17/`

## 0. 需要 Codex 决策的唯一事项

R3-1..R3-5 的实现与测试全部完成并通过，但 **v10 verifier 退化到 46/50**，根因单一
且可归类：

`docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json` 的
`sourceInventoryEvidence.scopes[]` 用 **SHA-256 冻结了
`apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts`
的字节**。R3 为关闭「启动窗口内可产生第二 socket / Port / Offscreen document」
这一 R3-1 缺陷必须修改该文件。

| | SHA-256 |
|---|---|
| fixture 冻结值 | `b344caf3be26a2264867ce0453d6dddbffed06adb02746d58136429600d71888` |
| R3 当前值 | `325d0b59fbd20072689c2cb7bcd46cb53ad1564c4cd6f36a6edbc4acb7f8991c` |

verifier 的另外三项失败（`sourceScopeExtractorsValid`、
`sourceEmitSetEqualsFrozenInventory`、`discoveredCodeUniverseClosed`）是**级联**：
摘要不匹配时 verifier 直接 `continue` 跳过该文件的 AST 抽取，于是 5 个 Controller
失败码「消失」。用冻结抽取器单独验证，修改后的 Controller 仍被完整抽出 8 个码——
**失败码集合没有变，变的只是文件字节**。

请 Codex 在以下三者中择一：

1. **授权重冻结**该 scope 的 `sha256` 为 `325d0b59…f7b8991c`（本轮倾向此项：
   Controller 本就是 relay 边界内的实现文件，R3 的改动只收紧了编排，未改变任何
   失败码、阈值或消息形状；抽取结果可逐字复核）；
2. 要求把单启动守卫**移出** Controller（例如放在 `background/index.ts` 的入口
   守卫），使冻结文件恢复原字节 —— 但这会在 Background 增加一层编排状态，需 Codex
   判断是否违反「单一编排者」；
3. 其它指示。

在得到指示前**不做任何进一步修改**。

## 1. changed files

### 新增

```
apps/chrome-extension/src/modules/media_companion/tests/RelayR3ControllerComposition.test.ts
  fd7f5f86c74dd06e2e8e74e93b0f513b69b279e24a3c5d5bd48fdfcf601d4130
```

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
  46af1b57c0afc7d39fc01884a443b2123c1a4b41e99342b2e17c682de9e2e015
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
  3288ced5b1bbf5fc9d6a28c59e0068c0af11e17a679f9f72bb79777534eca399
apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts   ← 冻结摘要
  325d0b59fbd20072689c2cb7bcd46cb53ad1564c4cd6f36a6edbc4acb7f8991c
apps/chrome-extension/entrypoints/background/index.ts
  802dbbb9c17ddd938b5713378c0c9244dfab550fc735d9ae9d14488d03d408e5
apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts
  67dd0688eda8b9faf8343010dc61495cbcfb03db0dcccf3aae1d679a3a779160
apps/chrome-extension/src/modules/media_companion/tests/RuntimeCaptureTransport.test.ts
  08a069557a270ae05de1238858fbdb74d674f2536e62cd321f920c687c60c9af
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  7c7e10478948d17664c2e17dfb3c98fbe52303ff5a5a27acda77bbdecfd72db6
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 明确未修改

v10 schema、v10 fixture、20/40 inventory、FailureCode registry、
`services/local-runtime/**`、冻结阈值、公共 API、Runtime endpoint、Origin、
ticket TTL、Cookie/provider 合同，以及 R0 / R1 / R1 纠偏 ×3 / R2 / R2 纠偏 /
R2 最终纠偏的全部历史证据目录（均未修改、未删除）。

## 2. 合同变化

- **内部合同变化**：有，共 8 项（详见 `10-receipt.md` §1.1–§1.8）
  1. `MediaCaptureController` 新增 `#starting` 单启动守卫与 `starting` 状态；
  2. 七个 start 失败点统一收口到私有 `#failStart()`（含 `relay.disconnect()`）；
  3. `relayFacade.abort` 改走 `OffscreenAudioPort.notifyProducerAbortOnce()`；
  4. `RuntimeCaptureTransport` 新增 `#armCleanupTimeout()`（复用冻结
     `RELAY_V10.cleanupTimeoutMs`）；
  5. 新增 `#settledTerminal` 与单调的 `markProducerReady()`；
  6. `stop()` / `awaitTerminal()` 在已结算时直接返回已结算终态；
  7. `OffscreenAudioPort` 的 `#onMessage` 增加统一 session 门禁（覆盖五条入站消息）；
  8. `OffscreenAudioPort.disconnect()` / `#onDisconnect()` 释放 capture-local 的
     `boundDocumentId` 与 `abortNotified`。
- **公共合同变化**：**none**。九消息集合、20 码 registry、全部固定阈值、公共 API、
  Runtime endpoint、Origin、ticket TTL、Cookie/provider 合同未改。
- **冻结材料**：**未修改**（schema / fixture / inventory 均未动）。触碰的是 fixture
  所冻结的一个实现文件字节，见 §0。

## 3. 全部命令与退出码（61 §4，集中回归一次）

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **229 / 229**（23 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **562 / 562**（67 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | **42 / 42** |
| 6 | `python3 -m pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `python3 -m pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** |
| 8 | `python3 -B …/verify-…-v10-contract.py` | **2** | **46 / 50** ← 阻塞 |
| 9 | `python3 -B …/verify-…-v10-mutations.py` | **2** | 随第 8 项级联 |

定向（实现内循环）：R3 composition 17/17；媒体子树收尾 229/229；
静态门禁收尾 42/42。

## 4. 逐工作包关闭证据

| 工作包 | 关闭证据 |
|---|---|
| **R3-1** | `refuses a duplicate start while the first is still awaiting Runtime`：启动进行中二次 `startArmed` / `arm` / `prepare` 全返回冻结 `ALREADY_ACTIVE`；最终 1 socket / 1 document / 1 次 producer `start`。静态门禁：`#starting` 必须存在且在 `startArmed` 首部；`#failStart` 恰 6 个调用点；Background 恰 1 Controller / 1 router / 1 relay facade。 |
| **R3-2** | `resolves no streamId, opens no Offscreen document and accepts no chunk before started`：`streamIdCalls = 0`、producer 收到 0 条消息、`producerReady = false`、`credit = 0`、state `connecting`、提前 chunk 被真实 `offerChunkMessage` 拒为 `PROTOCOL_INVALID`。 |
| **R3-2/R3-4** | 6 个 start 失败点逐一断言：Runtime start 失败 / streamId 失败 / Port 被拒 / 缺权限 / tab 非法（另加 binding 不匹配）→ socket closed、Port 断开、document 关闭、marker 清一次、公开 failure 恰好一次。 |
| **R3-3** | 四种 reason 的 `beginStop → sendQuiesce → stop` 顺序与 Runtime `stop.reason` 冻结；in-flight 非零时 Runtime 只发过 `start`，ACK 后 `stop` 发出瞬间 backlog `{0,0,0}`；producer 永不发 `stopped` → 假时钟过 `cleanupTimeoutMs+1` → 终态 `PORT_DISCONNECTED`、document 关闭；重复 stop 与迟到事件不新增 marker / failure / marker clear。 |
| **R3-4** | idle stop 与 producer `capture_error` 都关闭 document 且 `status()` 可解释；**双轮 composition**：新 `captureSessionId`（符合 `cap_+32`）、新 documentId、新 Port、新 socket；旧 session 的 `ready`/`chunk`/`quiesced`/`stopped` 全被拒为 `BINDING_MISMATCH` 且 counters 逐字段不变；突发旧事件下 owner 只记录一次归一化失败；**每轮 abort 恰好一次**；两轮 marker 各清一次、两轮 document 均关闭；旧 Port 无法顶替新 Port（`ALREADY_ACTIVE`）。 |
| **R3-5** | 24 步 composition 直接 import 冻结 fixture 的 `positiveTrace`，逐步驱动真实生产类并断言每步 `requiredState`：五相位按序、每条 6 冻结字段、终态后零新增发布、TTL 每 capture 恰写一次、streamId 与 producer `start` 各一次、first credit 在 `ready` 之后且 `ackSeq = -1`、ACK 是唯一 credit 来源、Runtime `stop` 发出瞬间 backlog 全零且 `sequence = 2`、三项 cleanup 计数为 0、Port 断开 + document 关闭。 |

## 5. 真实 run 计数

| 项 | 次数 |
|---|---:|
| Chrome 启动 | **0** |
| Provider 请求 | **0** |
| 六视频 fresh run | **0** |
| 真实产品 run | **0** |
| 声音播放 | **0** |
| 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation | **0** |

本轮不需要浏览器，未触发 `--mute-audio` 前置条件，也未产生任何需要静默的实例。

composition 证据由**真实生产类 + 真实接线边界**给出；仅替换 `WebSocket`、
`setTimeout`、`chrome.offscreen`、`chrome.tabCapture`、`chrome.runtime.getContexts`
五类浏览器/网络原语；被验收的 Controller、router、transport、Port owner、
producer bootstrap 与状态机全部为生产实现。

## 6. PRD 覆盖

见 `30-prd-review.md`：61 §2 五个工作包、§3 十项 oracle、§4 退出条件逐条对照；
13 条架构不变量全部维持，其中 3 条本轮被强化（两阶段停止、单一 control plane、
每个 idle/error 关闭 Offscreen），新增 1 条（旧 session 事件不得影响当前 capture）。

## 7. secret / cleanup

- 变更源文件扫描 `cookie` / `api[_-]?key` / `bearer ` / `authorization:` / `sk-…`
  → **0 命中**。
- 测试数据全部为固定占位（`"t".repeat(43)`、`bilibili/video/BV1TEST`、
  `cap_a…`/`cap_b…`、`doc-1`/`doc-2`）；无真实域名、token、原始媒体、绝对私有路径。
- 无外部网络访问；假时钟 / 假 socket；无临时文件或持久残留。
- navia 自身遗留测试进程 **0**；无 Chrome 进程（主机上另有其它仓库的 vitest 进程，
  与 navia 无关）。
- 交接包为**未跟踪文件**，未执行 `git clean`。

## 8. 剩余风险

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | `MediaCaptureController.ts` 的冻结摘要与实现不一致，verifier 停在 46/50 | **高** | 阻塞出门，等 Codex 决策（见 §0） |
| 2 | `#armCleanupTimeout` 只覆盖「等待 `stopped`」段 | 低 | 该段之后由既有冻结 `finalizeTimeoutMs` 兜底；两段合起来保证 `stop()` 一定终止 |
| 3 | `stop()` 在已结算时返回 `#settledTerminal` | 低 | 与 `awaitTerminal()` 行为一致；已被静态门禁锁定「新 waiter 只能在未结算时创建」 |
| 4 | `#settledTerminal` 在 capture 期间保留终态对象 | 低 | 只含固定码与统计量（chunks / capturedMs / transcript），不含 ticket / streamId / PCM / 绝对路径；每次 `#reset()` 清空；已被静态门禁锁定 |
| 5 | `draining` 期间接受 chunk，理论上 producer 可延迟 drain | 低 | 仍受单信用、sequence 纪律、outstanding 上限与整轮 `maxCaptureMs` 上限约束，并由 `cleanupTimeoutMs` 兜底；且 `#offscreenStopped` 起立即关闭 |
| 6 | 旧 session 的迟到事件会使**当前** capture fail-closed | 低（刻意） | 与 R2 已冻结的 `chunk` → `BINDING_MISMATCH` → fail-closed 行为一致，保持五条入站消息同一规则；代价是偶发的误杀换取了不可能的静默串话 |
| 7 | 未做真实 Chrome composition | 中 | 依授权未启动浏览器；若后续需要，须 `--mute-audio` 并另行授权 |
| 8 | 全量回归耗时 1048 s | 低 | 已核实为主机 CPU 争用，非死锁或产品问题 |

## 9. 交接检查项

| 项 | 状态 |
|---|---|
| changed files | ✅ §1（含 SHA-256） |
| 合同变化 | ✅ 内部：有（8 项）／公共：**none** |
| 测试 | ✅ 定向 + 一次集中回归；8/9 项 exit 0，第 8/9 项阻塞（§0） |
| 真实 fixture / 真实 Chrome | ✅ 0 次（不需要），已说明 |
| PRD 覆盖 | ✅ `30-prd-review.md` |
| 剩余风险 | ✅ §8 |
| Fatal / Major / Minor | **0 / 0 / 0**；待重冻结 **1** |
| Chrome / Provider / 六视频 / 声音 | **0 / 0 / 0 / 0** |
| secret scan | ✅ 0 命中 |
| 遗留进程 / 临时资源 | ✅ 0 / 0 |
| commit / push / reset / clean / checkout / revert | ✅ **均未执行** |
| HEAD | ✅ 未变（`a303551a5bf89c26ff36b24ac06c7e30c334db27`，`main`） |
| dirty worktree | ✅ 保留，未覆盖，历史失败证据未删除（107 未跟踪 / 86 修改 / 85 删除，均未触碰） |
| 冻结材料 | ✅ 未修改 schema / fixture / inventory / 阈值 / 公共合同 |

## 10. Automation 停止原因

1. **61 §5 停止条件**：「需要改变…固定分母」—— fixture 冻结的
   `MediaCaptureController.ts` 摘要需要 Codex 决策，本轮不越权重冻结；
2. **用户常设规则**：「若确实必须修改冻结材料，立即停止并报告 Codex」；
3. **61 §4 固定出门条件**未满足（第 8/9 项 exit 非 0），不得宣布完成；
4. 无 `R-stage may start` 授权，不得进入 R4；
5. 未做独立文档外审，未做阶段 closeout。

状态写为 **R3 AWAITING CODEX CHECKPOINT**。不宣布 R3 PASS，不进入 R4。
