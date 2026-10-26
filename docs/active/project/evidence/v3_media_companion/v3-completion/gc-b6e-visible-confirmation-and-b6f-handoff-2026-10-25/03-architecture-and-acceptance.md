# GC-B6F Architecture And Acceptance

## Problem

The adapter has one enforcement loop, but each request payload repeats only a
subset of the frozen candidate contract. A temporal repair can regress brief
value constraints; a shape regeneration can regress boundary anchors. With a
soft-schema endpoint, naming the active defect is insufficient unless every
request also repeats the complete invariant set.

The current privacy-safe diagnostic combines several causes into
`brief_value_domain`, so the real run cannot distinguish text type/length from
the evidence-id container/value domain.

## Design

1. Introduce one pure `candidate_contract_requirements()` owner containing the
   complete frozen shape, value-domain, relation, evidence-id, boundary,
   monotonic-anchor and applicable balance requirements.
2. Initial generation, shape regeneration, temporal regeneration, balance
   regeneration and `repair_v2` must all compose this same invariant block.
   A targeted request may add context but may not omit common invariants.
3. Extend diagnostics with privacy-safe value-domain classes: text type and
   normalized length bucket; evidence-id container class, item-type/empty
   counts and unknown-reference count. Never persist text or IDs.
4. For a candidate whose key vocabulary is exact, permit the same selected
   Provider to receive its own prior authorized derivative as repair context.
   For unknown keys or invalid container types, fall back to the existing
   trusted partial context. Do not locally edit the candidate.
5. Preserve one adapter instance, one selected Provider, the global request
   bound of eight, and the independent validator as final authority.

## Acceptance

- Exact tests prove every generation/repair task includes the common invariant
  block and cannot override it.
- A regression reproduces the observed sequence of brief/temporal/balance
  failures and converges without any local semantic mutation.
- Terminal invalid sequences fail closed at no more than eight actual outbound
  requests and publish nothing.
- Diagnostics distinguish every brief value-domain class without retaining
  content, IDs, paths, Provider identity, requests or responses.
- Initial and `repair_v2` routes use the same owner.
- Existing frozen V2.1 validator tests, Stage B offline suite and Runtime full
  suite remain green.
