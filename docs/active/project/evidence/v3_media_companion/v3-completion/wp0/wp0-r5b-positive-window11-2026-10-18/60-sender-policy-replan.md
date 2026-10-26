# R5-B Offscreen sender policy replan

Date: 2026-10-18

Status: `DOCUMENT CANDIDATE / IMPLEMENTATION REQUIRES EXPLICIT SECURITY-BOUNDARY AUTHORIZATION`

## 1. Problem statement

The production Chrome run `r5b-positive-20261018T194000Z` delivered an Offscreen Port whose
`MessageSender.documentId` was absent. The installed Chrome API type declares that field optional, while relay
v10 defines absence as `RLY10-N05` and requires fail-closed rejection. This makes the positive R5-B path
unreachable in the observed supported browser without weakening or revising the internal sender policy.

Repeated waiting or visible retries cannot create a field Chrome did not provide. URL-only acceptance is also
not acceptable because it would remove the document-instance binding and weaken replacement detection.

## 2. Route comparison

| Route | Description | Security | Architecture/document cost | Decision |
|---|---|---|---|---|
| S0 | Keep v10 unchanged and retry Chrome | No security drift | Low immediate cost; permanent R5/R6 blocker | Reject |
| S1 | Edit v10 sender semantics in place | Can be secure | Low code cost; destroys historical semantic immutability and changes `RLY10-N05` under the same ID | Reject |
| S2 | Introduce relay v11 with equivalent unique-context binding | Preserves fail-closed identity | Moderate bounded migration across contract, fixture, tests, static verifier and R6 package | **Recommend** |
| S3 | Accept exact extension ID + URL without authoritative context | Weaker; spoof/replacement ambiguity | Low code cost | Reject |

S2 is the only route that both restores the real user path and preserves an auditable security boundary.

## 3. Relay v11 sender policy

All conditions are conjunctive. Any failed or unavailable condition returns the existing
`V3_MEDIA_CAPTURE_PORT_FORBIDDEN` boundary code.

1. `MessageSender.id === chrome.runtime.id`.
2. `MessageSender.url === chrome.runtime.getURL("/media-capture-offscreen.html")` by exact equality.
3. `MessageSender.tab` is absent.
4. `MessageSender.frameId` is absent or zero.
5. Background calls `runtime.getContexts` with the exact bundled document URL and
   `contextTypes=["OFFSCREEN_DOCUMENT"]`.
6. The result contains exactly one context.
7. That context has `contextType=OFFSCREEN_DOCUMENT`, exact document URL, exact extension origin, matching
   `chrome.extension.inIncognitoContext`, and a non-empty `documentId`.
8. If `MessageSender.documentId` is present, it must exactly equal the authoritative context document ID.
9. If `MessageSender.documentId` is absent, the authoritative context document ID becomes the binding key.
10. A later sender/context replacement cannot replace the first bound document within a live owner.
11. Lookup exceptions, zero/multiple contexts, missing authoritative context document ID, origin mismatch,
    URL mismatch, incognito mismatch, and present-but-different sender document ID all fail closed.

No sender value, context ID, stream ID, ticket, Cookie, token or private path enters public diagnostics. Only the
fixed mismatch-category enum may be logged privately.

## 4. Version boundary

Relay v10 remains immutable historical evidence. Relay v11 changes only:

- internal schema version and internal Port version;
- sender-policy constants;
- the semantic meaning of the fifth sender negative case;
- sender-policy production implementation/tests/verifier;
- R6 prerequisite references and candidate digests.

Relay v11 does **not** change:

- the nine message types or their payload schemas;
- PCM shape, Base64 transport, sequence, credit, queue or byte/duration limits;
- restart marker fields/phases/expiry;
- source/target FailureCode inventory or mappings;
- Runtime endpoint, Origin, ticket TTL, Cookie/provider handling, SourceAuthority or materialize ownership;
- the trusted user action or any visible user step.

## 5. Fixed sender validation matrix

Positive cases:

| ID | Sender document ID | Context result | Expected |
|---|---|---|---|
| SP11-P01 | present, equal | exactly one authoritative context | accept and bind context document ID |
| SP11-P02 | absent | exactly one authoritative context | accept and bind context document ID |
| SP11-P03 | absent initially, empty lookup then one within bounded wait | exactly one authoritative context | accept after bounded registration wait |

Negative cases:

| ID | Mutation | Expected |
|---|---|---|
| SP11-N01 | extension ID mismatch | PORT_FORBIDDEN |
| SP11-N02 | sender tab present | PORT_FORBIDDEN |
| SP11-N03 | sender URL absent/mismatch/prefix-only match | PORT_FORBIDDEN |
| SP11-N04 | non-zero sender frame | PORT_FORBIDDEN |
| SP11-N05 | context lookup throws | PORT_FORBIDDEN |
| SP11-N06 | zero contexts after bounded wait | PORT_FORBIDDEN |
| SP11-N07 | more than one matching context | PORT_FORBIDDEN |
| SP11-N08 | context type mismatch | PORT_FORBIDDEN |
| SP11-N09 | context URL mismatch | PORT_FORBIDDEN |
| SP11-N10 | context origin mismatch | PORT_FORBIDDEN |
| SP11-N11 | context incognito mismatch | PORT_FORBIDDEN |
| SP11-N12 | context document ID absent/empty | PORT_FORBIDDEN |
| SP11-N13 | present sender document ID differs from context | PORT_FORBIDDEN |
| SP11-N14 | second/replacement document differs from bound key | BINDING_MISMATCH or existing single-owner rejection by phase |

The relay fixture denominator remains 30 cases. The former
`sender_document_missing_or_replaced` case is replaced, not removed, by
`authoritative_context_missing_ambiguous_mismatched_or_replaced`. The three positive cases are additional
production-class acceptance evidence and do not reduce the negative denominator.

## 6. Implementation workpack

1. Create versioned v11 schema, fixture and verifier/mutation pair from the accepted v10 baseline.
2. Update internal constants and the Background/Offscreen Port version together; no dual-version fallback.
3. Refactor sender classification to return an accepted authoritative document ID, not only a boolean/code.
4. Bind `OffscreenAudioPort.boundDocumentId` to that authoritative ID.
5. Add all SP11 positive/negative cases to production-class tests and static anti-regression gates.
6. Update the R6 package authority references and matrix from v10 to v11 without changing its 65-case total.
7. Run one offline checkpoint: schema meta-validation, baseline/mutations, targeted suites, media subtree,
   typecheck, build, secret scan and cleanup scan.
8. Only after offline PASS, schedule one owned visible Chrome run with `--mute-audio` to complete R5-B.

## 7. Stop conditions

Stop before a visible run if any sender/context mismatch can pass, if URL-only acceptance is possible, if v10 is
overwritten, if a second Port/version fallback exists, if the 30+8 or R6 65-case denominator shrinks, or if public
API/FailureCode/threshold/user-step behavior changes.
