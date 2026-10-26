# GC-B6B Machine Results (per source)

Batch: `GC-B6B FRESH CANDIDATE + BLIND SEMANTIC REVIEW`
Run id: `gc-b6b-20261025T061036Z`
Candidate run id (the ledger key): `gc-b6b-20261025T061036Z`

The public record carries digests, counts, stable codes and object indexes
ONLY. It carries no derivative text, no transcript / OCR / caption text, no
PNG byte, no private bundle file name, no absolute or private path, no
Cookie value, no secret and no Provider response.

## The three attempted sources

| Order | BVID | Disposition | Failure code | Outcome |
|---|---|---|---|---|
| 1 | BV11t8w6oEtP | `failed` | `B6_CAPTURE_BUNDLE_INVALID` | the synthesis COMPLETED and the durable V2.1 derivative was published; the B-6 review capture was REFUSED by the production bundle validator |
| 2 | BV1QcYx6VEAj | `failed` | `B6_CAPTURE_SEEK_UNCLOSED` | the synthesis COMPLETED and the durable V2.1 derivative was published; the B-6 review capture could not close the seek map (no PNG-backed frame for a chapter) |
| 3 | BV1v58B6GEan | `failed` | none (the source was SIGKILLed by the batch stop) | the source was interrupted by the batch stop; it produced no evidence set |

The sources 4, 5 and 6 were NEVER ATTEMPTED: the batch stopped at the first
stop condition. The four reserve sources were never attempted, never
substituted and never used.

## The per-source machine facts

### Order 1 / BV11t8w6oEtP

```text
taskId                    media_task_b8e5d5026654416b88a91f10abae2873
taskRevision              7
dependencyGeneration      depgen_edc19bc76c47d43a5630256d1069d5672663cffc1ba331a8c55d56b93f1a872c
derivativeSha256          c9ff075d25d1d35ded1466764cefb24a0fb45fff6f4504f6cf27a94c65126c2d
receiptSha256             c93548fc7ed60cd9e78b119c338dfca6e8fe0ecd599dd081e34ae3cd76ab1773
evidenceSha256            c9ff075d25d1d35ded1466764cefb24a0fb45fff6f4504f6cf27a94c65126c2d
provider attemptCount     1
provider requestCount     4   (the ACTUAL outbound HTTP attempt count is KNOWN, not null)
published requestCount    4
artifact quality status   complete
artifact claims           5
artifact chapters         6
artifact regions          3
referenced evidence ids   96
media duration ms         1878880
review capture status     failed
review capture counts     evidence 0 / thumbnails 0 / chapters 0
review capture closure    identityClosed=false catalogClosed=false
                          thumbnailsClosed=false seekClosed=false
upload counters           rawVideo 0 / rawAudio 0 / frameBytes 0 / cookies 0
                          apiKeyDisclosure 0 / localPath 0
audio outputs             0
tabCapture                0
focus events              1
cookie injections         26
mute-audio verified       true
cleanup                   runtimeScratchDeleted=true profileRootDeleted=true cleanupFailure=null
```

### Order 2 / BV1QcYx6VEAj

```text
taskId                    media_task_d9f03f5309d8440eafd654fce75b81e9
taskRevision              7
dependencyGeneration      depgen_edc19bc76c47d43a5630256d1069d5672663cffc1ba331a8c55d56b93f1a872c
derivativeSha256          a0a6b08b3434e0f42ac346dfddd8b3d5be9c8882a3ff8cebfac0c058dc379d3b
receiptSha256             59f4d6a0dfc96851879fbb135b89722d58a8811701625c86bc53ecd5aa13bcb5
evidenceSha256            a0a6b08b3434e0f42ac346dfddd8b3d5be9c8882a3ff8cebfac0c058dc379d3b
provider attemptCount     1
provider requestCount     3   (the ACTUAL outbound HTTP attempt count is KNOWN, not null)
published requestCount    3
review capture status     failed
review capture counts     evidence 0 / thumbnails 0 / chapters 0
review capture closure    identityClosed=false catalogClosed=false
                          thumbnailsClosed=false seekClosed=false
upload counters           rawVideo 0 / rawAudio 0 / frameBytes 0 / cookies 0
                          apiKeyDisclosure 0 / localPath 0
audio outputs             0
tabCapture                0
focus events              1
cookie injections         26
mute-audio verified       true
cleanup                   runtimeScratchDeleted=true profileRootDeleted=true cleanupFailure=null
```

### Order 3 / BV1v58B6GEan

The source was interrupted by the batch stop while it was still in the
acquisition phase. It produced NO evidence set: no machine receipt, no
derivative, no capture receipt, no cleanup receipt. The batch stop is
recorded in the sequencer summary and in the action ledger.

## The B-5 machine gate

```text
verdict.positive = false
```

The production aggregate (`lib/aggregate.mjs`) reported, among others:

- `AGG_FAILED_SOURCE` for the sources 1, 2 and 3;
- `AGG_INCOMPLETE_ATTEMPT_SET` — the batch carries 3/6 source rows;
- `AGG_MISSING_EVIDENCE` for the source 3 (the interrupted source);
- `AGG_LEDGER_ACCOUNTING` for the source 3 (it has no valid attempted
  attempt count);
- `AGG_AUDIT_FAILED` for the source 3 (it leaked an owned process and did
  not clean its resources — the consequence of the hard stop);
- `AGG_FAILED_SOURCE` — only 0 sources are complete (at least 5 are
  required).

The machine gate is NEGATIVE. The candidate is not reviewable.

## What the two completed sources prove

The B-5 machine gate worked on REAL data for the two sources that reached
the synthesis:

- the Provider request accounting is EXACT and KNOWN (4 and 3 outbound
  attempts, no null, no double counting);
- the upload counters are HARD ZERO for every counter;
- the audio output, the tab capture and the focus counters are accounted;
- the mute-audio assertion holds for every owned Chrome;
- the owner cleanup closed for both sources (the scratch and the profile
  are deleted, no cleanup failure);
- the durable V2.1 derivative was published and its bytes are the exact
  durable bytes.

The failures are NOT in the B-5 machine gate. They are in the B-6 REVIEW
CAPTURE, which is the acceptance harness that the B-6A batch added.
