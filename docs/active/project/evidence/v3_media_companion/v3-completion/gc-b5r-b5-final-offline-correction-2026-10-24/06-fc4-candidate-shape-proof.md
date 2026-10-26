# FC4 — the exact candidate shape and the temporal enforcement

Oracle:
`services/local-runtime/tests/test_v3_gc_b5r_final_offline_correction.py`
(18 FC4 cases) and
`services/local-runtime/tests/test_v3_gc_b5r_chapter_diagnostics.py`
(the 14 pre-existing cases, still green).

The oracle is the REAL production adapter
(`MiniMaxGroundedSynthesisProvider`); only its HTTP transport is faked.

## The exact key sets

The candidate shape is the frozen one of the V2.1 contract. The adapter now
enforces the EXACT key set of every level:

| level | exact key set |
|---|---|
| top level | `brief`, `claims`, `chapters`, `unresolvedEvidenceConflict` |
| `brief` | `text`, `evidenceIds` |
| EVERY `claims[i]` | `text`, `evidenceIds` |
| EVERY `chapters[i]` | `title`, `thesis`, `evidenceIds`, `relationToPrevious` |

Before this batch the claims were NOT checked at all (only the FIRST claim
was inspected, and only for its keys, never for the exact set), and the
conflict flag was only checked when it was present.

## The violation classes

`stage_b_candidate_shape_violation` returns one frozen class, in this
precedence order:

```text
not_an_object → top_level_key_set → brief_shape → claims_shape →
claim_field_set → chapters_shape → chapter_count → chapter_field_set →
relation_enum → conflict_flag
```

## The negative cases

| required negative case | the class it yields | the proving test |
|---|---|---|
| a missing brief field | `brief_shape` | `test_fc4_a_brief_with_a_missing_field_is_refused` |
| an extra brief field | `brief_shape` | `test_fc4_a_brief_with_an_extra_field_is_refused` |
| an EXTRA field on a NON-FIRST claim | `claim_field_set` | `test_fc4_an_extra_field_on_a_non_first_claim_is_refused` |
| a MISSING field on a NON-FIRST claim | `claim_field_set` | `test_fc4_a_missing_field_on_a_non_first_claim_is_refused` |
| a NON-OBJECT claim | `claim_field_set` | `test_fc4_a_non_object_claim_is_refused` |
| a NULL conflict flag | `conflict_flag` | `test_fc4_a_null_conflict_flag_is_refused` |
| a MISSING conflict flag | `top_level_key_set` (the key set is incomplete first) | `test_fc4_a_missing_conflict_flag_is_refused` |
| a non-boolean conflict flag | `conflict_flag` | `test_fc4_a_non_boolean_conflict_flag_is_refused` |
| a malformed LAST chapter | `chapter_field_set` | `test_fc4_every_chapter_is_checked` |
| a missing top-level field | `top_level_key_set` | `test_fc4_a_missing_top_level_field_is_refused` |

A missing conflict flag is refused as a missing TOP-LEVEL KEY first, because
the exact key set is checked before the value type. A PRESENT but null flag
is refused as the conflict flag. Both are refusals; the difference is only
which regeneration hint the adapter sends.

## The conflict flag must be a REAL boolean

```python
elif not isinstance(conflict, bool):
    violation = "conflict_flag"
```

`None`, `"false"`, `0` and `1` are all refusals. The flag is never defaulted
to `False`.

## ONE shared enforcement

The initial route and the service-level `repair_v2` now call the SAME
function:

```python
candidate = self._enforce_candidate(
    candidate=candidate, evidence=evidence, regenerate=regenerate,
    stage="initial_candidate",      # or "bounded_repair"
)
```

`_enforce_candidate` applies the frozen shape AND the frozen temporal
contract in ONE loop, so the two routes cannot drift apart. The proving cases
are:

* `test_fc4_the_initial_route_regenerates_a_malformed_candidate`
* `test_fc4_the_repair_route_enforces_the_same_shape`
* `test_fc4_the_repair_route_enforces_the_temporal_contract`
* `test_fc4_the_two_routes_issue_the_same_regeneration_contract` — the two
  routes issue the SAME regeneration task, the SAME violation class, the SAME
  requirements and the SAME output schema.

## The temporal validation now applies to `repair_v2` too

The temporal contract (strictly increasing chapter anchors, the first chapter
carrying the earliest evidence, the last chapter the latest) is enforced on
the repair route exactly as on the initial route, with the SAME bounded
same-Provider regeneration and the SAME redacted temporal index.

## The diagnostic records the RESOLVED outcome

```text
recovering  → the violation was found and a regeneration was attempted
recovered   → the regeneration resolved it  (failureCode: null)
fail_closed → a terminal refusal            (failureCode: V352_SYNTHESIS_RESPONSE_INVALID)
```

* `test_fc4_a_recovered_diagnostic_records_a_resolved_outcome` — after a
  successful regeneration the diagnostics contain `recovered` and NOT
  `fail_closed`, the recovered record carries `failureCode: null` and the
  final candidate's shape is `none`.
* `test_fc4_a_terminal_refusal_records_fail_closed` — a persistent violation
  yields `fail_closed` and never `recovered`.

The diagnostic stays redacted: it carries counts, enums and booleans only —
never a value, an id, a text or a path.

## The independent validator stays authoritative

The adapter never ACCEPTS a candidate. It only refuses a malformed one
earlier, so the independent validator can spend its own refusal. The
pre-existing case `test_c4_the_independent_validator_stays_authoritative`
still holds: a candidate with a valid shape but an unknown evidence id is
still refused by the validator with `V3510B_EVIDENCE_UNCLOSED`.

## The honest limits

* The shape enforcement compares KEY SETS and the conflict flag type. It does
  not judge the semantics of a claim or a chapter: the independent validator
  remains the only authority on meaning.
* The temporal enforcement reuses the adapter's existing anchor rule. It was
  not made stricter by this batch; what changed is that `repair_v2` now
  applies it too.
