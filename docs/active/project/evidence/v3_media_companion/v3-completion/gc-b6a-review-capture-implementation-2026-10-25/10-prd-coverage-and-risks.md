# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6-semantic-review-preimplementation-2026-10-25/`
(`00-current-coordinate-and-decision.md`, `01-target-architecture.md`,
`02-detailed-development-plan.md`, `03-acceptance-plan.md`,
`04-risk-and-anti-false-green.md`, `05-preimplementation-audit.md`).

| the requirement of the acceptance plan | where it is covered | the state |
|---|---|---|
| A0: the baseline, the zero action proof and the untouched dirty worktree | `00-status-and-scope.md`, `09-zero-action-receipt.json` | covered |
| A1: the exact private contract and a fail-closed pure validator | `03-case-to-production-oracle-map.md`, `lib/review_bundle.mjs` | covered |
| A1's negatives: task/revision/source/order/BVID, catalog hash, missing or foreign evidence id, text hash, bad PNG, a non-200 thumbnail route, a seek out of range, a Provider identity leak, an absolute path, a raw media extension, a duplicate file and a manifest drift | `04-negative-receipts.md` | covered |
| A2: the read-only capture adapter between the publication and the cleanup | `lib/review_capture.mjs`, the runner's capture point | covered |
| A2's prohibitions: no directory search, no raw SQL, no materializer call, no raw media, no private root in the public receipt | the capture module + the lifecycle case | covered |
| A3: the blind projection and the aggregate | `lib/blind_projection.mjs`, `lib/b6_aggregate.mjs` | covered |
| A4: the offline anti-false-green tests | the five B6A test files | covered, 54 fixed obligations + extras |
| A5: the checkpoint | this package | covered |
| the 54 fixed obligations, neither reduced nor merged | `05-obligation-map.json` | covered: 12 + 10 + 8 + 8 + 6 + 10 = 54 |
| the exact threshold and one-under are driven | `B6 aggregate 2/10` and `B6 aggregate 3/10` | covered |
| a missing row, a duplicate row, the same session, 3/5, a critical error, a sentinel reversal and a visible Provider identity are all non-positive | `B6 aggregate 4/10 .. 10/10` | covered |
| the tests drive the REAL production workspace/thumbnail routes and the REAL runner lifecycle boundary | the composition case and the lifecycle cases | covered |
| a static string scan is only a supplement | `09-zero-action-receipt.json` | covered |
| the default/offline command proves Chrome 0, Runtime media tasks 0, Provider 0, downloads 0, Cookie reads 0, audio 0, tabCapture 0 | `09-zero-action-receipt.json` | covered |
| the contract changes: none | `06-contract-statement.md` | covered |

## The contract statement

**none.** This batch changed no public API, no public schema, no FailureCode
inventory, no threshold, no message, no Provider registry, no Origin/auth
order, no frozen denominator, no relay fixture and no historical evidence.

The four new modules and the five new test files are INTERNAL
acceptance-harness artefacts. The runner change is the addition of ONE
optional capture step, gated by an explicit `NAVIA_B6_PRIVATE_ROOT`: without
it the B-5 behaviour is byte-identical, which the lifecycle case proves.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video candidate has NOT been produced with the capture tool | **high** | this batch is strictly offline; the tool is proven against synthetic values, a local Runtime double and the REAL product routes of a seeded synthetic task | the GC-B6B fresh candidate, which is NOT authorized yet |
| R2 | a CONCURRENT dirty-worktree change writes the V2.1 derivative bytes into the PUBLIC evidence set (`derivative-v2.1.json`) | **high** | the B6A plan says the PUBLIC evidence must not contain the full text; this batch did NOT introduce that write and did NOT revert it (it is outside the authorized scope and it belongs to another session's real run) | the owner of that change, or a Codex decision; this batch must not silently revert another session's work |
| R3 | the private bundle is only as good as the PUBLIC workspace projection it reads | medium | the capture binds the artifact to the workspace metadata, but the workspace is the product's projection: a product defect in it would propagate into the bundle | the product's own validation of the projection (the frozen contract) |
| R4 | the derived text is read from the runner-owned private root by the relative ref the workspace declares | low | the resolution is exact and it can never escape the root, but the private root is the product's layout, not a frozen contract | a frozen contract for the private relative refs |
| R5 | the composition case boots the LOCAL product application | low | it starts no media task, it downloads nothing and it calls no Provider, but it IS a local application start (the port is not the frozen Runtime port) | nothing; it is the product's own route implementation under test |
| R6 | the ownership tracker samples the process tree every 150 ms and is Linux-only | low | unchanged from the previous batches; a descendant created AND exited inside one sampling window is never recorded | a process-events based tracker |
| R7 | the blind projection's privacy is proven by a scanner and by fixtures | low | a semantic leak that is not a path/secret/identity (for example a fact that identifies the model by its style) would not be caught | the independent B-7 review of the projection |
| R8 | the sentinel is a HOST semantic judgement and cannot be fully deterministic | low | it is constrained by two sessions, two positions, the stable verdicts and the B-7 recomputation | the B-7 recomputation |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT
```

B-6, Stage B and V3 are **not** complete, and this batch does not enter
B6B, B7 or Stage C.
