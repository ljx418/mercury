# GC-B6H-R Commands And Exits

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
Date: 2026-10-26

Every command of this batch, with its exit code. No command in this list
started Chrome, opened a visible window, read a Cookie, injected a Cookie,
started a Runtime media task, called a Provider, downloaded media, imported
media, ran a real BVID, performed a blind review, produced a sentinel or
consumed a VISIBLE authorization.

The ONLY external processes of this batch were the offline test runners:
the Node test runner, the Python test runner and the child processes that
the offline cases spawn (the REAL runner driven by the fault seam, the
sequencer driven by a stub, and the publisher). Every one of them stopped
before its first external action.

## 1. The new focused Node suite (R1, R2, R3, R4, R5)

```text
$ cd scripts/stage_b_b5_3
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO \
      node --test --test-concurrency=1 test/b6hr_offline_corrective.node-test.mjs
# tests 31
# pass 31
# fail 0
exit 0
```

## 2. The GC-B6H suite, updated for the recomputed public evidence (H1, H2, H4, H6)

```text
$ cd scripts/stage_b_b5_3
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO \
      node --test --test-concurrency=1 \
        test/b6h_offline_correction.node-test.mjs \
        test/b6hr_offline_corrective.node-test.mjs
# tests 56
# pass 56
# fail 0
exit 0
```

## 3. The new focused Python suite (H4, H5, R6)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/test_v3_gc_b6h_quality_diagnostics.py -q
6 passed in 2.11s
exit 0
```

## 4. The FULL Runtime suite (the production Python changed)

```text
$ cd services/local-runtime
$ .venv/bin/python -m pytest tests/ -q
1330 passed, 3 skipped, 55 warnings in 871.82s (0:14:31)
exit 0
```

## 5. The COMPLETE Stage B offline suite (once, on the final state)

```text
$ cd <repo-root>
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO -u NAVIA_B6_EXECUTION_CLOSURE \
      -u NAVIA_B6_REQUIRE_SNAPSHOT -u NAVIA_B6_SNAPSHOT_ROOT \
      node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 685
# pass 685
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The environment MUST be clean: an inherited `NAVIA_B6_PRIVATE_ROOT` makes
the sequencer demand six closed captures, an inherited
`NAVIA_B6_REQUIRE_SNAPSHOT` makes every runner demand a sealed snapshot and
an inherited `NAVIA_B6_SNAPSHOT_ROOT` would point the runners at a stale
snapshot. Those are properties of the harness, not of this correction.

## 5b. The candidate preparation entrypoint (a local, zero-action check)

```text
$ node scripts/stage_b_b5_3/prepare_candidate.mjs \
    --run-id=b6hr-prep-check --private-root=<an owned temporary root> \
    --evidence-root=<the same root>/evidence --prepare-only
{
  "prepared": true,
  "runId": "b6hr-prep-check",
  "fileCount": 499,
  "toolIdentities": {
    "node": "v22.22.1",
    "python": "Python 3.12.3",
    "platform": "linux-x64",
    "playwright": "1.60.0",
    "extensionDependencyTreeSha256": "d7dec48483cf0343fca249b34ad996206fb388ee6c878889aea73b6d845c2eba",
    "extensionDependencyCount": 18,
    "runtimeDependencyTreeSha256": "7440cde1bc6a09907e3cecca9c1bddac3a9451e2e49d159cb506b6d98507a72d",
    "runtimeDependencyCount": 69
  }
}
exit 0
```

The preparation is a PURE local operation: it reads the working tree, copies
the executed bytes into the exclusive snapshot, verifies them and writes the
manifest and the candidate lock. It starts no Chrome, no Runtime and no
Provider, and it consumes no authorization. The check root was removed by
its exact path afterwards.

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

The relay baseline and mutation suites were therefore NOT re-run: the frozen
scope did not change. The relay v11 gate case is green inside the run of §5.

## 7. The whitespace gate

```text
$ git diff --check
exit 0
```

## 8. The secret / path / raw-media scan

```text
$ node <the production detectors over the twenty changed files and the payloads>
evidence secret hits: 0
evidence absolute path hits: 0
evidence raw media payload hits: 0
changed secret hits: 0
changed absolute path hits: 14
changed raw media payload hits: 0

The 14 path shapes in the CHANGED files are the SECRET DETECTOR's own
pattern prefixes, the harness's relative-path suffix filter, the console
log marker of a Chrome launch, the default temporary-directory root of the
preparation, the synthetic private paths of the refusal cases and the tail
of the frozen schema version: the frozen vocabulary and the deliberate
refusal inputs, never a private path. They are itemised in
`05-privacy-scan.json`.
```

The remaining path shapes in the CHANGED files are the SECRET DETECTOR's own
pattern literals and the schema and route-class literals: they are the frozen
vocabulary, not a private path. The itemised result is in
`05-privacy-scan.json`.

## 9. The cleanup audit and the zero-action receipt

See `07-zero-action-and-cleanup-audit.md`.

## 10. The payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6hr-offline-corrective-2026-10-26
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-status-and-scope.md: OK
01-implementation-map.md: OK
02-commands-and-exits.md: OK
03-mutation-receipts.md: OK
04-changed-files-and-contract.md: OK
05-privacy-scan.json: OK
06-risks-and-next-decision.md: OK
07-zero-action-and-cleanup-audit.md: OK
exit 0
```
