# Findings And Reproductions

## Major 1: membership was descriptive, not enforced

A candidate with valid chapter anchors but an unknown evidence reference in
the brief or a claim returned no adapter shape violation. The independent
validator would reject it later, consuming another repair request despite the
new contract claiming membership as an invariant.

Correction: unknown-reference counts now participate in the existing
brief/claim/chapter value-domain refusals before the candidate leaves the
adapter.

## Major 2: empty arrays produced a false diagnostic

For a claim with `evidenceIds: []`, production enforcement correctly returned
`claim_value_domain`, but the diagnostic reported a list container and zero
invalid evidence-id items.

Correction: an empty list has the stable `empty_list` container class and is
counted as an invalid claim/chapter evidence-id collection.

## Major 3: the runner dropped plural diagnostics

The runner listed plural class arrays as array-capable keys but omitted them
from the enclosing key allowlist and had no plural enum vocabularies. They were
therefore silently discarded at the real runner boundary.

Correction: all five plural class arrays are present in both allowlist layers;
unknown keys and unknown enum values remain fail-closed and are dropped.

## Structural trust defect

An exact-key candidate whose evidence-id array contained an object was marked
trusted and could be reflected into a repair request. Correction: structural
trust accepts evidence-id arrays only when every item is a string. Unknown or
empty strings remain repairable value defects; nested values are untrusted.
