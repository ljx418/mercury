# AC3 — the public schema-validation entry point is self-protecting

Oracle: `scripts/stage_b_b5_3/test/schema_keywords.node-test.mjs` (12 cases)
and the focused Python equivalence test (22 cases).

## The defect that was closed

`frozenV21Schema()` called `assertSchemaKeywordSupport()`, but the EXPORTED
`validateAgainstSchema()` did not. A caller could pass a schema with an
unsupported constraint directly and it was silently ignored:

```json
{"schema":{"type":"object","not":{}},"value":{},"verdict":{"ok":true,"errors":[]}}
```

The previous tests called the keyword assertion helper separately or went
through the frozen-schema loader; they did not prove that the shared
validation ENTRY POINT enforces its own documented fail-closed contract.

## The closure: a checked public entry and a private evaluator

```js
/**
 * This is the CHECKED PUBLIC entry point: it inventories the schema's
 * keywords and REFUSES an unsupported one BEFORE the value is evaluated …
 * The recursive traversal is PRIVATE and assumes the check has already
 * passed, so the inventory runs exactly once per call.
 */
export function validateAgainstSchema(schema, value, { root = schema, path = "$" } = {}) {
  assertSchemaKeywordSupport(schema);          // ← the check happens HERE
  const errors = [];
  evaluateSchema(schema, value, root, path, errors);   // ← PRIVATE
  return { ok: errors.length === 0, errors };
}

function evaluateSchema(schema, value, root, path, errors) { … }   // NOT exported
```

The recursive evaluator is no longer exported, so there is no unchecked
entry point left. The inventory runs exactly ONCE per public call (not per
recursion) ✓.

The frozen-schema cache validation is RETAINED:
`frozenV21Schema()` still inventories the frozen file BEFORE it is cached, so
a contract revision with a new keyword is a hard failure at load time as well.

## The negatives

Every case now calls the SAME PUBLIC API that production uses, in addition to
the direct keyword assertion:

| the case | the placement | the result |
|---|---|---|
| `SB3: an unsupported keyword at the ROOT throws` | `not` | the public API throws |
| `SB3: an unsupported keyword in a $defs schema throws` | `minProperties` | the public API throws |
| `SB3: an unsupported keyword in an items schema throws` | `exclusiveMinimum` | the public API throws |
| `SB3: an unsupported keyword in a property schema throws` | `multipleOf` | the public API throws |
| `SB3: an unsupported keyword in an if, then or else schema throws` | `contains`, `propertyNames`, `dependentRequired` | the public API throws |
| `SB3: the unsupported keywords are never silently ignored` | the three keywords of the Codex reproduction | the public API throws |
| `AC3: the PUBLIC validation entry point is fail-closed on its own` | `not` at the root and `minProperties` NESTED | the public API throws |
| `SB3: the supported keyword subset still validates values` | a supported schema | the public API still validates |

## The Codex reproduction, re-run

```text
$ node --input-type=module -e '…validateAgainstSchema({ type: "object", not: {} }, {})…'
AC-03 REPRODUCTION: hard failure -> the schema uses the unsupported keyword(s): not
```

## The retained proofs

* the frozen-schema cache validation ✓ (`frozenV21Schema()` checks before
  it caches);
* the complete keyword inventory tests ✓ (the frozen file's 23 keywords are
  compared with the supported and the annotation vocabularies);
* the canonical serialization checks ✓ (the Python↔JavaScript byte
  comparison over the legal frozen receipt domain, ten fixtures);
* the Python/JavaScript representative cases ✓ (the same verdict on the
  representative accept/reject fixtures).

## The honest limits

* The shared validator implements the keyword subset of the frozen contract.
  A frozen revision that introduces a new keyword is a HARD FAILURE at both
  the cache load and the public validation call — the contract and the
  validator must be extended together.
* The representative fixtures remain a sample, not a universal equivalence
  proof; the universal part is the keyword inventory plus the fail-closed
  behaviour.
