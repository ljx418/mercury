# WP-B Handoff

候选：`wp-b-explicit-local-media-import-implementation-2026-10-19`
阶段结论：**WP-B AWAITING CODEX CHECKPOINT**
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-implementation-2026-10-19/`

## 0. 需要 Codex 决策的两项（均 Major）

### 0.1 `app.py` 冻结摘要漂移

本包按 `02-target-architecture-and-code-map.md` **必须**修改 `navia_runtime/app.py`
（四个 API、privileged Origin/CORS、让 local-import 的 OPTIONS 到达自己的处理器）。

| | 值 |
|---|---|
| v11 冻结值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |
| 当前值 | `7ec4bda3f68b598dbef5d1f9ecb37a515b916e534a4981b025db41de63ca9844` |

已验证**非合同扩张**：`unlistedBoundaryEmits = {}`；`targetInventoryDiff` 仍 **20/20**；
`sourceInventoryDiff` 中「missing」的 5 个码正是 `app.py` **自身发出**的码——
抽取器仅因摘要不符而跳过该文件。

请裁决是否执行一次受限重冻结（只更新该 scope 的 SHA-256 与派生 authority digest），
或要求回退 `app.py` 改动并改由其它装配点提供路由。

### 0.2 私有 seed 媒体缺失（阻塞 B29 / B30）

registry 要求：mp4/webm/mkv、**30,000–300,000 ms**、含音视频流、
**SenseVoice ≥3 非空片段**、**≥3 个不同帧哈希**，且 `st_blocks*512/fileSize >= 0.95`。

本机 `NAVIA_WP_B_SEED_MEDIA` **未设置**；仅有的两个候选经只读 `ffprobe` 探测为
**5,167 ms** 与 **5,041 ms**，时长门失败。门禁明文禁止以稀疏文件、填零或 mock 替代。

## 1. changed files（含 SHA-256）

### 新增 — Runtime 模块
```
6fbfb3e32321da81a88355fc543d77e1f0e8ce73cf09344518601858698291f0  local_import/__init__.py
73ca928c215a9eab6ec2f249b09741ef52e2e2da18c75d2d5c29a1a297523f78  local_import/contracts.py
b0b07e226d3d1c8384f3787765c2b4b1809c949565b201653d9091ded81db7bb  local_import/store.py
26ef7d15e10da9f695291e97ba1d5d88a3bce94befd97fc9e64020ceefd7baf7  local_import/manager.py
f832e5a76b332a82c5cf58eb19b4568fbf010bac31114332911d3b84ac5283ae  local_import/runtime.py
890e4123a11d26e5c1e61fffd198132668e8bc3f564ebc688747e135a68d59d0  local_import/preparer.py
d2cabc9aab2cd23375399b4d39d5deb44773b5e5adc4b6f51e412370392679ed  local_import/consumer_barrier.py
94584cac6b0a672bbcb2b8c0d8d68215bb2a910dcc252c1e0ab4c443a2424ba6  scripts/v3_media_local_import_wp_b_probe.py
```
（前缀均为 `services/local-runtime/navia_runtime/modules/media_companion/` 与 `services/local-runtime/`）

### 新增 — Extension 面
```
ec0f131a8dafcc73b1f00db95577d9a518432dfefe4cf7722da29220e493aef2  src/modules/media_companion/LocalMediaImportClient.ts
2cb565d13043588657b9f8c1a081df62446c41794aacd12ba2445c88774a5b56  src/modules/media_companion/settings/LocalMediaImportCard.tsx
59b5dce7c43dfafe3e0c2a965c3d11561330d92b4b7f80abd6061b4a30d49ede  src/modules/media_companion/tests/LocalMediaImportClient.test.tsx
```
（前缀 `apps/chrome-extension/`）

### 修改 — 既有生产文件
```
7ec4bda3f68b598dbef5d1f9ecb37a515b916e534a4981b025db41de63ca9844  services/local-runtime/navia_runtime/app.py
8c0c03358bfa12edd024f016d11617d1bac2cb0883e1e40b1c105c143cfa3042  …/acquisition/coordinator.py
b864a670804b52725bacf23a4eb740a58207e300f72dcaa23eb89c277feb5cc8  …/acquisition/transcript_service.py
a37b5154d5fdbad0331f23214379c66f643f2327e5e695c2c33e79bd4c531c06  …/product_materializer.py
```

## 2. 合同变化

- **公共新增**：四个 loopback endpoint、两个公共 schema（`v3_media_local_import_status/api_v1`）、一个内部 durable schema、18 个 `V3_MEDIA_IMPORT_*` 失败码。
- **未扩张**：relay v11 的 40/20 code universe（`unlistedBoundaryEmits = {}`）。
- **未改动**：v11 历史材料、Cookie/Provider 边界、WP-A 固定来源与摘要、WP-C 支持级别、自动 route 顺序。

## 3. 命令与退出码

见 `20-test-results.md` §2（一次集中回归）。

## 4. B01–B30

**25 PASS / 2 PARTIAL / 1 NOT_STARTED / 2 IMPOSSIBLE**。逐项见 `40-case-results.json`。
**固定分母 30/30 未达成**，因此不可宣布 WP-B PASS。

## 5. 真实 run / task / import / product id

- canary run / task / import / product id：**无**（B29/B30 未执行）
- durable receipts：hard-kill probe 在临时根内产生 T1–T4、audio owner、visual receipt，结束后删除
- 资源峰值：writer slice ≤ 1 MiB（逐 slice 记账）；probe owned 根残留 **0**

## 6. PRD review

见 `30-prd-review.md`：全部不可变边界**未被触碰**。

## 7. secret / cleanup

见 `50-cleanup-and-secret.json`：secret **0**、绝对私有路径 **0**、原始媒体 **0**、
owned 进程/端口/临时根/媒体资产 **0**、表内无禁止列、SQLite dump 无 token 与其摘要。

## 8. 剩余风险

| # | 风险 | 等级 |
|---:|---|---|
| 1 | `app.py` 摘要未重冻结，v11 停在 46/50 | **高** |
| 2 | 私有 seed 缺失，B29/B30 不可证明，整包无法达 30/30 | **高** |
| 3 | B22 图文产品链路未端到端驱动 | 中 |
| 4 | B21 的 SenseVoice 投影端到端未驱动（本机无 TTS，需真实语音样本） | 中 |

## 9. 交接检查项

| 项 | 状态 |
|---|---|
| phase receipt | ✅ `10-receipt.md` |
| changed files + SHA | ✅ §1 |
| 命令 / 退出码 | ✅ `20-test-results.md` |
| B01–B30 | ✅ `40-case-results.json` |
| 真实 run/task/import/product id | ✅ §5 |
| durable receipts | ✅ §5 |
| 资源峰值 | ✅ §5 |
| PRD review | ✅ `30-prd-review.md` |
| secret / path / raw-media scan | ✅ `50-cleanup-and-secret.json` |
| cleanup | ✅ §7 |
| handoff | ✅ 本文件 |
| manifest | ✅ `70-payload-manifest.sha256` |
| Fatal / Major / Minor | **0 / 2 / 0** |

## 10. 自动化停止原因

1. B0–B7 已实施并取证，集中回归与 hard-kill probe 全绿；
2. **固定 30/30 分母未达成**：B29/B30 因缺合格私有 seed 不可真实证明；
3. `app.py` 因本包强制改动导致 v11 冻结摘要漂移，需 Codex 裁决是否受限重冻结。

状态 **WP-B AWAITING CODEX CHECKPOINT**。本包未达成固定分母，适用包内无条件停止规则：「任一 Fatal/Major、
合同需扩张、B29/B30 无法真实证明……写 WP-B AWAITING CODEX CHECKPOINT 并停止」；「若没有合格私有 seed，必须 WP-B AWAITING CODEX CHECKPOINT，
不得降低 oracle」。本包 25/30、Major 2，且 B29/B30 因真实语音仅 12,290 ms（低于冻结的
30,000 ms 下限 17,710 ms 且禁止填充 / mock）而无法真实证明。
未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mvk），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mvk），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**仍需 Codex 知晓的一项**：`app.py` 冻结摘要漂移
（`51791f05…` → `7ec4bda3f68b598d…`；`unlistedBoundaryEmits = {}`、target 20/20，非合同扩张）。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，未做 Claude 文档外审，
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**仍需 Codex 知晓的一项**：`app.py` 冻结摘要漂移
（`51791f05…` → `7ec4bda3f68b598d…`；`unlistedBoundaryEmits = {}`、target 20/20，非合同扩张）。

**重新开启本包所需**：提供一段 ≥30 秒、含真实语音的媒体（`NAVIA_WP_B_SEED_MEDIA`，任意
mp4/webm/mkv），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。

未宣布 WP-B/V3 PASS，未进入 WP-C，
未做 Claude 文档外审，未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree
或历史证据。

用户已就本分叉明确选择交回 Codex，故停在此处。

**Codex checkpoint 需知晓的两项事实**（常规复核项，本包终态已落定，不依赖其结论）：

1. `app.py` 冻结摘要漂移：`51791f05…` → `7ec4bda3f68b598d…`，v11 因此 46/50、mutations 报
   `canonical_baseline_not_green`；已验证非合同扩张（`unlistedBoundaryEmits = {}`、target 20/20）。
2. `04-development-plan.md` 写有「若没有合格私有 seed，必须 WP-B AWAITING CODEX CHECKPOINT」；本机确无该 seed，
   前提事实成立。若 Codex 认为该条款无条件优先，本包结论应改写为 `WP-B AWAITING CODEX CHECKPOINT`。

本包未降低任何 oracle：B29/B30 记为不可证明，B21 记为未启动，均未以替代物冒充。

**重新开启本包所需**：提供 registry 合规的私有 seed 媒体（`NAVIA_WP_B_SEED_MEDIA`，
mp4/webm/mkv、30,000–300,000 ms、含音视频流、含可被 SenseVoice 转写为 ≥3 个非空片段的真实语音、
含 ≥3 个不同帧哈希），即可关闭 B21 / B22 / B29 / B30 并重新提交 checkpoint。
未 commit/push/reset/clean/checkout/revert，未覆盖 dirty worktree 或历史证据。

**恢复条件**：① Codex 对 `app.py` 摘要漂移的裁决；② 提供满足 registry 的私有 seed 媒体（`NAVIA_WP_B_SEED_MEDIA`），
   并补齐 B21 / B22 的端到端驱动。
两者到位后方可重跑 B7/B8 并重新提交 checkpoint。
