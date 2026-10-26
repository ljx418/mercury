# PRD Coverage And Risks

## The PRD coordinate

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md` §3.3
("B-6 host semantic review") with §3.2 (the B-5 acceptance that closed the
machine gate), plus the `03-corrective-plan.md` of the Codex checkpoint
package `gc-b6a-codex-checkpoint-2026-10-25`.

## Coverage of §3.3, clause by clause

| PRD clause | Where it is implemented | Where it is proven |
|---|---|---|
| "An evaluator independent of the implementation session reviews the six fresh artifacts blind to Provider identity" | `lib/blind_projection.mjs` (the projection strips the Provider identity and keeps the irreversible review binding) and `lib/b6_aggregate.mjs` (the Provider identity keys are rejected at ANY depth) | `b6_blind_projection.node-test.mjs` (8 fixed) and `b6_aggregate.node-test.mjs` (the Codex reproduction with a NESTED `meta.providerId`) |
| "Per video: accuracy, whole-span coverage, content value/fit, and chapter boundary quality must each score at least 4/5" | `B6_RUBRIC_AXES` (the four frozen axes), `B6_AXIS_MINIMUM = 4`, each axis checked individually so that no averaging may compensate a weak axis | `b6_aggregate.node-test.mjs` cases 2/10 (the exact threshold passes) and 3/10 (one under fails) |
| "critical errors are zero" | `B6_CRITICAL_ERRORS` and `checkCriticalErrors` | `b6_aggregate.node-test.mjs` case 6/10 |
| "Repeat one frozen sentinel" | the sentinel must be reviewed exactly TWICE, in DIFFERENT sessions, in DIFFERENT positions, with the SAME non-empty material-claim id set | `b6_aggregate.node-test.mjs` cases 7/10, 8/10 and the sentinel position/drift case |
| "treat a changed thesis or material claim reversal as Major" | `B6_SENTINEL_REVERSED` for a reversed thesis and for a reversed claim verdict, `B6_SENTINEL_CLAIM_SET_CHANGED` for a changed claim set | the Codex reproduction with an EMPTY second sentinel claim set |
| "Model, prompt hash, session, inputs, and rubric results are recorded" | the rubric and prompt hashes are REQUIRED and compared unconditionally (`B6_RUBRIC_HASH_DRIFT`, `B6_PROMPT_HASH_DRIFT`), the review session id is required per row and per sentinel review, and the review binding binds the exact reviewed artifact | `b6_aggregate.node-test.mjs` case 9/10 and the authority defect classes |
| "without transcript or media content leakage" | the public capture receipt carries only the schema, the counts, the digests, the closure and the status; the bundle validator refuses a secret, an absolute path, a raw media file and a Provider identity in the receipt | `b6_review_bundle.node-test.mjs` cases 8/10, 9/10, 10/10, `b6_lifecycle.node-test.mjs` case 4/6 and the private receipt of the runner |

## Coverage of the corrective plan C0 to C6

| Item | Status |
|---|---|
| C0 preserve boundaries | DONE: the submitted B6A package verified before the edit, the zero external actions are recorded, no frozen contract or historical evidence was edited |
| C1 bundle authority and manifest closure | DONE: exact shapes, the manifest bytes bound to the canonical actual files, every public receipt field recomputed, the process-level mutation matrix |
| C2 filesystem containment and transaction | DONE: an inside-repository root, a symlink root, a symlink component, a pre-existing destination, a traversal manifest name, a non-regular payload and an interruption at EVERY boundary are refused |
| C3 thumbnail and seek closure | DONE: the one-to-one chapter binding, the PNG-backed same-task frame and the in-chapter seek time |
| C4 candidate-bound aggregate | DONE: the exact candidate authority, no permissive default, six complete rows, the exact bindings, the recursive Provider rejection, the exact sentinel claim sets, the Codex reproductions as regressions |
| C5 runner integration | DONE: the authority is derived from the same machine receipts and capture receipts, a capture failure leaves no `sourceCompletion` accounting and no complete machine receipt, the cleanup stays unconditional and the public receipts stay content-free |
| C6 consolidated checkpoint | DONE: the 54 fixed obligations are green, the adversarial matrix is green with stable non-positive codes, the real-route composition proves the transactional capture, the full offline suite passes once, the relevant Runtime tests pass, the relay v11 gate is green, the scan and the cleanup are zero and the manifest is generated last |

## The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The candidate authority has never been exercised against a REAL six-source candidate run | HIGH | This batch is OFFLINE by authorization. The sequencer assembles the authority from the six machine receipts and the six capture receipts, but no real run produced them yet. The B-6B real-run checkpoint must produce them. |
| R2 | The whole `scripts/stage_b_b5_3/` tree is UNTRACKED in git | MEDIUM | The digests in `01-changed-file-hashes.json` are the only baseline of this batch. A concurrent session is editing other parts of the worktree. |
| R3 | The relay v11 sources are untracked and belong to another session | MEDIUM | The relay v11 gate case is green inside the offline suite, but the relay sources are not byte-pinned by git, so the gate is a behavioural proof and not a digest proof. This batch wrote nothing under `apps/chrome-extension/`. |
| R4 | `captureReviewBundle` has a fault-injection seam (`interruptAt`) | LOW | It exists so that the interruption at EVERY write and rename boundary can be proven on a real filesystem. It is never set outside `test/b6_capture_filesystem.node-test.mjs` and it is documented as a test seam in the module. |
| R5 | The C5 runner integration is proven by a behaviour pair, not by a real failure run | MEDIUM | `b6_runner_capture_gate.node-test.mjs` drives the PRODUCTION gate, the PRODUCTION ledger and the PRODUCTION finalizer merge in a separate process, and the source-order invariant of `run_one_bvid.mjs` is asserted. A real capture failure against a real Chrome run was not executed (it is unauthorized). |
| R6 | The seek representative may be OUTSIDE the chapter window | LOW | The architecture defines the fallback: a cited frame inside the window, otherwise the nearest captured frame. The executable seek time is ALWAYS inside `[startMs, endMs)`. A reviewer must read the seek time and the representative separately. |
| R7 | The stored workspace is SANITIZED | LOW | The `authorization` block (the provider id, the model id and the outbound digest) is dropped before the workspace is written into the private bundle. The reviewer sees the irreversible review binding instead. |
| R8 | The pre-existing temporary-directory leftovers of an earlier session | LOW | 16 `${TMPDIR}/navia-b5-3-*` and 6 `${TMPDIR}/b6a-*` directories from 09:14 to 09:33 are not this batch's residue and were not deleted by it. |

## What is explicitly NOT claimed

- Not claimed: that the B-6 semantic review has been performed. It has not:
  no evaluator reviewed the six sources.
- Not claimed: that B-6, Stage B or V3 is complete.
- Not claimed: that a real six-video run passed. It did not run in this
  batch.
- Not claimed: that the atomicity of the capture is a proof of durability on
  every filesystem. It is an exclusive staging directory, a validated
  re-read and ONE atomic rename on the local filesystem; the directory fsync
  is best-effort where the platform refuses it.
- Not claimed: that the containment is proven by a lexical resolution. The
  containment is proven by `lstat` on every component, a symlink refusal and
  a `realpath` comparison.
