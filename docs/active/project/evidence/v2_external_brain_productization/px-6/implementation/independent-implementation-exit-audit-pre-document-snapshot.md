# PX6-0..5 独立实施出门审计

日期：2026-09-15  
审查者：独立 reviewer session（read-only，与 implementation report/internal-risk-audit 不同会话）  
审查对象：`docs/active/project/external-audit-package/` 平铺 19 载荷 + `AUDIT_MANIFEST.md`  
候选 run：`px6-machine-exit-20260914t163000z`

## 1. 范围与允许/禁止声明

### 1.1 决定对象（仅）

```text
PX6-0..5 machine candidate LIMITED PASS or FAIL
```

### 1.2 允许声明

```text
PX6-0..5 LIMITED PASS
PX6-6 human review pending
PX6-7 production finalizer blocked (fail-closed)
```

### 1.3 禁止声明（不在本审查范围；擅自写出即视为越权）

```text
H01..H07 / Human Review 签署
PX-6 / V2 / RAG / RKM 通过
PX-5 由 FAIL/REOPENED 升级
PX6-7 production finalizer 已放行
"机器通过 = 生产通过" 等任何等价表述
```

### 1.4 不可越界

PX6-7 独立终审握手 Major（`px6-7-final-audit-handshake-risk-stop.md`）属于 PX6-7 阶段，且按 risk-stop §"当前处置"明示"PX6-0..5 不受影响"。本审查**不**把该 Major 扩张为 PX6-0..5 机器阶段失败。PX6-0..5 与 PX6-7 在 schema、CLI、archive 政策上保持 `waiting_for_human_review / finalPassed=false` 的硬隔离。

## 2. 复现命令与独立算法

下列命令由 reviewer 在 `/mnt/c/workspace/navia` 下逐条重跑；不修改任何产品代码或既有证据。

### 2.1 平铺包 19 载荷 SHA-256 + 字节数 + 权威源一致性

```bash
python3 - <<'PY'
import hashlib, os, re
manifest = 'docs/active/project/external-audit-package/AUDIT_MANIFEST.md'
pkg_dir  = 'docs/active/project/external-audit-package'
root     = '/mnt/c/workspace/navia'
rows = []
for line in open(manifest):
    m = re.match(r'\|\s*(\d+)\s*\|\s*(`[^`]+`)\s*\|\s*(`[^`]+`)\s*\|\s*(`[^`]+`)\s*\|\s*(\d+)\s*\|', line)
    if m: rows.append((int(m.group(1)), m.group(2).strip('`'), m.group(3).strip('`'), int(m.group(5))))
fails=0
for num, payload_name, src_path, expected_bytes in rows:
    pkg_bytes = open(os.path.join(pkg_dir, payload_name),'rb').read()
    src_bytes = open(os.path.join(root, src_path),'rb').read()
    pkg_h = hashlib.sha256(pkg_bytes).hexdigest()
    src_h = hashlib.sha256(src_bytes).hexdigest()
    ok = (pkg_h == src_h) and (len(pkg_bytes) == expected_bytes) and (len(src_bytes) == expected_bytes)
    print(f'#{num:>2} {payload_name}: pkg_sha={pkg_h} src_sha={src_h} bytes_ok={len(pkg_bytes)==expected_bytes} binding={ok}')
    if not ok: fails += 1
print(f'TOTAL={len(rows)} fails={fails}')
PY
```

独立结果：19/19 binding ok，19/19 bytes match manifest；T04.1 ExitManifest raw SHA-256=`1e37f5ed…4186` 与 PX-6 MachineExitAudit raw SHA-256=`12bd5a…21b7` 与 PX-6 machine public archive SHA-256=`54ff4a…4be8` 三方一致（manifest 顶部声明）。

### 2.2 Schema meta + 7 positive + 20 registry/case/failureCode

```bash
python3 - <<'PY'
import json
s = json.load(open('docs/active/project/contracts/v2_px6_exit_contracts.schema.json'))
print('meta:', s['x-navia-contract-version'], s['x-navia-canonical-json'])
fc = s['x-navia-failure-code-registry']; rq = s['x-navia-requirement-registry']
assert len(fc)==20 and len(set(fc))==20, f'failure-code registry must be 20 unique, got {len(fc)}'
assert len(rq)==20, f'requirement registry must be 20, got {len(rq)}'
f = json.load(open('docs/active/project/contracts/fixtures/v2_external_brain/px6-exit-contract-fixtures.json'))
print('fixtureMode:', f['fixtureMode'], 'claim:', f['claim'])
assert len(f['positiveInstances'])==7, f'positive must be 7, got {len(f["positiveInstances"])}'
assert f.get('cases') and len(f['cases'])==20, f'cases must be 20, got {len(f.get("cases",[]))}'
PY
```

独立结果：meta=`v1 / navia_canonical_json_v1`；failure-code-registry=20（unique）；requirement-registry=20（PX6-N-001..PX6-N-020，每个含 `requirementKey / failureCode / enforcementLayer`）；positiveInstances=7（PX6-P-001..PX6-P-007）；cases=20。

### 2.3 T04.1 ExitManifest raw/content/public/audit binding

```bash
python3 - <<'PY'
import hashlib, json
em = open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/exit-manifest.json','rb').read()
assert hashlib.sha256(em).hexdigest() == '1e37f5ed06dd28bf94cd3fb4b2f92ee7f0fe79f7d041353f6a58b4a1ed1f4186'
m = json.loads(em)
# raw→content binding
base = json.loads(em); del base['contentSha256']
import hashlib as H
canonical = json.dumps(base, sort_keys=True, separators=(',',':')).encode()
assert H.sha256(canonical).hexdigest() == m['contentSha256'], 'content hash mismatch'
print('raw binding:', m['snapshotInputManifest']['sha256'])
print('content binding:', m['contentSha256'])
print('public binding:', m['publicEvidenceArchive']['sha256'])
print('audit count:', len(m['auditArtifacts']))
PY
```

独立结果：raw ↔ content ↔ snapshotInputManifest ↔ publicEvidenceArchive ↔ 4 auditArtifacts（含 `implementation-exit-audit-request.md`）四向一致；canonical JSON 重算与 `contentSha256` 一致。

### 2.4 28 tracked source AST + raw → facts

`apps/chrome-extension/e2e/lib/v2PxExitAudit.mjs` 第 342 行：`deriveFacts({ runRoot: roots.fresh_source_run, sealedRawRun: storedDerived.sealedRawRun, ... })` 重新派生；第 343 行 `canonicalJson(recomputed.facts) !== canonicalJson(storedDerived) ⇒ PX6_T04_EVIDENCE_MUTATED`。架构扫描从 `architecture-scan-manifest.json` 的 28 tracked source 原始字节经 `executableArchitecture.trackedPaths` 注入 `inlineSource`，再走 `validateArchitectureFromRaw`（import `typescript` AST in `v2PxSemanticValidation.mjs`）。

```bash
python3 - <<'PY'
import json
a = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/fresh/validation/architecture-scan-manifest.json'))
print('trackedPaths =', len(a['trackedPaths']))
PY
```

独立结果：`trackedPaths = 28`。AST 不信任 `violations=0` 总结，从原始字节重算。

### 2.5 newest scan 与旧 runner 禁用

- `LEGACY_RUNNER = "audit-v2-external-brain-exit.mjs"` 在 `v2PxExitAudit.mjs:34`；`validateLegacyInvocation(argv)` 在第 283 行；`assertNoLegacyInvocation(resolved)` 在第 361 行；PX6-N-005 在第 402 行实际执行 mutation + 断言。
- `assertNoLegacyInvocation` 在 `v2PxSnapshotComparison.mjs:225-229` 同时禁掉 `generate-v2-external-brain-productization-report.mjs`、`validate-v2-external-brain-production-evidence.mjs`、`validate-v2-external-brain-productization-report.mjs`。
- 候选 run 由 `binding.t04RunId / px6RunId` 显式传入（`v2PxExitAudit.mjs:305`），**不**做 `ls | sort | tail -1` 类 newest 扫描；架构文档 §02 第 2143 行也明确禁止。

### 2.6 17/12/20/12/4/4/0/0/5 + 63/109/42 + T04 14/25 + T04.1 14/8

```bash
python3 - <<'PY'
import json
cb = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t163000z/candidate-binding.json'))
d = cb['denominators']
expect = dict(productionScenarios=17, sources=12, webSources=6, localSources=3, noteSources=3,
              routeCells=20, forgetRecoveryChains=12, faultClasses=4, viewportClasses=4,
              axeSerious=0, axeCritical=0, keyboardPassed=5, keyboardTotal=5,
              validationRules=63, machineRulesPassed=61, humanRulesPending=2,
              contractFixtures=109, productionMutations=42, t04Acceptance=14, t04Negatives=25)
print('match_all:', all(d.get(k)==v for k,v in expect.items()))
pv  = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/fresh/validation/production-validation.json'))
cr  = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/fresh/validation/contract-regression.json'))
pm  = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/fresh/validation/production-mutation-results.json'))
sr  = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/snapshot-revalidation.json'))
t1a = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/t04.1-acceptance-results.json'))
t1n = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-resolved-invocation-20260914t145648z/t04.1-negative-fixture-executions.json'))
print('validation:', len(pv['ruleResults']), 'contract:', len(cr['caseResults']), 'mutations:', pm['total'], pm['passed'], pm['failed'])
print('T04 acc:', len(sr['t04AcceptanceResults']), 'neg:', len(sr['negativeResults']))
print('T04.1 acc:', len(t1a['results']), 'neg:', len(t1n))
PY
```

独立结果：`match_all=True`；validation=63 (61 passed + 2 pending)、contract=109/109、mutations=42/42/0、T04 acceptance=14（all passed）、T04 negatives=25（all passed）、T04.1 acceptance=14（all passed）、T04.1 negatives=8（all passed）。

### 2.7 20 negative 实际命中而非回显

`px6-negative-results.json` 含 20 个 `PX6-F-001..PX6-F-020`，每个有 `expectedPrimaryFailure`/`observedPrimaryFailure` 且 `passed=true`。`runPx6NegativeSuite` 在 `v2PxExitAudit.mjs:394-431` 通过 `actions[requirementId]()` 实际执行 mutation 并捕获 `errorCode`；任何 expected≠ observed 会抛 `PX6_VALIDATION_DENOMINATOR_MISMATCH`。本审查运行 `python3 -c "import json; r=json.load(open('…/px6-negative-results.json')); assert len(r)==20 and all(x['passed'] for x in r) and all(x['expectedPrimaryFailure']==x['observedPrimaryFailure'] for x in r)"`。

### 2.8 A01..A14 passed + A15/A16 pending

`machine-exit-audit.json` 第 14-206 行：16 个 acceptanceResults，A01..A14=`status:"passed"` 且 `evidenceRefs` 非空，A15/A16=`status:"pending"` 且 `evidenceRefs:[]`。schema `MachineWaitingAcceptanceResults` 在 `$defs` 用 `contains` 强制枚举 A01..A16 的 status，且 claim 固定为 `"PX-6 machine review package is ready for human review."`。

### 2.9 公开机器 tar

```bash
mkdir -p /tmp/px6-audit-tar && cd /tmp/px6-audit-tar && \
  tar xzf docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t163000z/public/px6-public-evidence.tar.gz && \
  tar tzf docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t163000z/public/px6-public-evidence.tar.gz | sort
```

独立结果：17 个成员（含 `machine-package-member-index.json` 自身）；成员 hash 与 `machine-package-member-index.json` 中 16 条 member + index 自身逐字节一致（0 mismatch）。所有 JSON 文本扫描：

```bash
python3 - <<'PY'
import json, re
forbidden = [r'"reviewer"\s*:', r'"reviewedAt"\s*:',
             r'V2-PX External Brain Productization passed dual-container real-Chrome acceptance',
             r'"finalPassed"\s*:\s*true']
for f in ['machine-exit-audit.json','review-request.json','machine-package.json',
         'machine-package-member-index.json','evidence-index.json','machine-boundary.json']:
    t = open(f'/tmp/px6-audit-tar/{f}').read()
    hits = [p for p in forbidden if re.search(p, t)]
    assert not hits, f'{f}: {hits}'
print('no human/final/success claim leaked')
PY
```

独立结果：无 `"reviewer":`/`"reviewedAt":`/production-passed claim/`"finalPassed":true` 漏出；`machine-exit-audit.json` 的 `machinePassed=true` 与 `finalPassed=false` 明确分离；`review-request.json` 的 `automatedApprovalAllowed=false`。

### 2.10 document-drawio-audit 5 repository_snapshot path/raw hash

```bash
python3 - <<'PY'
import json, hashlib
d = json.load(open('docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t163000z/document-drawio-audit.json'))
arts = d['artifacts']
assert all(a['artifactRoot']=='repository_snapshot' for a in arts)
for a in arts:
    p = f'docs/active/project/{a["path"]}'
    b = open(p,'rb').read()
    assert hashlib.sha256(b).hexdigest() == a['sha256'], a['path']
    assert len(b) == a['byteLength'], a['path']
print('repo_snapshot count:', len(arts), 'all hash+len ok')
PY
```

独立结果：5 个 repository_snapshot artifact，路径与字节/哈希全部对得上（01-prd.md、02-architecture.md、04-acceptance-plan.md、stage-gates/v2-external-brain-productization.md、design/v2-memory-personal-knowledge-base-gap.drawio）。

### 2.11 PX6-7 握手 fail-closed 范围

`px6-7-final-audit-handshake-risk-stop.md` §"当前处置" 第 1 条：`**PX6-0..5 不受影响**，继续停在 waiting/pending/pending/false"；`buildFinalDisposition` 对 `production_acceptance` 默认返回 `PX6_CLAIM_OR_FINAL_AUDIT_OVERREACH`。架构文档 §02 第 3 行也写明"PX6-7 production finalizer 在独立终审 ArtifactRef 尚未冻结前 fail-closed"。本审查**不**将 PX6-7 Major 扩张为 PX6-0..5 机器阶段失败。

## 3. 严重度裁定

```text
PX6-0..5 machine stage:  Fatal = 0 / Major = 0 / Minor = 0
PX6-7 production path:    Fatal = 0 / Major = 1 (document/contract handshake)
                         -> 单独 fail-closed，不并入 PX6-0..5
PX6-6 human review:       pending; H01..H07 不可由本审查代签
PX-5:                     FAIL / REOPENED (历史冻结，本审查不动)
PX-6 final:               NOT PASSED
```

## 4. 独立判定

- **PX6-0..5 LIMITED PASS**：19 载荷逐字节一致；schema meta/7 positive/20 failure-code/20 requirement/20 case 闭合；T04.1 ExitManifest raw↔content↔public↔audit 四向闭合；28 tracked source AST + raw→facts 真正重算；newest scan 与旧 runner 被禁止；20/20 negative 实际 mutation 命中 expected failure；A01..A14 passed / A15..A16 pending 不存在删除或代签；公开 tar 17 成员 hash 一致且不含 reviewer/reviewedAt/finalPassed=true/production-passed claim；5 个 repository_snapshot 路径+字节+hash 全部对得上；分母 17/12/20/12/4/4/0/0/5、63/109/42、T04 14/25、T04.1 14/8 全部独立核出。
- **PX6-6 维持 pending**：human review 不能由本审查代签；human-review-checklist.md/final-review.html 已生成但仅作显示用。
- **PX6-7 维持 fail-closed**：独立终审 ArtifactRef 尚未冻结；`buildFinalDisposition` 默认拒绝。

## 5. 残余风险（非阻断机器出门，但下游必须警惕）

1. PX6-7 handshake Major 需要在 H01..H07 之后回到文档阶段冻结两步握手（PX6-7a FinalizationCandidate → IndependentFinalAudit ArtifactRef → PX6-7b FinalDisposition）；未经用户批准不得选择弱化路线。
2. T04 跨 root 命名一致性 Minor 1（`replay_validation` vs `validation_run`，物理路径与字节相等）属历史结论，本轮不动，但下游需保持 `artifactRoot` alias 表稳定。
3. `02-architecture.md` / `04-acceptance-plan.md` / `design/v2-memory-personal-knowledge-base-gap.drawio` 三个 active 文档对"T04.1 / LIMITED PASS / PX-6 / PX6-7 fail-closed"的措辞是审查前置条件，任何下游改动需同步重跑 `document-drawio-audit.json`。
4. 跨 reviewer / 跨 OS（`/mnt/c` 与 `/tmp` ext4）的 tar 重建一致性已由实施方报告；本审查在 `/mnt/c` 单 OS 复算，未跨 FS 复跑，仍属可复现区间。
5. A15/A16 与 H01..H07 任何一条不通过都必须重新跑机器出门；不得用"机器阶段 Limited Pass 等同产品 Pass"代替。

## 6. 越权告警

本审查**不**：

- 不签 H01..H07、不声称 Human Review 已通过；
- 不承认 PX-6 / PX-5 / V2 / RAG / RKM 已通过；
- 不代签 production finalizer（PX6-7）；
- 不修改任何产品代码或既有证据；
- 不跑 Chrome、Runtime、旧 `audit-v2-external-brain-exit.mjs`、旧 generator/validator；
- 不把 PX6-7 握手 Major 算到 PX6-0..5 头上。

## 7. 落地

```text
PX6-0..5 machine candidate:  LIMITED PASS
PX6-6 Human Review:          pending (H01..H07, real human in visible Chrome)
PX6-7 production finalizer:  blocked (fail-closed, two-step handshake unfrozen)
```

唯一允许写入文件即本文件 `independent-implementation-exit-audit.md`。