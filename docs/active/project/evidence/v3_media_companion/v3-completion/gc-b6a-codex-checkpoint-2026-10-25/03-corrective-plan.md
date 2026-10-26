# Corrective Development And Acceptance Plan

## C0 - Preserve boundaries

- Verify the original B6A package manifest before editing.
- Record zero external actions.
- Do not edit frozen public contracts or historical evidence.

## C1 - Bundle authority and manifest closure

- Enforce exact identity, evidence, thumbnail, seek, receipt and manifest
  shapes.
- Bind manifest bytes to canonical actual bundle files.
- Recompute every public receipt field.
- Add process-level mutation tests for foreign adapter, stale revision,
  detached manifest bytes, false closure flags and wrong counts/hashes.

## C2 - Filesystem containment and transaction

- Reject inside-repo roots, symlink roots/components/targets, pre-existing
  destinations, traversal manifest names and non-regular files.
- Implement exclusive staging, reread validation, atomic rename and failure
  cleanup.
- Add real filesystem tests, including symlink escape and interruption at
  each write/rename boundary.

## C3 - Thumbnail and seek closure

- Bind every seek row exactly to one derivative chapter.
- Require a PNG-backed same-task frame and in-chapter seek.
- Add zero-length, wrong-window, missing/extra/reordered chapter,
  non-frame representative and no-frame negative tests.

## C4 - Candidate-bound aggregate

- Require exact candidate authority; delete all permissive defaults.
- Require six complete rows and exact task/revision/bundle/review bindings.
- Recursively reject Provider identity.
- Require exact sentinel claim sets and verdicts.
- Add the Codex reproduction as process-independent regression tests.

## C5 - Runner integration

- Derive candidate authority from the same machine receipts and capture
  receipts that closed B-5.
- Ensure capture failure never leaves `sourceCompletion` accounting or a
  final machine receipt that can be interpreted as complete.
- Keep cleanup unconditional and public receipts content-free.

## C6 - Consolidated checkpoint

Required before returning to Codex:

1. All original 54 obligations remain present and green.
2. New adversarial matrix is green; each Codex reproduction returns a stable
   non-positive failure code.
3. One owned synthetic Runtime composition proves real workspace/thumbnail
   routes and transactional capture; no Chrome, Provider, Cookie or download.
4. Full offline Stage B runner suite passes once.
5. Relevant Runtime tests pass; full Runtime only if production Python was
   changed.
6. Relay v11 baseline/mutations remain green or byte-level unchanged proof is
   supplied according to the existing gate.
7. Secret/path/raw-media scan and owned-resource cleanup are zero.
8. Final evidence manifest is generated only after all payloads stabilize.

Exit state must be exactly:

`GC-B6A CORRECTIVE IMPLEMENTED AWAITING CODEX CHECKPOINT`

B6B remains unauthorized.

