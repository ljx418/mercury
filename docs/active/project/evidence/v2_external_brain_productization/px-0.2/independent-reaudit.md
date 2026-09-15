# V2-PX PX-0.2 Independent Re-audit

Audit date: 2026-09-01

Orca provenance:

```text
Run: run_eafb1fb5831e
Task: task_c5d01d226d98
Dispatch: ctx_92c2701b6585
Mode: independent read-only review in the current uncommitted worktree
Files modified by auditor: none
```

## Disposition

```text
PX-0.2: FAIL / REOPENED.
Fatal: 0.
Major: 3.
Minor: 1.
PX-1+: NO-GO.
```

The auditor independently reproduced the baseline command result:

```text
9 schemas
65 positive instances
1 FixtureSuite root
175 fixture validation instances
63 RuleIds
41 semantic RuleIds
109 mandatory negative fixtures
7/7 focused tests
typecheck PASS
```

It confirmed that complete FixtureSuite root/exact-set closure and full PNG
decode are repaired. Those local checks do not close the following findings.

## Major 1: RFC 6902 Array Add Is Not Strict

`patchDocument()` converts an array key with `Number(key)` and calls `splice`
without first requiring a valid integer index or the RFC 6902 `-` append token.
Changing PX-N-099 to use:

```text
/testCommands/3/result/excludedPaths/not-a-valid-array-index
```

still allowed the complete suite to pass. The runner must reject invalid array
indices before applying any patch.

Primary implementation reference:

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs:94
```

## Major 2: Screenshot Metadata Artifact Is Not Bound

Report `screenshotMetadataPaths` are path strings, but the artifact/hash rule
does not include them and the metadata rule trusts the separately loaded JSON
objects. Removing:

```text
virtualArtifactContract.artifactsByPath[fixtures/scenario_01/screen.json]
```

still returned `passed=true` with G1-G7 true. Every metadata path must resolve
to exact raw bytes and those bytes must parse to the paired metadata object.

Primary implementation reference:

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs:419
```

## Major 3: G4 `fetch.call` Bypass

After replacing tracked source bytes, recomputing blob/tree hashes and keeping
Report `violations=0`, this direct frontend call was not detected:

```javascript
fetch.call(globalThis, "http://localhost:17861/v1/query")
```

`architectureScan()` returned `scopeValid=true` and `violations=0`. Callee
normalization must treat `call/apply/bind` wrappers around forbidden network
functions as the underlying operation, and focused tests must cover the path.

Primary implementation reference:

```text
apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs:268
```

## Minor 1: Active Acceptance Authority Drift

`docs/active/project/04-acceptance-plan.md` still describes PX-0.1b as reopened
although the active stage gate records PASS, and names Architecture Scan
Manifest v1 while the frozen contract uses v2.

## Required Decision

Per the development rule for Major false-green findings, automation stops here
for human confirmation. The next allowed work is a bounded PX-0.2 repair for
these three Majors and one Minor, followed by complete local acceptance and a
new independent read-only audit. PX-1 remains prohibited.
