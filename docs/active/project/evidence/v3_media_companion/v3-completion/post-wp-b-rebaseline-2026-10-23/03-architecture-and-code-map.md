# Architecture and code map

## Authority flow

```text
current portal identity + acquisition task
  -> ordered automatic acquisition routes (WP-A verified dependencies)
  -> explicit user-selected matching local media when automatic routes exhaust (WP-B)
  -> durable transcript/OCR/frame evidence under the same task/source authority
  -> one task-selected grounded synthesis Provider
  -> schema + semantic + evidence + temporal + authority validation
  -> atomic V2.1 derivative publication
  -> Chat/Workspace projections from the same task/revision/catalog
```

tabCapture is not in the GC-B5R critical path.

## Primary implementation locations

- `services/local-runtime/navia_runtime/modules/media_companion/comprehension/`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/`
- `services/local-runtime/navia_runtime/modules/media_companion/local_import/`
- `services/local-runtime/navia_runtime/modules/media_companion/product_materializer.py`
- `services/local-runtime/navia_runtime/app.py`
- `scripts/stage_b_b5_3/`
- `services/local-runtime/tests/test_v3_media_comprehension.py`
- current WP-A/WP-B production tests and composition tests

Extension composition is inspected, not automatically changed. If changed, use
the current `apps/chrome-extension/src/modules/media_companion/` production
client/card/router and its tests; do not create a second orchestration plane.

## Historical inputs

- `design/v3-5.10-media-experience-repair-plan.md`
- `v3-5.10-experience-repair/stage-b-grounded-comprehension-contract.md`
- `v3-5.10-experience-repair/stage-b-six-video-registry.json`
- `v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md`
- `v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md`
- `v3-completion/wp-b-final-acceptance-2026-10-21/`

Historical plans provide contracts and failure history. This package controls
today's scope, sequencing, runtime authorization, and status vocabulary.
