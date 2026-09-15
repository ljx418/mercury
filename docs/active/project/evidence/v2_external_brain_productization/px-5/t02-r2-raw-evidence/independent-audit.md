# T02 R2 原始证据采集独立只读审查

日期：2026-09-11  
审查者：当前 session（独立只读静态 + Python 标准库 + 隔离文件读取；未启动浏览器、未运行 Runtime、未跑原 validator / generator）  
审查对象：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件  
审查决策对象：`runId=t02-r2-raw-20260911T143100`，`snapshotCommit=c2409206e4a337314b2995665780da1ca86c7a8d`  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`  
审查范围：T02-A01..A12 固定 12 项分母，逐项 PASS/FAIL 与 Fatal/Major/Minor 判定。

---

## 0. 摘要

```text
T02 审查结论：T02 PASS（限定范围），且仅允许进入 T03 实施前规划与审计。
```

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- `t02-px-raw-run/v2` Schema 元校验与完整实例校验均 0 错误；schema `additionalProperties: false` 严格封闭。
- 13 种 event kind 全部覆盖，无额外字段泄漏；sequence 严格递增 1..1033；events / artifacts / scenarios 数量 = 1033 / 861 / 64，与候选结论一致。
- 3 入口 × 2 = 6 background request/response 链全部成对。
- 5 canonical routeIntent × {direct_open / reload / back / reopen} 全部覆盖（每对 ≥1 观测，source_detail 每模式 4 观测）。
- 420 runtime request → 403 runtime_response + 17 transport_failure（exact-one terminal，0 孤儿，0 多终态）。
- 4 类 fault 各 1 组 start/end，序列号区间 [892..1028] 不重叠。
- 8 张 PNG（side_panel 360/420、workspace_page 768/1280 正常 + 4 类 fault）。
- Seal contentSha256 = `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7` 与独立重算 canonical JSON SHA-256 完全相等；inputMode = `canonical_json_without_seal_v1`。
- 公开 artifact 6.1 MB 字节扫描：0 命中 Bearer / JWT / `/home/` / `/Users/` / `/root/` / `NAVIA_LOCAL_FILES_TOKEN=`。
- 6 条 prerequisite command exitCode=0；frontend 22 Test Files / 169 Tests / Runtime 307 passed / collector 10 tests / T01 Chrome regression exitCode=0；T01 Chrome 36 checks 与 candidate 自报一致但本 session 未直接逐条复核（已确认 exit=0 + 收集器 / Runtime / frontend 实测数）。
- 候选的 T02-A12 Pending 项已具备完整原始证据；T12 的独立自动化 CLI 因 20 分钟无输出 / max turns=24 中断两次，不得视为产品失败。
- 本次未启动浏览器、未运行 Runtime、未跑旧 generator / validator、未修改主工作树、未提交、未推送。

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
| `01-audit-request.md` | `108d8a6693e02ac15bd26ee91f8febdd6c40173bf29b54c6cca1670bd53ec92a` | 同 | ✓ |
| `02-prd.md` | `fce3928cec1f5ebb7a987a8b06ba0d538bfaef9c5412ea52549b489a4d85c3b5` | 同 | ✓ |
| `03-architecture.md` | `7f40e3de8e46da1d95a7be273ae692ce540d911e24fd4ccf826a9bc784a45651` | 同 | ✓ |
| `04-px-stage-gate.md` | `676a10d265c1a2ba501fc34f45374c2ddb02ee05c5e659b4b0194f2cc9a730e7` | 同 | ✓ |
| `05-px5-repair-execution-contract.md` | `2e233d7c6dbc8bf467e73c71e9c81092e124a04f5fd27e2d2a774fcd5107413c` | 同 | ✓ |
| `06-t02-development-plan.md` | `54f0c1b7c5207fca6e3407012441c7b094365f3a0ec1e1f3abeefec6347af700` | 同 | ✓ |
| `07-t02-acceptance-plan.md` | `9e0dc1c26c20b59a433be3b0e2f8cd64b2fd12fad896b2db9f09a9dd54fe712d` | 同 | ✓ |
| `08-t02-acceptance-candidate.md` | `cabcbb4d31722991374cd1cf501f678aee0704f97ce1475f4a30f9f27994bae3` | 同 | ✓ |
| `09-v2-px-raw-run.schema.json` | `9d851ef05c81ad36407d4d6d8ffad7dd0d1627ae0129a2b3d32e30ea056011ae` | 同 | ✓ |
| `10-raw-collector.mjs` | `c0fc00404c181d934d03b3f4b3e0e2dc4273764b26172b1c67cf49da1a061d0e` | 同 | ✓ |
| `11-raw-collector-tests.mjs` | `41f3237e15014b43d8005b193bbafadcb20e9e58d6abf51f6bc86b17bf945068` | 同 | ✓ |
| `12-r2-real-chrome-runner.mjs` | `f7ba610714a57892ee80713dae4be175e4910da86f90e61e4ef24c9007b991ea` | 同 | ✓ |
| `13-sealed-raw-run.json` | `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` | 同 | ✓ |
| `14-artifact-index.json` | `3fff4bd32f13a971d28705bc9f29e14058ba766e6c5d32b21442f32bae7a57fd` | 同 | ✓ |
| `15-collection-diagnostic.json` | `26adb72c48bfa2903e35cf0d49d44619d3a2567fdaabed6632192af0f7b9e735` | 同 | ✓ |
| `16-cleanup-manifest.json` | `f5d3c965b410f327aa35647225e873d87b03b4890ac8ab9dcd62b303c48499f4` | 同 | ✓ |
| `17-snapshot-input-manifest.json` | `276a5c60e4df852006cc24154141854ba1342153e3077fa8416e42b623948bd5` | 同 | ✓ |
| `18-build-index.json` | `349f4c52203e5504a8cc48762592c95d6e5cc88820a00510dc6185f3b2ad0bc7` | 同 | ✓ |
| `19-public-evidence.tar.gz` | `845e04e36216e9bf35b9e6738cd27c7402311fe35e372665c7df59dd27ed8587` | 同 | ✓ |

---

## 2. 早前失败 run 隔离

| run | sealed raw-run sha256 | 是否纳入本 run |
|---|---|---|
| `t02-r2-raw-20260911T044000` | —（无） | 否 |
| `t02-r2-raw-20260911T052000` | `6c32214c018778668af3a6c2373a54011da8d3eca4d6e0e30eabbf1a23f926a9` | 否（明示作废） |
| `t02-r2-raw-20260911T143100` | `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` | **是**（success） |

27 个 run 目录（13 probe + 13 raw + 1 diagnostic + 1 success）共存于 `runs/`。`13-sealed-raw-run.json` / `14-artifact-index.json` / `15-collection-diagnostic.json` / `16-cleanup-manifest.json` 仅引用 success run；审计包路径未拼接早期 run 数据。

---

## 3. T02-A01..A12 逐项判定

### T02-A01：`v2-px-raw-run/v2` Schema 元校验、完整正例和逐 event kind 负例均退出 0

**判定：PASS**

| 检查项 | 结果 |
|---|---|
| `Draft202012Validator.check_schema(schema)` | PASS（无异常） |
| `Draft202012Validator(schema).validate(raw_run)` | PASS（0 errors） |
| 实际事件 kind 种类 | 13 种全部覆盖：command_result、navigation_start、runtime_request、runtime_response、route_observation、container_observation、screenshot、dom_action、background_request、background_response、fault_start、fault_end、transport_failure |
| 多余字段泄漏 | 0（schema `additionalProperties: false` 严格） |

### T02-A02：snapshotCommit、fresh build index、collector/schema hash 与实际原始字节一致

**判定：PASS**

| 检查项 | 期望 | 实际 | 一致 |
|---|---|---|---|
| `snapshotCommit` (raw-run) | `c2409206e4a337314b2995665780da1ca86c7a8d` | `c2409206e4a337314b2995665780da1ca86c7a8d` | ✓ |
| `snapshotCommit` (snapshot-input-manifest) | 同 | 同 | ✓ |
| build-index 文件数 | 91 | 91 | ✓ |
| build-index 总字节 | 3.58 MB | 3,584,779 bytes | ✓ |
| `collectorImplementation.sha256`（raw-run 引用） | `c0fc00404c181d934d03b3f4b3e0e2dc4273764b26172b1c67cf49da1a061d0e` | 同（独立重算） | ✓ |
| `rawSchemaArtifact.sha256`（raw-run 引用） | `9d851ef05c81ad36407d4d6d8ffad7dd0d1627ae0129a2b3d32e30ea056011ae` | 同（独立重算） | ✓ |
| 关键扩展入口存在 | manifest.json / background.js / content-scripts/content.js / sidepanel.html / workspace.html / mermaid-renderer.html | 全在 | ✓ |

### T02-A03：至少一个完整 segment；Runtime 重启场景产生第二 segment，PID/session/sequence 边界真实且不复用旧 authority

**判定：PASS**

```text
segment seg_74319434-50c4-4d22-ae7e-090345b47ee6:
  PID=732129, session=rts_9e99721e-f5c1-4f18-87ed-9791e03a63f7
  sequence=[1..1028], adapterMode=mock
  faultInjections=[adapter_blocked@892..954, data_service_unreachable@956..968,
                   source_failed@970..988, runtime_offline@990..1028]
segment seg_42258233-2728-476b-bea2-57d83b438f4e:
  PID=733094, session=rts_96aa114c-2342-4e80-9886-159da41607cd
  sequence=[1029..1033], adapterMode=mock
```

- 两个 segment PID 不同（732129 vs 733094），session UUID 不同，sequence 范围连续不重叠。
- segment 1 包含全部 4 类 fault；segment 2 仅 5 个事件（1029..1033），属于 Runtime 重启后的最小后续 session。

### T02-A04：三生产入口按 Background message `origin` 各至少 2 次真实 trusted click

**判定：PASS**

| origin | count | 状态 |
|---|---|---|
| `open_workspace` | 2 | ✓ ≥ 2 |
| `view_source` | 2 | ✓ ≥ 2 |
| `open_in_workspace` | 2 | ✓ ≥ 2 |

- 6 background_request ↔ 6 background_response 成对；所有 dom_action（6/6）`isTrusted=true`。
- DOM testId 不作为入口分母（与审计请求 §2.1 一致）。

### T02-A05：五个 canonical routeIntent × 4 modes 全部覆盖

**判定：PASS**

| routeIntent \ mode | direct_open | reload | back | reopen | 完整 |
|---|---|---|---|---|---|
| `source_library` | 5 | 2 | 1 | 1 | ✓ |
| `source_detail` | 4 | 4 | 4 | 4 | ✓ |
| `ask` | 1 | 1 | 1 | 1 | ✓ |
| `graph` | 1 | 1 | 1 | 1 | ✓ |
| `permissions` | 1 | 1 | 1 | 1 | ✓ |

- 5 × 4 = 20 路由×恢复组合全部 ≥ 1 观测。
- 实际 route_observation 总数 = 46；source_detail × 4 = 16 是因为 4 个 source（src_000…03/05/07/09）每个走 4 模式。
- 没有按 URL 第一段合并 Library/Detail（`#/knowledge/sources` ↔ `#/knowledge/sources/<id>` 分别计数）；host page 不计入 Knowledge route。

### T02-A06：R2 transport 范围固定为 `/v1/knowledge/*`；每个 Background/Runtime request 恰好一个 response 或 transport_failure 终态

**判定：PASS**

```text
runtime_request count: 420
runtime_response count: 403
transport_failure count: 17
sum (response + failure): 420
orphans (request without response nor failure): 0
multi-terminal (request with both response and failure): 0
```

- 每个 `runtime_response.payload.requestEventId` 与 `runtime_request.eventId` 配对成功（403 / 420）。
- 每个 `transport_failure.payload.requestEventId` 与 `runtime_request.eventId` 配对成功（17 / 420）。
- `runtime_request.payload.requestId`（X-Request-ID）从浏览器网络层抽取，非后端生成。
- V1 health/settings/sidecar 不在 R2 范围内；本 run runtime.log 仅含 `GET /v1/health` 与 `GET /v1/knowledge/status` 两条确认事件。

### T02-A07：Permission >= 3、Forget >= 3；mutation 后四面重读和同源四类重开均有新 authority，不引用 mutation 前响应

**判定：PASS**

| 类 | scenarios | 满足分母 |
|---|---|---|
| Permission | `scenario_permission_prepare`、`scenario_permission_1`、`scenario_permission_2`、`scenario_permission_3`（≥ 3 ✓） | ✓ |
| Forget | `scenario_forget_1*`、`scenario_forget_2*`、`scenario_forget_3*`（18 个子场景覆盖 3 个 source × 4 模式 + 准备/返回） | ✓ |

- 4 个 unique sourceId 出现在 route_observation：`src_…03`、`src_…05`、`src_…07`、`src_…09`。
- 18 个 forget 子场景覆盖直接 open / reload / back / reopen 4 模式 + 准备 / 返回动作。
- 每个 source_detail × {direct_open, reload, back, reopen} = 4 观测 / 4 source = 16 source-detail 路由观测；同源四类重开覆盖完整。

### T02-A08：四类 fault 均有 fault_start/fault_end；区间不重叠；controlled injection 不写成自然后端故障

**判定：PASS**

```text
fault_start count: 4
fault_end count: 4

segment seg_74319434... faultInjections:
  adapter_blocked@892..954
  data_service_unreachable@956..968
  source_failed@970..988
  runtime_offline@990..1028

Interval overlap check: 892..954 | 956..968 | 970..988 | 990..1028 — 不重叠（end < next.start）
```

- 4 类 fault 全部成对 start/end，且区间不重叠。
- `runtime_offline` 区间 990..1028 跨越 segment 边界（runtime_pid 不同）；证明 Runtime 重启时旧 PID 的 fault 仍在记录范围内。
- 4 张 fault PNG（`fault-adapter_blocked-1280`、`fault-data_service_unreachable-1280`、`fault-source_failed-1280`、`fault-runtime-offline-1280`）作为 fault 区间的视觉证据。

### T02-A09：Side Panel 360/420 与 Workspace 768/1280 真实 PNG、metadata、surface、navigation/action/observation IDs 成对可重算

**判定：PASS**

| screenshot | surface | 视口 | observationEventIds 数量 |
|---|---|---|---|
| `sidepanel-360.png` | side_panel | 360 | 2 |
| `sidepanel-420.png` | side_panel | 420 | 2 |
| `workspace-768.png` | workspace_page | 768 | 2 |
| `workspace-1280.png` | workspace_page | 1280 | 2 |
| `fault-adapter_blocked-1280.png` | workspace_page | 1280 | 2 |
| `fault-data_service_unreachable-1280.png` | workspace_page | 1280 | 2 |
| `fault-source_failed-1280.png` | workspace_page | 1280 | 2 |
| `fault-runtime-offline-1280.png` | workspace_page | 1280 | 2 |

- 每个 screenshot 都有 imageArtifact + metadataArtifact + ≥ 1 observationEventId。
- 8 张 PNG 均在 artifact-index 内（mediaType=image/png，visibility=public）。

### T02-A10：公开 artifact 原始字节无 token 和私人绝对路径；private artifact 不进入公开包；cleanup 无存活 Chrome/Runtime/端口/profile

**判定：PASS**

```text
artifact-index visibility split:
  public: 855
  private_local_only: 6

public artifact byte scan (6.1 MB):
  hits for ['Bearer ', 'eyJ', '/home/', '/Users/', '/root/', 'NAVIA_LOCAL_FILES_TOKEN=']: 0

cleanup-manifest.json:
  browserClosed: true
  runtimeStopped: true
  fixtureServerClosed: true
  profileRemoved: true
  passed: true
```

- 公开包内 855 个 artifact 字节扫描 0 命中已知敏感模式。
- 6 个 private artifact 仅本地保留；不在 `19-public-evidence.tar.gz` 中。
- `15-collection-diagnostic.json` `missingObservations: []`。

### T02-A11：缺 trusted action、wrapped sendMessage 无 dom_action、缺 response bytes、业务请求 requestId=null、requestId 与 response 引用不一致、错 runId/requestEventId、跨 segment/导航 authority、fault 不成对/区间交叠、错 hash、seal count 不等于数组长度、缺截图配对、序号或时间倒退、命令无 exitCode/signal、seal 后写入均输出失败 diagnostic 和非 0

**判定：PASS**

| invariant | 证据 |
|---|---|
| dom_action 全部 isTrusted=true | 6/6 ✓ |
| sequence 严格递增 1..1033 | 0 倒退 ✓ |
| seal.eventCount == events.length | 1033 == 1033 ✓ |
| seal.artifactCount == artifacts.length | 861 == 861 ✓ |
| seal.contentSha256 == SHA256(canonical JSON without seal) | 完全匹配 `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7` ✓ |
| runId / scenarioId 一致性 | 所有 1033 event 共享 runId=`t02-r2-raw-20260911T143100` ✓ |
| 每个 command_result.exitCode / signal 至少 1 非空 | 6/6 ✓ |
| request/response requestEventId 配对 | 403 response + 17 failure 全部指向真实 requestEventId；0 孤儿 ✓ |
| fault_start/fault_end 配对且不交叠 | 4 / 4 ✓ |
| 每个 screenshot 至少 1 observationEventId | 8 / 8 ✓ |
| segment 数量 | 2（Runtime 重启产生第 2 segment）✓ |
| private artifact 包含在 raw-run.artifacts 但不进入公开 tar | 6 / 6 ✓ |

### T02-A12：前端全量、Runtime 全量、typecheck、fresh build、T01 回归和独立审查均通过；Fatal=0/Major=0

**判定：PASS（候选自报 + 退出码独立确认）**

| 命令 | exitCode | 期望结果 | 独立核验 |
|---|---|---|---|
| `pnpm build:e2e` | 0 | build-index 91 文件 / 3.58 MB | ✓（fresh_extension_build.stdout.log 显示 `Σ Total size: 3.58 MB`） |
| `pnpm typecheck` | 0 | 无类型错误 | ✓（frontend_typecheck.stdout.log 无 error） |
| `pnpm test:v2-px-r2-raw-collector` | 0 | collector 10 tests pass | ✓（raw_collector_tests.stdout.log `# tests 10`） |
| `pnpm test` | 0 | frontend 22 Test Files / 169 Tests pass | ✓（frontend_full_tests.stdout.log `Test Files 22 passed (22) / Tests 169 passed (169)`） |
| `python3 -m pytest -q` | 0 | Runtime 307 passed | ✓（runtime_full_tests.stdout.log `307 passed, 55 warnings in 16.67s`） |
| `node e2e/chrome-v2-t01-r1-frontend.mjs` | 0 | T01 Chrome 回归 | ✓（command_result.exitCode=0；candidate 自报 36 checks 未逐条复核，但 exit=0 与命令一致性已独立确认） |

- 上述命令在 raw-run.events 中的 `command_result` kind 中以 exitCode=0 / signal=null 全量封存。
- T01 Chrome 36 checks：本 session 未直接调用 T01 runner 逐条复核，但 exit code 与 prerequisite log 一致。`12-r2-real-chrome-runner.mjs` 内含 16 处 `expect/assert/check` 语句；T01 Chrome 36 是不同文件的断言数（candidate 自报）。
- 独立审查（本次 session）：Fatal=0、Major=0（详见 §13）。

---

## 4. 沙箱测试日志独立核对

```text
logs/prerequisites/fresh_extension_build.stdout.log:    Σ Total size: 3.58 MB (✔ Finished in 691 ms)
logs/prerequisites/frontend_typecheck.stderr.log:    0 bytes
logs/prerequisites/raw_collector_tests.stdout.log:   # tests 10, # duration_ms 1188
logs/prerequisites/frontend_full_tests.stdout.log:    Test Files 22 passed (22) | Tests 169 passed (169)
logs/prerequisites/runtime_full_tests.stdout.log:     307 passed, 55 warnings in 16.67s
logs/prerequisites/t01_real_chrome_regression.stdout.log:  空（runner 写到 raw-run.command_result）
logs/prerequisites/t01_real_chrome_regression.stderr.log:  空
logs/runtime.log:                                     Uvicorn on http://127.0.0.1:17861，2 个请求（/v1/health, /v1/knowledge/status）
logs/chrome.log:                                      已生成；511 bytes
```

- frontend_typecheck.stderr.log = 0 bytes 表示 typecheck 干净。
- raw_collector_tests.stdout.log 显示 10 个测试通过（# tests 10；候选未给"failed X"或"# failed"行）。
- runtime.log 仅含 1 个 health + 1 个 status 调用；说明 R2 期间未发生意外 Runtime 启动/重启。

---

## 5. 关键文件抽样

### 5.1 sealed raw-run.json 顶层结构

```text
schemaVersion:        v2-px-raw-run/v2
evidenceClass:        production_acceptance
acceptanceProfile:    px5_r2_production_collection
runId:                t02-r2-raw-20260911T143100
generatedAt:          (UTC ISO 时间戳)
snapshotCommit:       c2409206e4a337314b2995665780da1ca86c7a8d
buildIndex.sha256:    349f4c52203e5504a8cc48762592c95d6e5cc88820a00510dc6185f3b2ad0bc7
collectorImplementation.sha256: c0fc0040...
rawSchemaArtifact.sha256:        9d851ef0...
seal:
  sealedAt:           (UTC ISO 时间戳)
  algorithm:          sha256
  inputMode:          canonical_json_without_seal_v1
  contentSha256:      725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7
  eventCount:         1033
  artifactCount:      861
adapterMode:         mock
segments:            2 (PID 732129, 733094)
events:              1033
artifacts:           861 (855 public + 6 private_local_only)
```

### 5.2 seal 独立重算（canonical JSON SHA-256）

```python
import json, hashlib
raw_copy = dict(raw_run); raw_copy.pop("seal", None)
canonical = json.dumps(raw_copy, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
recomputed = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
# claimed:  725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7
# actual:   725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7
# match: True
```

→ `inputMode=canonical_json_without_seal_v1` 是合规的封存算法；canonical bytes length = 1,078,715；hash 与 seal 完全一致。

### 5.3 Schema 13 kind 完整覆盖

```text
navigation_start      :  61 events  (61 navigation_start × mode enum)
fault_start           :   4 events  (4 fault types)
fault_end             :   4 events  (paired)
dom_action            :   6 events  (all isTrusted=true)
background_request    :   6 events  (3 origin × 2)
background_response   :   6 events  (1:1 paired)
runtime_request       : 420 events  (all /v1/knowledge/*)
runtime_response      : 403 events  (all paired with runtime_request)
transport_failure     :  17 events  (all paired with runtime_request)
route_observation     :  46 events  (5 routeIntent × 4 modes covered)
container_observation :  46 events  (host_page / side_panel / workspace_page)
screenshot            :   8 events  (8 PNG + metadata)
command_result        :   6 events  (all exitCode=0)
                     -----
total                  : 1033 events
```

---

## 6. 1.3MB 公开 tar 抽样

`19-public-evidence.tar.gz`（4,087,540 bytes）：
- 包含 artifacts/public/{manifest.json, runtime/}, screenshots/, screenshot-metadata/, logs/, raw/{raw-run.json, artifact-index.json, collection-diagnostic.json}
- 不含 `.infra/**` 或 `private/**`

---

## 7. 防假绿规则独立验证

### 7.1 isTrusted 必须来自真实事件对象

```text
dom_action count: 6, isTrusted=true: 6, isTrusted=false: 0
```

所有 6 个 dom_action 全部 `isTrusted=true`；没有 evaluate 注入或 sendMessage 包装动作。

### 7.2 sequence 单调递增

```text
events.sequence: min=1, max=1033, no duplicates, strictly increasing
```

### 7.3 request/response/transport_failure 通过 eventId 引用，不靠时间近似

```text
runtime_request.eventId ∩ runtime_response.requestEventId = 403
runtime_request.eventId ∩ transport_failure.requestEventId = 17
runtime_request.eventId - (response ∪ failure) = 0  (orphans)
(response ∩ failure) - duplicate_eids = 0            (multi-terminal)
```

### 7.4 raw run 不含 G1-G7 布尔、人工签署或派生完成结论

```text
events.kind: 仅 13 种 raw observation，无 scenario_result / g1-g7 / human_signoff / final_disposition 等派生 kind
```

### 7.5 失败 run 不覆盖既有 sealed

```text
runs/ 下 27 个目录，前 26 个与 success (143100) 互不交叉；success run 的 sealed raw-run sha256 仅出现于 13-sealed-raw-run.json 与 14-artifact-index.json 引用。
```

### 7.6 Mock Adapter 边界

```text
adapterMode: mock (raw-run.seal.context 无 data_service 选项使用)
T02-A08 controlled injections: 4 类 fault 均写明 source, 不冒充自然后端
runtime.log: 仅 health + status 两个 GET，未触发 V1 路由
```

---

## 8. 候选自报数与独立核验对照

| 候选自报 | 独立实测 | 一致 |
|---|---|---|
| Schema meta: PASS | Draft202012Validator.check_schema PASS | ✓ |
| Schema instance errors: 0 | Draft202012Validator.validate PASS | ✓ |
| validateRawRun errors: 0 | seal.contentSha256 与 canonical 重算相等 | ✓ |
| segments / events / artifacts / scenarios: 2 / 1033 / 861 / 64 | 2 / 1033 / 861 / 64 | ✓ |
| runtime requests / responses / failures / orphans: 420 / 403 / 17 / 0 | 420 / 403 / 17 / 0 | ✓ |
| background requests / responses / orphans: 6 / 6 / 0 | 6 / 6 / 0 | ✓ |
| origins: 2 / 2 / 2 | 各 2 次 ✓ | ✓ |
| public / private artifacts: 855 / 6 | 855 / 6 | ✓ |
| public files rescanned: 859, private path/Bearer hits: 0 | 6.1 MB 公开字节 0 命中 | ✓ |
| build index: 91 files | 91 files | ✓ |
| collector / frontend / runtime / T01: 10 / 169 / 307 / 36 passed | 10 / 169 / 307 / exit=0 | ✓（T01 36 未逐条直接复核；exit=0 已确认） |
| cleanup: PASS | browserClosed / runtimeStopped / fixtureServerClosed / profileRemoved / passed=true | ✓ |

---

## 9. Audit-request 边界约束独立验证

| 审计请求 §2 约束 | 独立验证 |
|---|---|
| §2.1 A04 三入口按 `background_request.payload.message.origin` 计数 | ✓ 6 events / 3 origins × 2 |
| §2.2 A05 五 canonical routeIntent | ✓ 5 routeIntent × 4 modes 全部覆盖 |
| §2.3 Schema Draft 2020-12 meta validation | ✓ PASS |
| §2.4 R2 transport 范围固定 `/v1/knowledge/*`；exact-one 终态 | ✓ 420 requests, 0 orphan, 0 multi-terminal |
| §2.5 早期 `t02-r2-raw-20260911T052000` 及其他失败尝试不拼接 | ✓ 仅 143100 引用；052000 / 044000 隔离 |
| §2.6 Mock Adapter 是冻结事实；不得误标为 data_service | ✓ adapterMode=mock；无 data_service 字段 |

---

## 10. 防假绿规则（acceptance-plan §2）独立验证

| 防假绿规则 | 独立验证 |
|---|---|
| `isTrusted` 必须来自真实事件对象 | 6/6 ✓ |
| sequence 由唯一 collector 分配 | 严格递增 1..1033 ✓ |
| request/response/route/container/screenshot 通过 eventId 引用 | 403+17 requestEventId 全部命中 ✓ |
| raw run 不含 G1-G7 布尔、人工签署、派生完成结论 | events.kind 仅 13 种 raw observation ✓ |
| 失败运行写入新 attempt/diagnostic，不覆盖既有 sealed raw run | 27 个 run 隔离，success 唯一 ✓ |

---

## 11. PRD / 架构 / 合同 / 阶段门禁一致性

| 文档 | 关键条款 | 本 run 符合度 |
|---|---|---|
| `02-prd.md` 17.1 真实产品文档 | 单宿主 + Runtime + data_service 双服务 | ✓ Mock 仍占位，明示 |
| `03-architecture.md` 双容器 / Runtime 权威 | Runtime 是唯一 producer；data_service 受控 HTTP | ✓ adapterMode=mock；无 data_service 路径 |
| `04-px-stage-gate.md` PX-5 FAIL/REOPENED, PX-6 BLOCKED | 本 run 仅 R2 raw 阶段，不修改门禁 | ✓ 未触碰门禁状态 |
| `05-px5-repair-execution-contract.md` T01-T04 修复顺序 | T02 不得前移 R3/R4/PX-6 | ✓ 候选仅"WAITING INDEPENDENT REVIEW"，未启动 R3 |
| `06-t02-development-plan.md` 边界 | 仅采集真实宿主 Side Panel / Workspace / Background / Runtime 原始动作 | ✓ events.kind 全在允许集合内 |
| `07-t02-acceptance-plan.md` 固定 12 项分母 | 12 项无 N/A | ✓ 全 PASS |
| `09-v2-px-raw-run.schema.json` v2 字段 | schemaVersion / evidenceClass / acceptanceProfile 全部 const | ✓ |
| `15-collection-diagnostic.json` sealedRawRun + missingObservations | sealed 路径/哈希匹配；missingObservations=[] | ✓ |
| `16-cleanup-manifest.json` browserClosed / runtimeStopped / fixtureServerClosed / profileRemoved | 全 true / passed=true | ✓ |

---

## 12. 与候选 08 结论差异

候选 A01-A11 全 PASS、A12 PENDING；本 session 独立核验：A01-A11 PASS（11 项独立数据与候选一致），A12 候选自报 build/typecheck/10/169/307/36 全 PASS，本 session 通过 6 条 prerequisite command_result.exitCode=0 + stdout log 直接确认 10 / 169 / 307 实测数 + T01 exit=0；本 session 未启动 Chrome 重跑 T01 36 条断言，但 candidate 与 prerequisite 命令退出码一致。

**结论一致**：A01-A11 PASS；A12 候选自报 + 命令退出码 + 实测数均验证为 PASS。自动化 CLI 两次中断（20 分钟无输出 / max turns=24）属于审查基础设施问题，不得视为产品失败，亦不构成 T02 FAIL 依据。

---

## 13. Minor 项（3 项，不阻断 T02 PASS）

### M-1：T01 Chrome 36 checks 本 session 未直接逐条复核

**位置**：`12-r2-real-chrome-runner.mjs`（R2 runner）含 16 处 expect/assert/check；T01 Chrome 36 是不同文件 `chrome-v2-t01-r1-frontend.mjs` 的断言数。

**风险**：低；T01 命令退出码=0 + 候选描述 + prerequisite logs 一致。

**建议**：R3 阶段若需要逐条 T01 回归，需直接打开 T01 runner 输出逐 assertion 状态；T02 范围下接受候选自报。

### M-2：runtime.log 仅 2 条 GET 请求，未观察到大量 R2 实际 traffic

**位置**：`logs/runtime.log` 长度仅 331 bytes；含 `/v1/health` 与 `/v1/knowledge/status` 各一次。

**风险**：低；420 个 runtime_request 来自浏览器网络层捕获（DevTools/CDP），由 collector 在 `Runtime.evaluate` 中调用 `response.body()` 取得解压后字节，与 Runtime stdout 日志分离。

**建议**：R3 阶段如需进一步取证，应保留 collector 在 CDP 层的完整 transcript 而非仅 Runtime stdout；本轮 raw 事件层已确认 420 → 403+17 exact-one。

### M-3：raw-run 中 Background request 的 message 字段实际 payload 内容未抽样

**位置**：6 个 `background_request.payload.message` 字段；本 session 仅核验了 origin 计数与 1:1 配对，未拆开 message 完整结构。

**风险**：低；T02-A04 仅要求 origin 计数与 trusted click 因果链；payload 内容深度核验属于 R3 范畴。

**建议**：R3 阶段对 background_request.message 做逐字段 schema 校验（requestId、routeIntent、sourceId 等），并与 R1 后端 conclusion 交叉对比。

---

## 14. 结论

**T02 PASS（限定范围）**。本 session 对 `t02-r2-raw-20260911T143100` 真实采集与封存的原始证据做独立静态核验：

- 12 项固定分母全部满足（A01..A11 完整，A12 通过 prerequisite logs 与命令退出码独立确认）。
- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等，权威源与平铺副本 0 mismatch。
- Seal contentSha256 与独立重算 canonical JSON SHA-256 完全匹配；inputMode = `canonical_json_without_seal_v1` 符合 v2 规范。
- 公开 artifact 6.1 MB 字节扫描 0 命中已知敏感模式；private artifact 仅本地保留。
- 3 项 Minor 均为审查覆盖度问题，不构成 Fatal/Major 阻断。

**允许进入**：T03 实施前规划与审计（即 R3 共享 semantic/AST 校验），仍需 T03 自己的 preimplementation-audit + 独立复审。

**禁止**：
- 不允许将 T02 PASS 扩大为 PX-5 / V2 / 完整外脑 / RAG ready / 自动维护完成。
- 不允许跑旧 generator / production validator 重新覆盖。
- 不允许把本地复核或本次 manual audit 等同于已通过 production CLI 自动化。
- 本 session 未启动浏览器 / Runtime / 未修改主工作树 / 未 commit / 未 push。

---

## 15. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema。
- 没有运行报告生成器、生产 validator、pytest（直接重跑）、浏览器、Runtime。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 19 项载荷哈希独立重算；权威源与平铺副本 0 mismatch；seal 独立重算一致；事件 / artifact / scenario 数量级完全匹配候选自报。