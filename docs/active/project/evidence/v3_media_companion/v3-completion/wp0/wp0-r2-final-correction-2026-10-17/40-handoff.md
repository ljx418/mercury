# WP0 R2 最终合并纠偏 Handoff（2026-10-17）

Candidate: `wp0-r2-final-correction-2026-10-17`
阶段结论：**R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT**。R3 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r2-final-correction-2026-10-17/`

## 1. changed files

### 新增

无（本轮为对既有 relay 实现与测试的最小定向修改）。

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
  844eb68b8a6520524de88fc68ae55b725bdd8b1860bb6571de08033546c50596
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
  20ec9e5e1bd75b5bc8da7370ee550843391d9d5853ff8f00b91b2f9c3b4126e4
apps/chrome-extension/entrypoints/background/index.ts
  420f92cee028ef39545729b03703850c4b6bb77dab49db33b54dba5bdd2cb9dd
apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts
  8ccff0dd5cab7755b95bcf5fd0d23dbcc88c9a282bf2f247e946d346feae2a6b
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  b0f91367a27f8680cb707ae36358ef395a218f63f53169fc0ea25c16c373595f
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 明确未修改

冻结 source scope 内文件（`MediaCaptureController.ts`、
`media-capture-offscreen/main.ts` 等）、v10 schema / fixture / contracts、
权威文档、`stage-b-six-video-registry.json`、`services/local-runtime/**`、
以及 R0 / R1 / R1 纠偏 / R2 / R2 纠偏的全部历史证据目录 —— 均为**未修改、
未删除**。两个 v10 verifier 保持 50/50 与 15/15 即为佐证。

## 2. 合同变化

- **内部合同变化**：有 ——
  1. `OffscreenAudioPort.notifyProducerAbortOnce()` 成为**唯一**
     producer-abort owner（`#abortNotified` once-guard，每个 capture 重置）；
  2. 新增 `RuntimeCaptureTransport.terminalReached` 只读属性；
  3. `abort()` 改为只走带幂等守卫的 `#failClosed()`；
     `#settle()` 不再改写已结算终态；
  4. deadline timer body 实际调用共享谓词
     `exceedsCaptureDurationBound()`，并以 `Math.max(1, …)` 重武装；
  5. 全部 Transport-owned 失败统一为**单一** `#failClosed()`。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、20/40 inventory、
  FailureCode registry（20 码）、固定阈值、9 个冻结消息、公共 API、
  Runtime endpoint、Origin、ticket、Cookie/provider 合同。
- **冻结材料**：无修改，无需重冻结。

## 3. 逐 Major 关闭证据

| 编号 | 关闭证据 |
|---|---|
| **M-R2-C1**（单一 producer-abort owner） | 用例 `cumulative byte overflow via producer.postMessage performs one full closeout`（`producer.postMessage(chunk)` 进入**真实** Port CHUNK 分支）断言 abort **恰好 1**（`BYTE_LIMIT`）、公开 failure **恰好 1**、`socket.readyState === 3`、terminal `{ok:false,BYTE_LIMIT}`、`markerClears === [SESSION]`；`no-credit is PORT-owned…` 断言 Port-owned backpressure 路径 abort 同样**恰好 1**。harness 分列 `failures` / `portRequests` 两通道并镜像生产接线。静态门禁 M-R2-C1：once-guard 必须存在、Background `onCaptureAbort` 不得用裸 `sendAbort`、CHUNK 分支须 `!terminalReached` 才自行 abort。 |
| **M-R2-C2**（deadline exact boundary） | 用例 `elapsed === maxCaptureMs stays ACTIVE; +1 ms aborts` 与 `the timer body re-arms at the exact boundary instead of aborting`（max−1 空 · max 空 · max+1 失败）。静态门禁改为**定位 `#armCaptureDeadline()` 函数体**，断言其内含 `exceedsCaptureDurationBound(`、`#armCaptureDeadline(); return;`、`Math.max(1,` —— 作废原「全文件出现次数 ≥2」false-green 门禁。 |
| **C3**（终态不可改写） | 用例 `a deadline that wins the race keeps aborted against a late finalize`：进入真实 `cleanup_pending` 并令 `#finalizeRuntime()` 等待，deadline 先结算 `aborted`，随后迟到 socket close / completed frame / timer×3 **四项计数全部不变**；`a late abort() after a successful finalize cannot rewrite finalized` 断言 state 保持 `finalized`。静态门禁 M-R2-C3：`abort()` 须走 `#failClosed`、`#settle()` 须 `if (!this.#terminalSettled)`、不得有 `#fail(...)` 后紧跟 `abort(...)`。 |

## 4. 测试

### 定向（实现内循环，仅受影响套件）

| 套件 | 结果 |
|---|---:|
| 5 个受影响套件合计 | **95 / 95** |
| `RelayR2Invariants.test.ts` | **46 / 46** |
| `RuntimeCaptureTransport.test.ts` | **30 / 30** |

### 集中回归（每个子阶段**仅一次**）

见 `20-test-results.md §2`：typecheck 0 · media_companion **212/212**（22 files）·
全量 **545/545**（66 files）· build 0（Σ 4.66 MB）· 静态合同 **32/32** ·
runtime barrier **6/6** · runtime focused **180 passed** ·
v10 baseline **50/50**（inventory 40/40，unlisted `{}`）· v10 mutations **15/15**。

**全绿，零产品失败。**

## 5. 真实 fixture / 真实浏览器证据

- 真实 **Chrome fixture**：**0 次**（本轮不需要浏览器）。
- 真实 Provider / 六视频 fresh run：**0 次**。
- 真实产品 run：**0 次**。
- 声音播放：**0 次**。
- 可见 Chrome / 原生弹窗 / 焦点抢占 / UIAutomation：**0 次**。

因此**未触发**「若意外必须用 Chrome，先停下通知用户」的前置条件；
也未产生任何需要 `--mute-audio` 的实例。

composition 证据以**真实生产类 + 真实接线边界**给出：
`OffscreenAudioPort`（真实 Port 入站分支）+ `RuntimeCaptureTransport`
（真实 owner 状态机与 marker）+ `producer.postMessage()`（真实 Port 消息
边界）+ 假时钟 / 假 socket（仅替换浏览器/网络原语，owner、adapter、
router、状态机全部为真实生产类）。

## 6. PRD 覆盖

见 `30-prd-review.md`：M-R2-C1 / M-R2-C2 / C3 全部关闭；13 条架构不变量
全部维持；四类上限在证据中分列，无任何一条用背压冒充累计字节或时长上限。

## 7. 剩余风险

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | `maxCaptureBytes` 测试 seam 若被误传入 production 值 | 低 | 默认参数为 `RELAY_V10.maxCaptureBytes`，仅依赖注入可覆盖；背景端接线未传该参数 |
| 2 | `#abortNotified` 依赖 `sendStart()` 重置 | 低 | 每次新 capture 必发 `start`；若将来存在不经 `sendStart()` 的 reuse 路径需复核 |
| 3 | 边界语义为**闭区间**（`elapsed === maxCaptureMs` 允许） | 低 | 已由静态门禁 + 行为用例双向锁定；与冻结阈值语义一致 |
| 4 | 静态门禁仍是源码文本匹配 | 低 | 已限定到**函数体**而非全文件计数，且每条都有对应行为用例作 oracle |
| 5 | 未做真实 Chrome composition | 中 | 依授权未启动浏览器；若后续需要，须 `--mute-audio` 并另行授权 |

## 8. Automation 停止原因

自动化已**主动停止**于 R2 最终合并纠偏边界，等待 Codex checkpoint：

1. 用户明确要求「最终状态写 R2 FINAL CORRECTION AWAITING CODEX CHECKPOINT，
   随后停止，不得宣布 R2 PASS，不得进入 R3」；
2. 用户明确要求「Codex 只复核三条新增生产 composition 用例；通过即直接
   放行 R3，不再进行 R2 文档外审」；
3. 无 `R-stage may start` 授权，不得进入 R3 或 WP0 下一子阶段；
4. §5.1 分层：纠偏轮**不触发**阶段 closeout 审计，也未做 immutable
   candidate 重打。

## 9. 交接检查项

| 项 | 状态 |
|---|---|
| changed files | ✅ 见 §1（含 SHA-256） |
| 合同变化 | ✅ 内部：有（见 §2）／公共：**none** |
| 测试 | ✅ 定向 + 一次集中回归，全 exit 0 |
| 真实 fixture / 真实 Chrome | ✅ 0 次（不需要），已说明 |
| PRD 覆盖 | ✅ 见 `30-prd-review.md` |
| 剩余风险 | ✅ 见 §7 |
| Fatal / Major / Minor | **0 / 0 / 0**；待重冻结 **0** |
| Chrome / Provider / 六视频 / 声音 | **0 / 0 / 0 / 0** |
| secret scan | ✅ 无 Cookie / key / token / 原始媒体 / 绝对私有路径 |
| 遗留进程 | ✅ navia 自身 **0** |
| commit / push / reset / clean / checkout / revert | ✅ **均未执行** |
| HEAD | ✅ 未变 |
| dirty worktree | ✅ 保留，未覆盖，历史失败证据未删除 |
| 交接包 | ✅ 未跟踪文件，**未执行 `git clean`** |
