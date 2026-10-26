# The relay v11 source-drift report

The corrective goal authorizes the change of
`services/local-runtime/navia_runtime/app.py` for the production composition.
That file is a **relay v11 source scope**, so its SHA-256 is recorded in the
frozen evidence
(`docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`).

**Nothing was refrozen.** The verifier, the fixtures, the inventories, the
schemas and the registry are unmodified. The drift is reported here, once,
with the semantic inventories extracted from the CURRENT sources.

## 1. The canonical baseline (one run, after the candidate stabilized)

```
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py
```

| | |
|---|---|
| exit | **2** |
| summary | **46 / 50** |
| failed checks | `sourceEvidenceHashesCurrent`, `sourceScopeExtractorsValid`, `sourceEmitSetEqualsFrozenInventory`, `discoveredCodeUniverseClosed` |
| `sourceInventoryDiff` | actual 39, frozen 40, missing `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` |
| `targetInventoryDiff` | **actual 20, frozen 20, missing none, extra none** |
| `unlistedBoundaryEmits` | **`{}`** |
| `targetScopeUnexpectedCodes` | **`{}`** |
| `schemaErrors` | `[]` |

The four failed checks are one cause: the verifier compares each listed file
against its frozen digest and **skips a file whose hash drifted**, so the
skipped `app.py` no longer contributes the codes it emits. The cascade is
visible in the diff (`39` instead of `40`).

The other **46** checks pass, including `limitsRemainBounded` (the frozen
thresholds), `noPublicApiExpansion` (the frozen public-API declaration),
`targetInventoryExact20`, `unlistedSourceFilesEmitNoBoundaryCodes` and
`schemaMetaValid`.

## 2. The semantic inventory, extracted from the CURRENT sources

The question the verifier cannot answer after an authorized source change is:
**what do the current sources actually emit?**

`analyze-relay-v11-semantic-inventory.py` answers it by loading the
verifier's OWN `python_codes` / `typescript_codes` helpers (read-only) and
running them over the CURRENT files, then applying the verifier's own
comparison rules (the target scope contributes to the source inventory only the
codes the frozen source inventory declares; the discovery-root scan covers the
unlisted files).

```
python3 docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-corrective-2026-10-23/analyze-relay-v11-semantic-inventory.py
```

| Inventory | Frozen | Actual | Missing | Extra | Exact |
|---|---:|---:|---|---|---|
| source | 40 | **40** | none | none | **true** |
| target | 20 | **20** | none | none | **true** |
| code universe (source ∪ target ∪ non-relay allowlist) | 59 | **59** | none | none | **true** |

* `unlistedBoundaryEmits`: **`{}`**
* drifted source scopes: **`services/local-runtime/navia_runtime/app.py`** —
  and only that one.
* every extractor reported valid for every scope.

The raw result is `relay/relay-v11-semantic-inventory.json`.

## 3. The acceptable pending state, item by item

| The corrective goal's condition | Observed | Met |
|---|---|---|
| only authorized source hash/scope drift | exactly one drifted scope: `app.py`, the authorized composition | **yes** |
| the target inventory remains 20/20 | 20/20 | **yes** |
| the semantic source inventory remains 40/40 when extracted from the current sources | 40/40 | **yes** |
| `unlistedBoundaryEmits` remains `{}` | `{}` | **yes** |
| no code, threshold, message or public-contract drift | the 46 other checks pass, including `limitsRemainBounded` and `noPublicApiExpansion` | **yes** |

## 4. The mutations

```
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py
```

**Status: `not run: canonical baseline pending Codex refreeze`.**

The corrective goal requires the mutations to run only when the canonical
baseline is green. It is not green: the only failing checks are the
authorized `app.py` source-scope hash drift and its semantic cascade. The
mutation verifier refuses to run against a non-green baseline (it would
report `canonical_baseline_not_green`), so running it would produce a result
that says nothing about the mutations.

**The refreeze is Codex's.** This batch performed no refreeze: no fixture, no
inventory, no schema, no registry and no verifier code was edited, and no
digest was rewritten.
