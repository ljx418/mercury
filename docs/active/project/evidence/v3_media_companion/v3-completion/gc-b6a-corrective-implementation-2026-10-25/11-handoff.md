# Handoff

Batch: `GC-B6A CORRECTIVE IMPLEMENTATION`
Exit state: `GC-B6A CORRECTIVE IMPLEMENTED AWAITING CODEX CHECKPOINT`

B6B remains UNAUTHORIZED. No B7, no Stage C, no visible-run authorization.

## 1. The changed files

19 files, all under `scripts/stage_b_b5_3/`. The digests are in
`01-changed-file-hashes.json`.

### New production modules of the harness

| File | Why |
|---|---|
| `lib/b6_authority.mjs` | The CANDIDATE AUTHORITY: the run id, the registry digest, the positive machine gate, the exact six ordered sources with their task, revision, dependency generation, derivative, bundle and blind review-binding hashes, the capture status and the closure counts. There are NO DEFAULTS. |
| `lib/b6_capture_gate.mjs` | The capture gate: a source may only be counted as COMPLETE when its review capture closed. |

### Rewritten production modules of the harness

| File | What changed |
|---|---|
| `lib/b6_aggregate.mjs` | The authority is REQUIRED, the rubric and prompt hashes are REQUIRED, exactly six `complete` rows are REQUIRED, every row is bound to its authority source, the Provider identity is rejected RECURSIVELY, the sentinel needs two exact reviews in distinct sessions and positions with an IDENTICAL non-empty claim set, and every permissive default was deleted. |
| `lib/review_bundle.mjs` | ONE canonical encoder per contracted file; the validation REBUILDS every file from the parsed bundle and compares it byte-for-byte with the manifest entry; the capture receipt is DERIVED; the identity grammar is strict; the evidence, thumbnail, seek, receipt and manifest shapes are exact; the seek map closes the derivative chapters one to one. |
| `lib/review_capture.mjs` | The canonical outside-repository 0700 root, the `lstat` of every component, the symlink refusal, the strict `realpath` containment, the exclusive staging directory, the validated re-read, the single atomic rename, the refusal of a pre-existing destination, the cleanup of ONLY the owned staging directory, and the seek builder that never returns a null representative. |
| `lib/blind_projection.mjs` | The review binding now has exactly ONE definition (it imports `reviewBindingSha256`). |
| `run_one_bvid.mjs` | The `sourceCompletion` accounting and the first finalization of the audit set moved AFTER the review capture; the capture gate decides the failure code. |
| `sequencer.mjs` | The candidate authority is derived from the SAME machine receipts and capture receipts and it is written into the summary; a defect fails the exit when the capture was requested. |

### The tests

| File | State |
|---|---|
| `test/b6_aggregate.node-test.mjs` | rewritten: the candidate-bound API, the four Codex reproductions and eight authority defect classes (23) |
| `test/b6_review_bundle.node-test.mjs` | edited: case 11/12 now removes a REFERENCED evidence record (24) |
| `test/b6_thumbnail_seek.node-test.mjs` | edited: the composition now uses the STRICT private-file resolution (10) |
| `test/b6_lifecycle.node-test.mjs` | edited: the specific capture failure code and the source-order invariant (7) |
| `test/b6_mutation_process.node-test.mjs` | new: the process-level bundle mutation matrix (13) |
| `test/b6_capture_filesystem.node-test.mjs` | new: the real filesystem transaction (14) |
| `test/b6_seek_closure.node-test.mjs` | new: the reviewable seek closure (13) |
| `test/b6_runner_capture_gate.node-test.mjs` | new: the runner integration (5) |
| `test/_fixtures/b6_bundle_fixture.mjs` | rewritten: the fixture is built with the PRODUCTION encoders, so the fixture and the writer cannot drift |
| `test/_fixtures/b6_mutation_runner.mjs` | new: the process-level mutation runner |
| `test/_fixtures/b6_capture_gate_scenario.mjs` | new: the process-level capture-failure scenario |

## 2. The contract changes

**None that require a refreeze.** The public API, the events, the data model,
the adapter contracts, the frozen V2.1 derivative contract, the public
product routes, the relay v11 contract, the frozen denominator and the
historical evidence are all UNCHANGED. The strictifications are internal to
the acceptance harness and are declared in `06-contract-statement.md`.

## 3. The tests that were run

The exact commands and their exits are in `02-commands-and-exits.md`.

- The 9 B6A acceptance files: 117 tests, 117 pass, 0 fail.
- The FULL offline Stage B runner suite: 574 tests, 574 pass, 0 fail, exit 0.
  The external canary is NOT part of it and is NOT counted as a pass.
- The relevant Runtime tests: 50 passed (no production Python was changed).
- The final payload scan: 13 files, 0 secret hits, 0 absolute path hits,
  0 raw media hits, and `sha256sum -c PAYLOAD_MANIFEST.sha256` exits 0.

## 4. The real fixture and the real Chrome evidence

There is NO real Chrome evidence in this batch and none is claimed: a real
run is unauthorized here. The REAL evidence is:

- the REAL local Runtime of the product, booted by the composition test, with
  the synthetic task seeded through the PRODUCTION store API and the
  PRODUCTION outline generator, driving the PUBLIC workspace route and the
  AUTHENTICATED thumbnail route, and then the transactional capture against
  those two real routes;
- the REAL runner, driven against a local Runtime double, with the private
  bundle published, the machine receipt carrying the capture receipt and the
  owner cleanup proven to run after the capture;
- a REAL filesystem: real temporary roots outside the repository, real
  symlinks, real renames and real interruptions.

## 5. The PRD coverage

See `10-prd-coverage-and-risks.md`: the §3.3 clauses are covered clause by
clause, the C0 to C6 items are covered item by item, and the eight remaining
risks are declared.

## 6. The remaining risks

R1 to R8 in `10-prd-coverage-and-risks.md`. The material ones are R1 (the
authority was never exercised against a real six-source run) and R5 (the C5
integration is proven by a behaviour pair and not by a real failure run).

## 7. The Integration handoff notes

- The B-6A implementation is READY FOR THE CODEX CHECKPOINT. Nothing else is
  authorized.
- The B6B real-run checkpoint needs: the six machine receipts of ONE run, the
  six capture receipts of the SAME run, a private root OUTSIDE the
  repository with the mode 0700, and the aggregate call
  `evaluateB6Aggregate({rows, sentinel, authority, expected})` with the
  authority built by `buildCandidateAuthority` from those receipts.
- The private bundle is PRIVATE. It must never be copied into the evidence
  tree: the Codex MINOR of the submitted package is exactly that mistake in
  an older package, and the B6B package must not repeat it.
- The review rows of the B-6 evaluation must carry the `bundleSha256` and the
  `reviewBindingSha256` of the reviewed source, and the sentinel reviews must
  carry the binding of the sentinel source: the aggregate compares them with
  the authority UNCONDITIONALLY.
- The evaluator must NOT see the Provider identity: the blind projection is
  the only supported input of the evaluation.
- The runner's private root must be OUTSIDE the repository and 0700: a root
  inside the repository is now a refusal.

## 8. The state of the worktree

This batch did NOT commit, push, reset, clean, check out or revert anything.
The unrelated dirty changes of the concurrent sessions were NOT touched. The
`scripts/stage_b_b5_3/` tree and this evidence package are UNTRACKED.
