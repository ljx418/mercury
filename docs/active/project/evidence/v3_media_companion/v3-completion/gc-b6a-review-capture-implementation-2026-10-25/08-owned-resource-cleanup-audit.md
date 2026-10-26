# The owned-resource cleanup audit

Audited after the last command of the batch, on the final state of the tree.

## The audit

| owned resource | how it is audited | the result |
|---|---|---|
| an owned Chrome process | `pgrep -af "chrome\|chromium"` | **0** |
| an owned workpack process (`run_one_bvid.mjs`, a sequencer copy, the stage scripts) | `pgrep -af "run_one_bvid\|stage_b_b5_3"` | **0** |
| an owned local Runtime application | `pgrep -af uvicorn` | **0** |
| the frozen Runtime port 17861 | `ss -ltn \| grep 17861` | **nothing listening** |
| an owned PRIVATE review root | the private review roots of the B6A tests | **0** — every private root the tests created was removed |
| an owned temporary root of the B6A tests | the B6A temporary roots | **0** |
| a generated artefact in the SOURCE tree | the changed-file inventory | `generatedArtifactsInTheSourceTree: []` |
| a private bundle inside the repository | `find docs -name PRIVATE_MANIFEST.sha256` | **0** |

## The temporary roots

The offline tests create their roots with `makeTempRoot` from
`scripts/stage_b_b5_3/lib/temp_roots.mjs`: every root is OWNED by the test
that created it, it lives under the platform temporary directory, and it is
REMOVED when the test process exits. A green offline suite (517 cases) that
leaves **zero** B6A residue.

## The residue that is NOT this batch's

Sixteen temporary roots with the B-5 RUNNER's own profile and scratch
prefixes were present at the audit. They belong to the REAL RUN of a CONCURRENT session
(the `gc-b5r-b5-final-real-run-r4-2026-10-25` package), NOT to this batch:

* this batch never launched a real runner against a real Runtime (its runner
  invocations used the test double and the test-only no-browser seam);
* the roots carry the prefix of the B-5 RUNNER's own profile and scratch
  roots, not the B6A capture roots.

They were deliberately NOT deleted: this batch does not own them, and
deleting another session's evidence would be a destructive act outside the
authorized scope. They are reported here instead.

## The private roots of THIS batch

Every private review root the B6A tests created was removed with the test
process. The lifecycle case proves the two properties that matter:

* the private root is 0700 and OUTSIDE the repository;
* the private bundle holds the CONTRACTED file set and nothing else.

## The durable state that the batch deliberately keeps

* the historical evidence packages are NOT touched and NOT deleted;
* this evidence package is the only new durable artefact of the batch;
* the `PAYLOAD_MANIFEST.sha256` of this package is the last file written; it
  records every other file of the package.
