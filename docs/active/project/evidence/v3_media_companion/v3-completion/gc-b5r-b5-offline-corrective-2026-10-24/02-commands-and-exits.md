# Commands and exits (offline corrective)

Every command of this batch. No command launched Chrome, started a real media
Runtime, called a Provider, downloaded media, read or injected Cookie
material, played audio or executed a real BVID.

## 1. The ONE offline runner suite

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` | **0** | the serial phase **7/7** and the concurrent phase **249/249** — 256 offline cases, deterministic |

The suite covers the new registry, the aggregate exit semantics, the
anti-false-green matrix, the stage action ledger, the failure finalizer, the
redacted diagnostic, the exact Provider lock and the static runner gate. The
external canary (`canary_bvid1.node-test.mjs`, PH0-AR-12) is classified as
`external_not_run` by the command and is NOT counted as a pass.

## 2. The new offline suites

| Command | Exit | Result |
|---|---:|---|
| `node --test scripts/stage_b_b5_3/test/action_ledger.node-test.mjs` | 0 | **9/9** — the append-only ledger, the stage/candidate distinction, the interrupted process, the malformed prior ledger, the duplicate authorization id, the lower-bound reconciliation |
| `node --test scripts/stage_b_b5_3/test/runner_failure_evidence.node-test.mjs` | 0 | **11/11** — the real runner driven through all five failure milestones, the complete audit set, the nonzero exit, the selected/attempted/published Provider facts, the zero upload counters, the consumed authorization, the diagnostic survival and the zero external action |
| `node --test scripts/stage_b_b5_3/test/runner_static_check.node-test.mjs` | 0 | **2/2** — no undefined identifier, no module-level function reading a block-scoped declaration |

## 3. The Runtime GC-B5R suites

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py tests/test_v3_gc_b5r_corrective_authority.py tests/test_v3_gc_b5r_chapter_diagnostics.py tests/test_v3_media_comprehension.py -q` | 0 | **87 passed** |

## 4. The full Runtime suite

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests -q` | 0 | see §4.1 |

### 4.1 The full Runtime suite result

| Result | Value |
|---|---|
| passed | **1191** |
| skipped | 3 |
| warnings | 4 (the pre-existing `os.fork()` deprecation of the WP-B AC1 durability cases) |
| duration | 523 s |
| exit | 0 |

The suite ran against the final byte state of every file this batch touched.

## 5. The relay v11 preservation

This batch changed **no** relay-v11 source-scope file, so the canonical gate
stays green. Nothing was refrozen.

| Command | Exit | Result |
|---|---:|---|
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | 0 | **50/50**, `failedChecks: []`, `unlistedBoundaryEmits: {}` |
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py` | 0 | **16/16** |

## 6. The scans and the cleanup

| Check | Result |
|---|---|
| secret / private-path / raw-media scan over the changed files and the new evidence | see `08-secret-path-raw-media-scan.json` |
| owned process / port / profile / temp-root residue | see `10-handoff.md` |

## 7. The extension

This batch changed **no** extension or shared TypeScript, so the extension
subtree is not affected by it. The `PH0-AR-12` canary is the EXTERNAL visible
canary and was not run: the corrective goal forbids re-running it here.
