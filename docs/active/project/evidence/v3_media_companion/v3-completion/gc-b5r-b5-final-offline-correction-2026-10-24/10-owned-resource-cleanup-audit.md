# The owned-resource cleanup audit

Audited after the last command of the batch, on the final state of the tree.

## The audit

| owned resource | how it is audited | the result |
|---|---|---|
| an owned Chrome process | `pgrep -af "chrome\|chromium"` | **0** — the only match is the audit command itself |
| an owned workpack process (`run_one_bvid.mjs`, `sequencer.mjs`, the stage scripts) | `pgrep -af "run_one_bvid\|stage_b_b5_3"` | **0** |
| an owned temporary root under the platform temporary directory | `ls -d /tmp/navia-b5*` | **0** |
| the owned stage root in the repository (`.navia/b5-stage`) | `ls .navia/b5-stage` | **absent** — no run used the default stage root |
| a media task created by this batch | `find ~/.navia/media-tasks -newermt <batch start>` | **0** |
| the frozen Runtime port 17861 | `ss -ltn \| grep 17861` | **nothing listening** — no Runtime was started |

## The residue that WAS found, and what was done about it

The offline tests of this workpack create their roots with
`fs.mkdtempSync` and did not remove them. After the test runs of this batch
the temporary directory held **1497** owned roots:

```text
246  /tmp/navia-b5-3-seqtest-*      224  /tmp/navia-b5-auth-*
179  /tmp/navia-b5-auth-ev-*       162  /tmp/navia-b5-3-seqstage-*
145  /tmp/navia-b5-failure-*        143  /tmp/navia-b5-stage-*
118  /tmp/navia-b5-ledger-*         76  /tmp/navia-b5-fc3-stage-*
 76  /tmp/navia-b5-fc3-*            64  /tmp/navia-b5-3-rb-*
 ...  (and the runner's own profile roots /tmp/navia-b5-3-bvid*-*)
```

Two things were done:

1. **The tests were fixed.** `scripts/stage_b_b5_3/lib/temp_roots.mjs` now
   owns every temporary root of the offline tests and removes it when the test
   process exits. Twelve offline test files were switched to it.
2. **The residue was removed.** Every `/tmp/navia-b5*` directory was deleted;
   the count is now **0**.

The runner's own profile roots (`/tmp/navia-b5-3-bvid*-`) are removed by the
runner's own cleanup path. The residual ones that were found came from the
runs in which the runner was killed before its cleanup path; the current
runner removes them, and the FC3 case confirms it: after a fresh FC3 run the
count of `/tmp/navia-b5-3-bvid*` roots did not change.

## The re-run after the fix

```text
$ node scripts/stage_b_b5_3/test/run_offline_suite.mjs
OFFLINE SUITE PASSED
exit 0
$ ls -d /tmp/navia-b5* | wc -l
0
```

A green offline suite that leaves **zero** residue.

## The unrelated temporary directories

Three temporary directories that are NOT owned by this workpack were left
alone on purpose:

```text
/tmp/navia-probe-seq                 (2026-10-23, another tool)
/tmp/navia-pytest-runtime-*           (2026-10-23, the pytest runtime)
/tmp/navia-relay-v11-fixture-*        (2026-10-24 00:02, the relay mutation verifier of an earlier phase)
```

They are not owned by this batch, they predate it, and this batch does not
delete resources it does not own.

## The durable state that the batch deliberately keeps

* The historical evidence packages are NOT touched and NOT deleted: they are
  the record of the earlier attempts.
* This evidence package is the only new durable artefact of the batch.
* The `PAYLOAD_MANIFEST.sha256` of this package is the last file written; it
  records every other file of the package.
