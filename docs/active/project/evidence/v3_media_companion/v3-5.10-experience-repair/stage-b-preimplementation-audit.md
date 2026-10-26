# Stage B internal preimplementation audit

Date: 2026-10-13. Decision: **DOCUMENT CANDIDATE; IMPLEMENTATION NO-GO**.

## Findings closed by this revision

1. The old validator accepted increasing anchors without whole-span coverage or
   imbalance checks. The V2 contract now freezes thirds coverage, ending ratio,
   rolling 20% concentration and maximum chapter-span invariants.
2. The old summary allowed 20-4000 characters and partial fallback concatenated
   chunk summaries. V2 freezes a 20-100 character brief and forbids raw-prefix
   or uncovered-region promotion to `complete`.
3. Existing chapter evidence IDs established existence, not user-visible claim
   structure. V2 adds 2-8 separately cited claims and retains host-model semantic
   review because a machine cannot prove entailment from an ID alone.
4. Historical compatibility is explicit: V2 is a revision/hash-bound derivative
   beside V1; invalid or failed V2 cannot mutate the prior projection.
5. The six-BVID denominator, blocked-source policy, sentinel repeat and
   independent exit are fixed before implementation.

## Contract checks performed

- Schema and normative document use one schema version and one failure-code set.
- Eighteen negative fixtures each have one expected code and disposition.
- Raw video/audio/frame bytes, Cookie, API key and local path upload counts are
  fixed to zero for Stage B synthesis.
- No public endpoint, portal adapter, consent scope or V4 knowledge contract is
  widened.
- `blocked` is explicitly outside V2 `quality.status`; the private V2 path is
  frozen separately from the existing V1 synthesis file; the six BVIDs are a
  machine-readable immutable registry.
- B-6 records the exact host model, prompt hash and session before judgment;
  B-7 requires a new reviewer identity distinct from implementation and B-6.

## Remaining review risks

- Minor: JSON Schema cannot express cross-field temporal continuity, rolling
  windows or evidence membership; the semantic validator and fixtures must.
- Minor: Unicode scalar counting must use code points, not UTF-16 code units.
- Minor: a provider can return structurally valid but semantically weak claims;
  the fixed host-model review remains mandatory.
- Minor: source availability for the six BVIDs is temporally unstable; blocked
  entries remain visible and two or more blocked sources force replan.

Internal result: Fatal 0 / Major 0 / Minor 4 for document readiness. A separate
independent document audit must validate the schema, failure-code equality,
fixture denominator, PRD alignment and historical-reader boundary before the
user may authorize B-0..B-7 implementation.
