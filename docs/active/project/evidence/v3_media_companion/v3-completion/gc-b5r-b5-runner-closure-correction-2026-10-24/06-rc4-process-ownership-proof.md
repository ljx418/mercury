# RC4 — the process ownership is scoped and the generated fixtures are isolated

Oracles:
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (21 cases),
`scripts/stage_b_b5_3/test/real_branches.node-test.mjs` (8 cases) and the
previously failing Codex command (30/30).

## The defect that was closed

The sequencer's process audit was NAME-BASED:

```js
const text = execFileSync("pgrep", ["-af", "node"], …);
if (line.includes("run_one_bvid.mjs") && !line.includes("sequencer.mjs")) leaked.push(line);
```

It scanned the WHOLE machine for a NAME. An unrelated `run_one_bvid.mjs` of
another test or another run was therefore counted as a leak of THIS run —
and the test's cleanup killed it.

That was exactly the cause of the previously failing Codex command: the
`structured_failure_evidence` test runs the REAL runner while the
`authorization_composition` test drives a sequencer, and the sequencer saw
the other test's runner as its own leak.

## The ownership-based audit

The audit is now proven by the PROCESS TREE
(`scripts/stage_b_b5_3/lib/process_ownership.mjs`):

1. while a child is alive, the sequencer records the PIDs that are its
   DESCENDANTS (the Linux pid → ppid table);
2. after the child exits, the recorded PIDs that are still alive are the
   leaks.

A process that is not a descendant of this sequencer's child is NEVER a
leak of this run. The audit never scans the machine for a NAME.

The summary reports the PIDs only:

```json
"processAudit": { "leakedBefore": 0, "leakedAfter": 0, "ok": true, "leakedPids": [] }
```

A command line carries an absolute path, and the summary IS an evidence
file, so the leak report is a PID list and nothing else.

## The negative receipts

| case | the assertion |
|---|---|
| `an UNRELATED live runner is neither counted nor killed` (sequencer test) | `processAudit.ok === true`, `leakedAfter === 0`, `leakedBefore === 0`, the sequencer exits 0, and the unrelated process is STILL ALIVE (`killed === false`, `exitCode === null`) |
| `PH0-AR-10: an UNRELATED live runner is neither counted nor killed` (ownership test) | the same, through the real sequencer with the six stub children |
| `an OWNED leaked process exits nonzero` | a descendant of the sequencer's own child that outlives it IS counted (`leakedAfter > 0`, `ok === false`) and the sequencer exits non-zero |

The OLD case (`a leaked owned process exits nonzero`) used a process whose
ARGV merely named the runner. That case encoded the defect, so it was
REPLACED: the owned leak is now a real descendant and the unrelated runner
is the negative case.

## The generated fixtures are isolated

Every generated artefact now lives in a UNIQUE, OWNED temporary directory
and is deleted when the test finishes:

| artefact | before | now |
|---|---|---|
| the patched sequencer copy | `test/_fixtures/sequencer_alt.mjs`, `test/_fixtures/sequencer_grant_alt.mjs`, `test/_fixtures/sequencer_rb_*.mjs` | `lib/sequencer_copy.mjs` → `<owned temp dir>/sequencer_copy.mjs`, disposed in a `finally` |
| the sleeping runner fixture | `test/_fixtures/running_sleep_*.mjs` | an owned temporary directory |
| the stub runner | `test/_fixtures/stub_runner.mjs` (written by the test, PERSISTED in the tree) | an owned temporary directory; its library import is ABSOLUTE |

The persisted copies were DELETED:

```text
scripts/stage_b_b5_3/test/_fixtures/sequencer_alt.mjs       (removed)
scripts/stage_b_b5_3/test/_fixtures/sequencer_grant_alt.mjs (removed)
scripts/stage_b_b5_3/test/_fixtures/stub_runner.mjs         (removed)
```

The final source tree of `test/_fixtures/` holds only the two HAND-WRITTEN
fixtures (`attempt_harness.mjs`, `grant_stub_runner.mjs`). The changed-file
inventory records `generatedArtifactsInTheSourceTree: []`.

## The suite runs CONCURRENTLY

`scripts/stage_b_b5_3/test/run_offline_suite.mjs` no longer has a serial
phase. EVERY offline file runs concurrently, including the ownership tests.

Serialising the files would have hidden exactly the defect that the
concurrency exposes. The suite is deterministic because the audit is
ownership-based, not because the files were serialised.

```text
node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 307
# pass 307
# fail 0
OFFLINE SUITE PASSED
exit 0
```

## The previously failing Codex command

```text
node --test \
  scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs \
  scripts/stage_b_b5_3/test/structured_failure_evidence.node-test.mjs \
  scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs
# tests 30
# pass 30
# fail 0
exit 0
```

## The honest limits

* The ownership tracker samples the process tree every 150 ms. A process
  that is created AND exits inside one sampling window is not recorded. A
  LEAK is by definition long-lived, so it is recorded; a very short-lived
  grandchild is not.
* The tracker records the descendants of the sequencer's CHILD. A process
  that is started by the sequencer itself (not by a child) is not tracked.
* The audit is Linux-only: it reads the Linux process filesystem. On another platform the tracker
  finds no descendants, and the audit reports nothing rather than guessing.
