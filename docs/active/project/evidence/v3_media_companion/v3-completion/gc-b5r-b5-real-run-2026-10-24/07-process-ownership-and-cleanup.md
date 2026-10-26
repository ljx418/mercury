# Process ownership and cleanup

## 1. What the batch owned

Every source ran in its own isolation. The ownership is per source, never
shared, and nothing was reused between the six sources.

| Owned resource | Per source | How it was owned | How it was released |
|---|---|---|---|
| the Chrome profile | 1 | `mkdtemp` under the OS temp root, mode 0700 | the runner's `finally` block removes it |
| the Runtime scratch (the database, the task roots, the download cache, the logs) | 1 | `mkdtemp` under the OS temp root, mode 0700 | the runner's `finally` block removes it |
| the SQLite database | 1 | inside the Runtime scratch, created empty, mode 0600 | with the scratch |
| the media task root | 1 | inside the Runtime scratch | with the scratch |
| the task namespace | 1 | a fresh `media_task_<32 hex>` per source | the task ends with its source |
| the source identity | 1 | the product's own identity for that BVID | the task ends with its source |
| the dependency generation | 1 lease | the same content-addressed generation, leased per task | the Runtime's own lease |
| the extension fixture | 1 copy | a `mkdtemp` copy of the built bundle with the frozen permission promotion | with the Runtime scratch |
| the Chrome window | 1 | headed, `--mute-audio`, never the user's profile | the context is closed in the `finally` block |
| the Runtime process | 1 | `uvicorn` on the product's frozen port 17861 | SIGINT, then SIGKILL after 4 s |

The per-source cleanup receipts (`run/bvid-*/cleanup.json`) report
`runtimeScratchDeleted: true` and `profileRootDeleted: true` for **all six**
sources.

## 2. The residual audit after the batch

| Owned resource | Residual |
|---|---:|
| owned Chrome processes | **0** |
| owned Runtime processes | **0** |
| owned runner / sequencer processes | **0** |
| owned listening ports (17861) | **0** |
| owned Chrome profiles | **0** |
| owned Runtime scratch roots | **0** (after the interrupted attempt's two leftovers were removed, see §4) |
| owned media task roots | **0** |
| owned temporary media assets | **0** (the product's own acquisition cleans its media) |
| the sequencer's own process-group audit | `leakedBefore 0 · leakedAfter 0 · ok true` |

The user's own Chrome, the user's profile and the user's Runtime were never
attached to, closed, altered, reused or focused.

## 3. The evidence and the redaction roots

| Root | Owner | Note |
|---|---|---|
| `gc-b5r-b5-real-run-2026-10-24/run` | this batch | the machine evidence of record |
| `gc-b5r-b5-real-run-2026-10-24/aborted-attempt-*` | this batch | the earlier launches, each with its console log and diagnostic |
| `gc-b5r-b5-real-run-2026-10-24/diagnostic-attempt-6` | this batch | the diagnostic launch |
| the preflight's owned scratch | the preflight | removed in its `finally` block |
| the per-source scratch and profiles | the runner | removed in its `finally` block |

No evidence root, process root, redaction root or cleanup root is inside a
historical evidence directory, and no historical evidence file was modified.

## 4. The two scratch directories an interrupted attempt left

Two of the earlier launches were stopped while a source was in flight (the
sequencer was terminated, so the runner's `finally` block could not finish).
They left exactly two owned directories:

```
/tmp/navia-b5-3-bvid2-<rand>      the interrupted source's Chrome profile
/tmp/navia-b5-3-rtbvid2-<rand>     the interrupted source's Runtime scratch
```

Both were removed after the batch, and the residual audit above was taken
after that removal.

## 5. The scratch the OFFLINE test suites leave

The pre-existing offline suites create their own evidence roots under the
temporary directory and never remove them (the sequencer, real-branch,
registry and canary suites). The batch's test runs therefore left a number of
`navia-b5-3-seqtest-*`, `navia-b5-3-rb-*`, `navia-b5-3-registry-*` and
`navia-b5-3-canary-*` directories. They are test fixtures, not run residue:
they hold no media, no cookie and no product artifact, and they were removed
after the final regression.

This is a pre-existing test-hygiene gap, not a defect of this batch.
