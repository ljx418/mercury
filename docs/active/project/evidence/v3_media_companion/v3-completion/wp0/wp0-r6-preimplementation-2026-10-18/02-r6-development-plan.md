# WP0 R6 detailed development plan

## Entry gate

R6 starts only after a Codex checkpoint records `R5 PASS / R6 MAY START`, its payload manifest verifies,
and its accepted build tree hash plus production-source closure hash equal the current candidate. v10
baseline must be 50/50, mutations 15/15, and the current matrix verifier green. Any R5-B candidate drift
returns to R5-B acceptance. Until then this document is planning only.

## R6-0: reconcile and freeze the run

- Recompute schema, fixture, production-owner and accepted-evidence hashes.
- Run the matrix verifier and prove exactly 30 RLY, 8 OM and the declared supplement IDs.
- Record the accepted R5-B checkpoint path, payload-manifest hash, build-tree hash and production-source
  closure hash, then recompute all four. Old decision text alone is not an entry gate.
- Mark every R6 behavior case fresh. R4 reports may guide harness design but cannot satisfy an R6 case.
- Create a fresh run root, owned port range, database, task roots and process ledger.

Exit: no missing/duplicate case, no unknown FailureCode, no unresolved evidence disposition.

## R6-1: extension protocol negatives

- Drive `OffscreenAudioPort`, `RuntimeCaptureTransport`, `MediaCaptureController`, producer bootstrap and
  restart reconciler through production composition.
- Execute `RLY10-N01..N30`; browser primitives may be controlled fakes, but the owner/router/state machine
  under test may not be replaced by a stub.
- Assert exact pre-state, input, FailureCode, terminal, no enqueue/write after rejection, one abort and zero
  marker/Port/socket residue.

Exit: 30/30 with per-case receipts; static v10 and mutation verifiers remain green.

## R6-2: consolidated browser lifecycle faults

- Notify the user once, then launch one fresh owned production Chrome with `--mute-audio`.
- In one session execute permission-missing after grant/ticket issuance but before Runtime socket ownership,
  exact `getContexts`, Service Worker restart during a live marker-backed capture, Offscreen
  disconnect, explicit cancel, navigation and tab-close scenarios. Use a new task per scenario; do not
  reuse grants.
- Only native actions restricted by owned Profile/PID and allowlisted controls may create user activation.
- Record active window only around the required click. Do not close or manipulate user Chrome or games.
- Stop after the first independent failure; return to headless correction before scheduling another visible
  window.

Exit: each scenario has typed UI terminal/recovery action and zero track/context/Port/WS/offscreen residue.

## R6-3: real Runtime and transport faults

- Use owned Uvicorn child processes, random ports and real HTTP/WS clients.
- Execute expired/replayed/binding-invalid tickets, ACK timeout, WS loss, graceful SIGTERM, hard kill,
  Runtime restart, connecting DELETE, GET 404 and cleanup failure.
- Do not use FastAPI TestClient or a mocked HTTP success as process evidence.

Exit: exact frozen terminal/code, deterministic owner, no active sink, no temporary raw audio.

## R6-4: durable handoff and recovery

- Execute six fixture handoff injection points and seven phase/recovery dispositions.
- Execute `OM10-N01..OM10-N08` through the production
  `MediaAcquisitionCoordinator.recover_interrupted()` -> `TaskAudioStager.recover_cleanup()` path and its
  manifest/receipt validation.
- Execute each R6-G4 case fresh using the accepted R4 harness design where appropriate; do not rerun
  unrelated R4 cases or relabel old results.
- For hard kill, terminate after FULL receipt commit and before worker start; no `finally` assumption.

Exit: four residual counters are zero, unpublished work is abandoned, durable commit alone may publish,
fresh begin creates exactly one sink.

## R6-5: consolidated checkpoint

- Run one relevant-subtree regression, one full unit regression, build, Runtime focused suite, relay static,
  v10 baseline/mutations, secret scan and owned-resource scan.
- Produce per-case machine receipts plus receipt/test/PRD/handoff documents and SHA-256 manifest.
- Do not repeat R4's full 62-process matrix; run only the fresh R6 case denominator.

Exit: Fatal 0, Major 0, every fixed case resolved, no public-contract drift. Status becomes only
`R6 AWAITING CODEX CHECKPOINT`; ClaudeCode does not enter R7.

## Change boundary

Allowed: fault harnesses, test-only injection seams that cannot alter production defaults, missing
fail-closed closeout in existing owners, and R6 evidence. Any public API/schema/code/threshold or security
boundary change returns to Codex planning and refreeze before implementation continues.

