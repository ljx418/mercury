# GC-B6H Commands And Exits

Every command of this batch, with its exit code. No command in this list
started Chrome, read a Cookie, called a Provider, downloaded media, ran a real
BVID, opened a visible window, created a media task, performed a blind
review, produced a sentinel or consumed an authorization.

## 1. The new focused Node suite (H1, H2, H3, H4, H6)

```text
$ cd scripts/stage_b_b5_3
$ node --test test/b6h_offline_correction.node-test.mjs
# tests 25
# pass 25
# fail 0
exit 0
```

## 2. The new focused Python suite (H4, H5)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/test_v3_gc_b6h_quality_diagnostics.py -q
5 passed in 1.68s
exit 0
```

## 3. The existing B6 aggregate / capture / runner suites

```text
$ cd scripts/stage_b_b5_3
$ node --test test/b6_aggregate.node-test.mjs \
           test/b6_review_bundle.node-test.mjs \
           test/b6_thumbnail_seek.node-test.mjs \
           test/b6_lifecycle.node-test.mjs \
           test/b6c_order2_canary.node-test.mjs \
           test/b6d_balance_diagnostic.node-test.mjs \
           test/b6f_candidate_diagnostic.node-test.mjs \
           test/b6h_offline_correction.node-test.mjs
# tests 143
# pass 143
# fail 0
exit 0
```

## 4. The FULL Runtime suite (the production Python changed)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/ -q
1329 passed, 3 skipped, 55 warnings in 900.59s (0:15:00)
exit 0
```

## 5. The COMPLETE Stage B offline suite (once)

```text
$ cd <repo-root>
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO -u NAVIA_B6_EXECUTION_CLOSURE \
      node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 654
# pass 654
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The environment MUST be clean: an inherited `NAVIA_B6_PRIVATE_ROOT` makes
the sequencer demand six closed captures, and the offline cases (which run
no capture) would then fail. That is a property of the harness, not of this
correction.

## 6. The relay v11 scope (byte-hash proof; the scope did not change)

This batch wrote NOTHING under `apps/chrome-extension/`. The relay v11 scope
digests are byte-identical to the ones recorded by the GC-B6B batch:

```text
e75a1efa4eb51cfa  apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts
18d0b5361cb84a2c  apps/chrome-extension/src/modules/media_companion/capture/contracts.ts
dc20b041647b6fcf  apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts
d7d0ed7db90d12a4  apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageRouter.ts
5a2317a96d24f257  apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureMessageClient.ts
```

The relay v11 gate case is green inside the run of §5. The relay baseline
and mutation suites were therefore NOT re-run: the frozen scope did not
change.

## 7. The whitespace gate

```text
$ git diff --check
exit 0
```

## 8. The secret / path / raw-media scan

```text
$ node <the production detectors over the fourteen changed files>
secret hits: 0 (after the two deliberate fixtures were reshaped)
absolute path hits: 0 in the twelve new and changed acceptance files
raw media payload hits: 0
```

The remaining path shapes are the SECRET DETECTOR's own pattern literals
and the schema version and route-class literals in the runner and the
quality module: they are the frozen vocabulary, not a private path. The
itemised result is in `04-secret-path-raw-media-scan.json`.

## 9. The cleanup audit and the zero-action receipt

See `03-zero-action-and-cleanup-audit.md`.

## 10. The payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6h-offline-candidate-2026-10-26
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-implementation-map.md: OK
02-commands-and-exits.md: OK
03-zero-action-and-cleanup-audit.md: OK
04-secret-path-raw-media-scan.json: OK
05-closure-protocol-and-retention.json: OK
06-risks-and-next-decision.md: OK
exit 0
```
