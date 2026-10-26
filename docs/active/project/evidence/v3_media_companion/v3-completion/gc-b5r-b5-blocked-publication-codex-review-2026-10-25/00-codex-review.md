# GC-B5R B-5 Blocked Publication Codex Review

Status: `GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION NO-GO`

Date: 2026-10-25

## Accepted Closures

AC1-AC3 close the three submitted reproductions:

- complete-row source authority, namespace receipt, timestamp validity and
  namespace shape are enforced;
- machine disposition is mandatory and compared with the parsed disposition;
- the ordinary public schema-validation path now checks its keyword inventory.

The evidence manifest verifies, and all 58 recorded source hashes and sizes
match the current worktree. Independent focused tests pass 132/132 and the
consolidated offline suite passes 438/438. These green tests do not cover the
two positive-candidate reproductions below.

No Chrome, Cookie, Provider, Runtime media task, download, import, audio,
tabCapture, focus action, or visible authorization was used.

## Major 1: The Positive Blocked Branch Accepts Foreign Identity And Publication

The aggregate runs `machineIdentityDefects()` and artifact integrity only
inside `disposition === "complete"`. A blocked row still carries a mandatory
machine receipt, but its source authority, task identity, dependency generation
and timestamps are not passed through that validator.

The positive blocked fixture also writes a real derivative file and a mirror
with `published: true` even though it declares `reachedSynthesis: false` and
zero synthesis attempts. Because publication/artifact checks are complete-only,
the aggregate ignores those contradictory files.

Independent reproduction used five valid complete rows plus one blocked row:

```json
{
  "positive": true,
  "failures": [],
  "blockedSourceIdentity": "portal:attacker:BV11t8w6oEtP:41828944992:p1",
  "blockedArtifactPresent": true,
  "blockedMirrorPublished": true
}
```

This conflicts with the frozen positive rule that a blocked source is a
pre-synthesis exception, while a V2.1 derivative and publication receipt belong
only to a successful task. It also makes the existing positive blocked test a
false-positive fixture.

Required correction:

- define explicit common identity/terminal authority required for every row;
- for a pre-task blocked row, allow absent task-bound fields only as one
  explicit all-absent state; if any task-bound field exists, require the full
  task identity and namespace binding;
- require blocked rows to have zero synthesis and Provider attempts and no
  publication, derivative bytes, published mirror, or artifact receipt;
- make the one-blocked positive fixture represent that truthful state rather
  than writing a successful derivative;
- reject foreign adapter, cross-run/registry/row identity, partial task
  identity, blocked artifact, blocked publication, and blocked nonzero ledger
  facts in pure and real-sequencer tests.

Do not solve this by requiring a fabricated task id or derivative from a source
that was blocked before task creation.

## Major 2: An Alternate Root Bypasses The Checked Schema Entry

`validateAgainstSchema()` inventories only its first `schema` argument, while
its exported options allow a different `root`. The private evaluator resolves
`$ref` against that root without inventorying it.

Independent reproduction:

```js
const root = { $defs: { X: { type: "object", not: {} } } };
const schema = { $ref: "#/$defs/X" };
validateAgainstSchema(schema, {}, { root });
```

Observed result:

```json
{"ok":true,"errors":[]}
```

The unsupported `not` constraint is therefore still reachable through an
exported public path.

Required correction:

- preferably remove the public root/path override because production callers
  do not use it; or validate the complete effective root and entry schema before
  resolving any reference;
- ensure every schema node reachable by `$ref` belongs to the checked schema
  graph;
- add the exact alternate-root reproduction plus nested/ref-chain variants to
  tests of the production public API;
- retain the current frozen-schema inventory and representative Python/JS
  comparisons.

## Gate

Do not consume a visible-run authorization and do not rerun the six videos.
Complete only the bounded offline correction in `02-claudecode-goal.md`, then
return to Codex checkpoint.

