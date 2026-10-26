# Commands and exits

Every command of this batch, with its exit code and its result.

## 1. The implementation and the offline gate (R0)

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/test/run_offline_suite.mjs` | **0** | the serial phase **7/7** and the concurrent phase **229/229** — 236 offline cases, deterministic, no Chrome, no Runtime, no Provider, no network |
| `python3 -m pytest tests/test_v3_gc_b5r_input_authority.py tests/test_v3_gc_b5r_corrective_authority.py tests/test_v3_media_comprehension.py -q` | 0 | **72 passed** (32 + 12 + 28) |
| `python3 -m pytest tests -q` | 0 | the full Runtime suite — see §6 |

The offline suite includes the new registry, aggregate-exit and anti-false-green
tests, the preflight and exact-lock tests, the static runner gate and the
relay-preservation checks.

## 2. The extension build (R2.1)

| Command | Exit | Result |
|---|---:|---|
| `npm run build:e2e` (in `apps/chrome-extension`) | 0 | the bundle built, 4.7 MB total; it is the bundle the batch loaded (through the pre-granted fixture) |

## 3. The production preflight (R1)

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/production_preflight.mjs --evidence-root=…/gc-b5r-b5-real-run-2026-10-24` | 0 | **34 checks, 0 failed**; every action counter zero; the receipt is `03-preflight-receipt.json` |

What it proved before any Chrome launch: the exact v2 registry digest, the
exact order, the reserve prohibition, the six public metadata responses bound
to their BVID and not paywalled, the authorized Cookie file readable with the
required Cookie NAME present (no value, no value length, no path, no content),
the owned Playwright Chromium, the built extension bundle, the pre-granted
fixture (no native prompt), a free CDP port, a fresh profile, the free frozen
Runtime port 17861, the fresh Runtime roots, database and task root, the
product's ffmpeg/ffprobe configuration, the SenseVoice binary/model/VAD, the
four dependencies VERIFIED through the product's own status route with their
frozen digests, exactly ONE configured Provider
(`minimax-cn-openai-vision` / `minimax_chat_completions`) through the
supported product bootstrap, the disk/memory/execution budgets, and the owned
cleanup roots.

## 4. The single owned visible batch (R2)

| Command | Exit | Result |
|---|---:|---|
| `node scripts/stage_b_b5_3/sequencer.mjs --run-id=gc-b5r-b5-real-2026-10-24 --evidence-root=…/run` | **1** | the six sources ran: **complete 3 · failed 3**; the aggregate verdict is not positive; the process audit is clean (0 leaks) |

### The earlier launches (each aborted before any product action)

| # | The identified condition that aborted it | Product actions |
|---:|---|---|
| 1 | a runner wiring defect (`visionProviderDbPath` was never defined) | 0 |
| 2 | the same defect (the fix was block-scoped) | 0 |
| 3 | a launch with a relative path from the wrong working directory | 0 |
| 4 | the extension's optional `cookies` permission needed a native prompt the automation could not answer | 0 |
| 5 | the extension's frozen Runtime URL is `http://127.0.0.1:17861` and the runner had started the Runtime on a random port | 6 (the resolve fired, the source was refused) |
| 6 | the runner's own privileged call had no companion session | 6 (the acquisition completed, the synthesis was refused) |
| 7 | **the clean batch** | 6 (three complete, three refused) |

Launches 1–4 performed **no** product action at all: no navigation, no Cookie
injection, no acquisition, no Provider call, no download and no media task.
Launch 5 and 6 are preserved as `diagnostic-attempt-6` and the aborted
attempt directories; their per-source diagnostics are the evidence of the
identified condition.

Every abort was preceded by an identified change, never a blind retry, and
every one is preserved with its console log.

## 5. The relay v11 preservation (O12)

This batch changed **no** relay-v11 source-scope file, so the canonical gate
stays green. Nothing was refrozen.

| Command | Exit | Result |
|---|---:|---|
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py` | 0 | **50/50**, `failedChecks: []`, `unlistedBoundaryEmits: {}` |
| `python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py` | 0 | **16/16** |

## 6. The static runner gate

| Command | Exit | Result |
|---|---:|---|
| `node --test scripts/stage_b_b5_3/test/runner_static_check.node-test.mjs` | 0 | no undefined identifier and no module-level function reading a block-scoped declaration — the gate that now prevents the class of defect that aborted launches 1 and 2 |

## 7. The full Runtime suite

| Command | Exit | Result |
|---|---:|---|
| `python3 -m pytest tests -q` | 0 | **1176 passed, 3 skipped**, 4 warnings, 457 s |

The three skips and the four warnings are pre-existing (the warnings are the
`os.fork()` deprecation of the WP-B AC1 durability cases). The suite ran
against the final byte state of every file this batch touched, including the
receipt-extras correction.

## 8. The extension subtree and the external canary

The batch changed **no** extension or shared TypeScript, so the extension
subtree is not affected by it. The `build:e2e` ran green (§2) and the
`PH0-AR-12` canary is the EXTERNAL visible canary: the corrective goal
forbids re-running it here, and the one offline command classifies it as
`external_not_run` (not a pass, not an offline failure).

A media-companion subtree run (`npx vitest run --pool=forks
--fileParallelism=false src/modules/media_companion`) was started as an extra
check and was **stopped after ~40 minutes without a result** on this
filesystem. It is therefore **not** reported as a pass. The last green
extension media result is the WP-B closeout's, not this batch's.
