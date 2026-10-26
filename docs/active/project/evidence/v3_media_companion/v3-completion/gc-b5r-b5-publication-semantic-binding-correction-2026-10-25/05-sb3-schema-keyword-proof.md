# SB3 — the schema keyword handling is fail-closed

Oracles: `scripts/stage_b_b5_3/test/schema_keywords.node-test.mjs` (11
cases) and the extended Python equivalence test
`services/local-runtime/tests/test_v3_gc_b5r_v21_artifact_validator_equivalence.py`
(22 cases).

## The defect that was closed

The validator comment said "an unknown JSON Schema keyword is a hard error",
but the implementation had no keyword-inventory check: `not`, `minProperties`
and `exclusiveMinimum` were silently IGNORED, so a value that the keyword
would have rejected was ACCEPTED.

The current frozen schema happens to use the implemented subset, so the
existing fixtures stayed valid — but the claimed fail-closed
contract-drift behaviour did not exist.

## The structural keyword inventory

`scripts/stage_b_b5_3/lib/v21_artifact.mjs` now inventories the schema
BEFORE it is cached or used:

```js
export function inventorySchemaKeywords(schema)   // the STRUCTURAL inventory
export function assertSchemaKeywordSupport(schema)  // THROWS on an unsupported keyword
export function frozenV21Schema() {
  if (!frozenSchema) {
    const loaded = JSON.parse(fs.readFileSync(V21_SCHEMA_PATH, "utf8"));
    assertSchemaKeywordSupport(loaded);   // ← BEFORE the cache
    frozenSchema = loaded;
  }
  return frozenSchema;
}
```

The inventory is STRUCTURAL: the keys of a schema node are KEYWORDS, and
the NAMES under `properties` and `$defs` are names, not keywords. The
walker descends into the single-schema keywords (`items`,
`additionalProperties`, `not`, `if`, `then`, `else`, `contains`,
`propertyNames`, `unevaluatedItems`, `unevaluatedProperties`), the list
keywords (`allOf`, `anyOf`, `oneOf`, `prefixItems`) and the map keywords
(`properties`, `$defs`, `patternProperties`, `dependentSchemas`).

Three explicit vocabularies:

```js
SUPPORTED_SCHEMA_KEYWORDS    // the assertions and applicators this validator implements
ALLOWED_ANNOTATION_KEYWORDS  // $schema, $id, $comment, title, description, default,
                              // examples, deprecated, readOnly, writeOnly — no assertion
```

Every keyword outside those two sets THROWS:
`the schema uses the unsupported keyword(s): …`.

## The negatives

| the case | the placement | the result |
|---|---|---|
| `SB3: an unsupported keyword at the ROOT throws` | `not` | throws |
| `SB3: an unsupported keyword in a $defs schema throws` | `minProperties` | throws |
| `SB3: an unsupported keyword in an items schema throws` | `exclusiveMinimum` | throws |
| `SB3: an unsupported keyword in a property schema throws` | `multipleOf` | throws |
| `SB3: an unsupported keyword in an if, then or else schema throws` | `contains`, `propertyNames`, `dependentRequired` | throws |
| `SB3: the unsupported keywords are never silently ignored` | the three keywords of the Codex reproduction | throws |
| `SB3: the annotation keywords are allowed and asserted by nothing` | the annotation set | no throw |
| `SB3: the supported keyword subset still validates values` | the minimal schema | the values are still validated |

## The keyword inventory of the ACTUAL frozen contract

The frozen file uses exactly these 23 keywords, and every one of them is
supported or allowed:

```text
$id  $ref  $schema  additionalProperties  allOf  const  enum  if  items
maxItems  maxLength  maximum  minItems  minLength  minimum  pattern
required  then  title  type  uniqueItems
```

The Python test asserts the SAME inventory from the Python side
(`_python_keyword_inventory`), keyword by keyword, so the two sides cannot
drift apart silently.

## The equivalence claim is now SCOPED

The previous evidence described the 22-fixture comparison as a universal
equivalence proof. It is not one, and the batch no longer claims it:

* the STRUCTURAL guarantee is the keyword inventory plus the fail-closed
  behaviour: the shared validator implements exactly the keywords the frozen
  contract uses and refuses everything else;
* the REPRESENTATIVE fixtures show that the shared validator and the
  production `jsonschema` library return the SAME verdict on a set of
  accept/reject samples.

The Python test's own docstring now says exactly that.

## The canonical receipt serialization, proven BYTE BY BYTE

The canonical serialization claim is now scoped to the LEGAL FROZEN RECEIPT
DOMAIN and proven against the production layout:

```python
json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
```

The new Python case compares the BYTES of both implementations over every
legal receipt field type and representative Unicode strings:

| the fixture | what it covers |
|---|---|
| `ascii` | the plain frozen receipt |
| `unicode-model` | a CJK + emoji model id |
| `unicode-provider` | a Latin-1 diacritic string |
| `combining` | a COMBINING character sequence |
| `rtl` | a right-to-left string |
| `cjk` | a CJK string |
| `emoji` | a NON-BMP emoji (a surrogate pair) |
| `zero-upload` | the zero counters and the minimum request count |
| `max-request` | the maximum request count and latency |
| `nesting` | nested objects, arrays and booleans |

The claim holds for the legal receipt domain: the strings the frozen pattern
allows, the integers, and the structure of the receipt. A LONE SURROGATE is
outside the legal domain (the frozen patterns forbid it) and is not claimed.

## The honest limits

* The shared validator implements the keyword subset of the frozen contract.
  A future revision of the frozen contract that introduces a new keyword is
  a HARD FAILURE (the validator throws before it is used) — which is the
  intended fail-closed behaviour, and it means the contract revision and
  the validator must be extended together.
* The representative fixtures are a sample, not a universal proof. The
  universal part is the keyword inventory plus the fail-closed behaviour.
