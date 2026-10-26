# SB4 — the accepted closures are preserved

The batch did not weaken any accepted closure. Each one is still proven by
its own case.

| the accepted closure | the proving case | the state |
|---|---|---|
| the deterministic artifact filename and the byte hashing | `AI1: the artifact bytes hash to the declared digests` and the nine AI1 process-level cases | preserved — the contracted name `derivative-v2.1.json` and the byte hashing are unchanged |
| the receipt and derivative digest recomputation | `AI1: a DERIVATIVE hash mismatch is refused`, `AI1: a RECEIPT hash mismatch is refused` | preserved — and the receipt hash now uses the PRODUCTION canonical serialization, so it is recomputable from the artifact bytes |
| the exact mirror wrapper and the Provider lock | `AI2: every required mirror wrapper field is required` (ten cases) and the AI2 mirror cases | preserved — the wrapper key set, the schema version and the locked selection are unchanged |
| the positive request counts and the exact ledger totals | `AI2: receipts and ledger that consistently claim zero requests exits nonzero` and `CI2: duplicated ledger events exits nonzero` | preserved — and STRICTER: a zero request count on an attempted synthesis is now refused |
| the latched owned-process sightings and the owned-only cleanup | `an OWNED descendant that exits before the closeout is still a leak` and `an UNRELATED live runner is neither counted nor killed` | preserved — the leak sighting behaviour was NOT touched by this batch |

## The boundaries that did not change

| the boundary | the state |
|---|---|
| public API | unchanged — no endpoint, request or response shape changed |
| schema | unchanged — the frozen V2.1 candidate schema, the frozen V2.1 derivative schema and the frozen Stage B contract are byte-identical. The batch READS the frozen derivative contract |
| FailureCode | unchanged — the batch CONSUMES the frozen codes and adds none. The two new aggregate codes belong to the INTERNAL evaluator |
| threshold | unchanged — the positive threshold is untouched |
| message | unchanged — no error message, stop reason or evidence field was renamed |
| Provider registry | unchanged — the locked Provider id, endpoint class, provider lock and derived-text scope are untouched |
| Origin/auth order | unchanged |
| the frozen source denominator | unchanged |
| the relay fixtures | unchanged — the 12 frozen relay hashes match and the relay scope was last modified on 2026-10-20 |
| the historical evidence | unchanged — every prior package still verifies against its own manifest |

## The validators were NOT weakened

* The machine receipt identity check is NEW and STRICT: eleven required,
  typed and compared fields.
* The artifact identity comparison is UNCONDITIONAL now: a missing value is
  a defect, never a skipped comparison.
* The artifact quality is NEWLY BOUND to the disposition, and a complete
  result must carry no quality failure code.
* The schema keyword handling is NEWLY FAIL-CLOSED.
* The frozen receipt identity got stricter: `requestCount` must be an integer
  `>= 1` (it accepted `0` before).
* The positive stub got stricter: it writes a real V2.1 artifact, derives
  every hash from the bytes and can express the new mutations.

## One behaviour that moved (not a weakening)

The production quality-to-disposition rule moved from the body of
`run_one_bvid.mjs` into the shared contracts module
(`QUALITY_STATUS_TO_DISPOSITION` / `dispositionForQualityStatus`) so that the
runner and the aggregate use the SAME rule. The rule itself is unchanged:

```js
// before
finalDisposition = qualityStatus === "complete" ? "complete"
  : (qualityStatus === "limited" ? "limited" : "failed");
// after
finalDisposition = dispositionForQualityStatus(qualityStatus) ?? "failed";
```

## The production Python was not touched

The batch changed no production Python file. It extended ONE Python TEST
(the validator equivalence proof) with the structural keyword inventory and
the byte-for-byte canonical serialization comparison.
