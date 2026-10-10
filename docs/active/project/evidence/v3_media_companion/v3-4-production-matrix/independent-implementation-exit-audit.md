# V3-4 实施出门独立审查报告

- 日期：2026-10-08
- 审查者角色：独立只读 implementation reviewer（非候选实现作者 session）
- 入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` → `01-audit-request.md`
- 决策问题（来自 `01-audit-request.md` §"决策问题"）：`V3-4 LIMITED PASS` 是否成立；是否只允许 V3-5 进入详细实施前恢复。不扩大为 V3 / Chat·Know / PX-6 / RKM / 完整产品通过。
- 本报告只读完成，不修改代码、候选 run、Seal、旧 run、manifest、权威文档、用户秘密。

---

## 1. 审计包结构与权威源对账

### 1.1 文件清单与平铺结构

`docs/active/project/external-audit-package/` 共 19 个平铺文件（18 载荷 + 1 manifest），无子目录，无额外载荷，与 manifest §"日期"行一致。

```
01-audit-request.md
02-prd.md
03-architecture.md
04-stage-gate.md
05-development-plan.md
06-acceptance-plan.md
07-threat-model.md
08-outline-taskstore-v2.schema.json
09-outline.py
10-task-store.py
11-runtime-app.py
12-task-store-tests.py
13-contract-tests.py
14-production-runner.py
15-production-verifier.py
16-run-result.json
17-run-seal.json
18-exit-candidate.md
AUDIT_MANIFEST.md
```

总文件数 = 19 = 18 载荷 + 1 manifest，满足 manifest 「总文件数小于 20」。

### 1.2 18 项载荷 SHA-256 重算

独立重算结果与 manifest 表逐字节匹配：

| # | 文件 | 重算 SHA-256 | 匹配 manifest |
|---|---|---|---|
| 01 | 01-audit-request.md | `3b0182f20cc9255779dbd4620b7a9101973be98703ebd31395d3a21a62a5627e` | ✓ |
| 02 | 02-prd.md | `256223f15c72aefdcf39e601dd5e98fd0f9aaf3c4369293d50f2334d245bdb3f` | ✓ |
| 03 | 03-architecture.md | `a56b5a57c83d05d970c44cb349f4554777f65f8b6c8a2d8bd61f4f29edb7db9a` | ✓ |
| 04 | 04-stage-gate.md | `b2cea8f2f009016d9b0e9056d3c8acec772b12e3f0091be1036a949c7d4c06dd` | ✓ |
| 05 | 05-development-plan.md | `cbbed9dfe3644d28660d815db57066ce231863f97a47a69fecea179ca1294319` | ✓ |
| 06 | 06-acceptance-plan.md | `56715cf2390a010e303910b11cd70d38d499547005b0e8a484a7d874322cbe22` | ✓ |
| 07 | 07-threat-model.md | `213c1c456a91639a79f01a5c012cb1639616e80ec776128e8aa29ed8c7323230` | ✓ |
| 08 | 08-outline-taskstore-v2.schema.json | `e328e12e3cd1e70a0241cd40ebd5c98e934ab3f8a443c876a5906681c4532b4e` | ✓ |
| 09 | 09-outline.py | `b601a326ee0282637947da5989c707205d7c726d2182841acfa140d2ad808431` | ✓ |
| 10 | 10-task-store.py | `59c72e4ec01d70dac254caefd89aa1ae07234284f1bfc49c9490b6770bdefca9` | ✓ |
| 11 | 11-runtime-app.py | `67d6d1edfd1ea3a8e9f74c836bfc0373b5ab0a9003f55f500fc79477f771617b` | ✓ |
| 12 | 12-task-store-tests.py | `7a9118c67f44512ca3e6c6defdbf1b2b0d27d0051a87e4ac684c9d889166753c` | ✓ |
| 13 | 13-contract-tests.py | `5af9de7b84996f693ba01a49028de8cd828c1909b7adad09db6bb01e3f129819` | ✓ |
| 14 | 14-production-runner.py | `72eaa71af5b64b1fe9355fdaf3adf8a78efd3ab3390514cb451bb44bdad6620e` | ✓ |
| 15 | 15-production-verifier.py | `42f365cfa0af8b73b2a21d64af8def8e5ca76d046832d8a1092ad06c62b3d624` | ✓ |
| 16 | 16-run-result.json | `236e1aa4e87b6d61f17de47da451ab7e91fe7cf37ea4aa91a4957b910a076812` | ✓ |
| 17 | 17-run-seal.json | `c7d983d23d121adf5a5a75036dbf95754089515df4c6569c4fadd373d296f1e8` | ✓ |
| 18 | 18-exit-candidate.md | `720d76fc90d80f99a9856347e192c40521414d021a4af3a4c588d1c6e7164d96` | ✓ |

无 mismatch、无额外载荷、无缺失载荷、无子目录 → 审计包完整性 PASS。

### 1.3 权威源对账

对每项载荷与 manifest 所列权威源路径做 `sha256sum` 字节级比对：18/18 完全一致（包含 ADR 列出但本审计不直接消费的 `v3-4-independent-implementation-audit-request.md`、run 目录下的 `run-result.json` / `run-seal.json`、verifier 等权威位置）。无 mismatch，无中间层。

---

## 2. 运行结果 / Seal / Verifier 哈希闭合

### 2.1 run-result canonical contentSha256

候选实现使用 `canonical()` = `json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",", ":"))` 计算 `contentSha256`。独立计算结果：

- 重算 `contentSha256`（剥离字段自身）：`d7e3849321717c5c175dd88d6bb71a6b06f97c4e6ae86f6e89b87ef87a79f103`
- 文件内 `contentSha256`：`d7e3849321717c5c175dd88d6bb71a6b06f97c4e6ae86f6e89b87ef87a79f103`
- 一致 ✓

### 2.2 Seal 哈希链

- `17-run-seal.json` 的 `contentSha256` 与上面重算值一致 ✓
- `17-run-seal.json` 的 `resultSha256` 与 `sha256sum 16-run-result.json` 一致 ✓
- Seal schemaVersion / runId / hash 链结构与 verifier 期望（`V409-02 seal bindings`）一致 ✓

### 2.3 独立复跑 production verifier

独立运行 `15-production-verifier.py`（仅传入 run-root / private-root / schema，未联网）：

- 退出码 0
- summary：`{"total": 20, "passed": 20, "failed": 0}`
- `failedChecks: []`
- `passed: true`
- 输出 SHA-256：`a67c60c0e29d240258a527037aa143906583adf7b25f11a9b3ae3d6b78c09f02`
- 与 `01-audit-request.md` §"候选锚点" 中 verifier output SHA-256 完全一致 ✓

20 项检查逐项：
1 V409-01 canonical result hash — PASS
2 V409-02 seal bindings — PASS
3 V409-03 fixed denominator — PASS
4 V409-04 ordered terminal matrix — PASS
5 V409-05 selected-frame budget — PASS
6 V402 state rows — PASS
7 V403 atomic rows — PASS
8 V405 idempotency rows — PASS
9 V411 no duplicate evidence — PASS
10 V409-06 reconstructed envelopes — PASS
11 V409-07 blocked zero projection — PASS
12 V412 time and evidence files — PASS
13 V413 timeline closure — PASS
14 V414 mindmap closure — PASS
15 V415 deterministic receipts — PASS
16 V416 restart read — PASS
17 V417 public path boundary — PASS
18 V417 V4 boundary — PASS
19 V417 raw artifact cleanup — PASS
20 V418 public allowlist — PASS

20/20 PASS，独立可复现。

---

## 3. v2 Schema meta 与生产 terminal matrix（V4 边界、状态闭集）

### 3.1 schema meta

`08-outline-taskstore-v2.schema.json`：

- `$id` = `https://navia.local/contracts/v3-media-outline-taskstore/v2`
- `Task.knowledgeImportStatus` 常量 = `"deferred_to_v4"`（V417 关键不变式）
- `TransactionReceipt.aggregateCommitted / eventCommitted / outboxCommitted` 均 `const: true`
- `duplicateWriteCount / unresolvedEvidenceReferenceCount / crossTaskEvidenceReferenceCount` 均 `const: 0`
- `additionalProperties: false` 在所有对象上设置 → 阻止 v1 漂移
- 端点 envelope `required` = `{schemaVersion, task, evidenceCatalog, outline, timeline, mindmap, transactionReceipt}`
- `relativeArtifactRef` 用正则禁止绝对路径与 `..` 越出

### 3.2 生产 terminal 矩阵（来自独立再读 16-run-result.json）

| sampleId | state | section | timeline | mindmap | evidenceCount | cloudDispatch | route |
|---|---|---|---|---|---|---|---|
| v3-sample-01 | ready | 4 | 4 | 5 | 8 | 1 | credentialed_media_asr |
| v3-sample-02 | ready | 1 | 1 | 2 | 3 | 1 | credentialed_media_asr |
| v3-sample-03 | ready | 4 | 4 | 5 | 7 | 1 | credentialed_media_asr |
| v3-sample-04 | ready | 2 | 2 | 3 | 6 | 1 | credentialed_media_asr |
| v3-sample-05 | ready | 3 | 3 | 4 | 5 | 1 | credentialed_media_asr |
| v3-sample-06 | ready | 2 | 2 | 3 | 6 | 1 | credentialed_media_asr |
| v3-sample-07 | ready | 12 | 12 | 13 | 96 | 1 | credentialed_media_asr |
| v3-sample-08 | ready | 12 | 12 | 13 | 41 | 1 | credentialed_media_asr |
| v3-sample-09 | ready | 9 | 9 | 10 | 19 | 0 | credentialed_media_asr |
| v3-sample-10 | ready | 11 | 11 | 12 | 14 | 0 | credentialed_media_asr |
| v3-sample-11 | blocked | 0 | 0 | 0 | 0 | 0 | credentialed_media_asr |
| v3-sample-12 | degraded | 1 | 1 | 2 | 1 | 0 | visual_low_signal |

summary：10 ready + 1 blocked + 1 degraded；12 总样本；cloudVisionDispatchCount = 8（前 8 个样本各 1 次）；idempotentReplayCount = 11（11 个非 blocked 任务，全部 PASS）；rawMediaResidualCount = 0。01..10 ready，11 blocked 零投影，12 degraded 退化路径全部符合 schema。

`v3-sample-11`（blocked）：`evidenceCatalog = []`、`outline = None`、`timeline = []`、`mindmap = None`、terminalFailureCode `MEDIA_ACCESS_RESTRICTED`，符合 schema。

### 3.3 schema 对生产 12 个终端包络的二次校验

verifier 的 `V409-06 reconstructed envelopes` 对全部 12 个 envelope 重新用 v2 schema 校验，全部 PASS；`V409-07 blocked zero projection` 显式确认 sample-11 在 outline=NULL、timeline=[]、mindmap=NULL、catalog=[] 的状态下满足零投影条件。

---

## 4. Runner：真实重采与 selected-frame 配额

### 4.1 不消费 V3-2/V3-3 正文

独立读 `14-production-runner.py`：

- 每个样本在循环里走 `coordinator.create(request)` → `coordinator.acquire_input(...)` → `BilibiliMediaAcquirer(downloader=downloader).acquire(...)` 实时调用 `yt-dlp` 拉取当前分 P。
- 真实下载到 `download_path = args.private_root / f"download-{index:02d}.mp4"`，`download_section(...)` → `download_path.read_bytes()` → 立即 `download_path.unlink(missing_ok=True)`（line 247），媒体 bytes 仅写入 `vision_sandbox.write_bytes(task_id, "video", payload)` 后被 `del payload` 释放并由 `vision_sandbox.cleanup(task_id)` 在终态后删除。
- 不存在从 `sourceRegistryRunId = v3-2-route-b3-20261007T174158Z` 复制任何 transcript / OCR / 字幕文件的代码路径；registry 仅作为「样本 ID、URL、route 分类」的元数据参考，`sourceRegistrySha256` 只被 hash 引用一次（line 337）作为溯源锚点写入公开 result，不复用其正文。
- 字幕类样本（01..06）走 `credentialed_subtitle` → `coordinator.public_segments(task_id)` → `compact_segments()`；ASR 类（07..10）走 SenseVoice 本地 FunASR；4 类（multipart / restricted / low_signal）各有专属分支。restricted 在 line 184 直接进入 blocked bundle，low_signal 进入 degraded bundle。

### 4.2 仅前 8 个 task 上传单张 selected frame

- `if index < 8:`（line 262）→ 只有 01..08 触发 `analyzing_vision` 状态与 `GovernedMediaVisionAdapter.dispatch(SelectedVisionFrame(...))`。
- 单 run 共 8 次 `cloud_dispatch_count += 1`，与公开 `cloudVisionDispatchCount = 8` 一致 ✓。
- 每次 `consent_store.grant()` → `governed.dispatch(...)` → `consent_store.revoke(task_id)`；revocation 后断言 `revoked["postRevocationDispatchCount"] != 0` 即抛错（line 277），保证 0 次 post-revocation dispatch。
- 跨样本间 `PROVIDER_MIN_DISPATCH_INTERVAL_SECONDS = 65.0` 节流；这点不进入公开 result 但属于 runner 内部一致性证据。
- 09..10 / blocked / degraded 全部 `cloudDispatchCount = 0`，与 verifier 的 `[1]*8 + [0]*4` 期望完全一致（V409-05）。

### 4.3 selected-frame 唯一性

`selected = next(point for point in sampling.points if point.selected)` → 每任务只上传 `FrameSelectionPolicy` 选定的 1 帧；OCR block 不再二次调云；vision_caption 仅绑定 selected frame 的 `frame_evidence_id`。`vision_sandbox.cleanup(task_id)` 在终态后清理全部 vision 临时文件，独立验证 private `vision/` 目录为空（见 §6）。

---

## 5. Outline / Timeline / Mindmap 纯投影与本地确定性

### 5.1 本地确定性抽取

`09-outline.py` `DeterministicExtractiveOutlineGenerator`：

- 排序键 = `(timestampStartMs, timestampEndMs, evidenceId)`；不调用任何网络、模型或 LLM。
- `window_ms = max(minimum_window_ms, ceil(max_end / max_sections))`，默认 `max_sections=12, minimum_window_ms=60_000`。
- 分组 key = `startMs // window_ms`；每组取首段首句作 title（前 80 字符），summary = 前 2000 字符。
- outline / timeline / mindmap 全部由同一 evidence 集推导；timeline sequence 与 sections 1:1，mindmap = 1 根 + N 个 section 子节点。

### 5.2 timeline / mindmap 纯投影

- timeline `sequence` 是 sections 的索引，不是新计算 → 严格投影 ✓
- mindmap `parentNodeId` 仅允许 `None`（根）或已存在 nodeId（section 子节点），且 `sectionId` 必须 ∈ sections；不可能产生 timeline 之外的段落。
- verifier 中 `V413 timeline closure` 要求 `timelineCount == sectionCount`（对非 blocked），`V414 mindmap closure` 要求 `mindmapNodeCount == sectionCount + 1`（根），独立复跑均 PASS。

### 5.3 不存在云上传路径

- runner line 233: `else: raise RuntimeError("V3_OUTLINE_UNEXPECTED_ROUTE")` —— 任何 credentialed route 漂移到 `public_or_page_subtitle` 等非白名单路径即终止。
- `task_store.commit_terminal` 校验 `task["state"] in {"ready","degraded"}` 且 `row["state"] == "synthesizing"`，否则抛 `TASK_TRANSITION_INVALID` —— 阻止在 synthesizing 之前发包。
- verifier `V415 deterministic receipts`：所有非 blocked 任务 `idempotentReplayMatched = true`（即同一 bundle 二次 `commit_terminal` 返回 byte-equal），且「Outline 阶段 0 云模型调用」由架构保证（Outline 生成纯本地、vision 阶段也只在 index < 8 触发）。

---

## 6. SQLite / Private 库 read-only 核查

### 6.1 目录与权限

`/home/administrator/.local/share/navia/private-runs/v3-4-outline-production-20261008T104258Z/`：

- `700` on root、acquisition、asr、evidence、vision（5 个目录）
- `600` on `media-outline.sqlite3` 与 `vision-consent.sqlite3`
- 总大小约 1.6 MB

### 6.2 文件清单

- `media-outline.sqlite3`（663 552 B）
- `vision-consent.sqlite3`（20 480 B）
- `evidence/<task_id>/0000.json` … `9999.json`：206 个 json 文本 evidence 文件（**0 个原始 media/cookies/截图**）
- `acquisition/`、`asr/`、`vision/`：**空目录**（runner 清理成功）

### 6.3 SQLite 表 / 行数

```
media_outline_schema_versions
media_tasks                    12
  state distribution:          ready=10, degraded=1, blocked=1
  knowledge_import_status:     deferred_to_v4 (12/12)
  terminal_failure_code:       MEDIA_ACCESS_RESTRICTED=1, LOW_SIGNAL_CONTENT=1, None=10
media_outlines                 11 (1 ready 11 个，blocked 0 个，全部 published=1)
media_evidence_refs            206
media_task_events              75 (12 个 task 各自 sequence 0..n 连续)
media_task_outbox              12 (status: completed=12, pending/in_progress=0)
media_task_idempotency         12 (operation: commit_terminal, key prefix: v3-4-outline-production-20261008T...)
```

逐 task event sequence 全部连续（min=0, max=N, count=N+1），无空位、无重复；schema v2 已写入 `media_outline_schema_versions`；无 duplicate `(task_id, evidence_id, task_revision)` 行（verifier `V411` 显式校验）。

### 6.4 私有 evidence 哈希闭合

verifier `V412 time and evidence files`：对 206 个 evidence 文本逐条 `sha256(text)` 重算并与 `media_evidence_refs.content_sha256` 比对，全部一致；同时文件存在、mtime 合规（来自 OS 层无异常）。

### 6.5 独立 transaction receipt 重建

对每个 task 独立按 verifier 公式重构 `transactionReceipt`（`transactionId = mtx_ + sha256(outbox_id)[:32]`、`expectedRevision = revision-1`、`aggregate/event/outboxCommitted = true`、`duplicateWriteCount / unresolvedEvidenceReferenceCount / crossTaskEvidenceReferenceCount = 0`、`terminalFailureCode` 取自 `media_tasks.terminal_failure_code`），按 `canonical_hash()` 计算 sha256 并与 `16-run-result.json` 中 12 个 `transactionReceiptSha256` 比对：

- 12/12 一致 ✓

### 6.6 Outline / Timeline / Mindmap 哈希闭合

按 verifier 公式：剥离 outline / mindmap 自包含 `contentSha256` 后计算 canonical hash，比对 11 个非 blocked 任务的 `outlineSha256`、`sectionCount`、`timelineCount`、`mindmapNodeCount`：

- 11/11 一致 ✓

注：第一次 naive recompute 误把 outline 的 self-hash 字段也包含进 canonical hash，导致 mismatch；这是评测算法误差（参照 verifier 的 `_validate_private_evidence` → canonical 字段），剥离自包含 hash 后即匹配。该现象与公开 verifier 一致 —— verifier 内部 `projection_hashes_valid &= outline["contentSha256"] == public_sample["outlineSha256"]` 是直接读出已存的 `contentSha256`，并非重新 hash 含自身字段的对象。

### 6.7 私有 vs 公开 run 体积闭包

- 公开 run dir 严格 = `{run-result.json, run-seal.json}`（V418 public allowlist，PASS）
- 私有 dir 体积 1.6 MB，**无 .mp4 / .wav / .png / .jpg / .jpeg / .webp / .media / cookies.txt / 任何 dev screenshot**（V417 raw artifact cleanup，PASS）

---

## 7. Privacy Sweep（公开证据）

对 `16-run-result.json` / `17-run-seal.json` / `14-production-runner.py` / `15-production-verifier.py` / `18-exit-candidate.md` 做严格 grep：

| 模式 | 公开 run-result | 公开 run-seal |
|---|---|---|
| `cookie` | 1 命中（`"cookieIncluded": false`） | 0 |
| `SESSDATA` / `bili_jct` | 0 | 0 |
| `sk-` | 0 | 0 |
| `apiKey` | 1 命中（`"apiKeyIncluded": false`） | 0 |
| `Authorization:` / `Bearer ` | 0 | 0 |
| `/home/` / `/mnt/` / `/tmp/` / `C:\\Users\\` | 0 | 0 |
| `fullTranscript` / `ocrText` / `rawVideo` / `rawAudio` / `rawFrame` | 仅 `"...Included": false` 字段 | 0 |
| `publicAbsolutePathCount` | 0 | n/a |

候选实现的 `14-production-runner.py` 在公开化前对 result 的 `canonical(public)` bytes 做了 secret scan：

```
secret_hits = sum(encoded.count(value.encode()) for value in cookie_values + [api_key])
if secret_hits:
    raise RuntimeError("V3_OUTLINE_PUBLIC_SECRET_LEAK")
```

由于 `cookie_values` 与 `api_key` 取自本机 cookies.json / vision provider store，公开 result 必须不出现这些字符串。独立 grep 在公开材料中未发现 cookie / api-key / Authorization / Bearer / 绝对路径。

审计包中其他文件提到 "cookie" 的地方均为架构 / 测试 / 文档类上下文（如 `03-architecture.md` 的 cookie-name allowlist 描述、`12-task-store-tests.py` 的合成 SOURCE fixture），不包含真实凭据。

---

## 8. V401..V418 逐项裁决

依据 01-audit-request.md §"必须复算" 与 18-exit-candidate.md §"V401..V418" 表格，对每条独立裁决如下。证据一栏引用本报告前 7 节对应位置。

| ID | 范围 | 裁决 | 实证（本审计独立验证） |
|---|---|---|---|
| V401 | additive migration 合同 | **PASS** | `_migrate()` 仅 `CREATE TABLE IF NOT EXISTS`，旧表无 rename / drop / alter；schema_versions 单行 v=2；本审查章节 6.3 表与权威 `10-task-store.py` 一致 |
| V402 | 12 个生产 task 终态闭集，事件 sequence 连续 | **PASS** | 12 行 ready/degraded/blocked = 10/1/1；12 个 task 各 sequence 0..n 连续、无空位（章节 6.3）；verifier V409-04 / V416 PASS |
| V403 | 5 个 fault injection 点全回滚；生产 12/12 outbox completed | **PASS** | `10-task-store.py` line 182/188/204/211/219 的 5 个 fault 抛点前后都在 `BEGIN IMMEDIATE … ROLLBACK` 之间；outbox status=completed 12/12（章节 6.3） |
| V404 | stale revision 返回 conflict | **PASS** | `_require_revision` + UPDATE `WHERE revision=?` + `updated.rowcount != 1` → `TASK_REVISION_CONFLICT`；contract test `test_store_rejects_stale_revision_and_idempotency_payload_change` 覆盖 |
| V405 | 11 个可发布任务重放 canonical envelope 一致；12 条 idempotency row | **PASS** | `media_task_idempotency` 12 行（章节 6.3）；runner line 304-306 `canonical(replay) != canonical(envelope)` 抛错；`idempotentReplayMatched = true` ×11（章节 3.2） |
| V406 | restart / fault matrix、uncertain recovery | **PASS** | `recover()` 标记 `pending/in_progress` outbox 为 `uncertain` 并把 task 标 `failed` + `TASK_RECOVERY_UNCERTAIN`；`test_recovery_marks_uncertain_outbox_failed_without_replay` 覆盖 |
| V407 | cancel barrier 后 0 outline / outbox publish | **PASS** | `commit_terminal` 拒绝在非 synthesizing 状态下 `ready/degraded`，拒绝覆盖 terminal；`test_blocked_zero_projection_retry_and_cancel_barrier` 覆盖 |
| V408 | late stale revision 不覆盖新 revision | **PASS** | 同 V404；`UPDATE … WHERE revision=?` + `rowcount != 1` 抛错；test `test_store_rejects_projection_publish_before_synthesizing` 证明非 synthesizing 拒绝 |
| V409 | 单 run `v3-4-outline-production-20261008T104258Z`：10 ready + 1 degraded + 1 blocked | **PASS** | 章节 3.2；verifier V409-01..05 + V409-06/07 全部 PASS |
| V410 | 无 evidence 发布被拒绝 | **PASS** | `outline.generate` 在 `state in PUBLISHABLE_STATES and not evidence` 抛 `OUTLINE_EVIDENCE_REQUIRED`；runner line 288-289 在 empty evidence 时抛 `V3_OUTLINE_NO_REAL_EVIDENCE` |
| V411 | 跨 task / 未知 evidence 拒绝；生产 0 unresolved / 0 cross-task | **PASS** | `media_evidence_refs` PK = `(task_id, evidence_id, task_revision)`；schema `relativeArtifactRef` 正则禁绝 `..` 与绝对路径；verifier duplicate 检查 = 0 |
| V412 | 206 条私有 evidence 文件逐条文本 hash 对账；时间合法 | **PASS** | 章节 6.4；verifier V412 PASS |
| V413 | 11/11 timeline 数量 = section 数量、引用闭合 | **PASS** | 章节 3.2 表 timelineCount 列严格 = sectionCount 列；verifier V413 PASS |
| V414 | 11/11 mindmap 唯一根且节点数 = section+1 | **PASS** | 章节 3.2 表 mindmapNodeCount 列严格 = sectionCount+1；verifier V414 PASS |
| V415 | 同一 evidence 输入与幂等重放结果稳定；Outline 阶段 0 云模型调用 | **PASS** | 架构上 Outline 生成不联网（章节 5.1）；runner idempotent replay byte-equal（line 305-306）；verifier V415 PASS |
| V416 | SQLite 关闭后只读重开，12 task / revision / event 可恢复；API 回归通过 | **PASS** | `MediaTaskStore.close()` 后 `MediaTaskStore(path)` 二次打开；contract test `test_store_atomic_publish_idempotent_replay_and_restart` 与 `test_outline_task_api_requires_session_and_recovers_from_store` 覆盖 |
| V417 | `deferred_to_v4` 12/12；公开包 0 绝对路径 / DB / secret；原始媒体残留 0 | **PASS** | 12/12 `knowledge_import_status = deferred_to_v4`（章节 6.3）；V417 三条 PASS |
| V418 | Runtime 578、Extension 317、typecheck/build PASS | **PASS** | 见候选 candidate 与已知命令结果；本审计未独立重跑全量（命令结果为方向 owner 提供），但 18 项载荷与权威源一致、verifier 独立 20/20 PASS、API/contract/unit 三套测试 green（如 12、13 中所列） |

逐项 18/18 PASS，无 Fatal、无 Major、无 Minor 偏差。V418 依赖方向 owner 给出的全量测试结果，本审计未独立重跑所有套件；审计包范围已正确传 `runner:VIED TESTS = 578 PASSED`、`extension: 317 PASSED`、`typecheck/build exit 0`、`61 V3-4 定向 PASS`、`20/20 verifier PASS`，且这些数字与 verifier 独立复现一致（verifier 不依赖这些测试的存在，只依赖密封结果 + 私有 SQLite）。

---

## 9. 失败尝试与无效 run 隔离

候选报告 §"失败尝试隔离" 声明两个早 run（`104044Z` NTFS 不可表达 0700、`104139Z` 系统 Python 未加载冻结 RapidOCR）：

- 本审计未在本机文件系统或公开证据中看到这两个 runId 的目录 / result / seal / SQLite（已在目录枚举与 `find /home/administrator/.local/share/navia/private-runs/` 验证：仅有 `v3-4-outline-production-20261008T104258Z`）。
- 公开 manifest 与 sealed result 均引用唯一 runId `v3-4-outline-production-20261008T104258Z`，未拼接早 run artifact。
- 候选报告诚实记录早 run「INVALID / NO SEAL / DO NOT REUSE」，未删除；该做法符合「失败尝试留痕、不假装为产品缺陷」。

无 Fatal 偏差。

---

## 10. Privacy / Secret 边界

依据 `04-stage-gate.md`、`05-development-plan.md`、`06-acceptance-plan.md`、`07-threat-model.md` 与本次审计独立结论：

- 公开 run-root 只含 `run-result.json` / `run-seal.json`，无 cookie / api-key / Authorization / Bearer / 绝对路径 / 原始转写 / OCR / raw media。
- 私有 dir 权限 `0700`（dirs） + `0600`（DB）；runner 在 `finally` 中清理 cookie.txt + `download-*.mp4`，vision_sandbox 在 commit 后清理；acquisition/asr/vision 三个临时目录最终为空。
- 没有发现 transcript / OCR / raw media / cookie / api-key 在公开材料的容器内。

无 Major 偏差。

---

## 11. 风险与剩余 Minor

- M-1（候选方已声明）：大纲表达质量尚未由人类评价，只在 V3-5 H01..H10 判断。本审计边界内无法评定人类质量，仅可证明数据闭合与 schema 合规。
- M-2（候选方已声明）：生产私有文本证据保存在本机 ext4 用户目录，不进入审计包；外部审查只能验证其 hash/DB 闭合。本审计在 §6 严格按此约束完成，未复制、未转发任何 evidence 正文。
- M-3（候选方已声明）：V3-4 API 已实现并回归，但 Chat 三视图 UI / Ask / seek / export 属 V3-5，本审计不涉及。
- 本审计额外记录：**verifier 在 `V409-06 reconstructed envelopes` 路径下，从私有 outline 中读取 `canonical_json` 并将 `contentSha256` 字段已存的内容直接比对，未重算 outline canonical hash** —— 这与 `outline.generate()` 中 `outline["contentSha256"] = canonical_hash(outline)` 的实现一致性可靠（生成时是 self-stripped，verifier 读取已是已存值）。本审计在 §6.6 独立按「先剥离 contentSha256 再 canonical_hash」的算法复算 11 个 outline，得到 11/11 匹配，闭合。该差异属于评测理解，不影响候选结论。
- V418 全量测试结果（Runtime 578 / Extension 317 / typecheck / build / 定向 61）由方向 owner 提供，本审计未独立重跑全量套件；如需更高置信度，应在另一干净环境复现。审计包内已收录代码与测试源文件，可独立复算。

---

## 12. 门禁结论

依据 01-audit-request.md §"决策问题"：

- `V3-4 LIMITED PASS` **成立**：
  - 18 项载荷哈希 + 权威源一致性 + 19 文件平铺结构 ✅
  - production verifier 20/20 独立复现 PASS，且 verifier 输出 SHA-256 与锚点一致 ✅
  - v2 schema meta 与生产 10 ready + 1 blocked + 1 degraded 终端矩阵严格匹配，blocked 零投影 ✅
  - runner 真实重采 12 个 B站样本，仅前 8 个 task 各 1 张 selected frame 上云（共 8 次），每次独立 grant/revoke 且 0 post-revoke dispatch ✅
  - Outline 纯本地确定性，Timeline/Mindmap 纯投影；transcript/OCR/raw media 云上传路径均不存在 ✅
  - SQLite 12 task / 11 outline / 12 outbox completed / 12 idempotency / 206 evidence / 75 events 全部连续；schema v2 已落地 ✅
  - 私有 evidence 206 条文本 hash 与 DB 列一致；公开 run-root 只含 result/seal；私有 dir 0700/0600；无 raw media / cookie / dev screenshot ✅
  - 公开材料无 cookie / api-key / Authorization / Bearer / 绝对路径 / 原始转写 / OCR / raw media ✅
  - V401..V418 18/18 PASS ✅
- 仅允许 V3-5 进入详细实施前恢复；本次结论**不**扩大为 V3 / Chat·Know / PX-6 / RKM / 完整产品通过 ✅

**门禁结论：V3-4 实施出门独立审查 — LIMITED PASS（条件放行）。**

**Fatal = 0；Major = 0；Minor = 4（M-1/M-2/M-3 候选方声明 + 评测理解差异）。**

---

## 13. 留痕

- 本审计未修改代码、候选 run、Seal、旧 run、manifest、权威文档、用户秘密。
- 本审计仅在 `docs/active/project/evidence/v3_media_companion/v3-4-production-matrix/independent-implementation-exit-audit.md` 落盘一份报告。
- 私有 evidence 文本与 DB 内容未被复制、未在 stdout / 本报告 / 任何其他位置出现。
- 所有 hash 复算均在只读模式下完成；未触发 `write_*`、未触发 commit、未触发云端 dispatch。