# The owned-resource cleanup audit

Audited after the last command of the batch, on the final state of the tree.

## The audit

| owned resource | how it is audited | the result |
|---|---|---|
| an owned Chrome process | `pgrep -af "chrome\|chromium"` | **0** |
| an owned workpack process (`run_one_bvid.mjs`, a sequencer copy, the stage scripts) | `pgrep -af "run_one_bvid\|sequencer_copy\|stage_b_b5_3"` | **0** |
| a leftover descendant of a stub runner | `pgrep -af "sleep 30\|sleep 3"` | **0** |
| an owned temporary root under the platform temporary directory | `ls -d /tmp/navia-b5*` | **0** |
| the owned stage root in the repository (`.navia/b5-stage`) | `ls .navia/b5-stage` | **absent** |
| a media task created by this batch | `find ~/.navia/media-tasks -newermt <batch start>` | **0** |
| the frozen Runtime port 17861 | `ss -ltn \| grep 17861` | **nothing listening** — no Runtime was started |
| a generated artefact in the SOURCE tree | `ls scripts/stage_b_b5_3/test/_fixtures/` | only the three HAND-WRITTEN fixtures |

## The temporary roots

The offline tests create their roots with `makeTempRoot` from
`scripts/stage_b_b5_3/lib/temp_roots.mjs`: every root is OWNED by the test
that created it, it lives under the platform temporary directory, and it is
REMOVED when the test process exits.

```text
$ ls -d /tmp/navia-b5* | wc -l
0
```

A green offline suite that leaves **zero** residue.

## The owned descendants of the CI1 negative cases

The CI1 negative cases spawn REAL descendants (a `sleep` process) to prove
the ownership audit. They are cleaned by the sequencer itself
(`killOwnedLeaks()`) and, for the ones the sequencer does not own, by the
test's own `finally`.

```text
$ pgrep -af "sleep 30|sleep 3" | wc -l
0
```

## The unrelated processes that were NOT touched

The batch killed NOTHING outside its own ownership:

* the ownership-based tracker only knows the descendants of the sequencer's
  own child;
* the negative case `an UNRELATED live runner is neither counted nor killed`
  proves it: a live process whose argv names `run_one_bvid.mjs` but that
  belongs to another run is neither counted as a leak nor killed — it is
  still alive after the sequencer finished;
* the CI1 late-exit case repeats the proof in the presence of a REAL owned
  leak: the unrelated process survives the cleanup of the owned one.

## The generated artefacts

The repository holds no generated file. The three hand-written fixtures are:

```text
scripts/stage_b_b5_3/test/_fixtures/attempt_harness.mjs          the shared offline harness
scripts/stage_b_b5_3/test/_fixtures/contract_shaped_stub.mjs     the shared contract-shaped writer
scripts/stage_b_b5_3/test/_fixtures/grant_stub_runner.mjs       the stub of the authorization tests
```

The changed-file inventory records `generatedArtifactsInTheSourceTree: []`.

## The durable state that the batch deliberately keeps

* the historical evidence packages are NOT touched and NOT deleted;
* this evidence package is the only new durable artefact of the batch;
* the `PAYLOAD_MANIFEST.sha256` of this package is the last file written; it
  records every other file of the package.
