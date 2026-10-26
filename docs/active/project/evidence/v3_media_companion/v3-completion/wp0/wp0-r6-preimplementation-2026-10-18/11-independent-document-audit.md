# R6 preimplementation independent document audit

Date: 2026-10-18

Decision: `DOCUMENT PASS / R6 IMPLEMENTATION STILL BLOCKED BY R5-B`

Severity: Fatal 0 / Major 0 / Minor 0 / external entry blocker 1 (`R5-B` visible positive).

## Independent review history

The read-only Codex Agent audited all package files, the v10 schema/fixture and every concrete production
owner referenced by the matrix. It did not edit files or run Chrome, Provider, audio or network actions.

The first final review found five Majors:

1. meaning-changing matrix mutations could remain verifier-green;
2. the acceptance plan did not explicitly state all 65 cases;
3. the Service Worker supplement did not follow the real live-marker restart boundary;
4. permission-missing contradicted the production grant/ticket order;
5. R5 same-candidate digests and ClaudeCode commands were not executable definitions.

All five were remediated as one batch. The bounded recheck closed 5/5:

- complete matrix SHA-256 is pinned and duplicate JSON keys fail;
- nine adversarial semantic mutations fail the verifier;
- denominator is exactly 30 RLY + 8 OM + 7 phase + 6 handoff + 14 boundary = 65;
- permission failure occurs after grant/ticket issuance but before Runtime socket/sink ownership;
- a live-marker worker restart dispatches `cancelThenObserve/observe`, does not emit `WORKER_RESTARTED`
  for a valid marker, restores no old transfer state, and follows terminal/grace cleanup;
- payload manifest, build tree and a fixed 20-file source closure have canonical digest algorithms and an
  executable computation tool;
- the ClaudeCode goal has unique prerequisite paths and exact entry commands.

## Independent verification

- `05-verify-r6-document-package.py`: 38/38 PASS, exit 0.
- `09-verify-r6-document-mutations.py`: 9/9 PASS, exit 0.
- fixed behavioral denominator: 65, all fresh.
- horizontal gates: 11, outside the behavioral denominator.
- visible browser work: restricted to one notified, owned, muted `R6-G2` session.

## Gate conclusion

The package can support R6 implementation after an accepted same-candidate R5-B checkpoint. It cannot
create that checkpoint, replace the remaining trusted Chrome/tabCapture positive, or authorize R6 by
itself. Until Codex records `R5 PASS / R6 MAY START`, `07-claudecode-r6-goal.md` must not be executed.
