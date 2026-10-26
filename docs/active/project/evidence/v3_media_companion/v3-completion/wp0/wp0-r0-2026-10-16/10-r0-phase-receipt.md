# WP0 R0 Phase Receipt — Background Capture Relay（2026-10-16）

Candidate: `wp0-r0-2026-10-16`
Status: **R0 NO-GO（Major 阻塞）**。R1 未启动。
Evidence root: `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/`

## 1. R0 目标

`05-wp0-relay-acceptance.md` R0：「v10 合同、Chrome 116、40/20 registry、manifest/receipt → 50/50、15/15、Schema → 落盘 checkpoint 后继续 R1」。

R0 的作用是**证明冻结的 relay v10 合同证据与当前工作树一致**。R0 不写产品代码。

## 2. 已执行的 R0 机器门槛

| 门槛 | 命令 | 退出码 | 结果 |
|---|---|---:|---|
| v10 baseline 50/50 | `python3 docs/.../verify-stage-b-b5-3-background-capture-relay-v10-contract.py` | 2 | **46/50 FAIL** |
| v10 mutation 15/15 | `python3 docs/.../verify-stage-b-b5-3-background-capture-relay-v10-mutations.py` | 2 | **14/15 FAIL** |
| Schema meta / instance | 同 baseline（`schemaMetaValid`/`protocolInstanceSchemaValid`/全部 immutable 检查） | — | PASS |
| extension typecheck | `cd apps/chrome-extension && npm run typecheck` | 0 | PASS |
| extension test | `npm test` | 0 | PASS（58 files / 392 tests） |
| extension build | `npm run build` | 0 | PASS（Σ 4.63 MB） |
| capture/transcript/outline/fault/product focused pytest | `cd services/local-runtime && PYTHONPATH=. ./.venv/bin/python -m pytest tests/ -k "capture or transcript or outline or fault or product" -q` | 0 | PASS（180 passed / 531 deselected） |
| `scripts/stage_b_b5_3/test/*.node-test.mjs`（离线 8 份） | `node --test ...` | 0 | PASS（134/134） |
| `scripts/stage_b_b5_3/test/*.node-test.mjs`（Runtime API 集成） | `node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs` | 0 | PASS（6/6） |

Raw outputs：`r0-relay-v10-contract-baseline.json`、`r0-relay-v10-mutations.json`。

## 3. 失败项（4 / 4 同源）

baseline 失败的 4 项：

```
sourceEvidenceHashesCurrent      = false
sourceScopeExtractorsValid       = false
sourceEmitSetEqualsFrozenInventory = false
discoveredCodeUniverseClosed     = false
```

mutation 失败 1 项：`non_boundary_lexical_string_control`（`expectedExit=0`，`actualExit=2`）。该用例是「未改动基线必须返回 0」的对照用例，因基线本身已失败而连锁失败；其余 14 个变异用例均正确返回 2。

## 4. 根因（已逐层核实）

### 4.1 直接根因

`verify-stage-b-b5-3-background-capture-relay-v10-contract.py:269-272`：

```python
current = path.is_file() and file_digest(path) == item.get("sha256")
source_files_valid &= current
if not current:
    source_extractors_valid = False
    continue          # ← 哈希漂移即整文件跳过 AST 抽取
```

冻结清单 `docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json`
的 `sourceInventoryEvidence.scopes` 共 11 个源文件，其中 **2 个与当前工作树哈希不一致**：

| 源文件 | 冻结 SHA-256 | 当前 SHA-256 | 状态 |
|---|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | `de3a903564fe534e1dd1bb94850491abaeec56fd567678b609a88fec33da759b` | `ddbf830f5ce5d15b2270deba636ad5620531ef122ef28ee6903a5f8ad603cb5c` | HASH_DRIFT |
| `services/local-runtime/navia_runtime/app.py` | `40040aed9ad7b3d29d93e487e92042ac97d201bf1f837dafdac697418f7c3618` | `518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8` | HASH_DRIFT |

其余 9 个源文件（含 `capture_sink.py`、`capture_grants.py`、`task_artifacts.py`、`acquirer.py`、`yt_dlp.py` 与 4 个 TS 文件）哈希一致，抽取有效。

### 4.2 连锁效应：6 个 boundary code 未进入 emit 集

因上述 2 个文件被整体跳过，其 boundary code 从未进入 `actual_emit_codes`，导致
`actualCount=34` vs `frozenCount=40`，缺失 6 项：

```
V3_MEDIA_ACQUISITION_IN_PROGRESS
V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN
V3_MEDIA_CAPTURE_NOT_ELIGIBLE
V3_MEDIA_CAPTURE_ORIGIN_MISMATCH
V3_MEDIA_CAPTURE_STREAM_INVALID
V3_MEDIA_SOURCE_TASK_ACTIVE
```

### 4.3 已排除「relay 实现缺失」

逐项核实结果（本次实际执行）：

- 6 个「缺失」code **全部存在于当前工作树**，且位于被跳过的两个文件内
  （例：`app.py:998/1003/1033/1069` 含 `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` /
  `V3_MEDIA_CAPTURE_STREAM_INVALID`；`coordinator.py:83/263/281/412` 含
  `V3_MEDIA_SOURCE_TASK_ACTIVE` / `V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN` /
  `V3_MEDIA_ACQUISITION_IN_PROGRESS`）。
- 7 个声明的抽取符号在当前文件中**全部存在**（AST 遍历确认）：
  `MediaAcquisitionCoordinator.create` / `.recover_interrupted` /
  `.bind_capture_grant` / `.acquire_input`、
  `create_media_capture_grant` / `get_media_capture_grant` /
  `media_capture_stream`。
- 对两个文件**单独调用验证器自身的 `python_codes()`** 均返回 `valid=True`
  （`coordinator.py` 7 个 code、`app.py` 5 个 code），说明抽取器本身可用。
- relay 运行时实体存在：`acquisition/capture_sink.py`、`acquisition/capture_grants.py`
  已入库（未修改），Runtime 侧 capture WebSocket handler 存在于 `app.py`。

**结论：relay v10 实现看起来是齐备的；R0 失败是「冻结哈希 ↔ 当前工作树」不一致，
不是实现缺失。**

### 4.4 漂移内容并非 relay 工作

`git diff`（相对 HEAD `a303551`）显示两个文件的增量为：

- `coordinator.py`：`+337 / -30`
- `app.py`：`+419 / -38`

新增内容为 `default_media_download_cache_root()`、`/v1/media/portal-settings/bilibili`
（GET/PUT/PATCH/POST-test/DELETE）、`/v1/media/cache`（GET/PATCH/DELETE）、
`/v1/media/acquisitions/resolve` 等，属 **V3-2/V3-3 的门户设置、媒体缓存与获取**，
不是 WP0 relay 的增量。

## 5. 为什么 ClaudeCode 不能自行修复

两条候选修复都超出 WP0 授权：

| 候选修复 | 越权原因 |
|---|---|
| (a) 把当前哈希重新冻结进 `v3-media-capture-internal-relay-v10-fixtures.json` | 该 fixture 是 R0 的**冻结合同证据**。`03-master-roadmap.md §3`：「ClaudeCode不能代替这些冻结动作。缺文档时只报告 prerequisite missing 并停止。」且用户指令禁止修改冻结分母/验收阈值。 |
| (b) 把 `app.py` / `coordinator.py` 还原到冻结哈希对应内容 | 会删除既有未提交产品代码（合计 +756 行），违反「禁止覆盖用户改动、删除历史失败证据」。 |

`02-target-architecture-and-boundaries.md §7 架构停止条件` 亦要求：需要修改公共合同/证据冻结时立即停止并交回 Codex。

## 6. R0 结论

**R0 = NO-GO（Major）**，失败项全部同源于 2 个源文件的冻结哈希漂移。
R1–R7 **未启动**。

## 7. 交回 Codex 的判定请求

Codex 需要在以下两者中择一（ClaudeCode 不代选）：

1. **重新冻结**：确认当前 `app.py` / `coordinator.py` 是权威内容，更新 fixture 的
   `sourceInventoryEvidence.scopes[].sha256`（及必要时重算 40-code inventory），
   然后 ClaudeCode 重跑 R0；或
2. **还原工作树**：确认冻结哈希对应内容才是权威，要求由具备权限的一方还原
   `app.py` / `coordinator.py`，然后 ClaudeCode 重跑 R0。

同时请确认：`V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` 在当前 `app.py` 中位于
`websocket.close(...)` 的 `keyword` 父节点；验证器 `PYTHON_BOUNDARY_PARENTS`
已包含 `ast.keyword`，因此重新冻结后该项可被正常抽取（无需改验证器）。

## 8. 下一阶段 prerequisite（R1）

R1「Background transport、同步 stage、cleanup owner」的前置条件：

- [ ] Codex 处置 §7 的冻结哈希问题并给出放行结论
- [ ] 重跑 `verify-...-v10-contract.py` 达到 50/50（退出码 0）
- [ ] 重跑 `verify-...-v10-mutations.py` 达到 15/15（退出码 0）
- [ ] 本 candidate 的 R0 checkpoint 被 Codex 接受
- [ ] 用户确认（如 R1 需可见 Chrome / 原生弹窗 / 焦点 / UIAutomation，必须先通知）

未满足前，R1 不得启动。

## 9. 本轮未做的事

- 未修改任何产品代码、schema、合同、fixture、固定分母或验收阈值
- 未执行 reset / checkout / clean / commit / push
- 未启动 R1–R7、WP1、六视频 fresh run、Provider 请求
- 未执行可见 Chrome、原生权限弹窗、焦点抢占或 UIAutomation
- 未自行宣布 PASS，未承担独立外审
