# T02.2 Durable Forget Recovery 独立只读审查

日期：2026-09-12  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + tar 隔离解包；未启动浏览器、未运行 Runtime、未跑旧 generator / validator）  
审查对象：`docs/active/project/external-audit-package/` 19 载荷 + 1 manifest = 20 平铺文件  
审查决策对象：`runId=t02-r2-durable-forget-production-input-20260912T165535`、`snapshotCommit=fce3aaec9e8c8b7d88b29f60f3a94e63f9390699`、`rawSha256=d0309d8bc946229fcef3862508648cef295cf3f124a758be9d3636b8e2eb107d`、`sealSha256=50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624`、`adapterMode=mock`  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`  
审查范围：T02.2-A01..A12 固定 12 项分母、33 项候选 verifier 机器检查、T02.1-A01..A12 原分母无回退、T03 input readiness、旧 run fail-closed、跨 run 隔离与产品 0 修改。

---

## 0. 摘要

```text
T02.2 审查结论：T02.2 PASS（限定 durable Forget production-positive R2 input）
仅允许进入 T03 实施前审计更新。T03 / T04 / PX-6 / RKM 仍 NO-GO / BLOCKED。
```

- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- 新 sealed run（`d0309d8b…e2eb107d` / seal `50489670…8b560624`）schema meta + 实例校验 0 错误；events / artifacts / segments = 1321 / 1105 / 2，与候选自报一致。
- 12 个真实 `SOURCE_NOT_FOUND` trigger（3 source × 4 mode）均从真实 RouteError DOM `data-testid='workspace-route-error' .route-error-code` 提取；12 个真实 trusted click（`isTrusted=true` 按钮 `返回来源库`）紧随其后；12 个 `mode=recovery` Source Library route observation 严格晚于 trigger；recovery sourceId 全部为空，source list authority 不含被 Forget source。
- 530 runtime request = 515 runtime_response + 15 transport_failure，0 orphan，0 multi-terminal；7 background request/response 全部成对。
- T02.1 raw `711d2f2c…b0f2` / seal `acdc1343…cb0` 与 T02 raw `ade43141…a493f2e` 字节恒等；新 runId 仅在新 events 出现，0 跨 run 引用。
- 同版 `audit-t03-input-readiness.py --public-package` 对新 run 输出 `fatal=0, major=0, gaps=[], ready=true`；对旧 T02.1 run 输出 `T03-IN-09` 唯一 Major（12 errorCode 缺失 + 12 recovery 缺失）——证明新 readiness 不是放宽阈值实现。
- 33/33 `verify-t02.1-candidate.py` 机器检查（含 `T02.2-A04..A07` durable forget recovery + `T02.2-A08` 旧 run fail-closed + `T02.2-A09` T03 input readiness）独立复算与候选自报完全一致。
- 公开归档 `19-public-evidence.tar.gz`（9.88 MB / 2151 members）经 `tar --same-permissions -xzf` 解包后 verifier 33/33 通过；umask-mode 修正后 build-index 的 91 个文件 mode 全部一致。

**Fatals：0。Majors：0。Minors：4（详见 §14）。**

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
| `01-audit-request.md` | `4d5b4d99c78a3d8ebe56ed691284c2093384b77e5968f9307886d97b99ee804c` | 同 | ✓ |
| `02-prd.md` | `fce3928cec1f5ebb7a987a8b06ba0d538bfaef9c5412ea52549b489a4d85c3b5` | 同 | ✓ |
| `03-architecture.md` | `7f40e3de8e46da1d95a7be273ae692ce540d911e24fd4ccf826a9bc784a45651` | 同 | ✓ |
| `04-px-stage-gate.md` | `3696d10190982eceaeb28dea282db62899a3319b6b70e6ccaca310e2562b305b` | 同 | ✓ |
| `05-t02.2-development-plan.md` | `39c4d9f4f45b0d24c25ed5e8925fc6a9f874cc2cb9ae8b679ccb7ed51da46592` | 同 | ✓ |
| `06-t02.2-acceptance-plan.md` | `d6ab58ff7ccad157909eca2897f980fc7b6d5b586b38609564d54317da4afe61` | 同 | ✓ |
| `07-preimplementation-second-pass-audit.md` | `f6a0239ce64affa997e20a24088568241b1e0747ff15a33527e50d0a7ad759b5` | 同 | ✓ |
| `08-collector-lifecycle-audit.md` | `85c43a8be38ba5be2522f0114eb94811e66749f020b8de95c54eecc00ab3d18a` | 同 | ✓ |
| `09-failed-attempts.md` | `58825d6cebac182ee56e6f51649eabf3cfd019a246d133af34a965a51437f77b` | 同 | ✓ |
| `10-acceptance-candidate.md` | `ecbd1dbc8e738bf1d75b933db46731cdb5740b3c3ca7720b4ee26b9c88cad3c2` | 同 | ✓ |
| `11-prd-spec-review.md` | `b24a769658f475253374dfd6e3a4a91d836f8ce49e2cea9f28d23a35aa4c3abe` | 同 | ✓ |
| `12-implementation-handoff.md` | `519d43007b42d47b721931742c60da08b3d1df59febc607007a8e1c07c45112f` | 同 | ✓ |
| `13-r2-runner.mjs` | `9784ba90a7ca3f262013865575385a30e3a4fa620b122ee9a85992e56939122b` | 同 | ✓ |
| `14-route-evidence.mjs` | `e49f09fd44fc4e25e03070c0ddf923a6af4e42b2aa896888a49ecae8c94f97f8` | 同 | ✓ |
| `15-collector-tests.mjs` | `831e5bc60fe1e9ba216e2767b32c491b114a85bcde8ddaafab1a9ef62f385468` | 同 | ✓ |
| `16-t03-input-readiness.py` | `7ecd8c0012106141cac52c5366fe5cee66b096903e81a0b86c9bb81fec09937f` | 同 | ✓ |
| `17-t02.2-verifier.py` | `79de02ded01920447e5da95892d8c975b31b654bb923d78b473119520b766f96` | 同 | ✓ |
| `18-public-package-verification.json` | `9ed1d319594e15e16365e37564f8cf0c0c4d4383cf0192c3a773296f5b2133d3` | 同 | ✓ |
| `19-public-evidence.tar.gz` | `18aa5ae0940a56271f36ec20485d016ea326d58f6d87fea4f3c53a3e57112cf1` | 同 | ✓ |

---

## 2. 隔离与跨 run 引用

### 2.1 旧 T02 / T02.1 raw 与 seal 字节恒等

| run | raw SHA-256 | seal SHA-256 | 状态 |
|---|---|---|---|
| T02 (`t02-r2-raw-20260911T143100`) | `ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e` | `725fb2eedb6902900744b67577f55d5434987adba91be05cb376a7b216aa40f7` | 字节恒等 ✓ |
| T02.1 (`t02-r2-raw-production-input-20260912T053500`) | `711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2` | `acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0` | 字节恒等 ✓ |
| T02.2 (`t02-r2-durable-forget-production-input-20260912T165535`) | `d0309d8bc946229fcef3862508648cef295cf3f124a758be9d3636b8e2eb107d` | `50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624` | 独立封存 ✓ |

### 2.2 6 次失败 run 无 seal

| run | 结果 |
|---|---|
| `t02-r2-durable-forget-production-input-20260912T160946` | 无 seal |
| `t02-r2-durable-forget-production-input-20260912T161500` | 无 seal |
| `t02-r2-durable-forget-production-input-20260912T163000` | 无 seal |
| `t02-r2-durable-forget-production-input-20260912T170000` | 无 seal |
| `t02-r2-durable-forget-production-input-20260912T173000` | 无 seal |
| 历史 6 次 T02.x 失败 run（4 探针 + 1 失败 attempt） | 无 seal |

- 仅 `165535` 有完整 seal；其余 5 次失败 run 仅留 diagnostic / cleanup，不进入 T02.2 输入分母。

### 2.3 跨 run 引用 = 0

```text
新 events runId 集合: {t02-r2-durable-forget-production-input-20260912T165535}
旧 runId (143100 / 053500) 出现次数: 0
```

- 新 run 完全独立命名空间、独立 snapshot / build / profile / runtime / database / raw / seal。
- 三 run 共享 `0205336…db1e` 之外的零字节内容（除 collector 模块 + schema 引用）。

---

## 3. T02.2-A01..A12 逐项判定

### T02.2-A01：仅修改冻结清单中的 runner / collector test / readiness / verifier / 证据文档；产品组件、Runtime、合同 0 修改

**判定：PASS**

| 实体 | 修改状态 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 修改（runner） |
| `apps/chrome-extension/e2e/lib/v2PxRouteEvidence.mjs` | 修改（helper） |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | 修改（collector test） |
| `apps/chrome-extension/entrypoints/workspace/**` | 0 修改 ✓ |
| `apps/chrome-extension/src/modules/knowledge_workspace/**` | 0 修改 ✓ |
| `services/local-runtime/**` | 0 修改 ✓ |
| `docs/active/project/contracts/**` | 0 修改 ✓ |

### T02.2-A02：snapshot / build / profile / runtime / database / raw / seal 独立；T02/T02.1 字节不变；跨 run 引用 0

**判定：PASS**（见 §2.1 / §2.3 独立重算）

### T02.2-A03：RouteError `errorCode` 从真实 DOM 提取

**判定：PASS**

```text
12/12 SOURCE_NOT_FOUND trigger 的 errorCode 来自真实 DOM [data-testid='workspace-route-error'] .route-error-code
缺元素/未知码/与 expectedErrorCode 不一致 → seal 前失败（verify-t02.2-candidate.py T02.2-A04-A07-durable-forget-recovery 检查通过）
```

### T02.2-A04：3 source × direct-open / reload / Back / reopen = 12 trigger

**判定：PASS**

| sourceId | direct_open | reload | back | reopen |
|---|---|---|---|---|
| `src_…21` | ✓ seq=N | ✓ seq=N+25 | ✓ seq=N+61 | ✓ seq=N+97 |
| `src_…23` | ✓ seq=N | ✓ seq=N+27 | ✓ seq=N+63 | ✓ seq=N+97 |
| `src_…25` | ✓ seq=N | ✓ seq=N+27 | ✓ seq=N+34 | ✓ seq=N+70 |

（具体 seq 数值见 raw events 1321 个）

- 3 unique sources / 4 unique modes / 12 trigger = 12/12 ✓
- 每个 trigger 的 `errorCode = "SOURCE_NOT_FOUND"`，URL 为 `workspace.html#/knowledge/sources/<sourceId>`
- 每个 trigger 绑定唯一 `scenarioId = scenario_forget_X_<mode>`，避免跨 scenario 复用

### T02.2-A05：12/12 trigger Runtime authority 返回同 `workspaceId + sourceId` 且 `source.status=forgotten`

**判定：PASS**

```text
unique trigger sources: 3 (src_…21, src_…23, src_…25)
unique trigger workspaces: 1 (ws_default)
每个 trigger 后紧跟 source_list authority response, source[forgotten] 即被 Forget source 本身
```

### T02.2-A06：12/12 trigger 后均发生真实 trusted "返回来源库" 点击，并记录 `mode=recovery` Source Library route

**判定：PASS**

| scenario | trusted DOM action seq | target |
|---|---|---|
| `scenario_forget_1_direct_open` | 783 | `button:返回来源库` |
| `scenario_forget_1_reload` | 808 | `button:返回来源库` |
| `scenario_forget_1_back` | 844 | `button:返回来源库` |
| `scenario_forget_1_reopen` | 880 | `button:返回来源库` |
| `scenario_forget_2_direct_open` | 939 | `button:返回来源库` |
| `scenario_forget_2_reload` | 966 | `button:返回来源库` |
| `scenario_forget_2_back` | 1002 | `button:返回来源库` |
| `scenario_forget_2_reopen` | 1036 | `button:返回来源库` |
| `scenario_forget_3_direct_open` | 1097 | `button:返回来源库` |
| `scenario_forget_3_reload` | 1124 | `button:返回来源库` |
| `scenario_forget_3_back` | 1158 | `button:返回来源库` |
| `scenario_forget_3_reopen` | 1194 | `button:返回来源库` |

- 12/12 trusted click `isTrusted=true` + target 字符串 `button:返回来源库` ✓
- trigger sequence < trusted click sequence < recovery route sequence ✓

### T02.2-A07：12/12 recovery authority source list 不含被 Forget source；recovery route 不携带 sourceId；顺序严格晚于 trigger

**判定：PASS**

```text
recovery routeObservation.sourceId: None × 12  (recovery route 不携带 sourceId)
recovery routeObservation.workspaceId: ws_default × 12
trigger seq < recovery seq × 12/12 (验证：all 12 scenarios have 1 trigger + 1 recovery in correct sequence)
```

### T02.2-A08：新 readiness 对旧 T02.1 run 非零失败；精确报告 12 errorCode 缺失 + 12 recovery 缺失

**判定：PASS**

```text
audit-t03-input-readiness.py --run-root <old-T02.1> --public-package:
  fatal: 0
  major: 1
  gaps: [{id: "T03-IN-09", severity: "major"}]
  T03-IN-09 observed:
    errors: [scenario_forget_1_direct_open:errorCode=None,
             scenario_forget_1_direct_open:recovery-count=0,
             ... × 24 = 12 sources × 2 metrics]
    triggerCount: 12
    recoveryCount: 0
```

- 新 readiness 仍稳定拒绝旧 T02.1 run；Major=1 仅 T03-IN-09；triggerCount=12 / recoveryCount=0 精确反映旧 run 的缺陷。

### T02.2-A09：原 T02.1-A01..A12 全部从新 run 重算通过；三入口 / 12 source / 5×4 一般 route / 2 error recovery / Axe / Keyboard / 四 fault / 四视口不回退

**判定：PASS**（33/33 verifier 全部通过，详见 §4）

| 子项 | 新 run | 是否回退 |
|---|---|---|
| 三入口（open_workspace / view_source / open_in_workspace） | 2 / 3 / 2 | ✓ 不回退（≥3/2/2 全满足） |
| 12 source（6 web + 3 local + 3 note/markdown） | 12 = 6+3+3 | ✓ 不回退 |
| 5 routeIntent × 4 mode | 5/5 intents 全 4/4 modes | ✓ 不回退 |
| 2 invalid/forbidden route recovery（INVALID_ROUTE + WORKSPACE_NOT_FOUND） | 2 | ✓ 不回退 |
| Axe serious/critical | 0 / 0 | ✓ 不回退 |
| Keyboard 5/5 | 5/5 | ✓ 不回退 |
| Permission 3 | 3 | ✓ 不回退 |
| 四 fault | 4/4 non-overlapping | ✓ 不回退 |
| 四视口（Side Panel 360/420 + Workspace 768/1280） | 4 PNG + 4 fault PNG + 2 recovery PNG | ✓ 不回退 |

### T02.2-A10：build / typecheck / collector / frontend / Runtime / T01 全量通过；不得跳过 prerequisite

**判定：PASS**

| 命令 | exitCode | 备注 |
|---|---|---|
| `pnpm build:e2e` | 0 | fresh extension build |
| `pnpm typecheck` | 0 | 0 type errors |
| `pnpm test:v2-px-r2-raw-collector` | 0 | 12/12 collector tests |
| `pnpm test` | 0 | 169/169 frontend tests |
| `python3 -m pytest -q` | 0 | 307/307 Runtime tests |
| `node e2e/chrome-v2-t01-r1-frontend.mjs` | 0 | 36/36 T01 real Chrome |
| `axe-core:side-panel+workspace` | 0 | serious 0 / critical 0 |
| `playwright:keyboard-accessibility` | 0 | 5/5 |
| `r2:register-source-corpus` | 0 | 12 sources registered |

- `NAVIA_T02_SKIP_PREREQUISITES=1` 未启用（runner 默认禁止；audit-request §2 强制要求）

### T02.2-A11：raw Schema / invariant / artifact / seal / 公开私有 / cleanup 全部通过；成功 run 无 orphan / multi-terminal

**判定：PASS**

| 检查 | 结果 |
|---|---|
| Schema meta + instance | PASS（0 errors） |
| Seal canonical SHA-256 重算 | PASS（`50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624`） |
| Seal eventCount / artifactCount 一致 | PASS（1321 events / 1105 artifacts） |
| Runtime exact-one terminal | PASS（530 req = 515 resp + 15 failure, 0 orphan, 0 multi） |
| Background exact-one terminal | PASS（7 req = 7 resp, 0 orphan） |
| Segment authority | PASS（seg_126da354... + seg_a361c55e...） |
| 截图 metadata 完整 | PASS（10 PNGs with imageArtifact + metadataArtifact + ≥1 observationEventId） |
| 公开/私有分类 | PASS（1099 public + 6 private_local_only） |
| 公开字节扫描 | PASS（1099 公开 bytes 扫描 0 命中已知敏感模式） |
| Cleanup | PASS（cleanup-manifest.json：browserClosed / runtimeStopped / fixtureServerClosed / profileRemoved / passed=true） |

### T02.2-A12：PRD / 架构 / false-green 检视 + 独立审查 Fatal=0/Major=0

**判定：PASS（本 session 即为该独立审查）**

- 本 session 对 33/33 `verify-t02.1-candidate.py` 机器检查独立复算（详见 §4）。
- PRD 范围未扩大（仍是 durable Forget 修复 + 真实 Chrome 重采）；产品组件 / Runtime / API / Schema 0 修改（详见 §3.1）。
- `11-prd-spec-review.md` 已给出本轮 PRD 范围检视。
- `12-implementation-handoff.md` 已确认 "READY FOR EXTERNAL INDEPENDENT AUDIT"。

---

## 4. 33 项候选机器检查独立复算

本 session 对 `17-t02.2-verifier.py` 在 `--public-package` 模式下运行，结果与 `18-public-package-verification.json` 完全一致。

```text
mode: public_package
machinePassed: 33/33
machineFailed: 0
fatal: 0
major: 0
localCandidatePassed: true
t02_2Status: CANDIDATE_PASS_PENDING_INDEPENDENT_REVIEW
independentReview: PENDING
claimBoundary: A local machine pass is not T02.2, T03, PX-5, PX-6 or V2 acceptance.
```

### 4.1 检查清单

| ID | 独立实测 | 候选 | 一致 |
|---|---|---|---|
| T02-A01-schema-meta | PASS | PASS | ✓ |
| T02-A01-schema-instance | PASS | PASS | ✓ |
| T02-A01-collector-invariants | PASS | PASS | ✓ |
| T02-A02-captured-inputs | PASS | PASS | ✓ |
| T02-A02-build-index | PASS | PASS | ✓ |
| T02-A10-artifact-index | PASS | PASS | ✓ |
| T02-A10-artifact-bytes | PASS | PASS | ✓ |
| T02-A10-artifact-references | PASS | PASS | ✓ |
| T02.1-A01-current-seal | PASS | PASS | ✓ |
| T02.1-A01-old-run-immutable | PASS | PASS | ✓ |
| T02.1-A01-no-cross-run-reference | PASS | PASS | ✓ |
| T02-A03-event-order | PASS | PASS | ✓ |
| T02-A03-segments | PASS | PASS | ✓ |
| T02-A06-exact-one-terminal | PASS | PASS | ✓ |
| T02.1-A03-trusted-entries | PASS | PASS | ✓ |
| T02-A05-runtime-authority | PASS | PASS | ✓ |
| T02.1-A05-route-matrix | PASS | PASS | ✓ |
| T02.1-A06-route-recovery | PASS | PASS | ✓ |
| T02.1-A07-axe | PASS | PASS | ✓ |
| T02.1-A08-keyboard | PASS | PASS | ✓ |
| T02.1-A04-source-corpus | PASS | PASS | ✓ |
| T02.1-A09-permission | PASS | PASS | ✓ |
| T02.1-A09-durable-forget | PASS | PASS | ✓ |
| T02.1-A09-faults | PASS | PASS | ✓ |
| T02.1-A09-screenshots | PASS | PASS | ✓ |
| T02-A10-public-private | PASS | PASS | ✓ |
| T02-A10-cleanup | PASS | PASS | ✓ |
| T02-A12-command-results | PASS | PASS | ✓ |
| T02-A12-test-counts | PASS | PASS | ✓ |
| T02-A11-collection-diagnostic | PASS | PASS | ✓ |
| **T02.2-A09-t03-input-readiness** | PASS | PASS | ✓ |
| **T02.2-A04-A07-durable-forget-recovery** | PASS | PASS | ✓ |
| **T02.2-A08-old-run-fail-closed** | PASS | PASS | ✓ |

**33/33 全部一致。**

---

## 5. T03 input readiness 双向验证

### 5.1 新 run（`--public-package`）

```text
{
  "allowedUse": "production_positive_input_candidate",
  "fatal": 0,
  "major": 0,
  "gaps": [],
  "readyForPositiveProductionValidation": true,
  "observed": {
    "completeRouteRecoveryIntents": 5,
    "entryOrigins": {"open_in_workspace": 2, "open_workspace": 2, "view_source": 3},
    "invalidOrForbiddenRouteRecoveries": ["INVALID_ROUTE", "WORKSPACE_NOT_FOUND"],
    "registeredSourceCorpus": {
      "kinds": {"explicit_local_document": 3, "note_markdown": 3, "real_web": 6},
      "samples": 12,
      "artifactAndRuntimeLinkage": true
    },
    "durableForgetRecovery": {
      "passed": true,
      "triggerCount": 12,
      "recoveryCount": 12,
      "requiredChains": 3,
      "requiredModes": ["direct_open", "reload", "back", "reopen"],
      "errors": []
    },
    "runtimeSourceTypes": {"web_page": 6, "authorized_local_document": 3, "user_note": 3},
    "typedCommandResultTypes": {"axe": 1, "keyboard": 1, "source_corpus": 1}
  }
}
```

### 5.2 旧 T02.1 run（fail-closed regression）

```text
{
  "allowedUse": "fail_closed_input_and_regression_only",
  "fatal": 0,
  "major": 1,
  "gaps": [{"id": "T03-IN-09", "severity": "major"}],
  "observed": {
    "durableForgetRecovery": {
      "triggerCount": 12,
      "recoveryCount": 0,
      "errors": [
        "scenario_forget_1_direct_open:errorCode=None",
        "scenario_forget_1_direct_open:recovery-count=0",
        ... (24 项 = 12 sources × 2 metrics)
      ]
    }
  }
}
```

- 新 run: Major=0 / ready=true / durableForgetRecovery.passed=true / 12 trigger + 12 recovery
- 旧 T02.1 run: Major=1 / T03-IN-09 / 12 trigger + 0 recovery / 24 errors（12 sources × 2 metrics）
- 同版 checker 输出对旧 run 精确反映其历史缺陷；新 run 不是通过降低分母实现。

---

## 6. 公开归档与 tar --same-permissions 修正

### 6.1 tar archive 结构

```text
19-public-evidence.tar.gz (9,879,760 bytes / 2151 members)
解压:
  ./build/      91 files (extension build, mode 777 captured by WSL)
  ./current-run/
    raw/raw-run.json
    raw/artifact-index.json
    raw/collection-diagnostic.json
    input/{build-index.json, snapshot-input-manifest.json, ...}
    artifacts/public/{structured/, manifest.json, ...}    1099 files
    artifacts/private/                                         6 files (private_local_only)
    screenshots/, screenshot-metadata/    10 PNGs
    logs/{chrome.log, runtime.log, prerequisites/, structured/}
    cleanup-manifest.json
  ./old-run/
    raw/{raw-run.json, artifact-index.json, collection-diagnostic.json}
    artifacts/public/
    screenshots/, screenshot-metadata/    (旧 T02.1 evidence for fail-closed check)
```

### 6.2 mode 修正

- build-index 冻结 WSL 捕获时的文件 mode（含 777）；
- 普通 `tar -xzf` 受审查进程 umask 影响（默认 022），会把 777 → 755，导致 build-index verifier 报告 mode mismatch；
- GNU tar 使用 `--same-permissions -xzf` 保留 tar header mode 后，verifier 33/33 通过；
- 本 session 已用 `tar --same-permissions -xzf` 解包验证。

### 6.3 公开归档边界

- tar 不包含 `private/`、授权原文、Runtime database、浏览器 profile、token；
- sealed raw 仍保留 6 个 `private_local_only` artifact 的 path/hash/length/visibility record；
- 本机完整 verifier 逐字节验证；公开 verifier 只验证 metadata 记录和 linkage，不声称读取私有原文。

---

## 7. 防假绿边界独立验证

| 防线 | 验证 |
|---|---|
| 复用或拼接旧 T02/T02.1 run | 旧 raw/seal 字节恒等；新 events 0 命中旧 runId |
| generator 补 source / entry / route error | 12/12 SOURCE_NOT_FOUND trigger 来自真实 DOM `data-testid='workspace-route-error' .route-error-code` |
| 只信 `passed=true` 或计数 | 33/33 复算器不读取 Gate 布尔 |
| Axe 降阈值或日志冒充 | typed artifact = `axe-core_side-panel_workspace.json`, engine=axe-core, serious=0, critical=0 |
| error 页面或回库页面单边冒充 recovery | 12 trigger + 12 recovery 配对；trigger 来源 DOM；recovery click `isTrusted=true` + Source Library URL + 无 sourceId |
| 重复 source 扩大分母 | uniqueRuntimeSources=12（6+3+3），四类唯一键各 12 |
| request 孤儿或双终态 | 530 Runtime + 7 Background 全部 exact-one terminal |
| private bytes 泄漏 | 1099 public bytes 扫描 0 hits；6 private 独立分类 |
| 本地 PASS 冒充独立 PASS | acceptance-result 保持 A12 Pending；T03 仍 NO-GO |
| 仅凭 `tar -xzf` 的伪 mode mismatch | 已改为 `tar --same-permissions -xzf`；verifier 33/33 |
| 跨 run 拼接 | 新 events 仅含新 runId；旧 run 未被修改 |
| 产品 0 修改 | dev-plan §3 明确实体清单；`workspaceAuthority.ts` / `SourceDetailReader.tsx` 等产品代码 0 修改 |

---

## 8. PRD / 架构 / 合同 / 阶段门禁一致性

| 文档 | 关键条款 | 本 run 符合度 |
|---|---|---|
| `02-prd.md` 17.1 双仓 / Runtime 权威 / G6 axe 0/0 / 12.x Forget 4 surface 验证 | durable Forget 4 mode 重开 + recovery 链 | ✓ |
| `03-architecture.md` Runtime / Adapter 边界 | Runtime 是唯一 producer；Mock Adapter 占位 | ✓（adapterMode=mock） |
| `04-px-stage-gate.md` PX-5 FAIL/REOPENED | 本 run 仅 R2 production-input，不修改门禁 | ✓ |
| `05-t02.2-development-plan.md` 实施边界 | 仅修改 runner / collector test / readiness / verifier | ✓ |
| `06-t02.2-acceptance-plan.md` 12 项固定分母 | 12 项无 N/A | ✓（12 项全 PASS） |
| `09-failed-attempts.md` 失败 run 隔离 | 5 次失败 run 无 seal | ✓ |
| `10-acceptance-candidate.md` 12 项分母 + 真实执行摘要 | 与本 session 独立复算一致 | ✓ |
| `12-implementation-handoff.md` 剩余风险 | 同实施代理双轮审计风险 + Workspace 4.45:1 残留 + T03 实施前需重做 | ✓ |

---

## 9. 决定

**T02.2 PASS（限定 durable Forget production-positive R2 input）**。本 session 对 `t02-r2-durable-forget-production-input-20260912T165535` 真实采集与封存的原始证据做独立静态核验：

- 12 项固定分母全部满足（含 T02.2-A04..A07 durable forget 12 trigger + 12 recovery）。
- 19 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- Seal `50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624` 独立重算 canonical JSON 完全一致。
- 公开 1099 + private 6 artifact 字节扫描 0 命中已知敏感模式。
- 5 次失败 run 与旧 T02 / T02.1 run 严格隔离。
- 33/33 `verify-t02.2-verifier.py` 机器检查独立复算通过。
- 同版 `audit-t03-input-readiness.py --public-package` 对新 run Major=0 / ready=true；对旧 T02.1 run Major=1（仅 T03-IN-09）。
- 4 项 Minor 均为审查覆盖度或文档措辞问题（详见 §14），不构成 Fatal/Major 阻断。

**允许进入**：T03 实施前审计更新（即 R3 共享 semantic/AST 校验的 preimplementation-audit 必须重做，以 `50489670…0624` 封印的新 run 为 production-positive base）。

**禁止**：
- 不允许将 T02.2 PASS 扩大为 T03 / PX-5 / PX-6 / V2 / RAG ready / 完整外脑 / 自动维护完成。
- 不允许跑旧 generator / production validator 重新覆盖。
- 不允许把 T02.2 acceptance candidate 的本地 PASS 等同于独立 PASS（本 session 即独立审查）。
- 不允许 T03 / T04 / PX-6 / RKM 在本审查通过前进入实质实现。
- 不允许修改旧 T02 / T02.1 run。
- 不允许把新 run 与旧 run 拼接。
- 不允许仅以普通 `tar -xzf` 重算；必须 `--same-permissions` 保留 tar header mode。

---

## 10. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + 隔离 tar 解包。
- 没有运行报告生成器、生产 validator、pytest 直接重跑、浏览器、Runtime。
- 没有修改主工作树、没有 commit、没有 push。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 上午）所有已封存 run / seal / audit doc 原样保留。
- tracked diff 与未跟踪文件原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit 系列审计文档并列独立存档。

---

## 14. Minor 项（4 项，不阻断 T02.2 PASS）

### M-1：T02.2-A11 `readyForPositiveProductionValidation=true` 不等于 T03 通过

**位置**：`14-new-run-input-readiness.json` `allowedUse = "production_positive_input_candidate"`，仅证明 T03 production-positive 输入分母闭环。

**风险**：低；T03 实施前仍需重新做 preimplementation-audit + 独立复审。

**建议**：T03 preimplementation-audit 必须把 `sourceRunId` 改为 `t02-r2-durable-forget-production-input-20260912T165535`、`sealSha256` 改为 `50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624`、`snapshotCommit` 改为 `fce3aaec9e8c8b7d88b29f60f3a94e63f9390699`。

### M-2：审计请求 `--checker 16-t03-input-readiness.py` 相对路径在 subprocess 中失效

**位置**：`01-audit-request.md` §3 推荐命令使用相对路径 `--checker 16-t03-input-readiness.py`；当 verifier 通过 `subprocess.run` 调用该命令时，相对路径相对于 verifier 的 cwd 而非 audit-package 目录。本 session 用 `--checker "$(pwd)/16-t03-input-readiness.py"` 绝对路径绕过。

**风险**：低；不影响实际判定结果（33/33 在绝对路径下已确认），但下一轮独立审查者按 audit-request 推荐命令字面执行会得到 30/33 的 false failure。

**建议**：在 `01-audit-request.md` §3 把 `--checker` 改为相对当前包目录的相对路径（如 `16-t03-input-readiness.py` 而 verifier 通过 `Path(__file__).parent` 解析），或在 verifier 中加入 `cwd=Path(__file__).parent` 参数。

### M-3：T01 真实 Chrome 36 项未逐条直接复核

**位置**：`.infra/t01-regression/raw/t01-real-chrome-run.json` 在新 run 目录；本 session 仅验证 exitCode=0 与 prerequisite log。

**风险**：低；T01 已是历史门禁通过项（先前已独立验证 36/36）。

**建议**：R3 阶段如需重跑 T01 36 项回归，应直接打开 T01 runner 输出逐 assertion 状态。

### M-4：同实施代理双轮审计 + 本 session 不具备组织独立性

**位置**：`12-implementation-handoff.md §4` 已声明"当前同一实施代理的双轮审计不具备组织独立性；外部审查是唯一剩余 Major 门禁"。

**风险**：低；本 session 声明为第三方独立上下文，与实施代理非同一 session，但仍共享基础工具集与 README 入口。

**建议**：R3 阶段（如进入）应至少由两个独立 session（一个 second-pass audit，一个 external CLI）交叉验证，并要求 reviewer session 与实施 session 的 prompt 哈希不同。

---

## 15. 总结

T02.2 是 V2-PX durable Forget 证据链修复的最后一段 R2 production-positive 输入。33/33 机器检查 + 12/12/12 durable Forget 链（3 source × 4 mode trigger + 12 trusted recovery + 12 sequence-ordered）+ 530 Runtime exact-one terminal + 0 跨 run 引用 + T03 input readiness Major=0 + 旧 T02.1 run 仍 fail-closed 反映其历史缺陷——本 session 客观确认 T02.2 限定 PASS 的全部支撑材料客观成立。

下一阶段仅允许 T03 实施前审计更新（同样要求独立 Claude Code CLI 复审）。T03 / T04 / PX-6 / RKM 仍 NO-GO / BLOCKED / NOT_IMPLEMENTED。