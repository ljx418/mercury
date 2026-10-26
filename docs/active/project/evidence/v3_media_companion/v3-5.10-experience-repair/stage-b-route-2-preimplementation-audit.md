# Stage B route 2 preimplementation audit

Date: 2026-10-14. Scope: documentation/schema candidate only.

## Findings

| Severity | Count | Result |
|---|---:|---|
| Fatal | 0 | no secret, permission or raw-media scope expansion |
| Major | 0 | recovery is bounded to two brief failures and full revalidation |
| Minor | 2 | six-video behavior remains unproven; external reviewer independence is pending |

## PRD and architecture review

- The route preserves the Stage B goal: a concise, evidence-grounded whole-video
  brief, claims and semantic chapters. It does not reduce fixed denominators.
- Provider semantics remain upstream. The local function performs deterministic
  selection/formatting only and cannot invent words outside selected claims.
- V2 immutability plus V2.1 new writes avoids silent contract mutation.
- Full validation and task/catalog authority barriers remain downstream, so the
  route does not create a bypass around evidence closure or cancellation.
- No Stage C/D feature, cloud scope, Cookie use or raw-media upload is added.

## Minor risks

1. **M-1, user-visible fluency:** joining claims may read less naturally than a
   provider brief. Mitigation: choose at most three claims, shortest valid closed
   subset, disclose origin and retain host semantic review.
2. **M-2, real-provider generalization:** the route is motivated by one fixed
   denominator video. Mitigation: six-video fresh denominator remains mandatory;
   no pass can be declared from fixtures or the sentinel alone.

## Independent review closure

Claude Code CLI independently recomputed 12/12 payload hashes and both schema
meta-validations, then returned DOCUMENT CONDITIONAL GO with Fatal 0 / Major 0 /
Minor 5. Its report is
`stage-b-route-2-independent-document-audit-2026-10-14.md` (SHA-256
`b3db4ffc82283712c28737a0ee569403e1194ea280b74ab24408f2c66eb72079`).

- external m1 and m4 are the residual fluency/generalization risks already
  represented by M-1/M-2 above;
- external m2 is closed by freezing exactly one provider repair before composer;
- external m3 is closed by the text-free
  `V3510B_COMPOSER_NO_VALID_SUBSET` internal diagnostic and original-error return;
- external m5 is closed by requiring a new Runtime, database, Chrome profile and
  task ID for every real-run retry.

No independent finding authorizes implementation or changes the real denominator.

## Gate decision

**DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO pending independent document audit
and explicit route-2 user authorization.** B-5 remains FAIL/REPLAN; B-6/B-7 and
Stage C/D remain NO-GO.

## 2026-10-14 addendum: V2.1 Receipt extras admitted (M-B5-1-01 closure)

The V2.1 schema `Receipt` type was extended with seven optional fields so that
B-5 real-run derivatives carrying the B-5-1 provider lock data can pass MR-07
schema meta-validation under `additionalProperties: false`. V2 schema is
unchanged (byte-identical SHA-256). Schema SHA-256, fixture SHA-256 and the
verifier output are recorded in
`stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md`.

The seven admitted fields and their constraints are documented in the
`Provider receipt extras (V2.1 only)` section of
`stage-b-route-2-contract-addendum.md`.

