# WP-B visible product seam — implementation report

**State: `WP-B VISIBLE PRODUCT-SEAM IMPLEMENTED AWAITING CODEX DRY REVIEW`**

This workpack makes the one-shot B27/B29/B30 harness genuinely executable
through the REAL Side Panel and the PUBLIC Runtime routes, and adds only
passive, sanitized, E2E-gated observations. **No Chrome was launched, no
Runtime was started, no 100 MB / 1 GB asset was generated, no audio was played
and the single approved visible session was not consumed.**

---

## 1. The passive E2E diagnostics (VH1 / mandatory 1)

### The Extension side

`src/modules/media_companion/localImportDiagnostics.ts` is a new PASSIVE
recorder. It remembers what the normal product path already produced and
exposes ONE read-only snapshot. It never creates, uploads, cancels, polls,
binds, materializes or cleans anything.

| the snapshot provides | where it comes from |
|---|---|
| the import id, the task id, the source identity, the state and the sequence | the public create/status/cancel responses the client already receives |
| the XHR lifecycle: started, the REAL `upload.onprogress` samples, loaded / errored / aborted | the client's own XHR callbacks |
| the uploaded bytes and the exact final byte count | the same callbacks |
| the Runtime session generation and the identity/task the import belongs to | the client's `generation()` and the create body |
| the identity generation | incremented when the product resolves a DIFFERENT media identity |
| the server-observed maximum writer slice, the cleanup claim count and the source/sandbox residue counts | the Runtime's E2E-only observation channel |

The recorder holds **no** bearer, cookie, upload token, `File`, file name,
absolute path, raw media, frame bytes or transcript text. Its snapshot TYPE
declares no such field, and an offline test proves it.

The global is installed ONLY under the existing compile-time
`__NAVIA_E2E_BRIDGE__` gate, in the Side Panel document, and it exposes exactly
one key: `snapshot`. A production build installs nothing.

### The Runtime side

`local_import/observations.py` is a new E2E-ONLY, READ-ONLY observation
channel. It is enabled only by the explicit `NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS=1`
flag, which the owned E2E Runtime sets and nothing else does. It records the
maximum writer slice the SERVER observed, how many times the barrier claimed
the cleanup, and the owned residue counts.

`GET /v1/media/local-import-observations/{importId}` answers **404** when the
channel is off, so a production Runtime and a default startup have no such
surface at all. When it is on it authenticates the exact extension origin and
a live companion session, exactly like every other media route, and it only
reports NUMBERS. It calls no owner: the offline test scans the route body for
`create_import(`, `begin_stream(`, `.cancel(`, `materialize_visual(`,
`.materialize(` and `bind_local_import(`.

## 2. The deterministic real user-flow setup (mandatory 2)

`e2e/lib/v3WpBVisibleSession/driver.mjs` describes the flow the harness
drives, and every step is a VISIBLE product control:

| step | control |
|---|---|
| open an owned Bilibili-format tab | — |
| open the real Side Panel | — |
| authorize the policy | `[data-testid='media-consent-authorize']` |
| connect the Runtime | `[data-testid='local-runtime-connect']` |
| start the credential lease | `[data-testid='media-credential-start']` |
| reach the last-resort card | `[data-testid='local-media-import-card']` |

The last-resort eligibility is reached **honestly**: the automatic routes fail
on their own and the card appears. The driver never forces React state and
never calls `localImportEntryEligible` as setup.

The cookies and the target identities are **explicit environment inputs**,
validated in the preflight BEFORE Chrome: `NAVIA_WP_B_COOKIE_FILE`,
`NAVIA_WP_B_TARGET_B27`, `NAVIA_WP_B_TARGET_B27_SECOND`,
`NAVIA_WP_B_TARGET_B29` and `NAVIA_WP_B_TARGET_B30`. Every target must be an
http(s) URL on a Bilibili host. A missing input is an `EXTERNAL-INPUT BLOCK`
before anything is launched. Nothing is searched for on the Desktop, in another
repository or on a drive.

**Every case gets a fresh identity and a fresh browser context.** The identity
plan gives each case its own primary Bilibili identity, so a successful B29
product can never make B30 ineligible and one case's source authority can never
block another's. A new browser context is created per case and closed after it.

**B27's identity switch is a REAL one.** The owned TAB is navigated to a
SECOND Bilibili identity, so the product resolves a different media identity
and the card's identity generation changes. Changing the Side Panel hash is
explicitly not accepted: the driver contains no hash-only path, and the card
now reacts to a real identity change (a resolved identity is not a switch).

## 3. The real oracles (mandatory 3)

| case | the oracle |
|---|---|
| B27 | the abort is sampled **after** the identity transition; the real Runtime DELETE is observed; the public status converges to a cancelled terminal with an increasing sequence; no stale attachment and no storage/UI residue |
| B29/B30 | exactly one Extension PUT; non-empty, MULTIPLE, monotonic progress ending at the exact asset bytes; `ready` only; strict `outline_<32hex>` / `media_task_<32hex>` ids; a real `image/png` thumbnail fetched with the ACTUAL evidence id |
| B30 resources | the PEAK owned Runtime RSS delta and the PEAK Side Panel heap delta, sampled THROUGHOUT the upload and the processing. A before/after pair is refused, and a missing sample fails |
| B30 accessibility | a REAL keyboard traversal and activation, the focus order, visible/enabled/hit-testable controls, the live region and the scroll/layout stability at the real Side Panel viewport. A DOM count alone is refused |

**Nothing is hardcoded.** The cleanup count, the residue, the ids and the
evidence id all come from the observation; an offline test scans the
executors and fails on a literal.

## 4. The owned lifecycle (mandatory 4)

The Codex-corrected lifecycle and its tests are intact. This workpack only
ADDED to them:

* the preflight now also validates the target identities and the cookie file
  before Chrome;
* the extension is still loaded with the browser-level `Extensions.loadUnpacked`
  and its EXACT id is still what configures the owned Runtime;
* the real session and the dependency snapshot are still read from the owned
  Runtime;
* the generated assets are still independently requalified;
* the cases still run through the Side Panel and the public routes;
* the Chrome and Runtime process trees, the profile, the assets and the owned
  root are still cleaned in every failure path;
* one redacted stable receipt is still written AFTER the cleanup.

The Windows Chrome ownership patterns in
`e2e/lib/windowsExtensionInvocation.mjs` are the reference; the WSL proxy pid
is never trusted as the Windows Chrome pid.

## 5. The offline anti-false-green tests (mandatory 5)

`e2e/lib/v3WpBVisibleSession.node-test.mjs` grew from 35 to **49** tests. The
new ones fail when:

| the harness or the seam is wrong | the test |
|---|---|
| the diagnostics bridge is missing, or the diagnostics are available in a production build | the bridge exists and is installed only under the E2E gate |
| the bridge invokes an owner | the recorder uses no `fetch`, no XHR, no storage, no client and no manager |
| the snapshot could carry a credential, a file or raw content | the snapshot TYPE declares no such field |
| the Runtime channel is not E2E-only, not read-only or not absent by default | the flag, the 404 and the route body are scanned |
| the progress is empty, single or does not end at the exact bytes | B29 refuses each of them |
| a cancelled or failed terminal is accepted as success | B29 and B30 accept only `ready` |
| a cleanup count, a residue, an id or an evidence id is hardcoded | the executors are scanned for literals |
| the resources are a point-in-time pair | B30 demands at least four samples |
| the accessibility oracle is a DOM count | the oracle must hit-test, traverse the focus order and read the live region |
| the identity switch is a hash change | the driver must navigate the owned TAB and must not touch the hash |
| the cases share a context | a fresh context is created and closed per case |
| the requests are not recorded against the owned Runtime | the adapter records the Runtime-origin requests |
| the stable evidence is inside the owned root | the destination must be outside it |
| the flow calls an owner | the flow drives only the visible controls |

## 6. What was NOT done, on purpose

* No Chrome, visible or headless.
* No Runtime.
* No 100 MB / 1 GB asset.
* No Desktop cookie read, no provider key read, no private media read.
* No audio.
* No B27 / B29 / B30 run, and the single approved visible session is
  untouched.
* No frozen schema, 18-code set, threshold, B01–B30 denominator, T1–T4 order,
  Origin/auth order, asset registry, WP-A digest or historical evidence change.
* No relay v11 refreeze, and nothing committed, pushed, reset, cleaned, checked
  out or reverted.
