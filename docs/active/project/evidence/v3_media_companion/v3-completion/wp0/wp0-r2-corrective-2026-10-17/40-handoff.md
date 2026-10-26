# WP0 R2 限定纠偏 Handoff（2026-10-17）

Candidate: `wp0-r2-corrective-2026-10-17`
阶段结论：**R2 CORRECTIVE AWAITING CODEX CHECKPOINT**。R3 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r2-corrective-2026-10-17/`

## 1. changed files

### 新增

无（本轮全部为最小修改 + 修正既有测试）。

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
  4cc33d10f87655295f66756c92b593984b8e70c004c4a0756e7ab3eb4c7ddc1a
apps/chrome-extension/entrypoints/background/index.ts
  cc980bd210d80392b74e1da528eb585888a5299d685d585c3ed342d17b6699fc
apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts
  3debc62d7d2c9829cbd675501062ff0748f067af80f30e1625f54e0e84256516
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  394c6ee3d42921d1a2ee853b99b7778326ed4d11303a0ff777af6ffbff5144ce
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 明确未修改

冻结 source scope 内文件（`MediaCaptureController.ts`、
`media-capture-offscreen/main.ts` 等）**未修改** —— 这也是两个 v10 verifier
保持 50/50 与 15/15 的原因。`services/local-runtime/**`、冻结 schema /
fixture / contracts / 权威文档、`stage-b-six-video-registry.json`、R0 / R1 /
R2 全部历史证据目录亦未修改或删除。

## 2. 合同变化

- **内部合同变化**：有 ——
  1. owner 新增**主动** wall-clock deadline handle（`#deadlineTimer` +
     `#armCaptureDeadline` / `#clearCaptureDeadline`），起点与 restart
     marker 的 `startedAt` 同源；
  2. 新增 `onCaptureAbort` 依赖钩子，让自触发的 deadline 也能终止
     Offscreen producer（复用既有冻结 `abort` Port 路径）；
  3. 新增两个**纯边界谓词**
     `exceedsCaptureByteBound` / `exceedsCaptureDurationBound`；
  4. 新增**仅内部测试用** `maxCaptureBytes` seam（production 默认仍
     `RELAY_V10.maxCaptureBytes`）。
- **公共合同变化**：**none**。未修改冻结 schema、fixture、40/20
  inventory、FailureCode registry（20 码）、固定阈值、9 个消息集合、公共
  API、Runtime endpoint、Origin、ticket、Cookie/provider 合同。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **206 / 206**（22 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **539 / 539**（66 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test …/relay_ownership_contract.node-test.mjs` | 0 | **30 / 30** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** |
| 8 | `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50**（40/40 inventory，unlisted `{}`） |
| 9 | `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |

## 4. 测试计数

| 类别 | 计数 |
|---|---:|
| R2 不变量测试（纠偏后） | **40**（原 28：删 1 false-green，增 13） |
| 静态所有权合同（纠偏后） | **30**（原 28：R2-5 改写 + C1 / C2 新增 2） |
| media_companion 子树 | **206**（22 files） |
| 扩展全量 | **539**（66 files） |
| Runtime barrier | 6 |
| Runtime focused | 180 |
| v10 baseline / mutation | **50 / 50** · **15 / 15** |

## 5. 真实 run / build / task / candidate ID

- 真实产品 run：**未执行**
- Chrome：**0 次** · Provider：**0 次** · 六视频 fresh run：**未启动**
- task ID：**无**
- build：`npm run build` 已执行
- candidate ID：`wp0-r2-corrective-2026-10-17`（**非** immutable candidate）

## 6. PRD / 架构覆盖

见 `30-r2-correction-prd-review.md`：Codex R2 两项 Major 逐条关闭；
`61-…` §3 的 6 类必需测试逐条落实；§2 的四项约束（单一 owner / 无第二
control plane / 无公共合同变化 / 低资源测试）全部满足；架构不变量 12 项
满足（其中「超限 enqueue 前 abort」「采集上限由 owner 强制执行」本轮强化）。

## 7. cleanup / secret scan

- Chrome 0 次、Provider 0 次、六视频 0 次、真实产品 run 0 次
- 无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径进入源码或证据
- `onCaptureAbort` 只传固定归一化失败码，不传原始异常文本
- 测试 seam 仅接受数值，不接受任何字符串或凭据
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并在结束时清理
- 结束前无遗留测试进程

## 8. Fatal / Major / Minor

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R2-01（主动 deadline）与 M-R2-02（累计字节真实边界）关闭 |
| Minor | 0 | — |
| 待重冻结 | **0** | v10 50/50 + 15/15 保持绿（exit 0）；未修改任何冻结 source scope 文件 |

## 9. 复核中新发现并修复的生产收口缺陷

按 Codex M-R2-02 §3.5-3.7 补「完整 fail-closed」断言时，发现
`offerChunkMessage()` 的累计字节 / 时长边界此前**只调用 `#fail()`**，
而生产 `reportFailure` 接线仅记录、**不 abort**。因此累计字节越界在生产中
只上报错误码，却**不**通知 producer、**不**关闭 Runtime socket、**不**
settle terminal、**不**清 marker。

**修复**：主动 deadline 与 enqueue 边界统一到单一私有 `#failClosed()`，
按固定顺序完成「仅一次失败码 → producer abort（既有冻结 Port）→
关闭 Runtime socket → settle 失败 terminal（内部清 marker 与全部
timer）」，并带幂等守卫保证至多一次。harness 同步改为**镜像生产接线**
（Port owner `onFailure` → `transport.abort()`）并让 `onMarker` /
`clearMarker` 可观测，因此相关断言是行为证明而非字符串搜索。

## 10. 对上一轮证据的更正（显式撤回）

上一轮 `wp0-r2-2026-10-17/10-r2-phase-receipt.md` 与
`40-r2-handoff.md` 中以下表述**不成立，予以撤回**：

- 「本轮唯一真实缺口已最小修复并被测试与静态门禁双重锁定」——
  该用例只循环 40 次，被 32-chunk 背压先拒绝，**从未触达** 512 MiB
  累计上限，属 false green；
- 「采集时长与总字节上限从未被强制执行 → 已修复」——时长部分仅在
  `offerChunkMessage()` 被动检查，**不是**主动截止，静默超时仍不收口。

本轮以 §3 的命令与 §4 的计数替代，并新增 C1 / C2 行为测试与静态门禁。

## 11. 自动化开发停止原因

R2 限定纠偏（仅 M-R2-01、M-R2-02）已实施并自验证通过：

- owner 具备**主动** wall-clock deadline，静默状态到点即产生固定
  `DURATION_LIMIT`、通知 producer abort、关闭 Runtime socket、settle 失败
  terminal、清理 marker 与全部 timer，且与 stop / disconnect 竞争时**至多
  一次**失败；
- 累计 `maxCaptureBytes` 以纯谓词 + 内部 seam 用**低资源确定性**方法证明
  exact-boundary / one-sample-over，并证明拒绝发生在 enqueue / sequence /
  counter 之前，四项计数器**零污染**；
- 原 32/33 与 outstanding raw-byte 背压测试全部保留，并与上述两类上限在
  证据中分列；
- 固定回归全部 exit 0，v10 50/50 + 15/15 保持绿，未触发重冻结。

按 `61-codex-r2-corrective-development-and-acceptance.md` §6 与用户指令，
在 R2 纠偏后停止，状态 **R2 CORRECTIVE AWAITING CODEX CHECKPOINT**，
不进入 R3，不自行宣布 R2 PASS。

## 12. 下一门禁

1. Codex 复核本轮纠偏实现与证据（重点：主动 deadline 收口、累计字节边界
   证明、上一轮 false-green 表述的撤回）；
2. Codex 明确 `R3 may start`。

在此之前不进入 R3。
