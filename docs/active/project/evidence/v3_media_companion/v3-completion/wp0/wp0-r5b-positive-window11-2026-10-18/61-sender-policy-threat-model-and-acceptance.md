# Relay v11 sender compatibility threat model and acceptance

Date: 2026-10-18

Decision: `PREIMPLEMENTATION DOCUMENT PASS / CODE NO-GO PENDING EXPLICIT AUTHORIZATION`

## Trust boundary

The untrusted input is a Chrome Runtime Port request. Background is the capture transport owner. The Offscreen
document may produce PCM only after Background proves that the Port belongs to the single current bundled
Offscreen context. The policy must not trust caller-provided document identity when Chrome omits it and must not
infer identity from URL alone.

## Threat analysis

| Threat | Attack/failure | Required control | Acceptance oracle |
|---|---|---|---|
| Spoofing | another extension or web/tab context opens the Port | exact extension ID, absent tab, exact URL/type/origin | rejected before owner binding |
| Context confusion | zero or multiple matching contexts | exactly one authoritative context | fail closed; no Port/socket/marker |
| Replacement | sender/context changes after first bind | bind authoritative context document ID | replacement rejected |
| Optional-field incompatibility | Chrome omits sender document ID | derive only from unique authoritative context | SP11-P02 succeeds without weakening other checks |
| Present-field contradiction | sender ID and context ID disagree | equality required whenever sender ID exists | SP11-N13 rejected |
| Incognito crossing | regular/incognito context mismatch | exact profile-context equality | rejected before capture ownership |
| TOCTOU | context disappears or changes during async validation | use one accepted context snapshot and bounded owner lifecycle; disconnect closes owner | no acceptance from stale/ambiguous snapshot |
| Information disclosure | diagnostics expose IDs/secrets | fixed category enum only | public/private secret scan zero |
| Denial of service | context registration race | bounded wait only | deterministic timeout; no infinite polling |

## Security equivalence judgment

The proposed route does not treat missing `MessageSender.documentId` as proof of identity. It replaces that
unavailable proof with a stronger conjunction: exact extension sender facts plus exactly one authoritative
Offscreen context with exact URL, origin, type, profile and non-empty context document ID. The authoritative ID
still supplies the per-document binding used to reject replacement.

Residual difference: when sender document ID is absent, Chrome does not provide a second independent ID to
cross-check against the context. This is an unavoidable platform limitation. The residual is constrained by the
extension-only Port, exact bundled URL/origin, no-tab rule, unique context requirement and single-owner lifecycle.
Severity after controls: Minor, accepted only with explicit project authorization and real positive Chrome proof.

## Automated acceptance

Offline gates, run without windows, focus or sound:

1. Versioned v11 schema validates under Draft 2020-12.
2. Baseline verifier passes its frozen count; every semantic/security mutation exits non-zero.
3. v10 historical verifier remains reproducible against its historical files.
4. SP11-P01..P03 and SP11-N01..N14 drive the production classifier/Port owner.
5. Exact context filter, authoritative ID return and bound-key replacement are behaviorally asserted.
6. Typecheck, media subtree, full unit suite, build and affected Runtime tests pass once at checkpoint.
7. R6 document verifier/mutations pass with the same 65-case total and updated v11 authority.
8. Secret/raw-media/private-path scan and owned-process/port scan are zero.

Visible gate, performed once only after all offline gates pass:

1. Notify the user immediately before the run.
2. Start a fresh owned production Chrome/Profile with explicit `--mute-audio`.
3. Use the fixed Bilibili source and user-authorized Cookie path without publishing secret values.
4. Reach the trusted capture action through the product UI; no controller/store/database shortcut.
5. Prove non-empty PCM, expected capture duration, Runtime sink, SenseVoice, acquisition terminal, materialized
   `ready|degraded`, task/source identity consistency, revision/fence monotonicity and UI busy cleared.
6. Stop on the first independent failure; never retry visibly in the same development batch.
7. Clean only owned Chrome, Runtime, Profile, ports, media and task roots; prove all residual counts zero.

## Review conclusion

Fatal 0 / Major 0 / Minor 1 residual platform dependence. The plan is complete enough to implement and verify,
but implementation remains NO-GO until the user explicitly authorizes the relay v11 internal security-contract
revision. R5-B, R5 and R6 remain unpassed until the fresh positive run succeeds.
