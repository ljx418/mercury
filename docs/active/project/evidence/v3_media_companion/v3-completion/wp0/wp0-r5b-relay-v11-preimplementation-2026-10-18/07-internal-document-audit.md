# Relay v11 preimplementation internal audit

Date: 2026-10-18

Decision: `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`

Fatal 0 / Major 0 / Minor 1.

## Reviewed

- Window 11 real result, Runtime log, secret scan and cleanup;
- installed Chrome Runtime API types showing optional sender document ID;
- relay v10 schema, fixture, verifier, mutation verifier and production sender validator;
- R6 target architecture, 65-case matrix and entry gate;
- this package's architecture, development plan, acceptance plan and machine matrix.

## Findings closed

1. Repeating Chrome cannot resolve an absent optional field: visible retry is prohibited.
2. URL-only acceptance would weaken the trust boundary: prohibited by architecture, matrix and mutation test.
3. Editing v10 in place would destroy historical semantic reproducibility: v11 is required.
4. Missing sender document ID is not accepted by itself: unique exact authoritative context remains mandatory.
5. R6 denominator is not reduced: its package must migrate authority only after R5-B PASS.
6. Disturbance is bounded: all offline first, then one owned muted visible positive at most.
7. The mutation verifier first proves its unmodified baseline is green; a broken baseline cannot create a false
   `mutations rejected` result.

## Residual Minor

Chrome can omit one of two potential document-ID observations, so an absent sender ID cannot be cross-checked
against the context ID. Exact extension/URL/origin/type/profile/no-tab rules, unique-context cardinality and
single-owner binding contain this platform limitation. Only a fresh positive Chrome run can validate compatibility.

## Mechanical checks

- `05-verify-document-package.py`: PASS, 17/17 sender cases, matrix SHA-256
  `0d0d5a59185172507db6e512520f1ea21ff7e561b9a137d28083a1e7fce936f1`;
- `06-verify-document-mutations.py`: PASS, 8/8 meaning-changing mutations rejected;
- payload SHA-256 manifest: generated after all documents stabilized and verified separately.

No product code, public API, v10 artifact, Runtime, Chrome, Provider or sound action is authorized by this PASS.
