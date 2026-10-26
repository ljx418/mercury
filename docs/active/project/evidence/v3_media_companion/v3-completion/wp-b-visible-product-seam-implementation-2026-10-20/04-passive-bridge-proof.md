# The bridge is passive and E2E-only

## The Extension bridge

| claim | the proof |
|---|---|
| it exists | `localImportDiagnostics.ts` exports the recorder and the installer; the Side Panel installs it under `if (!__NAVIA_E2E_BRIDGE__) return;` |
| it is E2E-only | the installation is behind the compile-time `__NAVIA_E2E_BRIDGE__` gate; a production build has no `__naviaE2ELocalImportDiagnostics` global at all |
| it is passive | the recorder uses no `fetch`, no `XMLHttpRequest`, no `chrome.storage`, no `chrome.runtime`, no client, no manager, no `document` and no `window`. The offline test scans for each of them. |
| it is read-only | the installed global has exactly one key, `snapshot`. The offline test asserts the key set. |
| it cannot carry a secret | the snapshot TYPE declares no bearer, cookie, token, file, path, raw-media, frame-byte or transcript field. The offline test scans the TYPE with a word-boundary pattern. |
| it cannot act on the product | the recorder's methods only remember values the product already produced. It never calls an owner. |

## The Runtime observation channel

| claim | the proof |
|---|---|
| it is E2E-only | `observations.enabled()` is true only for `NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS=1`, which the owned E2E Runtime sets. |
| it is absent by default | the route answers **404** when the channel is off. |
| it authenticates | the route uses the same exact-origin, live-companion-session authentication as every other media route. |
| it is read-only | it is a `GET`, and the offline test scans the route body for `create_import(`, `begin_stream(`, `.cancel(`, `materialize_visual(`, `.materialize(` and `bind_local_import(`. |
| it reports only numbers | the snapshot carries the writer-slice maximum, the cleanup count and two residue counts. |

## The frozen public surface

The public API, the three schemas, the 18-code set, the thresholds, the
B01–B30 denominator, the T1–T4 order and the Origin/auth order are all
**unchanged**. The new channel lives entirely outside them.
