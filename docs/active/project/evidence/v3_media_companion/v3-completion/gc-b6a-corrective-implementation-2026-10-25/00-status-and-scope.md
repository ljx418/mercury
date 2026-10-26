# GC-B6A Corrective Implementation — Status And Scope

Batch: `GC-B6A CORRECTIVE IMPLEMENTATION`
Date: 2026-10-25
Coordinate: V3 Chat + Know / V3-5.10 Stage B / B-5 machine gate CLOSED /
B6A checkpoint NO-GO / B6A corrective implementation AUTHORIZED.

## Exit state

```text
GC-B6A CORRECTIVE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

B6B remains UNAUTHORIZED. B6, Stage B and V3 are NOT complete. No B7, no
Stage C, no visible-run authorization was consumed.

## What the Codex checkpoint found

The `gc-b6a-codex-checkpoint-2026-10-25` package reported Fatal 0, Major 4,
Minor 1. The four MAJOR findings are closed in this batch:

| Finding | Defect class | Closure |
|---|---|---|
| M1 | The aggregate authority was FAIL-OPEN | `lib/b6_authority.mjs` (new) + `lib/b6_aggregate.mjs` (rewritten): the candidate authority is REQUIRED, the rubric and prompt hashes are REQUIRED, six `complete` rows are REQUIRED, every row is bound to its authority source, the Provider identity is rejected RECURSIVELY and the sentinel claim sets must be identical and non-empty. |
| M2 | The bundle and the receipt were NOT byte-closed | `lib/review_bundle.mjs` (rewritten): ONE canonical encoder per contracted file, the validation REBUILDS every file from the parsed bundle and compares it byte-for-byte with the manifest entry, and the capture receipt is DERIVED (counts, digests, closure, schema and status are recomputed). |
| M3 | The private-root isolation and the durable publication were INCOMPLETE | `lib/review_capture.mjs` (rewritten): a canonical outside-repository 0700 root, an `lstat` of every path component, a symlink refusal, a strict `realpath` containment for every read, a fresh EXCLUSIVE staging directory, a validated re-read of the staging bundle, ONE atomic rename onto a non-existing destination and a cleanup that removes ONLY the owned staging directory. |
| M4 | The screenshot and the seek semantics were NOT closed | `lib/review_bundle.mjs` + `lib/review_capture.mjs`: ONE seek row per derivative chapter with the exact chapter id, order, window and evidence set, a seek time inside `[startMs, endMs)`, and a representative that is a same-task `frame` with a captured PNG. The capture FAILS when a chapter has no frame. |

The MINOR of the checkpoint (a pre-existing public evidence-boundary
inconsistency in an OLDER B-5 evidence package) was NOT changed: it is
historical evidence and it is out of scope. The B6B package must not repeat
that content.

## The boundaries that were preserved

- OFFLINE only. No Chrome, no real Cookie, no Provider call, no media
  download, no real BVID, no B6B/B7/Stage C, no visible-run authorization.
- No public contract, frozen denominator, relay fixture or historical
  evidence was edited. `06-contract-statement.md` states the contract
  position.
- The 54 FIXED obligations are neither merged nor reduced. `05-obligation-map.json`
  maps them, and the 7 original extra cases are preserved.
- No claim of atomicity without an exclusive staging plus a validated atomic
  publication, and no claim of containment from a lexical `path.resolve`.

## The deviation that must be declared

`apply_patch` is NOT available in this environment (`apply_patch: command not
found`). The edits were made with the file write/edit tools, which produce
the same patch content. No other tool was used to modify a file.

## The scope of the change

19 files, all under `scripts/stage_b_b5_3/` (plus this evidence package).
The whole `scripts/stage_b_b5_3/` tree is UNTRACKED in git, so the digests in
`01-changed-file-hashes.json` are the only baseline of this batch.
