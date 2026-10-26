# The owned-resource cleanup audit

Audited after the last command of the batch, on the final state of the tree.

## The audit

| owned resource | how it is audited | the result |
|---|---|---|
| an owned Chrome process | `pgrep -af "chrome\|chromium"` | **0** |
| an owned workpack process (`run_one_bvid.mjs`, a sequencer copy, the stage scripts) | `pgrep -af "run_one_bvid\|sequencer_copy\|stage_b_b5_3"` | **0** |
| an owned temporary root under the platform temporary directory | the temporary roots of the workpack | **0** |
| the owned stage root in the repository (`.navia/b5-stage`) | `ls .navia/b5-stage` | **absent** |
| a media task created by this batch | `find ~/.navia/media-tasks -newermt <batch start>` | **0** |
| the frozen Runtime port 17861 | `ss -ltn \| grep 17861` | **nothing listening** — no Runtime was started |
| a generated artefact in the SOURCE tree | `ls scripts/stage_b_b5_3/test/_fixtures/` | only the two HAND-WRITTEN fixtures |

## The temporary roots

The offline tests create their roots with `makeTempRoot` from
`scripts/stage_b_b5_3/lib/temp_roots.mjs`: every root is OWNED by the test
that created it, it lives under the platform temporary directory, and it is
REMOVED when the test process exits.

```text
$ ls -d <the owned temporary roots> | wc -l
0
```

A green offline suite that leaves **zero** residue.

## The generated artefacts

Before this batch the repository held THREE generated files:

```text
scripts/stage_b_b5_3/test/_fixtures/sequencer_alt.mjs        (a patched sequencer copy)
scripts/stage_b_b5_3/test/_fixtures/sequencer_grant_alt.mjs  (a patched sequencer copy)
scripts/stage_b_b5_3/test/_fixtures/stub_runner.mjs           (a stub written by a test)
```

All three were removed. The generated artefacts now live in unique, owned
temporary directories and are deleted with them:

| artefact | where it lives now |
|---|---|
| the patched sequencer copy | `<owned temp dir>/sequencer_copy.mjs` (`lib/sequencer_copy.mjs`) |
| the sleeping runner fixture | `<owned temp dir>/running_sleep_*.mjs` |
| the stub runner | `<owned temp dir>/stub_runner.mjs` |

The final source tree of `test/_fixtures/` holds only the two hand-written
fixtures:

```text
attempt_harness.mjs      the shared offline harness of the runner-level tests
grant_stub_runner.mjs    the stub of the authorization composition tests
```

The changed-file inventory records `generatedArtifactsInTheSourceTree: []`.

## The processes that are NOT ours

The batch killed NOTHING outside its own ownership:

* the test-side cleanup only kills the PIDs that were recorded as
  DESCENDANTS of the sequencer it started;
* the negative case `an UNRELATED live runner is neither counted nor killed`
  proves it: a live process whose argv names `run_one_bvid.mjs` but that
  belongs to another run is neither counted as a leak nor killed — it is
  still alive after the sequencer finished.

## The durable state that the batch deliberately keeps

* the historical evidence packages are NOT touched and NOT deleted;
* this evidence package is the only new durable artefact of the batch;
* the `PAYLOAD_MANIFEST.sha256` of this package is the last file written; it
  records every other file of the package.
