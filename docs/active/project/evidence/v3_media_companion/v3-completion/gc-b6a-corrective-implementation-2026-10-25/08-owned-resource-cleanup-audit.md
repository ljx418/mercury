# Owned Resource Cleanup Audit

Batch: `GC-B6A CORRECTIVE IMPLEMENTATION`
Measured after the full offline suite and the Runtime tests.

## The resources this batch owned

| Resource | How it is owned | How it is released | Residue |
|---|---|---|---|
| The offline test temporary roots | `scripts/stage_b_b5_3/lib/temp_roots.mjs` registers every root it creates and removes it in the `exit` handler | the `exit` handler of the test process | 0 |
| The private capture roots of the filesystem tests | `makeTempRoot` (the same registry) | the `exit` handler | 0 |
| The private bundle directories of the lifecycle test | the temporary root of the test | the `exit` handler | 0 |
| The Runtime of the composition test | spawned by the test, killed in the `finally` block with `SIGINT` and then `SIGKILL` | the `finally` block of the test | 0 |
| The Runtime double of the lifecycle test | an in-process `http` server | the `finally` block of the test | 0 |
| The staging directories of a failed capture | the capture owns exactly one staging directory and removes ONLY it | the `catch` of the transaction | 0 |
| The Chrome processes of the runner | the runner never launched Chrome in this batch (the external canary is NOT part of the offline command) | — | 0 |

## The measurements

```text
$ ps -eo pid,etime,cmd | grep -E "uvicorn|navia_runtime|chrome" | grep -v grep
(no output)

$ ls -d ${TMPDIR}/navia-b6a-* ${TMPDIR}/navia-b6a-fs-* ${TMPDIR}/navia-b6a-seek-*
(no output)

$ find . -maxdepth 3 -name ".staging-*" -o -maxdepth 3 -name "*private-root*"
(no output)

$ node -e "import('./scripts/stage_b_b5_3/lib/temp_roots.mjs').then(m=>console.log(JSON.stringify(m.ownedTempRoots())))"
[]
```

The owned-resource residue of this batch is ZERO.

## The staging-residue check is a real assertion, not a convention

The filesystem test `B6 fs 10` interrupts the capture at EVERY write and
rename boundary and asserts that the published directory does NOT exist and
that the capture root holds NO staging residue. The successful capture case
`B6 fs 8` asserts the same for the happy path.

## The pre-existing leftovers that are NOT owned by this batch

Sixteen `${TMPDIR}/navia-b5-3-*-*` directories and six `${TMPDIR}/b6a-*` directories
exist with a modification time between 09:14 and 09:33, i.e. BEFORE this
corrective batch started. They belong to an EARLIER session of this stage
(the real-run attempts of the morning). They were NOT created by this batch
and they were NOT deleted by it: removing another session's scratch would
destroy the evidence of that run, which is outside the authorization of this
batch. They are reported as an observation, not as this batch's residue.
