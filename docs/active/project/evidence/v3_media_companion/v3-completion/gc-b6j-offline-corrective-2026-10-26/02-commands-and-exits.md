# GC-B6J Commands And Exits

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26

Every command of this batch, with its exit code. No command in this list
started Chrome, opened a visible window, read a Cookie, injected a Cookie,
started a Runtime media task, called a Provider, downloaded media, imported
media, ran a real BVID, performed a blind review, produced a sentinel or
consumed an authorization.

## 1. The new focused Node suite (J1, J2, J3, J4, J5)

```text
$ cd scripts/stage_b_b5_3
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO \
      node --test --test-concurrency=1 test/b6j_dependency_parity.node-test.mjs
# tests 15
# pass 15
# fail 0
exit 0
```

## 2. Every affected B6, candidate and public-evidence suite

```text
$ cd scripts/stage_b_b5_3
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO \
      node --test --test-concurrency=1 \
        test/b6j_dependency_parity.node-test.mjs \
        test/b6h_offline_correction.node-test.mjs \
        test/b6hr_offline_corrective.node-test.mjs \
        test/b6_aggregate.node-test.mjs \
        test/b6_review_bundle.node-test.mjs \
        test/b6_capture_filesystem.node-test.mjs \
        test/b6_mutation_process.node-test.mjs \
        test/b6_runner_capture_gate.node-test.mjs \
        test/b6_thumbnail_seek.node-test.mjs \
        test/b6_seek_closure.node-test.mjs \
        test/b6_blind_projection.node-test.mjs \
        test/b6_lifecycle.node-test.mjs \
        test/sequencer.node-test.mjs \
        test/runner_failure_evidence.node-test.mjs \
        test/runner_static_check.node-test.mjs \
        test/structured_failure_evidence.node-test.mjs \
        test/provider_attempt_accounting.node-test.mjs \
        test/production_preflight.node-test.mjs \
        test/gc_b5r_preflight.node-test.mjs \
        test/audit_finalizer.node-test.mjs \
        test/aggregate_identity.node-test.mjs \
        test/action_ledger.node-test.mjs
# tests 411
# pass 411
# fail 0
exit 0
```

## 3. The COMPLETE Stage B offline suite (once, on the final state)

```text
$ cd <repo-root>
$ env -u NAVIA_B6_PRIVATE_ROOT -u NAVIA_B5_AUTHORIZATION_ID \
      -u NAVIA_B5_STAGE_ROOT -u NAVIA_BILIBILI_COOKIE_FILE \
      -u NAVIA_CHROME_MUTE_AUDIO -u NAVIA_B6_EXECUTION_CLOSURE \
      -u NAVIA_B6_REQUIRE_SNAPSHOT -u NAVIA_B6_SNAPSHOT_ROOT \
      -u NAVIA_B6_CANDIDATE_DEPENDENCIES \
      node scripts/stage_b_b5_3/test/run_offline_suite.mjs
# tests 703
# pass 703
# fail 0
OFFLINE SUITE PASSED
exit 0
```

The environment MUST be clean: an inherited `NAVIA_B6_PRIVATE_ROOT` makes
the sequencer demand six closed captures, an inherited
`NAVIA_B6_REQUIRE_SNAPSHOT` makes every runner demand a sealed snapshot, an
inherited `NAVIA_B6_SNAPSHOT_ROOT` would point the runners at a stale
snapshot and an inherited `NAVIA_B6_CANDIDATE_DEPENDENCIES` would point them
at a stale dependency object. Those are properties of the harness, not of
this correction.

## 4. The candidate preparation from a fresh mode-0700 root

```text
$ rm -rf <a fresh temporary root> && mkdir -p <it> && chmod 700 <it>
$ node scripts/stage_b_b5_3/prepare_candidate.mjs \
    --run-id=b6j-prep-check --private-root=<it> \
    --evidence-root=<it>/evidence --prepare-only
{
  "prepared": true,
  "runId": "b6j-prep-check",
  "fileCount": 501,
  "toolIdentities": {
    "node": "v22.22.1",
    "python": "Python 3.12.3",
    "platform": "linux-x64",
    "playwright": "1.60.0",
    "extensionDependencyTreeSha256": "f7ae8e84979eaf516be3727a51eaebd25c3c851671273f84007579813a503d7a",
    "extensionDependencyCount": 169,
    "runtimeDependencyTreeSha256": "f05b60c321912e1d778b4b4cf66f33799aed7951f36732791ed1638c062f99df",
    "runtimeDependencyCount": 8166
  },
  "dependencyIdentities": {
    "managedTools": { "kind": "managedTools", "present": true, "fileCount": 3, "treeSha256": "c5e0e8a6865fc362abce6e9ea20a75fa5e76f89ea18ba5cbd79c3bb3fae81b24" },
    "asrRoot": { "kind": "asrRoot", "present": true, "fileCount": 4, "treeSha256": "ad4ba21c83c407f7509168c0933cb86a70e0136a3e2bf20741015901b865cf38" },
    "visionProviderSourceDb": { "kind": "visionProviderSourceDb", "present": true, "providerMetadataSha256": "6fc2eb7943ad54e11b25e698911bc84a281869d6ae622be85f21c82e42fae6e7" },
    "extensionRoot": { "kind": "extensionRoot", "present": true, "fileCount": 99, "treeSha256": "d2479a54156a9957eb2f36527f2f725bcb5253b18068e3d3833b42ae52e5ece7" }
  }
}
exit 0
```

The tool identities are byte-identical to the ones the GC-B6H-R Codex
checkpoint recorded, so the sealed execution trees did not drift. The
preparation is a PURE local operation: it reads the working tree, copies the
executed bytes into the exclusive snapshot, resolves the product dependency
inputs, writes the PRIVATE dependency object and the PUBLIC lock and it
performs no external action. The public lock carries NO absolute path and
never names the database; the private object carries the resolved paths with
mode 0600. The check root was removed by its exact path afterwards.

## 5. The production Python

NOT CHANGED by this batch: no file under `services/local-runtime/` was
touched. The Runtime full pytest was therefore NOT repeated, as the
verification plan requires.

## 6. The relay scope (byte-hash proof; the scope did not change)

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
scope did not change. The relay v11 gate case is green inside the run of §3.

## 7. The whitespace gate

```text
$ git diff --check
exit 0
```

## 8. The secret / path / raw-media scan

```text
$ node <the production detectors over the thirteen changed files and the payloads>
evidence secret hits: 0
evidence absolute path hits: 0
evidence raw media payload hits: 0
changed secret hits: 0
changed absolute path hits: 18
changed raw media payload hits: 0
```

The path shapes in the CHANGED files are the SECRET DETECTOR's own pattern
prefixes, the harness relative-path suffix filter, the PRODUCT's frozen
cookie fallback, the default private root of the preparation, the frozen
preflight paths and the SYNTHETIC refusal inputs of the new cases: the
frozen vocabulary and the deliberate refusal inputs, never a private path.
They are itemised in `05-privacy-scan.json`.

## 9. The cleanup audit and the zero-action receipt

See `07-zero-action-and-cleanup-audit.md`.

## 10. The payload manifest (generated LAST)

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6j-offline-corrective-2026-10-26
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
