# Findings

## Major 1 - The candidate lock does not seal the executed product

`01-candidate-lock.json:46-110` records 12 harness files and four comprehension
files. It does not bind the Runtime entrypoint and acquisition path, extension
source/build, dependency configuration, contracts, or the complete transitive
execution closure. The same package acknowledges concurrent Runtime and relay
edits in `09-risks-and-next-decision.md:21-22`. It also contains only a
`lockedBeforeAnyExternalAction` assertion and no post-run closure verification.

Impact: a future positive result could combine bytes from different candidates
while still presenting a valid-looking 16-file lock.

Required correction: run from a uniquely owned sealed snapshot or immutable
content manifest covering every executed source/build/config/contract input;
verify it before external action, after every source, and at closeout.

## Major 2 - The review protocol is self-frozen and has already drifted

The current `00-review-precommit.json:15-18` uses rubric/prompt hashes
`4a46f1ad...` and `318b4fcf...` and claims only that the rubric is verbatim "in
substance". The prior precommit uses different hashes `e2583ba9...` and
`97ceedd8...`, includes exact byte counts, and claims byte-verbatim content.
No repository-tracked canonical rubric/prompt bytes are bound by the harness.

Impact: a caller can replace the review criteria, hash the replacement, and
produce a formally self-consistent but semantically incomparable review.

Required correction: add canonical, versioned rubric/prompt files; freeze their
exact bytes once at the Codex checkpoint; and make the precommit builder reject
caller-supplied alternatives or drift.

## Major 3 - Stage A timeout evidence is incorrect and lacks a stable code

`run_one_bvid.mjs:1325-1326` sets authority timeout to five minutes and media-task
timeout to twenty minutes. The thrown messages at lines 1434 and 1469 say seven
minutes. The public decision repeats "frozen 7 minutes" at
`08-review-decision.md:32,63-65`, while the machine row exposes only the generic
failure code `Error` at `03-six-source-machine-results.json:108-113`.

Impact: the order-2 diagnosis is not machine-stable and the public account is
factually wrong. It cannot support a product decision about timeout behavior.

Required correction: derive text from the constants, emit stable internal
harness codes for authority timeout/block/unexpected phase, outline creation
failure, and media-task timeout/block, and preserve those codes through catch and
finalization. Match source identity by parsed exact components, not `includes()`.

## Major 4 - Public evidence is manually transcribed

`07-privacy-and-cleanup-audit.md:8-9` explicitly identifies the package as a
hand-written projection. The five-versus-seven-minute contradiction is a real
transcription failure. The review precommit also calls randomized presentation
order `registryOrder` (`00-review-precommit.json:7-14`), although the actual
registry order is 1..6 (`01-candidate-lock.json:12-36`).

Impact: evidence can drift from machine receipts even when the payload manifest
is internally valid.

Required correction: build the public package deterministically from validated
raw receipts. Use separate exact fields for immutable registry order and random
review order. Validate the generated package against strict schemas before the
manifest is signed.

## Minor 1 - Private artifacts lack an explicit disposal policy

`07-privacy-and-cleanup-audit.md:77-85` retains five private bundles and raw run
evidence for B7, although B7 was not entered and this candidate is negative.

Required correction: mark these artifacts diagnosis-only and forbidden as input
to any future candidate/review; record owner, retention deadline, and eventual
deletion receipt. Retention must not imply B7 authorization.

## Correct Behavior Preserved

- The negative machine decision is accepted.
- Refusing blind review was correct.
- The five successfully captured bundles remain useful diagnosis evidence only.
- `limited` outcomes must not be coerced to `complete`; unresolved conflict and
  brief coverage remain product quality results under the current frozen rules.
