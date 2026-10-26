# WP0 R0 测试结果（2026-10-16）

Candidate: `wp0-r0-2026-10-16`
所有命令在 `/mnt/c/workSpace/navia` 执行（`apps/chrome-extension` 与 `services/local-runtime` 子目录单独 cd）。

## 1. 命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-contract.py` | 2 | 46/50 PASS · 4 FAIL |
| 2 | `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v10-mutations.py` | 2 | 14/15 PASS · 1 FAIL |
| 3 | `cd apps/chrome-extension && npm run typecheck` | 0 | PASS |
| 4 | `cd apps/chrome-extension && npm test` | 0 | PASS — 58 files / 392 tests / 357.81 s |
| 5 | `cd apps/chrome-extension && npm run build` | 0 | PASS — Σ 4.63 MB / 4.678 s |
| 6 | `cd services/local-runtime && PYTHONPATH=. ./.venv/bin/python -m pytest tests/ -k "capture or transcript or outline or fault or product" -q` | 0 | PASS — 180 passed / 531 deselected / 16.00 s |
| 7 | `node --test`（8 份离线 node-test） | 0 | PASS — 134/134 / 3.33 s |
| 8 | `node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs` | 0 | PASS — 6/6 / 6.30 s |

原始输出：`r0-relay-v10-contract-baseline.json`、`r0-relay-v10-mutations.json`。

## 2. v10 baseline 失败明细（4 / 50）

```json
"failedChecks": [
  "sourceEvidenceHashesCurrent",
  "sourceScopeExtractorsValid",
  "sourceEmitSetEqualsFrozenInventory",
  "discoveredCodeUniverseClosed"
],
"summary": { "total": 50, "passed": 46, "failed": 4 }
```

`sourceInventoryDiff`：

```json
{
  "actualCount": 34,
  "frozenCount": 40,
  "missing": [
    "V3_MEDIA_ACQUISITION_IN_PROGRESS",
    "V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN",
    "V3_MEDIA_CAPTURE_NOT_ELIGIBLE",
    "V3_MEDIA_CAPTURE_ORIGIN_MISMATCH",
    "V3_MEDIA_CAPTURE_STREAM_INVALID",
    "V3_MEDIA_SOURCE_TASK_ACTIVE"
  ],
  "extra": []
}
```

其余 46 项（含 `schemaMetaValid`、`protocolAuthorityAllFieldsImmutable`、
`allFixtureAuthoritiesImmutable`、`protocolInstanceSchemaValid`、
`nineUniqueMessageVariantsExact`、`sourceInventoryExact40`、`targetInventoryExact20`、
`threeRevisionDomainsExplicit`、`noPublicApiExpansion`、
`restartRecoveryNoInMemorySuccessClaim` 等）全部通过。

## 3. v10 mutation 失败明细（1 / 15）

```json
{
  "name": "non_boundary_lexical_string_control",
  "expectedExit": 0,
  "actualExit": 2,
  "observedChecks": [
    "discoveredCodeUniverseClosed",
    "sourceEmitSetEqualsFrozenInventory",
    "sourceEvidenceHashesCurrent",
    "sourceScopeExtractorsValid"
  ],
  "passed": false
}
```

该对照用例要求「未改动的基线必须返回 0」；基线因 §2 的同一原因失败，故连锁失败。
其余 14 个变异用例（`owner_manifest_failure_removed`、`hard_crash_trace_step_removed`、
`source_inventory_entry_added`、`offscreen_direct_boundary_emit`、
`python_acquisition_boundary_emit` 等）均按预期返回 2，说明变异检测能力本身有效。

## 4. 冻结哈希漂移（唯一根因）

| 源文件 | 冻结 | 当前 |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | `de3a903564fe534e1dd1bb94850491abaeec56fd567678b609a88fec33da759b` | `ddbf830f5ce5d15b2270deba636ad5620531ef122ef28ee6903a5f8ad603cb5c` |
| `services/local-runtime/navia_runtime/app.py` | `40040aed9ad7b3d29d93e487e92042ac97d201bf1f837dafdac697418f7c3618` | `518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8` |

其余 9 个冻结源文件哈希一致。

## 5. 已排除项

- **不是实现缺失**：6 个「缺失」code 全部存在于当前工作树；7 个抽取符号全部存在；
  对两个文件单独调用验证器 `python_codes()` 均返回 `valid=True`
  （`coordinator.py`→7 code、`app.py`→5 code）。
- **不是抽取器缺陷**：`V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` 位于 `websocket.close(...)`
  的 `ast.keyword` 父节点；`PYTHON_BOUNDARY_PARENTS` 已含 `ast.keyword`。
- **不是 fixture 缺失**：v10 schema 与 fixture 均为单份存在
  （`git status` 显示为未跟踪 `??`，与用户所述「新交接包属于未跟踪文件」一致）。
- **不是 relay 增量**：漂移内容为 V3-2/V3-3 门户设置、媒体缓存与获取路由。

## 6. cleanup / secret scan

- 本轮未启动 Chrome、Runtime 长驻进程、Provider 请求或六视频 run。
- 离线 node 测试与 Runtime API 集成测试使用 `os.tmpdir()` 沙箱并在结束时清理。
- 结束前进程核查未见遗留 `run_one_bvid` / `sequencer_rb` / `running_sleep` /
  `navia-b5-3-canary` 进程。
- 公开证据只含固定 code 名与哈希；未写入 Cookie 值、API key、凭据、
  原始音视频或绝对私有路径。

## 7. 结论

R0 机器门槛 8 项中 **6 项 PASS、2 项 FAIL（同一根因）**。
按 `05-wp0-relay-acceptance.md`，R0 需 50/50 + 15/15 才可进入 R1；
**R1 未启动**，等待 Codex 处置冻结哈希问题。
