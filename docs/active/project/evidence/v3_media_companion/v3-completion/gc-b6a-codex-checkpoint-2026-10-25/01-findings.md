# Consolidated Findings

## M1 - Aggregate authority is fail-open

`lib/b6_aggregate.mjs` defaults a missing machine gate to `true`, treats missing
rubric/prompt hashes as optional, does not bind review rows to the candidate's
task/revision/bundle/review-binding hashes, and does not reject failed rows.
Provider identity is scanned only at the row's top level. Sentinel claim sets
may be omitted or replaced without a reversal.

Executable reproduction: six rows with `disposition: failed`, nested
`meta.providerId`, no expected authority, and an empty second sentinel claim
set return `positive: true` and `failed: 6`.

Relevant implementation: `b6_aggregate.mjs:87-130`, `:171-218`.

Required correction: a positive verdict must consume one exact candidate
authority object and bind every row and both sentinel reviews to it. Missing,
extra, stale, foreign, nested Provider identity, non-complete disposition, or
claim-set drift must fail closed.

## M2 - Bundle and receipt are not byte-closed

The validator verifies each manifest entry against the bytes embedded in that
same entry, but never compares those bytes with the actual in-memory bundle
components. The capture receipt's schema, counts, digests, closure booleans,
and status are not recomputed or checked.

Executable reproductions:

- Replace `manifest[source.json].bytes` with `{}`, recompute that entry hash:
  the bundle still validates.
- Replace the capture receipt with wrong schema, zero counts, zero hashes,
  false closure flags, and `status: failed`: the bundle still validates.
- Change `portal:bilibili:<BVID>:...` to
  `portal:attacker:<BVID>:...` consistently: the bundle still validates.

Relevant implementation: `review_bundle.mjs:155-176`, `:296-365`.

Required correction: exact source/evidence/seek/receipt key sets and types;
exact `portal:bilibili:<BVID>:<unit>:<part>` authority; manifest bytes bound to
the canonical actual files; capture receipt fully recomputed and compared.

## M3 - Private-root isolation and durable publication are incomplete

`resolvePrivateRef()` performs lexical containment only. A symlink below the
owned root can point outside and is read. `readReviewBundle()` trusts manifest
paths before validation. The writer accepts a root inside the repository,
accepts symlink/pre-existing destination components, overwrites an existing
source bundle, and writes directly to final paths despite claiming atomicity.

Executable reproduction: a root-local `ref.json` symlink to an outside file is
accepted and the outside bytes are read.

Relevant implementation: `review_capture.mjs:49-55`, `:278-308`, `:383-415`.

Required correction: canonical outside-repo owned root; `lstat`/`realpath`
containment with symlink rejection; exact manifest path grammar before reads;
fresh exclusive staging directory; write/fsync/validate/atomic rename; reject
pre-existing final bundle; cleanup failed staging without deleting unrelated
paths.

## M4 - Screenshot and seek semantics are not closed

The seek validator accepts zero-length windows, a seek time outside its own
chapter, a representative evidence item that is not a frame or has no PNG,
and a seek chapter set that does not match the derivative chapters. The
builder selects only a cited frame; a chapter with no cited frame receives
`null`, although B6 requires screenshot/seek review.

Executable reproduction: set a chapter to `start=end=1000` and
`seekTimeMs=3999` within a 4000 ms medium; the bundle still validates.

Relevant implementation: `review_capture.mjs:65-86` and
`review_bundle.mjs:267-294`.

Required correction: exact chapter identity/order/window binding to the
derivative; `start < end`; seek inside the chapter; one real PNG-backed frame
per reviewable chapter, selected deterministically from cited or nearest
captured frame with a declared rule; wrong-source/task/frame-kind fails.

## Verification performed

- Submitted evidence manifest: all 12 payload files OK.
- Existing focused B6 tests: 60 passed, exit 0.
- `git diff --check`: exit 0.
- Five executable adversarial reproductions above: all demonstrated a current
  false positive or boundary escape.

