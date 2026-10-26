# ClaudeCode Prompt: GC-B6F Candidate Invariant Recovery

Implement the next authorized package in the Navia repository.

## Authority and boundary

Read `AGENTS.md`, the V3 stage gate section 28, the post-WP-B rebaseline, and
this package. The fresh order-2 confirmation authorization is consumed. This
package is offline implementation only.

The real run exhausted the global eight-request bound while candidates
regressed among `brief_shape`, `brief_value_domain`, temporal boundary/ordering
violations, and chapter concentration. It failed closed with
`V3510B_PROVIDER_RESPONSE_INVALID` before derivative publication or B6 capture.

## Objective

Make every candidate-producing request carry the same complete frozen
candidate invariants, and make value-domain failures diagnosable without
content leakage. Do not make success more permissive.

## Required implementation

1. Create one pure owner for the complete V2.1 candidate requirements. It must
   cover exact top/nested key sets, all text length ranges, evidence-id array
   shape and membership, claim/chapter counts, relation enum, real boolean
   conflict flag, first/last boundary evidence, strictly increasing chapter
   anchors, and the currently applicable chapter-balance constraints.
2. Compose that owner into initial synthesis, shape regeneration, temporal
   repair, balance regeneration and `repair_v2`. Targeted repair instructions
   may be appended but must not replace or weaken the common block.
3. Extend the privacy-safe diagnostic so `brief_value_domain` identifies the
   failing subdomain using only enums/counts/booleans: text type, normalized
   length bucket, evidence-id container class, empty/non-string item counts,
   and unknown-reference count. Apply the same pattern to claim/chapter value
   domains where practical. Never persist text, evidence IDs, title, response,
   request body, Provider identity, path, Cookie, key or raw-media metadata.
4. When the rejected candidate has the exact frozen key vocabulary and safe
   container types, pass that same Provider-generated authorized derivative
   back to the same selected Provider as repair context. When structural trust
   is absent, retain the trusted partial-context fallback. Do not normalize,
   reorder, split, merge or locally rewrite semantic fields.
5. Preserve `_STAGE_B_MAX_REQUESTS == 8` at the lowest outbound boundary, one
   adapter instance, one task-locked Provider and the independent validator as
   final authority. Persistent invalidity must publish nothing and retain the
   frozen failure code.

## Required tests

- Table test for every generation/repair task proving the complete invariant
  block is present exactly once and targeted instructions cannot shadow it.
- Exact/one-under/one-over value-domain tests for brief, claim and chapter
  text plus evidence-id container/item/membership failures.
- Privacy tests proving diagnostics contain no content, IDs, requests,
  responses, secrets, paths or Provider identity.
- A scripted adapter sequence reproducing the real trace:
  `brief_shape -> brief_value_domain -> temporal -> brief_value_domain ->
  temporal+balance -> brief_value_domain`, followed by a valid candidate;
  prove convergence within the same budget and no local mutation.
- The same sequence ending invalid at request eight must fail closed and leave
  the prior durable product byte-identical.
- Initial synthesis and `repair_v2` parity, MiniMax soft-schema path and the
  selectable strict-adapter path.
- Runner boundary test proving the new diagnostic survives sanitization with
  only allowlisted structural facts.

## Validation sequence

1. New focused Python tests.
2. Existing GC-B5R/B6D comprehension tests.
3. Runtime full `pytest tests/` once because production Python changes.
4. B6C runner/lifecycle focused Node tests.
5. Full Stage B offline suite once.
6. Relay v11 only if a frozen relay-scope file changes; otherwise verify its
   frozen hashes unchanged.
7. Secret/path/raw-media scan and owned process/root/port cleanup audit.

## Forbidden

No Chrome, Cookie read/injection, Provider call, download/import, real BVID,
audio, tabCapture, B6 bundle, blind review, sentinel, B7, Stage C, contract
refreeze, threshold relaxation, request-budget increase, Provider fallback,
historical evidence edit, or visible-run authorization consumption.

Do not commit, push, reset, clean, checkout or revert unrelated changes.

## Stop condition

Stop at `GC-B6F OFFLINE IMPLEMENTED AWAITING CODEX CHECKPOINT`. Report changed
files, contract changes or explicit `none`, case-to-production-oracle mapping,
exact commands/exits, zero-action receipt, privacy/cleanup results, remaining
risks and a final manifest generated after all payloads are stable.
