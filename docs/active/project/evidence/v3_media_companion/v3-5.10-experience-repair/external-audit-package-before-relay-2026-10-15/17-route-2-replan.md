# Stage B route 2 deterministic brief composer replan

Date: 2026-10-14. Status: document candidate; implementation requires the
route-specific authorization recorded below.

## Problem and retained evidence

The fresh `BV1pohR6rEEh` run reached grounded synthesis, but MiniMax-M3 twice
returned a brief shorter than the frozen 20-character minimum. The Runtime
correctly rejected both candidates with `V3510B_BRIEF_LENGTH_INVALID`; no V2
derivative was published. The six failure artifacts and their hashes remain
authoritative in `stage-b-b5-provider-contract-risk-stop-2026-10-13.md`.

Repeated prompt retries are not an acceptable production control: they increase
latency and cost while allowing another field to regress. A native constrained
provider remains a future option, but no approved/configured provider is
available in the current low-resource route.

## Route 2 decision

Introduce `v3-media-grounded-comprehension/v2.1` beside V2. V2 remains readable
and byte-identical. New successful writes use V2.1 and disclose whether the
brief came directly from the provider or from a deterministic composition of
provider claims.

The local composer is a formatting recovery boundary, not a second summarizer:

1. The provider still proposes the brief, claims, chapters and citations.
   At most one full-contract provider repair request is allowed after the first
   failed validation. Composer evaluation begins only after that bounded repair
   also fails with one of the two allowlisted brief codes. Provider request
   count therefore remains finite and is recorded in the existing receipt.
2. Full validation runs first. Only `V3510B_BRIEF_LENGTH_INVALID` or
   `V3510B_BRIEF_RAW_PREFIX` may enter the composer.
3. The composer evaluates ordered subsets of 2 or 3 provider claims. A claim is
   eligible only when its text length and evidence IDs are valid, its evidence
   is known, and its normalized text is not a contiguous raw transcript excerpt.
4. A subset must collectively cover every substantive opening/middle/ending
   region. Its normalized texts are joined with the fixed separator `；`.
5. The result must contain 20-100 Unicode scalar values, must not be a raw
   transcript excerpt and must retain the union of the selected claims' direct
   evidence IDs. Selection is deterministic: maximize required-region coverage,
   then minimize character count, then use original claim index order.
6. The entire candidate is validated again. Any claim, chapter, coverage,
   authority or persistence failure still rejects the derivative.
7. If no valid subset exists, the original provider failure is returned. No
   padding, truncation, local paraphrase, chunk-summary promotion or threshold
   reduction is allowed.

When no valid subset exists, Runtime emits the structured internal diagnostic
`V3510B_COMPOSER_NO_VALID_SUBSET` with task ID, revision, catalog hash and the
original allowlisted failure code. It contains no claim/evidence text and is not
a published V2.1 failure code. The HTTP response preserves the original provider
failure so existing clients do not gain a new public error contract.

## Architecture impact

- `quality.py` owns a pure `compose_brief_from_validated_claims` policy function.
- `service.py` invokes it only after the two allowlisted brief failures and after
  the existing provider repair attempt. It then executes the normal complete
  validator and the existing authority/hash commit barrier.
- V2.1 stores `brief.origin` and `brief.sourceClaimIds`. Provider briefs use
  `origin=provider` and an empty list. Composed briefs use
  `origin=deterministic_claim_composer` and exactly 2-3 generated claim IDs.
- The V2.1 path is
  `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`.
  Reads prefer exact-binding V2.1, then exact-binding V2. V1 remains unchanged.
- Workspace may disclose the origin in details, but complete/limited styling is
  still determined exclusively by the full quality validator.

## Security and privacy boundary

The composer receives only the provider candidate plus the existing in-memory
derived evidence catalog. It makes no network request and writes no intermediate
file. Raw video/audio/frame bytes, cookies, API keys and local paths remain at
zero outbound count. It cannot run when task authority or evidence binding is
stale.

## Acceptance denominator

The route is not accepted by unit tests alone. After implementation:

1. schema meta-validation and positive/negative fixtures must pass;
2. provider-valid briefs must remain byte-semantically provider-originated;
3. the two allowlisted brief failures must recover only when claim coverage is
   closed; all other failures must remain fail-closed;
4. cancellation, revision drift and evidence-hash drift must prevent commit;
5. the fixed six-video B-5 run must be freshly executed with muted Chrome,
   isolated profile/database/task namespace and real provider responses;
   every retry, including a retry after failure, must assert new Runtime process,
   database path, Chrome profile path and task ID before collection starts;
6. all six rows need a published V2.1 result with machine invariants passing,
   followed by B-6 host semantic review and a separate B-7 exit audit.

## Authorization boundary

The existing `approved V3-5.10 Stage B B-0..B-7 implementation` authorizes the
frozen Stage B design. The 2026-10-13 risk stop explicitly requires a route
choice because this replan changes result provenance and schema version. Until
the user explicitly approves **Stage B route 2 deterministic brief composer
implementation**, only documentation, schema candidate preparation and
independent document review are allowed.

