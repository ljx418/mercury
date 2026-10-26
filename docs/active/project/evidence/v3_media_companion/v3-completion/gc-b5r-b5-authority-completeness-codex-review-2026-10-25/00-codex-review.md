# GC-B5R B-5 Authority Completeness Codex Review

Status: `GC-B5R B-5 PUBLICATION SEMANTIC BINDING CORRECTION NO-GO`

Date: 2026-10-25

## Accepted Closures

The correction materially closes the originally reported missing-field and
artifact-quality cases:

- all eleven listed machine identity fields are presence/type checked;
- artifact task id, revision and source identity comparisons no longer skip
  missing values;
- artifact quality is mapped through the shared production disposition rule;
- the frozen V2.1 schema is inventoried before it is cached;
- the submitted evidence manifest and all 58 recorded source hashes verify;
- focused Node tests pass 118/118, the Python equivalence tests pass 22/22,
  and the consolidated offline suite passes 404/404.

Those green tests do not cover the three independent reproductions below.
No Chrome, Cookie, Provider, Runtime media task, download, import, audio,
tabCapture, focus action, or visible-run authorization was used by this review.

## Major 1: Present Machine Fields Are Not Fully Bound To Authority

`machineIdentityDefects()` validates `taskNamespace` only as a non-empty
string. The sequencer records only whether `task_namespace.json` exists; it
does not parse that file or cross-bind its namespace, BVID, order and run id
to the machine receipt and frozen row.

The source identity parser accepts any syntactically valid adapter. The
validator checks only its BVID component, so
`portal:attacker:<frozen-bvid>:cid:p1` passes even though the frozen adapter is
`bilibili`.

Timestamp validation is regex-only. Calendar-invalid strings such as
`2026-99-99T99:99:99Z` match the regex; `Date.parse()` yields `NaN`, and the
ordering comparison is false rather than a defect.

Independent production-validator reproduction:

```json
{"identityDefects":[]}
```

for a receipt carrying an arbitrary non-empty namespace, the attacker adapter,
and calendar-invalid start/finish timestamps.

Required correction:

- require the source portal and adapter to equal the frozen row's literal
  authority (`portal` / `bilibili`), not merely parse;
- validate the namespace against its frozen shape;
- parse `task_namespace.json` and require exact equality of namespace, run id,
  order and BVID with the machine receipt and registry row;
- require finite, valid UTC instants and finish >= start;
- add direct and real-sequencer negatives for foreign adapter, malformed and
  cross-row namespace, malformed namespace receipt, and invalid timestamps.

## Major 2: Machine Disposition Remains Optional

The aggregate compares machine disposition only inside:

```js
if (receipt?.disposition !== undefined && receipt?.disposition !== null) {
  // compare
}
```

Deleting `disposition` from all six otherwise valid contract-shaped machine
receipts therefore disables that fact comparison. With exact artifact bytes,
mirrors and ledger totals, production `evaluateAggregate()` returned:

```json
{"missingDispositionPositive":true,"failures":[]}
```

This contradicts the stated four-way agreement among parsed disposition,
machine disposition, artifact quality and publication state.

Required correction:

- make `disposition` a required, typed terminal machine field;
- validate its frozen enum and compare it unconditionally with the parsed
  final disposition;
- retain quality and publication rules already added;
- add pure and real-sequencer negatives for missing, null, wrong-type,
  unknown and mismatched machine disposition, with hashes recomputed where
  relevant.

## Major 3: The Public Schema Validation Entry Point Still Fails Open

`frozenV21Schema()` calls `assertSchemaKeywordSupport()`, but exported
`validateAgainstSchema()` does not. A caller can pass a schema containing an
unsupported constraint directly and it is silently ignored:

```json
{"schema":{"type":"object","not":{}},"value":{},"verdict":{"ok":true,"errors":[]}}
```

The current tests call the keyword assertion helper separately or go through
the frozen schema loader. They do not prove that the shared validation entry
point enforces its own documented fail-closed contract.

Required correction:

- make every exported schema-validation entry point perform keyword support
  validation itself, or make the unchecked recursive evaluator private;
- avoid repeated inventory work during recursion by separating checked public
  entry from private traversal;
- add direct tests that call the actual public validation API with unsupported
  keywords at root and nested positions and require a hard failure;
- retain the frozen-schema inventory and Python/JavaScript representative
  comparisons.

## Gate

Do not consume a visible-run authorization and do not rerun the six videos.
Complete only the bounded offline correction in `02-claudecode-goal.md`, then
return to Codex checkpoint.

