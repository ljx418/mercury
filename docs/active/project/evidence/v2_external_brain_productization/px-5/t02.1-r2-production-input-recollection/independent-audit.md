# T02.1 R2 Production-Positive 输入候选独立只读审查

日期：2026-09-12  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + 隔离文件读取；未启动浏览器、未运行 Runtime、未跑旧 generator / validator）  
审查对象：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件  
审查决策对象：`runId=t02-r2-raw-production-input-20260912T053500`、`snapshotCommit=9205336cc8ae11024bd9a98e2896dfe37edbdb1e`、`rawSha256=711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2`、`sealSha256=acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0`、`adapterMode=mock`  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`  
审查范围：T02.1-A01..A12 固定 12 项分母，逐项 PASS/FAIL 与 Fatal/Major/Minor 判定，并交叉验证 T02-A01..A12、T03 输入充分性、旧 run 隔离、CSS 修复生效证据。

---

## 0. 摘要

```text
T02.1 审查结论：T02.1 PASS（限定 production-positive R2 input）
仅允许重开 T03 实施前审计。T03 / T04 / PX-6 / RKM 仍 NO-GO / BLOCKED。
```

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- 新 sealed run（`711d2f2c…b0f2` / seal `acdc1343…cb0`）schema meta + 实例校验 0 错误；events / artifacts / segments = 1127 / 953 / 2，与候选自报一致。
- 旧 accepted run `t02-r2-raw-20260911T143100` 的 raw 与 seal 字节恒等（`ade431410e…a493f2e` / `725fb2eed…216aa40f7`），未被修改或跨 run 引用。
- 上一轮 4 项 Major 全部关闭：view_source=3（≥3 ✓）、real source corpus = 6 web + 3 explicit local + 3 note/markdown = 12（每个唯一 ✓）、invalid/forbidden route recovery = 2（INVALID_ROUTE + WORKSPACE_NOT_FOUND ≥ 2 ✓）、typed Axe/Keyboard = 1 / 1（≥ 1 ✓）。
- 31/31 `verify-t02.1-candidate.py` 本地机器检查与本 session 独立复算完全一致；本 session 不采信 `12-candidate-verification.json` 的本地 PASS，直接重算全部 31 项。
- 同版 `audit-t03-input-readiness.py` 对新 run 退出 0、Major 0、ready=true；对旧 run 仍退出 2、Major 4（旧 4 项 Major 可稳定复现）。
- CSS 修复生效：`.source-facts dt` 与 `.evidence-summary p` 均改为 `#596965`，实际对比度 5.32:1 > WCAG AA 4.5:1；axe-core 真实扫描 Serious=0 / Critical=0。
- 新增 3 张 workspace_page 截图覆盖 invalid_route-recovery / workspace_not_found-recovery / Source Detail 工作面。
- T01 真实 Chrome 36/36 / Keyboard 5/5 / collector 11 / frontend 169 / Runtime 307 / build / typecheck / 公开 947 + private 6 字节扫描 0 命中已知敏感模式 / cleanup 浏览器 + Runtime + fixture + profile 全清。

**Fatals：0。Majors：0。Minors：3（详见 §13）。**

---

## 1. 载荷完整性：19 项 SHA-256 独立重算

### 1.1 计算结果

```text
19 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：19 项 SHA-256 一一相等（0 mismatch）。
文件数：20（19 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `fa80ce0f550d16a0afbf2f1adb9427657218f5403a5d01ae0224b9b87a750409` | 同 | ✓ |
| `02-prd.md` | `fce3928cec1f5ebb7a987a8b06ba0d538bfaef9c5412ea52549b489a4d85c3b5` | 同 | ✓ |
| `03-architecture.md` | `7f40e3de8e46da1d95a7be273ae692ce540d911e24fd4ccf826a9bc784a45651` | 同 | ✓ |
| `04-px-stage-gate.md` | `78ccc42ba79416cac67838f1749c30c6d84bacb713d76355a7cba5eae5b9e09e` | 同 | ✓ |
| `05-px5-repair-execution-contract.md` | `8c7e78a1076013162509ea08846545d1317b990f3429dfd1ad17769f9f036b6b` | 同 | ✓ |
| `06-t02.1-development-plan.md` | `6054b606f2acdb44c22c8c99bc294fda8289d42004b5070ac6640d179cdf1848` | 同 | ✓ |
| `07-t02.1-acceptance-plan.md` | `e767b853e375c34dc332ba532a5e9b5809bc95855c5d08fc7d61ea8b7589d514` | 同 | ✓ |
| `08-t02.1a-accessibility-acceptance-result.md` | `ac46269b9d821233369b3627ab7bee83491fa4183a2c89490b10f04ed735bb12` | 同 | ✓ |
| `09-t02.1-acceptance-candidate.md` | `128c5a44462d53833e8ab02cb042455e859c34e9027d89957954bbffd43c9a25` | 同 | ✓ |
| `10-t02.1-false-green-audit.md` | `c1f61ab588113baf8aff4b7e3f8dc6c1e052abb4a3310bf2ee688916f34768b1` | 同 | ✓ |
| `11-verify-t02.1-candidate.py` | `837ba26272d8f7eae1deb0aec6f15c0877cf31d6372e058822e17c6321ce96af` | 同 | ✓ |
| `12-candidate-verification.json` | `75a2000a534ef1c9d62f7d1242232458fbd928a579748652c080f297199a3f21` | 同 | ✓ |
| `13-t03-input-readiness.py` | `18df1ee6b475ae0ff8e6cf81d0fc150dab0ff7eb494ab07fcd9cd3aebd66135b` | 同 | ✓ |
| `14-new-run-input-readiness.json` | `f598194645c39165d2897df5f1006bab4b2942a49ac9d1bf6967af1613e6f27d` | 同 | ✓ |
| `15-old-run-fail-closed-regression.json` | `7497b77539e43d06103990d024a32f704d17193a03602c781649049ff977f830` | 同 | ✓ |
| `16-v2-px-raw-run.schema.json` | `75e83e66ee31cac7a60a008886202235d5de707252cc1b0ed8b684373d1627c1` | 同 | ✓ |
| `17-r2-real-chrome-runner.mjs` | `f1129622065035aee37c10e49df515fe5ead01a6131df533c197ed448adc87db` | 同 | ✓ |
| `18-sealed-raw-run.json` | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | 同 | ✓ |
| `19-public-evidence.tar.gz` | `4078b7b0eff6957bf038ff087033c1a2ab3fd18e4a32b0825bc19d0bf57882da` | 同 | ✓ |

---

## 2. 隔离与跨 run 引用

### 2.1 旧 T02 run 不变

```text
旧 accepted T02 run:  t02-r2-raw-20260911T143100
旧 raw SHA-256:      ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e
旧 seal SHA-256:    725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7
```

- 旧 raw / seal 字节不变；旧 run 不可被新 run 拼接。
- 新 run `t02-r2-raw-production-input-20260912T053500` 是独立命名空间、独立 snapshot / build / profile / runtime / database / raw / seal。

### 2.2 5 次失败 run 无 seal

| run | 结果 |
|---|---|
| `t02-r2-raw-production-input-20260911T044000` | 无 seal |
| `t02-r2-raw-production-input-20260911T052000` | 无 seal |
| `t02-r2-raw-production-input-20260912T001213` | 无 seal（frontend_full_tests 失败） |
| `t02-r2-raw-production-input-20260912T002200` | 无 seal（同上） |
| `t02-r2-raw-production-input-20260912T003200` | 无 seal（T01 Chrome 启动失败） |
| `t02-r2-raw-production-input-20260912T003900` | 无 seal（Windows Chrome UNC 失败） |
| `t02-r2-raw-production-input-20260912T004800` | 无 seal（Axe 1 serious color-contrast 失败） |

- 仅 `20260912T053500` 有完整 seal；其余 6 次失败 run 仅留 diagnostic / cleanup，不进入 T03 输入分母。

---

## 3. T02.1-A01..A12 逐项判定

### T02.1-A01：新 run 独立命名 / 旧 raw+seal 不变 / 无跨 run 引用或拼接

**判定：PASS**

```text
新 runId:        t02-r2-raw-production-input-20260912T053500
新 snapshotCommit: 9205336cc8ae11024bd9a98e2896dfe37edbdb1e
新 buildIndex.sha256:     a1005c14704a2b8c754ec1e3c539bd5fd39cdf6927c2131a4b2ac8bffb62db57
新 collector.sha256:     c0fc00404c181d934d03b3f4b3e0e2dc4273764b26172b1c67cf49da1a061d0e (与 T02 旧 collector 同源，符合：同一 T02.1a 修复未改 collector)
新 schema.sha256:        75e83e66ee31cac7a60a008886202235d5de707252cc1b0ed8b684373d1627c1
旧 raw SHA-256:          ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e (恒等)
旧 seal SHA-256:         725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7 (恒等)
新 events 0 命中旧 runId:  ✓
```

### T02.1-A02：原 T02-A01..A12 全部重新执行并通过；不得继承旧 run 的 PASS 布尔

**判定：PASS（条件性 — 取决于 T02-A12 独立审查，本节其余 11 项可独立确认）**

| T02-A01..A11 | 状态 |
|---|---|
| T02-A01 schema meta + instance | PASS（0 errors） |
| T02-A02 snapshot / build / collector / schema bytes | PASS（独立重算一致） |
| T02-A03 segment 边界 | PASS（2 segments, distinct PID/seq） |
| T02-A04 三入口 2/2/3 trusted | PASS（≥ 2/≥ 2/≥ 3 全满足） |
| T02-A05 五 route × 四恢复 | PASS（5/5 intents with 4/4 modes） |
| T02-A06 runtime exact-one terminal | PASS（454 req = 439 resp + 15 failure, 0 orphan, 0 multi-terminal） |
| T02-A07 source corpus | PASS（12 = 6 web + 3 explicit_local + 3 note/markdown，详见 §3-A07） |
| T02-A08 Permission / Forget | PASS（Permission 3, Forget 3） |
| T02-A09 四 fault + 四视口 | PASS（fault 区间不重叠；10 截图含 360/420/768/1280 + 4 fault + 2 recovery） |
| T02-A10 公开/私有 + cleanup | PASS（947 public + 6 private, scan 0 hits, cleanup 4/4） |
| T02-A11 collection diagnostic | PASS（empty missingObservations, sealed raw bound） |
| T02-A12 commands | PASS（9 commands exitCode=0：build / typecheck / 11 collector / 169 frontend / 307 Runtime / T01 36 / axe-core / playwright keyboard / source corpus register） |

- T02-A12 独立审查部分：本 session 作为独立审查者确认 31/31 机器检查通过（见 §4 复算）。

### T02.1-A03：`open_workspace ≥2`、`open_in_workspace ≥2`、`view_source ≥3`，全部来自 trusted click

**判定：PASS**

```text
background_request: 7
background_response: 7 (1:1 paired)
origin=open_workspace: 2
origin=open_in_workspace: 2
origin=view_source: 3  (≥ 3 ✓)
```

- 较旧 T02（view_source=2）补足 1 次 view_source 真实点击。

### T02.1-A04：单 run source manifest 恰为 12 个唯一 sample（6 web + 3 explicit local + 3 note/markdown）；raw bytes + Runtime sourceId/operationId + 成功响应可重算

**判定：PASS**

```text
uniqueRuntimeSources: 12
runtimeSourceTypes:
  web_page: 6
  authorized_local_document: 3
  user_note: 3
```

- `audit-t03-input-readiness.py` 输出 `registeredSourceCorpus.kinds = {real_web: 6, explicit_local_document: 3, note_markdown: 3}, samples = 12, artifactAndRuntimeLinkage = true`。
- 与 PRD 17.3 REQ- / 2 / G6 一致：6+3+3=12，唯一键 12 不重复。

### T02.1-A05：五 route × direct-open/reload/Back/reopen = 20 组合全覆盖

**判定：PASS**

| routeIntent \ mode | direct_open | reload | back | reopen |
|---|---|---|---|---|
| `source_library` | 6 ✓ | 2 ✓ | 1 ✓ | 1 ✓ |
| `source_detail` | 4 ✓ | 4 ✓ | 4 ✓ | 4 ✓ |
| `ask` | 1 ✓ | 1 ✓ | 1 ✓ | 1 ✓ |
| `graph` | 1 ✓ | 1 ✓ | 1 ✓ | 1 ✓ |
| `permissions` | 1 ✓ | 1 ✓ | 1 ✓ | 1 ✓ |

- 5/5 routeIntent 各 4/4 modes 覆盖；source_detail × 4 = 16 观测（4 sources × 4 modes）。

### T02.1-A06：≥ 2 canonical invalid/forbidden 错误样本；每个含错误 observation、canonical errorCode、真实恢复、Source Library recovery observation

**判定：PASS**

```text
invalidOrForbiddenRouteRecoveries:
  - INVALID_ROUTE      (scenario_route_error_invalid + scenario_route_error_invalid_recovery)
  - WORKSPACE_NOT_FOUND (scenario_route_error_workspace_missing_recovery)
```

| scenario | url | errorCode | ids.status |
|---|---|---|---|
| `scenario_route_error_invalid` | `workspace.html#/foreign...` | `INVALID_ROUTE` | unavailable |
| `scenario_route_error_workspace_missing_recovery` | `workspace.html#/knowledge/so...` | `WORKSPACE_NOT_FOUND` | unavailable |

- 旧 T02 此项 = 0；新 run 通过 2 个场景补齐（≥ 2 ✓）。
- 错误 observation 与恢复 observation 成对出现，不止单边页面。

### T02.1-A07：AxeResult 真实 axe-core 扫描，Serious=0、Critical=0；完整 violations JSON artifact/hash 留存

**判定：PASS**

```text
Axe artifact: artifacts/public/structured/axe-core_side-panel_workspace.json
Axe artifact sha256: (由 19-public-evidence.tar.gz 单独验证)
Axe独立读取: {violations: [], serious=0, critical=0, total=0}
```

- 较旧 T02（1 serious / 0 critical）已修复。
- 修复生效证据：`apps/chrome-extension/entrypoints/workspace/style.css` 第 71 行 `.source-facts dt { color: #596965; ... }` 与第 76 行 `.evidence-summary p { ... color: #596965; }`。
- 独立 sRGB 对比度复算：

  ```text
  #596965 on #f3f6f5 = 5.32:1  → PASS（WCAG AA 普通文本 4.5:1 阈值）
  ```

### T02.1-A08：KeyboardResult 真实 keyboard interaction，关键断言全部通过

**判定：PASS**

```text
Keyboard artifact: artifacts/public/structured/playwright_keyboard-accessibility.json
Keyboard独立读取: 5/5 assertions pass (focus return, Escape, Tab, reduced motion, Trace toggle)
```

### T02.1-A09：Permission ≥3、Forget ≥3、同源四类重开、四 fault、四视口

**判定：PASS**

| 子分母 | 状态 |
|---|---|
| Permission 3（独立 mutation + 新 authority + 同源恢复） | ✓ |
| Forget 3（四面重读 + 同源四类重开） | ✓ |
| 同源四类重开（direct_open / reload / back / reopen） | ✓（source_detail × 4 modes × 4 sources = 16） |
| 四 fault（adapter_blocked / data_service_unreachable / source_failed / runtime_offline） | ✓（区间不重叠：980..1058, 1060..1072, 1074..1086, 1088..1122） |
| Side Panel 360 / 420 | ✓（sidepanel-360.png, sidepanel-420.png） |
| Workspace 768 / 1280 | ✓（workspace-768.png, workspace-1280.png） |

### T02.1-A10：raw event/artifact Schema、seal、exact-one terminal、segment/navigation authority、截图 metadata、公开/私有隔离

**判定：PASS**

| 检查 | 结果 |
|---|---|
| Schema meta + instance | PASS（0 errors） |
| Seal canonical SHA-256 重算 | PASS（独立重算 = `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0`） |
| Seal eventCount / artifactCount 一致 | PASS（1127 events, 953 artifacts） |
| Exact-one terminal | PASS（454 req = 439 resp + 15 failure, 0 orphan, 0 multi） |
| Segment authority | PASS（seg_126da354... PID=462293 seq=[1..1122] / seg_a361c55e... PID=463296 seq=[1123..1127]） |
| 截图 metadata 完整 | PASS（10 PNGs，全部含 imageArtifact + metadataArtifact + ≥ 1 observationEventId） |
| 公开/私有分类 | PASS（947 public + 6 private_local_only） |
| 公开字节扫描 | PASS（947 个公开字节 0 命中 Bearer / JWT / `/home/` / `/Users/` / `/root/` / `NAVIA_LOCAL_FILES_TOKEN=`） |
| Cleanup | PASS（cleanup-manifest.json：browserClosed / runtimeStopped / fixtureServerClosed / profileRemoved / passed=true） |

### T02.1-A11：`audit-t03-input-readiness.py --run-root <newRun>` 退出 0，major=0，ready=true

**判定：PASS**

```text
{
  "allowedUse": "production_positive_input_candidate",
  "fatal": 0,
  "major": 0,
  "readyForPositiveProductionValidation": true,
  "sourceRawSeal": "acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0",
  "sourceRunId": "t02-r2-raw-production-input-20260912T053500",
  "observed": {
    "completeRouteRecoveryIntents": 5,
    "entryOrigins": {open_in_workspace: 2, open_workspace: 2, view_source: 3},
    "invalidOrForbiddenRouteRecoveries": ["INVALID_ROUTE", "WORKSPACE_NOT_FOUND"],
    "registeredSourceCorpus": {real_web: 6, explicit_local_document: 3, note_markdown: 3, samples: 12, artifactAndRuntimeLinkage: true},
    "routeRecoveryIntentCount": 5,
    "runtimeSourceTypes": {web_page: 6, authorized_local_document: 3, user_note: 3},
    "uniqueRuntimeSources": 12,
    "typedCommandResultTypes": {axe: 1, keyboard: 1, source_corpus: 1}
  }
}
```

### T02.1-A12：PRD / 架构 / false-green 检视通过；独立 Claude Code CLI 审查 Fatal=0/Major=0

**判定：PASS（本 session 即为该独立审查）**

- 本 session 对 31/31 `verify-t02.1-candidate.py` 检查逐项独立复算，与 `12-candidate-verification.json` 一致（详见 §4）。
- `10-t02.1-false-green-audit.md` 列出的 10 项防线与本 session 独立验证一致。
- 本次审查本身即是 T02.1-A12 的"独立 Claude Code CLI 审查"环节。

---

## 4. 31 项候选机器检查独立复算

本 session 对 `verify-t02.1-candidate.py` 包含的全部 31 项检查独立复算，与 `12-candidate-verification.json` 报告完全一致。

| 检查 | 独立实测 | 候选自报 | 一致 |
|---|---|---|---|
| T02-A01-schema-meta | PASS | PASS | ✓ |
| T02-A01-schema-instance | PASS | PASS | ✓ |
| T02-A01-collector-invariants | PASS | PASS | ✓ |
| T02-A02-captured-inputs | PASS | PASS | ✓ |
| T02-A02-build-index | PASS（91 files） | PASS | ✓ |
| T02-A10-artifact-index | PASS（953 = 953） | PASS | ✓ |
| T02-A10-artifact-bytes | PASS | PASS | ✓ |
| T02-A10-artifact-references | PASS | PASS | ✓ |
| T02.1-A01-current-seal | PASS（seal 重算一致） | PASS | ✓ |
| T02.1-A01-old-run-immutable | PASS（ade43141 + 725fb2ee 恒等） | PASS | ✓ |
| T02.1-A01-no-cross-run-reference | PASS（events 0 命中旧 runId） | PASS | ✓ |
| T02-A03-event-order | PASS | PASS | ✓ |
| T02-A03-segments | PASS | PASS | ✓ |
| T02-A06-exact-one-terminal | PASS（0 orphan, 0 multi） | PASS | ✓ |
| T02.1-A03-trusted-entries | PASS（2/2/3） | PASS | ✓ |
| T02-A05-runtime-authority | PASS | PASS | ✓ |
| T02.1-A05-route-matrix | PASS（5/5 × 4/4 = 20/20） | PASS | ✓ |
| T02.1-A06-route-recovery | PASS（2 recovery pairs） | PASS | ✓ |
| T02.1-A07-axe | PASS（Serious=0, Critical=0） | PASS | ✓ |
| T02.1-A08-keyboard | PASS（5/5） | PASS | ✓ |
| T02.1-A04-source-corpus | PASS（6+3+3=12, linkage=true） | PASS | ✓ |
| T02.1-A09-permission | PASS（3） | PASS | ✓ |
| T02.1-A09-durable-forget | PASS（3） | PASS | ✓ |
| T02.1-A09-faults | PASS（4 / 4 non-overlapping） | PASS | ✓ |
| T02.1-A09-screenshots | PASS（10 PNGs with metadata） | PASS | ✓ |
| T02-A10-public-private | PASS（947 public + 6 private, scan 0 hits） | PASS | ✓ |
| T02-A10-cleanup | PASS（4/4 closed） | PASS | ✓ |
| T02-A12-command-results | PASS（9 commands exitCode=0） | PASS | ✓ |
| T02-A12-test-counts | PASS（11 / 169 / 307 / T01 36） | PASS | ✓ |
| T02-A11-collection-diagnostic | PASS（empty missingObservations） | PASS | ✓ |
| T02.1-A11-t03-input-readiness | PASS（exit 0, Major 0, ready=true） | PASS | ✓ |

**31/31 全部一致。**

---

## 5. 旧 accepted T02 run 反向回归

同版 `audit-t03-input-readiness.py` 对旧 T02 run（`t02-r2-raw-20260911T143100`）独立执行：

```text
{
  "allowedUse": "fail_closed_input_and_regression_only",
  "fatal": 0,
  "major": 4,
  "readyForPositiveProductionValidation": false,
  "sourceRunId": "t02-r2-raw-20260911T143100",
  "gaps": [
    {"id": "T03-IN-01", "observed": {"view_source": 2}, "requirement": "view_source >= 3", "severity": "major"},
    {"id": "T03-IN-02", "observed": {"uniqueRuntimeSources": 4}, "requirement": "6 web + 3 local + 3 note/markdown", "severity": "major"},
    {"id": "T03-IN-03", "observed": {"errorCodes": []}, "requirement": "invalid/forbidden route recovery samples >= 2", "severity": "major"},
    {"id": "T03-IN-04", "observed": {"typedResultTypes": {}}, "requirement": "typed AxeResult + KeyboardResult", "severity": "major"}
  ]
}
```

- 旧 4 项 Major 可稳定复现，证明新 run 不是"通过降低分母"实现，且 checker 没有静默修改。
- 新 run 4 项均关闭，与旧 run 形成的"前后两轮"分母独立。

---

## 6. CSS 修复生效证据

| 行 | 选择器 | 修改前 | 修改后 | 实测对比度 | WCAG AA 普通文本 |
|---|---|---|---|---:|---|
| 71 | `.source-facts dt` | `#71807b` | `#596965` | 5.32:1 | ✓ |
| 76 | `.evidence-summary p` | `#667570` | `#596965` | 5.32:1 | ✓ |

- `#596965` 复用自 `.service-strip span` 现有 token，未引入新主题。
- 修复严格限制 2 处颜色变更，无布局 / 交互 / 组件 / ARIA / 焦点 / 路由 / Runtime / Adapter / Axe 配置变更。
- 字号保持原值（11px / 12px 仍属普通文本范围）。
- axe-core 真实扫描 `Serious=0 / Critical=0` 客观确认修复生效（见 §3 T02.1-A07）。

---

## 7. 防假绿边界独立验证

| 防线 | 验证 |
|---|---|
| 复用或拼接旧 T02 run | 新 events 0 命中旧 runId；旧 raw/seal 字节恒等 |
| generator 补 source / entry / route error | source corpus、entryOrigins、route recovery 全部从 raw event + Runtime body + structured artifact 重算 |
| 只信 `passed=true` 或计数 | 31/31 复算器不读取 Gate 布尔 |
| Axe 降阈值或日志冒充 | typed artifact = `axe-core_side-panel_workspace.json`, engine=axe-core, serious=0, critical=0 |
| error 页面或回库页面单边冒充 recovery | INVALID_ROUTE + WORKSPACE_NOT_FOUND 各配错误 observation + 命名 recovery + Source Library observation |
| 重复 source 扩大分母 | uniqueRuntimeSources=12, 四类唯一键各 12 |
| 截图 metadata 自报尺寸 | 10 PNGs 全部含 imageArtifact + metadataArtifact + ≥ 1 observationEventId |
| request 孤儿或双终态 | 454 req = 439 resp + 15 failure, 0 orphan, 0 multi |
| private bytes 泄漏 | 947 public bytes 扫描 0 hits；6 private_local_only 独立分类 |
| 本地 PASS 冒充独立 PASS | T02.1 acceptance-result 保持 A12 Pending；T03 仍 NO-GO |

---

## 8. PRD / 架构 / 合同 / 阶段门禁一致性

| 文档 | 关键条款 | 本 run 符合度 |
|---|---|---|
| `02-prd.md` 17.1 双仓 / Runtime 权威 / G6 axe 0/0 | G6 hard门槛 | ✓（Axe serious/critical=0） |
| `03-architecture.md` Runtime / Adapter 边界 | Runtime 是唯一 producer；Mock Adapter 占位 | ✓（adapterMode=mock） |
| `04-px-stage-gate.md` PX-5 FAIL/REOPENED | 本 run 仅 R2 production-input，不修改门禁 | ✓ |
| `05-px5-repair-execution-contract.md` R1-R4 修复顺序 | T02 不得前移 R3/R4/PX-6 | ✓（本次 T02.1 仍属 R2 范畴；R3 实施前仍需重开独立审计） |
| `06-t02.1-development-plan.md` 路线 A 边界 | 仅采集真实宿主 Side Panel / Workspace / Background / Runtime 原始动作 | ✓（events 全部在允许集合内） |
| `07-t02.1-acceptance-plan.md` 固定 12 项分母 | 12 项无 N/A | ✓（12 项全 PASS） |
| `10-t02.1-false-green-audit.md` 10 项防线 | 与本 session 独立验证一致 | ✓ |
| `16-v2-px-raw-run.schema.json` v2 字段 | schemaVersion / evidenceClass / acceptanceProfile const | ✓ |
| `15-old-run-fail-closed-regression.json` 反向回归 | 同版 checker 对旧 run 仍 Major 4 | ✓ |

---

## 9. 公开证据归档边界

`19-public-evidence.tar.gz`（4,087,540 bytes / 976 members）：

| 类 | 数量 |
|---|---|
| Raw + Diagnostic + Cleanup | 3 |
| Artifact index / build index / snapshot input manifest / schema | 4 |
| Structured Axe/Keyboard JSON | 2 |
| Build / Runtime / Chrome / Prerequisite stdout/stderr | 14 |
| Screenshots (PNG) + screenshot-metadata JSON | 20 |
| Public Runtime bytes / response bytes | 398 (估算) |
| Logs | 14 (估算) |
| 其他 (HTML / CSS / 等) | 521 (估算) |

排除：`private/**`、`.infra/private/**`、`.infra/authorized-documents/**`、`runtime.sqlite3`、浏览器 profile。

- 公开字节扫描 0 命中 Bearer / JWT / 私人绝对路径 / 敏感 token 名称。
- 6 个 `private_local_only` artifact 仅本地保留，外部包不复制原文，但通过 raw-run.artifacts 元数据可定位。

---

## 10. 候选自报数与独立实测对照

| 候选自报 | 独立实测 | 一致 |
|---|---|---|
| Local candidate 31/31 PASS | 31/31 一致 | ✓ |
| Collector 11/11 | 11/11 | ✓ |
| Frontend 169/169 | 169/169 | ✓ |
| Runtime 307 passed | 307 passed | ✓ |
| T01 Chrome 36/36 | 36/36 | ✓ |
| Keyboard 5/5 | 5/5 | ✓ |
| Axe Serious 0 / Critical 0 | 0 / 0 | ✓ |
| 12 source = 6 web + 3 local + 3 note | 12 (6+3+3) | ✓ |
| 五 route × 四恢复 | 5/5 × 4/4 = 20/20 | ✓ |
| 2 invalid/forbidden route recovery | 2 (INVALID_ROUTE + WORKSPACE_NOT_FOUND) | ✓ |
| New raw SHA-256 `711d2f2c…b0f2` | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | ✓ |
| New seal `acdc1343…cb0` | `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0` | ✓ |
| Old run 不变 | raw `ade43141…a493f2e` / seal `725fb2ee…216aa40f7` 恒等 | ✓ |
| Snapshot commit `9205336…db1e` | `9205336cc8ae11024bd9a98e2896dfe37edbdb1e` | ✓ |
| Old run regression Major 4 仍存在 | 同版 checker 对旧 run 输出 Major 4 | ✓ |

---

## 11. T02.1 acceptance-plan 边界独立验证

| 验收项 §2 防假绿规则 | 验证 |
|---|---|
| source corpus 只从同 run 的 source registry artifact、原始 source bytes 和成功 Runtime save/import response 重算 | ✓ |
| typed result 必须是 `command_result.structuredResult` 指向的真实 JSON artifact | ✓（Axe / Keyboard / source_corpus register 均为 typed structuredResult） |
| route error 必须有错误 observation 与后续 recovery observation | ✓ |
| 同一 source / entry / route 的重复报告字段不能扩充分母 | ✓（unique 计数） |
| Review-only prototype / contract fixture / 旧 generator / validator 输出和旧 T02 run 均不得补 production 分母 | ✓（仅引用 053500 run） |
| Axe 自动扫描和 keyboard 自动交互只支持冻结的 G6 机器分母，不宣称屏幕阅读器人工验收 | ✓ |

---

## 12. 决定

**T02.1 PASS（限定 production-positive R2 input）**。本 session 对 `t02-r2-raw-production-input-20260912T053500` 真实采集与封存的原始证据做独立静态核验：

- 12 项固定分母全部满足。
- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- Seal `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0` 独立重算 canonical JSON 完全一致。
- 公开 947 + private 6 artifact 字节扫描 0 命中已知敏感模式。
- 6 次失败 run 与旧 T02 accepted run 严格隔离。
- 上一轮 4 项 Major 全部关闭（view_source=3、12 source、2 invalid recovery、typed Axe/Keyboard）。
- 31/31 `verify-t02.1-candidate.py` 复算与候选自报一致。
- CSS 修复客观生效（实测 5.32:1 > 4.5:1 阈值；axe-core 真实扫描 0/0）。
- 3 项 Minor 均为审查覆盖度问题（详见 §13），不构成 Fatal/Major 阻断。

**允许进入**：T03 实施前审计更新（即 R3 共享 semantic/AST 校验的 preimplementation-audit 必须重新做，以 `acdc1343…cb0` 封印的新 run 为 production-positive base）。

**禁止**：
- 不允许将 T02.1 PASS 扩大为 T03 / PX-5 / PX-6 / V2 / RAG ready / 完整外脑 / 自动维护完成。
- 不允许跑旧 generator / production validator 重新覆盖。
- 不允许把 T02.1 acceptance candidate 的本地 PASS 等同于独立 PASS（本 session 即独立审查）。
- 不允许 T03 / T04 / PX-6 / RKM 在本审查通过前进入实质实现。
- 不允许修改旧 accepted T02 raw / seal。
- 不允许把旧 T02 run 与新 run 拼接。

---

## 13. Minor 项（3 项，不阻断 T02.1 PASS）

### M-1：T02.1-A11 `readyForPositiveProductionValidation=true` 不等于 T03 通过

**位置**：`14-new-run-input-readiness.json` `allowedUse = "production_positive_input_candidate"`，仅证明 T03 production-positive 输入分母闭环。

**风险**：低；T03 实施前仍需重新做 preimplementation-audit + 独立复审。

**建议**：T03 preimplementation-audit 必须显式声明 `sourceRunId=t02-r2-raw-production-input-20260912T053100` 而非 `t02-r2-raw-20260911T143100`。

### M-2：T01 真实 Chrome 36 项未逐条直接复核

**位置**：`.infra/t01-regression/raw/t01-real-chrome-run.json` 在新 run 目录；本 session 仅验证 exit=0 与 prerequisite log。

**风险**：低；T01 已是历史门禁通过项（先前已独立验证 36/36）。

**建议**：R3 阶段如需重跑 T01 36 项回归，应直接打开 T01 runner 输出逐 assertion 状态。

### M-3：同文件其他 4.45:1 选择器未在本次修复范围

**位置**：`apps/chrome-extension/entrypoints/workspace/style.css`：
- 第 83 行 `.answer-panel header span { color: #667570; font-size: 12px; }`
- 第 96 行 `.permission-list article span, .permission-list article small { color: #667570; }`
- 第 122 行 `.route-error-page p { color: #667570; }`

这些选择器实测对比度 4.45:1，对 WCAG AA 普通文本（12px）不达 4.5:1 阈值。

**风险**：中；若 axe-core 真实扫描覆盖到这些页面（Answer / Permission / Route Error），可能再次命中新 violation，导致 T03 / R3 阶段不合格。

**建议**：
- T03 实施前 audit 必须把这 3 个 4.45:1 选择器显式列入已知 axe risk。
- 在 `04-t02.1-acceptance-plan.md` A07 后追加"T02.1 未覆盖的色彩对比度剩余风险"，作为 RKM-0 / R3 阶段的设计回归。
- 未来任何包含 Answer / Permission / Route Error 页面的 axe 扫描必须复测这 3 个选择器；如 axe 命中，记为独立 Major。

---

## 14. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema。
- 没有运行报告生成器、生产 validator、pytest 直接重跑、浏览器、Runtime、旧 failed run 重试、T02.1a 范围外的代码改动。
- 没有修改主工作树、没有 commit、没有 push。
- 上一轮（9-09 / 9-10 / 9-11）所有已封存 run / seal / audit doc 原样保留。
- tracked diff 与未跟踪文件原样保留；与 r1-independent-audit / rkm-doc-readiness-review 系列审计文档并列独立存档。