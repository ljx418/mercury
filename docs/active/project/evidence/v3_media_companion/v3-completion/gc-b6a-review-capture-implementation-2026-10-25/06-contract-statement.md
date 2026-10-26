# The contract statement

**Contract changes: none.**

This batch changed no public API, no public schema, no FailureCode inventory,
no threshold, no message, no Provider registry, no Origin/auth order, no
frozen source denominator, no relay fixture and no historical evidence.

## What was added

| the artefact | the kind | why it is not a contract |
|---|---|---|
| `scripts/stage_b_b5_3/lib/review_bundle.mjs` | an INTERNAL acceptance-harness module | it describes a PRIVATE bundle; no public route, schema or code reads it |
| `scripts/stage_b_b5_3/lib/review_capture.mjs` | an INTERNAL acceptance-harness module | it reads the product's own routes; it writes nothing into the product |
| `scripts/stage_b_b5_3/lib/blind_projection.mjs` | an INTERNAL acceptance-harness module | it projects the private bundle for the evaluator |
| `scripts/stage_b_b5_3/lib/b6_aggregate.mjs` | an INTERNAL acceptance-harness module | it evaluates the six review rows; it is not a product gate |
| the five `b6_*.node-test.mjs` files | tests | they assert the four modules above |
| `scripts/stage_b_b5_3/test/_fixtures/seed_review_task.py` | a test fixture | it seeds one synthetic task through the PRODUCTION store API; it is never imported by the product |

## What was changed in an existing file

`scripts/stage_b_b5_3/run_one_bvid.mjs` gained ONE optional step: the B-6
review capture. It is gated by an EXPLICIT private root
(`NAVIA_B6_PRIVATE_ROOT`):

* without it the runner captures NOTHING and the B-5 behaviour is
  byte-identical (the lifecycle case proves it);
* with it the capture reads the product's own routes and the runner-owned
  private root, writes the PRIVATE bundle outside the repository, and records
  ONLY the bundle hash, the counts, the status and the closure in the machine
  receipt;
* a capture FAILURE fails the candidate closed and the owner cleanup still
  runs.

No public field, route, code or threshold was added, removed or renamed.

## The boundaries that were NOT crossed

| the boundary | the state |
|---|---|
| the public API and its schemas | unchanged |
| the FailureCode inventories | unchanged — the capture failure uses the INTERNAL runner code `B6_CAPTURE_FAILED`, which is not a product FailureCode |
| the aggregate thresholds and the frozen denominator | unchanged |
| the Provider registry and the Origin/auth order | unchanged |
| the upload policy | unchanged |
| the relay fixtures | unchanged — the v11 gate still passes 50/50 and 16/16 |
| the historical evidence | unchanged — every prior package still verifies against its own manifest |
| the product Python | NOT changed by this batch |

## A divergence that this batch did not introduce

A CONCURRENT session's dirty-worktree change writes the V2.1 derivative
bytes into the PUBLIC evidence set under the contracted name
(`derivative-v2.1.json`). The B6A plan says the PUBLIC evidence must not
contain the full text.

This batch:

* did NOT introduce that write;
* did NOT revert it (it is another session's work and reverting it would be a
  destructive act outside the authorized scope);
* implements the private-bundle contract of the plan: the derivative, the
  derived text, the thumbnails and the seek map live in the PRIVATE bundle,
  and the public capture receipt carries only the bundle hash, the counts,
  the status and the closure.

It is reported as risk R2 in `10-prd-coverage-and-risks.md` for the
checkpoint.
