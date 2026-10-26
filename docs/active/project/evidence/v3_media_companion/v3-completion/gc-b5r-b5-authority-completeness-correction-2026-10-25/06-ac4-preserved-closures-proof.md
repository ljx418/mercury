# AC4 — the accepted closures are preserved

The batch did not weaken any accepted closure. Each one is still proven by
its own case.

| the accepted closure | the proving case | the state |
|---|---|---|
| the deterministic artifact filename and the byte hashing | `AI1: the artifact bytes hash to the declared digests` and the nine AI1 process-level cases | preserved — the contracted name `derivative-v2.1.json` and the byte hashing are unchanged |
| the artifact task/revision/source UNCONDITIONAL binding | `AI1: a missing machine task id is a defect, never a skipped comparison` and the three sibling cases | preserved — the binding compares even when a value is absent |
| the quality/disposition mapping and the empty complete failure codes | `SB2: the production mapping is the single rule`, `SB2: a COMPLETE artifact with quality failure codes is not a positive candidate` | preserved — the shared mapping is untouched and the empty-failure-code rule still applies |
| the exact mirror wrapper, the Provider lock, the positive request counts and the ledger totals | the AI2 mirror cases, `AI2: every required mirror wrapper field is required`, `AI2: receipts and ledger that consistently claim zero requests exits nonzero` | preserved |
| the authorization/grant ownership and the latched owned-process sightings | `an OWNED descendant that exits before the closeout is still a leak`, `an UNRELATED live runner is neither counted nor killed` | preserved — the batch did not touch the ownership code |
| the public contracts, FailureCodes, thresholds, Provider registry, Origin/auth order, frozen denominator, relay fixtures and historical evidence | the boundary table below and the manifest verifications | preserved |

## The boundaries that did not change

| the boundary | the state |
|---|---|
| public API | unchanged — no endpoint, request or response shape changed |
| schema | unchanged — the frozen V2.1 candidate schema, the frozen V2.1 derivative schema and the frozen Stage B contract are byte-identical |
| FailureCode | unchanged — the batch CONSUMES the frozen codes and adds none. The two new aggregate codes belong to the INTERNAL evaluator |
| threshold | unchanged |
| message | unchanged — no error message, stop reason or evidence field was renamed |
| Provider registry | unchanged — the locked Provider id, endpoint class, provider lock and derived-text scope are untouched |
| Origin/auth order | unchanged |
| the frozen source denominator | unchanged |
| the relay fixtures | unchanged — the 12 frozen relay hashes match and the relay scope was last modified on 2026-10-20 |
| the historical evidence | unchanged — every prior package still verifies against its own manifest |

## The validators were NOT weakened

* The source identity is now bound to the LITERAL portal and adapter, not
  merely parsed.
* The task namespace is now validated against the FROZEN shape, not as a
  non-empty string.
* The task-namespace RECEIPT is now PARSED and cross-bound; the file's
  presence is no longer accepted as proof.
* The timestamps are now FINITE, REAL UTC instants with `finish >= start`;
  an impossible calendar value is a defect and the input is never
  normalized.
* The machine disposition is now a REQUIRED, typed terminal field, compared
  unconditionally.
* The public schema-validation entry point now enforces the keyword support
  ITSELF, and the unchecked recursive evaluator is private.

## One behaviour that moved (not a weakening)

The task-namespace receipt is now PARSED by the sequencer and handed to the
aggregate. Before this batch the sequencer recorded only whether the file
existed. The file's own content did not change: the runner still writes
`{ taskIdNamespace, bvid, order, runId }` ✓.
