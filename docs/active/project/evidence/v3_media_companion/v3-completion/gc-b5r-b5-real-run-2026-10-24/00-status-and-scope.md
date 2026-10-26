# GC-B5R B-5 real six-video run — status and scope

Date: 2026-10-24
Workpack: GC-B5R Stage B B-5, the real six-video run
Final state: **GC-B5R B-5 REAL RUN BLOCKED AWAITING CODEX DECISION**

## 1. What was executed

The single consolidated owned-Chrome visible batch ran the six frozen v2
sources, in the registry order, each with its own fresh Runtime, database,
Chrome profile, task namespace, source identity and dependency generation.

| | |
|---|---|
| the registry | `gc-b5r-source-set-rebaseline-2026-10-24/02-stage-b-six-video-registry-v2.json` |
| the registry digest | `9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454` (verified) |
| the run id | `gc-b5r-b5-real-2026-10-24` |
| the evidence root | `gc-b5r-b5-real-run-2026-10-24/run` |
| the preflight | `03-preflight-receipt.json` — 34 checks, all green, every action counter zero |
| the aggregate | `complete 3 · limited 0 · blocked 0 · failed 3` → **not a positive candidate** |
| the sequencer's exit | **1** (the aggregate verdict is not positive) |
| the process audit | `leakedBefore 0 · leakedAfter 0 · ok true` |

## 2. The action counts

| Action | Count |
|---|---:|
| owned Chrome launches (the real batch) | **6** (one per source, every argv carrying `--mute-audio`) |
| visible windows | **6** (one owned window per source, the user's own Chrome never touched) |
| Runtime starts (owned, isolated) | **6** |
| Provider synthesis attempts | **6** (one per source; three produced a published derivative, three were refused by the frozen validator) |
| Provider HTTP requests | **14** (the per-source request count of the published receipts is 5, 4 and 5; the frozen bounded repair route is inside that count) |
| downloads (the product's own acquisition) | **6** (the product's automatic route; the runner downloaded nothing itself) |
| imports (the product's own local-import route) | **0** (the local import was not selected on any source) |
| media tasks created (by the product) | **6** |
| Cookie injections (into the owned ephemeral profile) | **156** (26 per source; no value was printed, recorded or persisted) |
| audio outputs | **0** (`--mute-audio` on every launch; no audio device was opened) |
| tabCapture actions | **0** (the route was the automatic credentialed route on every source) |
| focus events | **6** (one per source, always on the runner's OWN owned window) |
| real-source completions | **3** |
| BVID substitutions | **0** |
| reserve substitutions | **0** |

## 3. Why the batch is BLOCKED, not AWAITING

The machine-positive candidate requires `complete >= 5`, `blocked <= 1`,
`limited = 0`, `failed = 0`, six fresh source rows, no substitution and no
cross-run reuse. The batch produced **3 complete and 3 failed**, so the
aggregate verdict is not positive and the sequencer exited nonzero.

The three failures are the frozen V2.1 chapter invariants refusing the cloud
output. The product behaved exactly as the contract requires: the rejected
invariant dominated, nothing was published, and the local result stayed
unchanged.

| Order | BVID | Disposition | The frozen refusal |
|---:|---|---|---|
| 3 | `BV1v58B6GEan` | failed | `V3510B_CHAPTER_TIME_INVALID` — "Chapter starts must strictly increase." |
| 4 | `BV1M5tJ6kEvw` | failed | `V3510B_PROVIDER_RESPONSE_INVALID` — "Chapter count is invalid." |
| 5 | `BV1HTbi6LERi` | failed | `V3510B_PROVIDER_RESPONSE_INVALID` — "Chapter fields are invalid." |

A second, independent block was found by the run itself and is now fixed in
the tree: the published V2.1 derivative carried an **empty** `attemptId`,
`requestSha256` and `responseSha256`, because the Runtime read the Provider's
receipt extras **before** the request. The frozen V2.1 schema requires those
fields, so the three published derivatives of this run do NOT satisfy the
frozen schema. The fix and its offline gate are in `09-prd-coverage-and-risks.md`.

## 4. The scope of this package

It contains the machine evidence of the real batch, the preflight receipt, the
per-source receipts, the provider/upload boundary, the scans, the cleanup proof
and the handoff. It also preserves the earlier attempts honestly:

| Directory | What it is |
|---|---|
| `run/` | the clean six-source batch (the evidence of record) |
| `diagnostic-attempt-6/` | the diagnostic run whose sources 3–6 reached the Provider (its sources 1–2 ran with the pre-fix runner) |
| `aborted-attempt-1/` … `aborted-attempt-5/` | the earlier launches, each aborted by an identified harness defect **before any product action** |

The aborted attempts cost no product action: no page navigation, no Cookie
injection, no acquisition, no Provider call, no download and no media task.
Each one is preserved with its console log and its diagnostic.
