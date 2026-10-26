# GC-B6B Capture Failure Analysis — The Exact Blocker

Batch: `GC-B6B FRESH CANDIDATE + BLIND SEMANTIC REVIEW`
Run id: `gc-b6b-20261025T061036Z`

## 1. The exact stop reason

```text
B6_CAPTURE_BUNDLE_INVALID   — the order 1 / BV11t8w6oEtP review capture was
                               refused by the production bundle validator
B6_CAPTURE_SEEK_UNCLOSED     — the order 2 / BV1QcYx6VEAj review capture could
                               not close the seek map
```

Both are STABLE production codes. They are raised by
`scripts/stage_b_b5_3/lib/review_capture.mjs` and they are recorded in the
machine receipts of the two sources. The batch stopped at the first stop
condition, exactly as the batch boundary requires: no retry, no patch, no
continuation to the remaining sources.

**The blind semantic review was NOT performed, and it could not be.** A
review needs a private bundle per source; no bundle exists. There is no
projection, no review row, no sentinel receipt and no aggregate. Nothing
was scored and no score was invented.

## 2. What is PROVEN by the durable evidence

| Fact | Evidence |
|---|---|
| The capture runs AFTER the durable publication and BEFORE the owner cleanup | The two completed sources published their derivative and their capture receipt; their cleanup closed (the scratch and the profile are deleted, no cleanup failure). The runner's own source-order invariant asserts the order. |
| The B-5 machine gate is healthy on REAL data | The Provider request count is EXACT and KNOWN (4 and 3), the upload counters are HARD ZERO, the mute-audio assertion holds, the durable V2.1 derivative was published. |
| The capture refused the bundle BEFORE writing anything | The private root holds NO bundle: only the review protocol. The production capture validates before it writes, so a refused bundle never reaches the disk. |
| The B-6A acceptance never exercised the capture against a REAL task | Every B-6A case feeds a contract-shaped SYNTHETIC fixture. The B6A test matrix has no case that drives `captureReviewBundle` against a real Runtime task, so the real-data path of the capture was unproven before this run. |
| The runner persists only the capture CODE | `captureFromRuntime` returns `{ok, code, detail, bundle, receipt}`; the runner stores the code and throws `The review capture failed: <code>.` The `detail` — the list of the failing closures — is DROPPED. |

## 3. The diagnostic gap (a HARNESS finding for Codex, NOT patched here)

The capture adapter DOES compute the failing closure list. The runner
throws it away. Therefore:

- the durable evidence cannot attribute WHICH closure refused the bundle of
  the order 1;
- a future run would fail in exactly the same unattributable way;
- the B-6A acceptance cannot be considered PROVEN for real data, because
  the only real-data capture that ever ran could not be diagnosed.

This is a harness defect in the DIAGNOSTIC PATH (not in the capture
contract). It must be closed by Codex before any new authorized run:
the capture failure must persist its closure CODES (never its content) in
the machine receipt or in the failure diagnostic.

## 4. The statically identified candidate causes

Each cause below is a HARNESS/PRODUCT interaction that the SYNTHETIC B-6A
fixtures cannot reach. None of them is PROVEN for this run: the evidence
catalog, the derived text and the thumbnails of the failed captures are not
in the durable evidence (the Runtime scratch was closed by the owner
cleanup, as it must be).

### H1 — the catalog hash algorithm is not the production algorithm

The PRODUCT computes the evidence catalog hash over the records sorted by
`(timestampStartMs, timestampEndMs, evidenceId)`
(`services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py`).
The HARNESS computes it over the records sorted by
`(timestampStartMs, evidenceId)`
(`scripts/stage_b_b5_3/lib/review_bundle.mjs :: evidenceCatalogSha256`).

Both use the same canonical byte layout, so the two hashes differ ONLY when
the two orderings differ, that is when two evidence records share a
`timestampStartMs` and carry a DIFFERENT `timestampEndMs`.

The real data shape: for every sampled frame the product emits THREE typed
evidence records — `frame`, `ocr_block` and `vision_caption` — with the
SAME `timestampStartMs` and the SAME `timestampEndMs` (start + 1)
(`product_materializer.py :: _typed_evidence`). Those three agree under
both orderings. A TRANSCRIPT bucket whose first ASR segment starts at the
same millisecond as a sampled frame but ends later does NOT agree. The
order 1 source referenced 96 evidence records (84 transcript + 12 typed),
which is a large population for such a tie.

Reachability: REAL. Proof status for this run: NOT PROVEN (the catalog is
not in the durable evidence).

### H2 — the bundle privacy scan covers the DERIVED TEXT that the B-5 privacy audit never scans

The B-5 privacy audit scans the EVIDENCE DIRECTORY. The derived transcript,
OCR and vision-caption text lives in the Runtime's PRIVATE root and is
never scanned by B-5. The B-6 bundle validator DOES scan it: a secret-like
token or a path-like string in the derived text refuses the whole bundle.

The production detectors over the REAL derivative bytes of the order 1
source found NO absolute path and NO secret ✓, so the derivative itself is
not the cause. The derived text is not in the durable evidence, so this
cause is neither proven nor excluded.

Reachability: REAL (a screen-captured API key or a path in a technical
video). Proof status: NOT PROVEN.

### H3 — a `degraded` task can never close the seek map (the order 2 code)

The order 2 task reached the product state `degraded` and the capture found
no PNG-backed frame for at least one chapter, so the seek closure could
not be built. This is the actual code of the order 2 source. It is a DATA
condition, not a harness defect — but it means a `degraded` task can never
be reviewed, and the batch needs an explicit policy for it.

Reachability: REAL. Proof status: PROVEN for the order 2 (the code and the
product state both say so).

## 5. What was NOT done

- No harness, product, contract, threshold, registry, rubric or prompt was
  modified. The candidate lock held.
- The batch was not retried. The sources 4, 5 and 6 and the four reserves
  were never attempted.
- No score, no verdict and no projection was invented.
- The blind projection builder was never run against a bundle, because no
  bundle exists.

## 6. The decision this forces

The candidate is unreviewable and the machine gate is negative, therefore:

```text
GC-B6 SEMANTIC REVIEW NO-GO
```

The next decision belongs to Codex. It must decide, in this order:

1. whether the capture failure is a harness defect (H1 / H2 / the
   diagnostic gap) and therefore a corrective batch that may touch the
   harness — with the explicit acceptance that the synthetic B-6A fixtures
   are NOT sufficient and that a REAL-task capture case must be added to
   the acceptance matrix;
2. the policy for a `degraded` task (H3): refused, or reviewed with an
   explicit coverage limit;
3. a NEW authorization id and a NEW candidate run, because the one-shot
   authorization of this batch is consumed.
