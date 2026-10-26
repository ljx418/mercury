# GC-B6J Changed Files And Contract Statement

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26

## 1. The contract statement

**none.**

No public API, V2.1 schema, quality threshold, eight-request budget, source
registry, fixed denominator, Provider registry or review protocol byte was
changed. The canonical rubric and prompt bytes remain exactly the ones the
Codex froze on 2026-10-26:

```text
rubric  sha256 60a32cd9a9334a702a6b588ae864194426c82c7130d43cd2f979748e1255f5de  3838 bytes
prompt  sha256 6c1f53f2aab1981937aa0f97f8c95a9102ed0ff763e30212bc65ae89826e87d2  5353 bytes
```

Nothing was self-refrozen: the loader, the precommit and the validator still
check those exact bytes, and this package did not touch the protocol files.

The PRODUCT's failure-code inventory is unchanged. The dependency codes are
HARNESS codes of the B6 acceptance harness: they are the stable terminal
codes of the offline harness's own external-input refusals, and they are
published by their own owner (`lib/stable_failure_codes.mjs`), never by a
hand list.

## 2. The changed files

The Stage B tree is largely UNTRACKED in git, so the git diff mixes this
batch with the uncommitted Stage B work of the earlier batches. The list
below is this batch's own inventory.

### New (4)

| File | Role |
|---|---|
| `scripts/stage_b_b5_3/lib/candidate_dependencies.mjs` | J1/J2: the ONE dependency-resolution authority — the four product dependency inputs, their safe identities, the explicit child environment, the parity comparison, the preflight check and the stable codes |
| `scripts/stage_b_b5_3/lib/stable_failure_codes.mjs` | J3: the stable terminal-code vocabulary, assembled from the owners of the codes |
| `scripts/stage_b_b5_3/test/b6j_dependency_parity.node-test.mjs` | the anti-false-green matrix of this corrective (15 cases) |
| `scripts/stage_b_b5_3/test/_fixtures/b6j_dependency_fixture.mjs` | the synthetic product dependency state and the runner driver of the cases |

### Modified (9)

| File | Change |
|---|---|
| `scripts/stage_b_b5_3/lib/candidate_prepare.mjs` | the dependency object is resolved during the preparation and written as the PRIVATE object; the candidate environment carries the EXPLICIT dependency values and the object location; the lock carries the safe identities; the candidate-path gate is one shared rule |
| `scripts/stage_b_b5_3/prepare_candidate.mjs` | the lock carries the dependency identities and the child environment carries the explicit values and the object location |
| `scripts/stage_b_b5_3/sequencer.mjs` | the dependency parity is verified BEFORE the authorization consumption |
| `scripts/stage_b_b5_3/run_one_bvid.mjs` | the dependency parity is verified BEFORE the grant, the Cookie read and Chrome; the product dependency paths resolve from the TOOL root; the product's external-input refusal carries a stable code; the terminal code is never an exception name; the dependency refusal carries no exception text |
| `scripts/stage_b_b5_3/lib/owned_session.mjs` | the product harness error class is exported: it is the stable marker of an external-input block |
| `scripts/stage_b_b5_3/production_preflight.mjs` | the preflight resolves the dependency inputs, publishes their safe identities and validates the EXACT object the child consumes |
| `scripts/stage_b_b5_3/lib/retention_ledger.mjs` | `collectArtifactDigests()` returns a sorted unique digest set |
| `scripts/stage_b_b5_3/lib/public_evidence.mjs` | the lock's dependency identities are validated with an exact key set and no path; the terminal failure code must be allowlisted |
| `scripts/stage_b_b5_3/test/_fixtures/b6hr_public_evidence.mjs` | the synthetic lock carries the dependency identities and the synthetic rows accept a terminal-code override |

### The evidence package

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6j-offline-corrective-2026-10-26/`

## 3. The other repository state

The working tree was dirty before this batch and it is dirty now. The
modifications of the concurrent sessions (the Runtime modules, the extension
sources, the built bundle and the historical evidence) were NOT touched by
this batch. The repository was not committed, pushed, reset, cleaned, checked
out or reverted.
