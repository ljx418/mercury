# GC-B6J Snapshot Dependency Parity Corrective — Status And Scope

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26
Coordinate: V3 Chat + Know / V3-5.10 Stage B / B-5 machine gate CLOSED /
**GC-B6B SEALED MACHINE NEGATIVE / AUTHORIZATION CONSUMED** /
GC-B6H-R Codex corrective PASS / GC-B6J OFFLINE CORRECTIVE AUTHORIZED.

## Exit state

```text
GC-B6J OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT
```

It does not authorize or schedule a visible run. The fresh six-source
authorization is SPENT and it is not replaced by this package. B7, Stage C,
Stage B PASS and V3 PASS stay blocked.

## The defect that this package closes

The authorized fresh sealed GC-B6B candidate ran exactly once and its machine
gate is negative: `0 complete / 0 limited / 0 blocked / 6 failed`. Every row
stopped BEFORE the Runtime startup because the sealed snapshot child
resolved the configured vision Provider database below the SNAPSHOT, where
the private product state is intentionally absent, while the production
preflight had verified the WORKTREE path. Both checks were individually
consistent and they did not validate the same effective child environment.

This is a harness environment-parity defect. It is not a Provider-quality
result, and it does not reopen the spent candidate.

## The corrections

| Finding | Correction | Owner |
|---|---|---|
| the candidate environment did not carry the product dependency inputs | ONE dependency-resolution authority resolves the managed tools, the ASR root, the vision Provider source database and the extension build root ONCE, binds their SAFE identities and hands the child EXPLICIT environment values | `lib/candidate_dependencies.mjs`, `lib/candidate_prepare.mjs`, `prepare_candidate.mjs` |
| the preflight and the child validated different things | the production preflight validates the EXACT dependency object that the child consumes, and the sequencer and every source runner re-verify the parity BEFORE the authorization consumption, the Cookie read, the Chrome launch and the Runtime startup | `lib/candidate_dependencies.mjs`, `production_preflight.mjs`, `sequencer.mjs`, `run_one_bvid.mjs` |
| the external-input failure degraded to the generic `Error` | a stable allowlisted dependency code survives the runner finalization, the machine receipt and the public projection; a path, a database name, a credential, a key and an exception text are never a final code | `lib/stable_failure_codes.mjs`, `run_one_bvid.mjs`, `lib/audit_finalizer.mjs`, `lib/public_evidence.mjs` |
| `collectArtifactDigests()` returned duplicate digests and a legitimate retention ledger was refused | the owner returns a SORTED UNIQUE digest set; the public validator stays strict and still refuses a caller-supplied duplicate | `lib/retention_ledger.mjs` |

## The boundaries that were preserved

- **Zero Chrome, zero visible window, zero Runtime media task, zero Cookie
  read or injection, zero Provider request, zero download, zero real BVID,
  zero blind review, zero sentinel, zero authorization consumption.**
- No public API, V2.1 schema, quality threshold, eight-request budget,
  source registry, fixed denominator, Provider registry or review protocol
  byte was changed. The canonical rubric and prompt bytes stay exactly the
  ones the Codex froze.
- No relay or review protocol hash was self-refrozen.
- The spent GC-B6B candidate was neither rerun nor amended. No historical
  evidence package and no generated public no-go package was edited.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted, and the unrelated dirty work of the concurrent sessions was
  preserved.
