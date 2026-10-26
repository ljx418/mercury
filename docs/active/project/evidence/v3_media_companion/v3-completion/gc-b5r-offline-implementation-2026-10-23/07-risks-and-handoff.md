# Risks and the exact handoff

## 1. Findings, honestly graded

**Fatal: 0. Major: 0. Minor: 5.**

### Minor 1 — the current-generation comparison needs a live lease

The authority compares the local import's `dependencyGeneration` with the
generation the task's lease holds right now. A lease is in-memory, so after a
Runtime restart the task holds no lease and the comparison is skipped.

This is the same rule the WP-B orchestrator already applies (its B19 check
reads the same `leased_snapshot` seam and skips an absent lease), so the two
owners never disagree and no frozen behaviour changed. It is a known
limitation of the frozen lease model, not a regression of this batch.

*Where:* `media_companion/input_authority.py::current_dependency_generation`
and the `verify_binding(..., dependency_generation=...)` call.

### Minor 2 — the coordinator check inside the authority is an injection, not a production path

`MediaInputAuthority` accepts a coordinator and refuses an acquisition task
whose source identity is not the task's. The production composition does not
inject one, because the identity binding is already owned by durable
production owners:

* `MediaAcquisitionCoordinator.create` refuses to rebind a task id to another
  source (`V3_MEDIA_TASK_INVALID`),
* the transcript projection's `sourceIdentity` IS the coordinator's immutable
  task identity, and the product materializer creates the task from it,
* the local route is bound through `coordinator.bind_local_import` at T3, which
  refuses a foreign source.

The hook is therefore a defence-in-depth addition exercised by a test double
only. It is reported here as **not** production-wired, and it must not be
counted as an end-to-end proof.

*Where:* `media_companion/input_authority.py::require_current_input`.

### Minor 3 — two pre-existing Node cases cannot pass in an offline batch

* `PH0-AR-12: pregranted-fixture canary on BV1pohR6rEEh` fails at
  `stage=cookie-prerequisite-failed`. It needs a real cookie, a real Chrome
  and a real Runtime — all of which this batch is forbidden to use.
* `PH0-AR-10: SIGTERM to running sequencer` is timing sensitive under the full
  parallel suite; it **passes in isolation** and failed only in the parallel
  run. It is a flake of the harness, not of the implementation.

Both are outside this workpack and both were failing before it.

### Minor 4 — a new read method on the durable local-import store

`LocalMediaImportStore.list_for_task(task_id)` was added because
`list_incomplete()` hides the `ready` records, and a `ready` record is the one
that owns the current input of a task. No table, column, state, transition or
semantic rule was changed, and the 15 frozen columns are untouched.

### Minor 5 — the process-level lease mirror

`DEPENDENCY_LEASES` mirrors the manager's task leases so that a component that
only knows the Runtime database path can read the current generation without a
second composition root. The manager stays the only owner: it publishes into
the map and pops it in `release_lease`. A manager instance that is replaced
without releasing its leases would leave a stale entry in the mirror; a
Runtime restart re-imports the module and empties it.

## 2. What was deliberately NOT done, and why

* **The `app.py` wiring was reverted.** The first implementation composed the
  authority in `navia_runtime/app.py`. That file's SHA-256 is frozen in the
  relay-v11 evidence, and the change made the relay-v11 baseline report 46/50
  (the file is skipped on a hash mismatch, which cascades into the semantic
  inventory) and the mutation verifier refuse to run. The composition was moved
  into the media_companion package and `app.py` was restored byte-for-byte
  (`d7d2c438b6bf…08e5f9d`). The relay baseline is 50/50 and the mutations are
  16/16 again. **No hash and no verifier was refrozen.**
* **No Provider fallback, no best-of-N, no cross-Provider stitching, no
  threshold reduction, no padding, no truncation, no paraphrase repair and no
  fabricated claim was added.** The one bounded repair route and the
  deterministic composer allowlist of the frozen service are untouched.
* **No new failure code, no new schema, no new endpoint, no changed
  threshold, message set, Provider registry, Origin/auth ordering, denominator
  or historical evidence.**
* **tabCapture was not used and stays default-off.**
* **No BVID was substituted** and no generic seed was reused.

## 3. The exact handoff for the Codex checkpoint

The checkpoint is **one** consolidated verification of this offline candidate.
It must not start the real six-video run, B-6, B-7, Stage C, WP-C, a visible
window, a browser, a Provider or a download.

1. Read `00-implementation-report.md` (the production map) and
   `02-o01-o12-case-to-production-oracle.md` (the case → owner → oracle map).
2. Re-run the consolidated commands of `03-commands-and-results.md` and check
   the expected results, including the two frozen relay verifiers (50/50 and
   16/16) and the two digests of the frozen registry and the grounded
   contract.
3. Check the changed-file digests of `01-changed-file-hashes.md`, in
   particular that `app.py` is byte-identical to the frozen relay evidence.
4. Check the preflight receipt of `04-preflight-receipt.md`: eleven action
   counters at zero, six sources inspected, no source passed.
5. Check the scans of `06-secret-path-raw-media-and-cleanup.md` and the
   honest findings above.

### What Codex should decide

* Whether the two Minor findings 1 and 2 (the lease-scoped generation
  comparison and the optional coordinator hook) are acceptable for B-5, or
  whether the lease model needs a durable generation before the real run.
* Whether the next step is the real six-video run of B-5 with an explicitly
  configured local-asset manifest (`--local-asset-manifest` or
  `NAVIA_STAGE_B_LOCAL_ASSETS`), given that this batch's preflight had **no**
  manifest configured and therefore reported all six sources as "not
  configured". That is a statement about the configuration, not a result.
* Whether the preflight should also verify a declared asset's digest. It
  currently inspects the declared availability with `stat` only and never
  reads the content; the identity verification stays with the authority at
  synthesis time.

### What this batch does NOT claim

* It does not claim that B-5, Stage B, V3 or WP-C passed.
* It does not claim that any of the six BVIDs passed, or even ran.
* It does not claim an end-to-end visible proof of anything. The preflight is
  an inspection, and the twelve obligations are proven against production
  owners with the network primitive faked.
