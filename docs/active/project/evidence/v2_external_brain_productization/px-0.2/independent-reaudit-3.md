# V2-PX PX-0.2 Fourth Independent Re-audit

Audit date: 2026-09-01
Mode: read-only independent Orca dispatch
Run: `run_5179b48203e5`
Task: `task_bb5f66675ad5`
Dispatch: `ctx_7c4e26da3856`

## Result

```text
Fatal: 0
Major: 1
Minor: 0
Disposition: FAIL / REOPENED
PX-0.2: No-Go for closure
PX-1+: No-Go
```

## Checks Reproduced

The independent auditor reran the contract validator and focused tests. The
baseline passed with 9 schemas, 65 positive instances, 175 validations, 63
rules, 41 semantic rules, 109 fixtures and G1-G7 all true. The focused test
file passed 10/10.

The auditor independently confirmed that the repaired rule rejects unequal
cardinality, extra metadata, reordered image paths, cross-scenario metadata,
duplicate `scenarioId + captureVariantId`, missing metadata artifacts and hash
mismatch. A correctly paired two-variant scenario also passes.

## Major Finding

A two-variant scenario can reuse the same `imagePath` in both Screenshot
Metadata objects. Both image/metadata arrays have equal length and every index
matches, so `PX_RULE_SCREENSHOT_METADATA_MISMATCH` returns true even though the
two entries are a duplicated image pairing.

This violates the bounded acceptance plan's requirement to reject duplicated
pairings. It allows one image artifact to be counted as multiple screenshot
variants.

## Required Closure

- Require unique screenshot image paths within each scenario's ordered pair
  set, or freeze a stronger globally unique evidence identity.
- Add a focused negative test for two metadata variants sharing one image
  path and image hash.
- Preserve the valid two-variant case with distinct image artifact paths.
- Run another independent read-only re-audit before closing PX-0.2.

No product capability was assessed or accepted by this audit.
