# Stage A policy-switch post-fix independent audit

Date: 2026-10-12. Reviewer: separate Claude Code CLI, read-only tools only.
The reviewer did not edit files, run tests, open secrets, or observe Chrome
directly. It inspected the first independent review, exit candidate, seven
policy-switch result/failure records and the named Runtime/extension code.

## Findings and bounded decision

Fatal 0; new Major 0. The original three Majors are closed:

- M-1: `policy_switch_receipt()` supports exact replay after a fresh
  `MediaTaskStore` and coordinator are opened. A direct test and an HTTP
  route test both return `replayed` 200 with the same task ID.
- M-2: new browser records require actual rendered chapters and more than
  200 chapter characters at each viewport. The strict records show 12
  chapters and 830 characters at 360/420/768/1280, with zero serious or
  critical Axe violations and no horizontal overflow.
- M-3: `keyboardRouteOutcome` is typed, recorded, and part of `passed`.
- Supplemental S-1: historical tasks are labelled and read-only in the UI;
  Ask/Export/Synthesis/Cancel/Retry return 409 or are hidden. Materializers
  enforce the same constraint through `MediaTaskStore.create/transition`.

The reviewer classified the failure
`first-use-runs/20261012T094222824Z-policy-switch-failure.json` as
**consistent with** switching focus to an ordinary extension tab during the
commit await: new v2 authority existed but its task stayed `created` and the
old product was untouched. The in-page confirmation run
`first-use-runs/20261012T094651278Z-policy-switch-result.json` passed.
The cause is not proven exclusively; a real user changing tabs at that
instant can still leave a recoverable pending task requiring explicit retry.
The reviewer treated this as Minor for task authority, not as a claim of
seamless automatic continuation.

Decision: **GO for Stage A consent-policy-switch task authority only.** It
does not approve Stage B-D, video understanding quality, exports, V4, or V3
final. A full Stage A exit still needs review of first-use, cancellation,
Runtime-crash recovery, and the fixed denominator together. Residuals for
that review: no exact crash injection between switch commit and execution;
coordinator cold-start source lookup returns 404 while persisted outline
lookup can show pending; prefix-only secret scan; and focus/epoch drift
requires a visible retry. The historical materializer route lacks an
explicit route-layer guard but is blocked in the store and was classified
Minor by the reviewer.
