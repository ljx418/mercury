# The production composition and the fresh-process restart receipts

The machine-readable receipts are `corrective-receipts.json`; the collector is
`collect-corrective-receipts.py`. The collector drives the production owners
and replaces only the dependency probes (the filesystem seams a verified
snapshot needs) and the synthesis Provider (the network edge).

## 1. The public app composition

`navia_runtime/app.py` composes the ONE input authority in the composition
root, from the REAL owners:

```python
media_input_authority = MediaInputAuthority(
    task_store=media_outline_task_store,
    local_import_store=local_media_import_store,
    coordinator=media_acquisition_coordinator,
    generation_resolver=_current_media_dependency_generation,
)

media_comprehension_service = MediaComprehensionService(
    media_outline_task_store,
    default_media_task_root() / "product-evidence",
    synthesis_provider_factory=create_grounded_media_synthesis_provider,
    input_authority=media_input_authority,
)
```

The resolver is the manager's own seam:

```python
def _current_media_dependency_generation(task_id: str) -> str | None:
    snapshot = media_dependency_manager.leased_snapshot(task_id)
    if snapshot is None:
        snapshot = media_dependency_manager.acquire_snapshot(task_id)
    generation = getattr(snapshot, "generation", None)
    return generation if isinstance(generation, str) and generation else None
```

| Observed | Value |
|---|---|
| the authority's type | `MediaInputAuthority` |
| the authority's task store IS the app's task store | **true** |
| the authority's local-import store IS the app's local-import store | **true** |
| the authority's coordinator IS the app's acquisition coordinator | **true** |
| the app's comprehension service USES that authority | **true** |
| the local-import store and the task store share ONE Runtime database | **true** |
| the generation seam is manager-owned (not a global map) | **true** |
| the process-global lease mirror | **`{}` (empty)** |

## 2. A fresh process, the SAME verified generation — accepted

| Observed | Value |
|---|---|
| the current verified generation | `depgen_edc19bc76c47d43a5630256d1069d5672663cffc1ba331a8c55d56b93f1a872c` |
| the fresh manager held a lease BEFORE the check | **false** (a fresh process holds nothing) |
| the decision | **accepted** |
| Provider calls | 1 |
| Provider factory invocations | **1** |
| published artifacts | 1 |
| the published artifact's SHA-256 | `39461a7fb51af0ffc76de248af0b602d88a7a73eb35d1fdc05ce522f08b7c03b` |

A fresh manager re-verifies the managed content, reaches the same generation
and the durable local binding is accepted.

## 3. A changed generation — refused before the Provider

| Observed | Value |
|---|---|
| the current verified generation | `depgen_edc19bc76c47d43a5630256d1069d5672663cffc1ba331a8c55d56b93f1a872c` |
| the asset's generation | `depgen_aaaa…aaaa` (another run) |
| the decision | **refused** |
| the failure code | **`V3_MEDIA_CROSS_TASK_REUSE`** (an existing frozen code) |
| Provider calls | **0** |
| Provider factory invocations | **0** |
| published artifacts | **0** |

## 4. An unverifiable current generation — refused before the Provider

| Observed | Value |
|---|---|
| the decision | **refused** |
| the failure code | **`V3_MEDIA_DEPENDENCY_NOT_READY`** (an existing frozen code) |
| Provider calls | **0** |
| Provider factory invocations | **0** |
| published artifacts | **0** |

The comparison is never skipped: a missing, unready or unverifiable current
generation is a refusal, never an open door.

## 5. What the receipts do NOT claim

* They do not claim a real BVID run. The receipts are produced from synthetic
  evidence over the production owners; no real media, no real Provider, no
  Chrome and no network were involved.
* They do not claim the ready generation is the production one: the frozen
  dependency catalog pins the real generation, and the test probes stand in
  for the frozen tool assets a unit test must not fabricate.
* They do not replace the Codex refreeze. The relay v11 evidence still records
  the pre-corrective `app.py` digest; the drift is reported in
  `05-relay-source-drift-report.md` and the refreeze is Codex's.
