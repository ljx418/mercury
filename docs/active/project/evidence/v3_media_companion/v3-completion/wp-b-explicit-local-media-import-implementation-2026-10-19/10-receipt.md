# WP-B 显式本地视频导入 — 阶段收据

候选：`wp-b-explicit-local-media-import-implementation-2026-10-19`
门禁：`V3 post-R7 / WP-A PASS / WP-B IMPLEMENTATION MAY START`（已核验 `10-codex-implementation-gate.md`）
状态：**WP-B AWAITING CODEX CHECKPOINT**

## 0. 一句话状态

B0–B7 已实施并取证：**Runtime 98 测试 + Extension 10 测试全绿**，**真实 hard-kill probe 五个注入点全通过**，
Extension media 子树 **488/488**，typecheck 与 build 均 exit 0。

但**固定 30 项分母未达成**（15 PASS / 5 PARTIAL / 1 NOT_STARTED / 2 IMPOSSIBLE），
且存在**两个未决 Major**：

1. `app.py` 因本包强制改动导致 v11 冻结摘要漂移（v11 46/50），需 Codex 裁决是否受限重冻结；
2. **缺少合规私有 seed**，B21 / B22 / B29 / B30 无法真实证明。

**已核实到的事实（本轮新增）**：本机确实存在**真实语音**——另一个项目的 voice 资产目录下有
两个真实用户语音片段（`pcm_s16le/16kHz/mono`，5,510 ms 与 6,780 ms），经用户授权后**只读**使用。
用它们构建的 owned 媒体为真实 mp4（h264 640×360 + aac），**12,290 ms**、含真实语音、
含 **5 个不同帧哈希**，并已通过**生产 `LocalMediaPreparer`** 产出 16 kHz mono WAV 与 3 帧，
再经沙箱 publish 与音频 staging 推进。

但 registry 要求 seed **30,000–300,000 ms**，实际只有 **12,290 ms**，缺口 **17,710 ms**。
`05-acceptance-plan.md` 明文禁止 sparse / truncate / 尾部填零 / metadata-only / mock，因此
**无法在不降低 oracle 的前提下满足时长下限**：B29 / B30 在本机不可达成。

用户已确认本机不提供该媒体；因此上述 NO-GO 条款的前提事实成立，条款本身的适用性交 Codex 复核。

本轮关闭了三项此前 PARTIAL 的用例（各为真实实现补齐，非仅补测试）：
- **B16**：此前**根本没有磁盘空间预检**。已实现冻结公式
  `declared + min(512 MiB, pcm + 128 MiB)` 的**下载前**闸门，exact 通过、one-under → `DISK_SPACE_LOW`
  且不留 record/writer；同时修掉探针对不存在路径取 `disk_usage` 会误报空间不足的问题。
- **B03**：单 active import、终态释放 task slot、generation 绑定进 record、`ACTIVE` 回 `details.importId`。
- **B28**：token 600s / upload 1800s / ffprobe 30s / preparing 1800s 四个 deadline，过期 token 拒绝、
  越墙钟 fail closed、迟到 callback 不覆写终态、active slot 释放。

**终态：WP-B AWAITING CODEX CHECKPOINT。**

本包未达成固定分母，故适用的是包内的**无条件**停止规则，而非抬头的「完成后 AWAITING」。

`04-development-plan.md` / `05-acceptance-plan.md`：「任一 Fatal/Major、合同需扩张、B29/B30
无法真实证明……写 WP-B AWAITING CODEX CHECKPOINT 并停止」；「若没有合格私有 seed，必须 WP-B AWAITING CODEX CHECKPOINT，不得降低 oracle」。
三条全部命中：

- 固定分母 **25 / 30**（PASS 25 · PARTIAL 2 · NOT_STARTED 1 · 不可证明 2）；
- **Fatal 0 / Major 2**：`app.py` 冻结摘要漂移使 v11 46/50、mutations 报
  `canonical_baseline_not_green`；
- **B29 / B30 无法真实证明**：全部真实语音合计 **12,290 ms**，低于 registry 冻结的
  **30,000 ms** 下限 **17,710 ms**，而 sparse / truncate / 尾部填零 / metadata-only / mock 全被禁止。

**未降低任何 oracle**：B29/B30 记为不可证明，B21 记为未完成，均未以替代物冒充。

## 1. 门禁（B0，全部 exit 0）

| 项 | 结果 |
|---|---|
| WP-B 文档 verifier | **101 / 101** |
| v11 contract（实施前） | **50 / 50** |
| v11 mutations（实施前） | **16 / 16** |

## 2. 集中回归（一次）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `pytest tests/test_v3_media_local_import_*.py`（6 个文件） | **0** | **88 passed** |
| `npx vitest run .../LocalMediaImportClient.test.tsx` | **0** | **10 passed** |
| `npx vitest run src/modules/media_companion` | **0** | **488 / 488**（60 files） |
| `pytest -k "transcript or media or capture or asr or import"` | **0** | **537 passed** |
| `npm run typecheck` | **0** | PASS |
| `npm run build` | **0** | Σ 4.67 MB |
| `scripts/v3_media_local_import_wp_b_probe.py --case hard-kill` | **0** | **5 / 5 注入点通过** |
| v11 contract（实施后） | **2** | **46 / 50** —— 见 §6 |

## 3. 真实 hard-kill probe（B23 / B26）

每个注入点都在**两个独立进程**中完成：驱动到该相位后 `os._exit(137)`（无 finally / 无 atexit），
第二个新进程仅凭磁盘与 SQLite 发现并收口。

| 注入点 | kill rc | 重启前相位 | 重启后 | 恢复 | 残留 |
|---|---:|---|---|---|---:|
| after_t1_before_t2 | **137** | video_durable | failed / RUNTIME_RESTARTED | **CLEANUP_INCOMPLETE（保留对象）** | 0 |
| after_t2_before_t3 | **137** | inputs_prepared | failed / RUNTIME_RESTARTED | released | 0 |
| after_t3_before_delete | **137** | input_bound | failed / RUNTIME_RESTARTED | released | 0 |
| after_delete_before_t4 | **137** | audio_staged | failed / RUNTIME_RESTARTED | released | 0 |
| after_t4_before_transcript_terminal | **137** | video_deleted | failed / RUNTIME_RESTARTED | released | 0 |

第一行是最重要的一条：只有 video manifest 而缺 visual receipt 时，恢复**拒绝盲删并保留对象**。
全部五例 `productSuccessClaimed = false`，恢复从不声称产品成功。

## 4. 实施中修掉的真实缺陷

1. **`advance_barrier` 的 UPDATE 根本没写 manifest/receipt 摘要列** —— 只更 sequence/phase/updatedAt，
   导致 T3 永远判定「visual receipt missing」，barrier 无法完成。
2. **终态回执未记录兄弟方是否已到** —— 第二个回执重复走等待分支，清理永不 claim。
3. **middleware 把所有 OPTIONS 短路成 204 并覆写全局 CORS 头** —— local-import 的 preflight 路由根本不可达。
4. **`create` 的 body 契约校验被放在依赖解析之后** —— 顺序与冻结的拒绝链相反。
5. **`app.py` 硬编码 managed root** 而不走 WP-A 的 `default_managed_root`，`NAVIA_MEDIA_TOOL_ROOT` 失效。
6. **preparer 未校验「声明类型 ↔ 实测容器」** —— 伪 MIME 可以伪装成合法容器通过。
7. **transcript_service 对 local route 无条件执行 acquisition cleanup** —— 会清掉第二个消费者仍在用的共享输入。

## 5. 本轮遵守的不可变边界

- 表 `media_local_imports_v1` **只有 15 个冻结列**；`token`/`token_digest`/`file_name`/`path`/`cookie`/`stderr`
  经测试断言**不存在**，且整个 SQLite dump 中既无 token 也无其摘要。
- `create` 精确四字段；`fileName/path/url/hash/extension/lastModified/relativePath` 逐项 400。
- raw content 仅 `request.stream()`；传输块可 >1 MiB，`memoryview` 切成 ≤1 MiB；无 `request.body()`、无 Base64。
- 拒绝发生在 **writer 创建之前**，每条负例都断言 `_build_writer` 未被调用。
- 工具 stderr 不出界：失败归一为固定码，测试断言 `SECRET`/`/tmp`/`ffprobe` 均不出现。
- 原视频**仅在 T3 与两个 receipt 都 durable 后**才删除；两个终态顺序皆合法；清理单一 owner。
- local route 不调用 downloader / credential resolver / tabCapture；不建第二 SourceAuthority；自动 route 顺序未变。

## 6. 待 Codex 裁决

### 6.1 `app.py` 冻结摘要漂移（Major）

本包按计划**必须**修改 `app.py`（四个 API + privileged Origin/CORS + 中间件放行 OPTIONS），
而该文件被 v11 fixture 以 SHA-256 冻结。

| | 值 |
|---|---|
| v11 冻结值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |
| 当前值 | `7ec4bda3f68b598dbef5d1f9ecb37a515b916e534a4981b025db41de63ca9844` |

已确认**非合同扩张**：`unlistedBoundaryEmits = {}`、`targetInventoryDiff` 仍 **20/20**；
`sourceInventoryDiff` 里「missing」的 5 个码正是 `app.py` **自身发出**的码（抽取器跳过了摘要不符的文件）。

### 6.2 私有 seed 媒体缺失（Major，阻塞 B29/B30）

registry 要求：mp4/webm/mkv、**30,000–300,000 ms**、含音视频流、
**SenseVoice ≥3 非空片段**、**≥3 个不同帧哈希**。
本机仅有候选为 **5,167 ms** 与 **5,041 ms**，时长门失败。
门禁明文禁止用稀疏文件、填零或 mock 替代。

## 7. 真实 run / task / import / product id

| 项 | 值 |
|---|---|
| canary run / task / import / product id | **无**（未运行 B29/B30 产品链路） |
| durable receipts（T1–T4 / audio owner / visual） | 由 hard-kill probe 在临时根内产生，结束后删除 |
| 资源峰值 | writer slice ≤ 1 MiB（逐 slice 记账）；probe 根 0 残留 |

## 8. secret / path / raw-media scan

见 `50-cleanup-and-secret.json`。secret 命中 **0**；公开证据不含绝对路径、原始媒体或转写全文。

## 9. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| **Major** | **2**（`app.py` 摘要待重冻结；私有 seed 缺失阻塞 B29/B30） |
| Minor | 0 |

## 10. 停止点

状态 **WP-B AWAITING CODEX CHECKPOINT**。不宣布 WP-B/V3 PASS，不进入 WP-C，不做独立文档外审。

**恢复本包所需的两个输入**：

1. Codex 对 `app.py` 冻结摘要漂移的裁决（受限重冻结，或改由其它装配点提供路由）；
2. 一个满足 registry 的私有 seed 媒体：`NAVIA_WP_B_SEED_MEDIA=<绝对路径>`，容器 mp4/webm/mkv、
   时长 30,000–300,000 ms、含音视频流、含可被 SenseVoice 转写为 ≥3 个非空片段的真实语音、
   含 ≥3 个不同哈希的帧；须留在 Git 与公开证据之外。
