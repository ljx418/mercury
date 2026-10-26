# The six-identity preflight receipt (O10)

The machine-readable receipt is `preflight/preflight-receipt.json`; the
sequencer summary is `preflight/sequencer-summary.json`.

## Command

```
node scripts/stage_b_b5_3/sequencer.mjs \
  --preflight-only=1 \
  --run-id=gc-b5r-offline-preflight-2026-10-23 \
  --evidence-root=docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/preflight
```

Exit: **0**.

## The action counters — every one is zero

| Counter | Value |
|---|---:|
| `chromeLaunchCount` | **0** |
| `visibleWindowCount` | **0** |
| `runtimeStartCount` | **0** |
| `providerCallCount` | **0** |
| `downloadCount` | **0** |
| `importCount` | **0** |
| `artifactGenerationCount` | **0** |
| `cookieInjectionCount` | **0** |
| `audioOutputCount` | **0** |
| `tabCaptureCount` | **0** |
| `focusEventCount` | **0** |

`attempted: false`, `providerCalls: 0`, `chromeLaunches: 0`, `downloads: 0`,
`imports: 0`, `artifactsGenerated: 0`.

## The six inspected source identities

The frozen registry digest was verified before the inspection:
`registrySha256 = 25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439`.

| Order | BVID | Local asset configured | Local asset available | Disposition | Passed |
|---:|---|---|---|---|---|
| 1 | `BV1pohR6rEEh` | false | false | `preflight_only` | **false** |
| 2 | `BV1hMpE6FEXG` | false | false | `preflight_only` | **false** |
| 3 | `BV1VHHe6kEH3` | false | false | `preflight_only` | **false** |
| 4 | `BV1SDHy6aEiB` | false | false | `preflight_only` | **false** |
| 5 | `BV1vSHD6tEsM` | false | false | `preflight_only` | **false** |
| 6 | `BV1FCps68EGf` | false | false | `preflight_only` | **false** |

`anySourcePassed: false`.

**No BVID passed here.** A preflight inspects the declared configuration and
the public availability of an explicitly configured local asset. It attempts no
source, calls no Provider, downloads nothing, imports nothing and generates no
artifact. No local-asset manifest was configured for this run, so all six
sources are "not configured" — that is a statement about the configuration,
not a result.

## What the preflight did not do

* it did not start Chrome (count 0) and opened no visible window (count 0);
* it did not start the Runtime media work (count 0);
* it did not call a Provider (count 0);
* it did not download or import media (counts 0);
* it did not generate a derivative or any other artifact (count 0);
* it did not inject a cookie (count 0), did not enable tabCapture (count 0)
  and produced no audio (count 0);
* it created **no** `bvid-<order>-<bvid>/` directory: a real run creates one
  per BVID, and the preflight creates none;
* the sequencer summary is `mode: "preflight-only"` with an empty `bvids` list.
