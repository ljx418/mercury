# Findings And Fixes

## Major 1: diagnostic sanitizer could disclose short private strings

The runner accepted arbitrary short lowercase/underscore strings. A process-level reproduction persisted injected `token` and `title` values into the machine receipt. The sanitizer now projects only explicit diagnostic keys, numeric/boolean fields, frozen codes, schema versions, and enumerated values. Unknown keys and strings are dropped. The process test now injects short secret-like values and proves they do not survive.

## Major 2: balance regeneration lacked semantic grounding

The repair request supplied only title, evidence ids/timestamps, and balance metrics while asking the Provider to regenerate brief, claims, and chapters. It now carries the same Provider's previous authorized candidate as `groundedContext`, allowing semantic preservation without raw evidence text, paths, credentials, or new collection.

## Major 3: strict adapter could not execute the shared repair loop

The selectable DeepSeek strict adapter inherited the shared enforcement but rejected shape and balance regeneration tasks as unsupported. Its strict schema and task contract now recognize both tasks. Unknown tasks remain fail closed.

## Precision correction

The repair prompt previously stated the concentration rule even below its frozen six-chapter applicability threshold. Constraint metadata now states which rules apply, and the prompt includes only active frozen rules. Threshold values and validator behavior did not change.
