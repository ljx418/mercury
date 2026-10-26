# R6 preimplementation internal document audit

Date: 2026-10-18

Decision: `DOCUMENT PASS / R6 IMPLEMENTATION STILL BLOCKED BY R5-B`

Severity after remediation: Fatal 0 / Major 0 / Minor 0 / entry blocker 1 (`R5-B` positive visible run).

## Audit scope

- v10 schema and fixture authority;
- Stage B B-5.3 relay architecture, development and acceptance plans;
- R0-R4 accepted evidence and the R5-B entry boundary;
- this package's architecture, development plan, acceptance plan, case matrix, verifier, risk register and
  ClaudeCode goal.

## First independent review

The first read-only independent Codex review returned `NO-GO`, with Fatal 0 / Major 4 / Minor 1:

1. The supplements omitted a Service Worker missing case and duplicated GET 404.
2. The verifier only checked phase/handoff rows partially, so semantic authority fields could shrink.
3. Supplement evidence disposition was absent and R4 reuse lacked a frozen per-case source closure.
4. The R5-B entry checked decision text but did not bind R6 to the same accepted build/source candidate.
5. The ClaudeCode prompt's first-failure wording could split already observable findings into serial rounds.

## Remediation closure

1. `R6B-N10` is now the distinct `service_worker_missing` browser-lifecycle case. The supplement scenario
   set is exact, and GET 404 is not duplicated as a supplement.
2. Every phase and handoff row embeds the complete fixture authority object. The verifier compares ordered
   objects byte-for-data rather than selected fields.
3. All 65 behavior cases are explicitly `fresh`. R4 is historical harness-design evidence only; no R4
   behavior result is eligible for R6 reuse.
4. The R5 entry gate now requires the accepted checkpoint path, payload-manifest SHA-256, build-tree
   SHA-256 and production-source-closure SHA-256. Drift in any field returns to R5-B.
5. The implementation prompt requires one consolidated headless checkpoint that reports all observable
   Fatal/Major/Minor findings. Immediate stopping remains limited to visible safety, privacy or cleanup
   failures.
6. Every case maps to a registry key whose concrete production path and symbol are checked against the
   current worktree. The recovery path is bound to
   `MediaAcquisitionCoordinator.recover_interrupted()` -> `TaskAudioStager.recover_cleanup()`.
7. All visible browser cases, including Service Worker termination, are restricted to `R6-G2`; all other
   groups are headless.

## Mechanical verification

The final independent review returned `DOCUMENT NO-GO`, Fatal 0 / Major 5 / Minor 0. Its single corrective
batch found semantic mutation false-greens, an incompletely stated acceptance denominator, invalid Service
Worker and permission-missing boundary oracles, and undefined R5 candidate digest algorithms.

The batch is remediated as follows:

- the acceptance plan freezes the complete 65 = 30 + 8 + 7 + 6 + 14 denominator;
- the complete matrix has a frozen semantic SHA-256, duplicate JSON keys are rejected, and nine adversarial
  meaning-changing mutations must all fail;
- permission-missing follows the production order: grant/ticket issuance precedes the Controller permission
  rejection, while Runtime socket/sink ownership remains absent and prepared resources are cleaned;
- the Service Worker case now starts a real marker-backed capture before terminating the owned worker, then
  verifies phase-specific `cancelThenObserve/observe`, no `WORKER_RESTARTED` for a valid marker, no old
  PCM/ticket/sequence resume, and terminal/grace cleanup;
- payload manifest, build tree and production source closure now have exact algorithms and a fixed 20-file
  source inventory, implemented by `10-compute-r5-candidate-digests.py`;
- the ClaudeCode goal lists unique v10 document paths and exact entry verification commands.

`python3 -B 05-verify-r6-document-package.py` returns 38/38 PASS and
`python3 -B 09-verify-r6-document-mutations.py` returns 9/9 PASS:

- fixture negatives 38/38 (`RLY10` 30 + `OM10` 8);
- phase recovery 7/7 with full fixture authority;
- handoff injection 6/6 with full fixture authority;
- real-boundary supplements 14/14 with an exact scenario set;
- total behavioral denominator 65, all semantic keys and IDs globally unique;
- all cases fresh and mapped to current production owner anchors;
- visible Chrome restricted to R6-G2;
- R5 entry bound to the accepted build/source candidate;
- 11 horizontal gates remain outside the behavioral denominator.

## PRD and architecture conclusion

The remediated package preserves the user path: one trusted action only when automatic acquisition is
unavailable, local muted capture, local ASR, typed progress/recovery and no internal transport exposure. It
does not change Chat/Know scope, provider defaults, cloud-upload policy, SourceAuthority or materialize
ownership.

The bounded independent recheck closed all five Majors and returned Fatal 0 / Major 0 / Minor 0. This
document result does not prove R5-B, authorize R6, or permit visible testing. R6 implementation remains
NO-GO until a separate same-candidate checkpoint records `R5 PASS / R6 MAY START`.
