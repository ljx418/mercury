# ClaudeCode Goal: WP-B visible product seam and deterministic user-flow driver

You are implementing the next bounded WP-B workpack in `/mnt/c/workspace/navia`.
Do not perform the visible run. Stop at `WP-B VISIBLE PRODUCT-SEAM IMPLEMENTED
AWAITING CODEX DRY REVIEW`.

## Read first

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`, especially section 5.1
3. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-visible-session-codex-correction-2026-10-20/00-codex-correction-report.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`
5. `docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json`
6. `apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs`
7. `apps/chrome-extension/e2e/lib/v3WpBVisibleSession/`
8. `apps/chrome-extension/src/modules/media_companion/LocalMediaImportClient.ts`
9. `apps/chrome-extension/src/modules/media_companion/settings/LocalMediaImportCard.tsx`
10. `apps/chrome-extension/src/modules/media_companion/MediaCredentialWorkspacePage.tsx`

Treat the current dirty worktree as authoritative. Preserve every unrelated
change. Do not commit, push, reset, clean, checkout or revert.

## Goal

Make the one-shot B27/B29/B30 visible harness genuinely executable through the
real Side Panel and public Runtime routes, while adding only passive,
sanitized, E2E-gated observations. Eliminate every remaining fabricated or
unobservable oracle. Produce offline evidence and stop before Chrome.

## Mandatory implementation

### 1. Passive E2E diagnostics, no alternate owner path

Under the existing compile-time `__NAVIA_E2E_BRIDGE__` gate, expose a read-only
local-import diagnostics snapshot to the Side Panel harness. It may observe and
sanitize facts produced by the normal product path; it must not create,
upload, cancel, poll, bind, materialize, clean or otherwise invoke an owner.

At minimum the snapshot must provide:

- import id, task id, current state and monotonically increasing sequence;
- XHR lifecycle: start, real `upload.onprogress` samples, load/error/abort;
- uploaded bytes and exact final byte count;
- current Runtime session generation and the identity/task the import belongs to;
- server-observed maximum writer slice, cleanup claim count, and source/sandbox
  residue counts through an E2E-only, test-owned observation channel;
- no bearer, cookie, upload token, `File`, filename, absolute path, raw media,
  frame bytes or transcript text.

If Runtime-side numeric facts need a seam, gate it explicitly to the owned E2E
Runtime environment and keep it absent from production builds/default startup.
Do not change the frozen public API/schema/failure-code universe. A test-only
diagnostic endpoint or event channel must be unavailable unless the explicit
owned-E2E flag is set, authenticate exact origin/session, and remain read-only.

Add negative tests proving the bridge cannot call product owners and the
diagnostic surface is unavailable outside E2E mode.

### 2. Deterministic real user-flow setup

Implement the browser driver that reaches the local-import card through the
actual Side Panel workflow. It must:

- open an owned Bilibili-format tab and the real Side Panel;
- use only an explicitly supplied cookie file/environment input through the
  repository-supported cookie injection path; never search Desktop or disk;
- drive policy authorization, Runtime access, credential lease and acquisition
  using visible product controls/public messages, not direct client/controller/
  store/database/coordinator/materializer calls;
- reach the frozen last-resort eligibility honestly after the automatic routes
  fail; do not force React state or call `localImportEntryEligible` as setup;
- establish a fresh task/source identity for each of B27, B29 and B30 so the
  successful B29 product cannot make B30 ineligible;
- for B27, switch the active media identity to a second real Bilibili-format
  identity and observe the actual generation change. Changing only the Side
  Panel hash is not an identity switch.

Any required target URL or cookie path must be an explicit environment input
validated before Chrome. Missing input is `EXTERNAL-INPUT BLOCK` before launch.

### 3. Real oracles

- B27 waits for abort after identity change, observes the real DELETE and
  `cancelled` terminal with increasing sequence, and proves no stale attachment
  or storage/UI residue.
- B29/B30 require exactly one Extension PUT, non-empty monotonic progress ending
  at exact asset bytes, `ready`, strict task/outline ids, and a real `image/png`
  thumbnail fetched with the actual evidence id.
- Replace before/after-only B30 resource checks with sampling throughout upload
  and processing. Record peak owned Runtime RSS delta and peak Side Panel heap
  delta. Missing samples fail.
- Accessibility must perform real keyboard traversal and activation, check
  focus order, enabled/visible/hit-testable controls, live-region updates and
  stable scroll/layout at the real Side Panel viewport. DOM existence/counts
  alone are insufficient.
- Never hardcode cleanup=1, residue=0, progress bytes, terminal state, ids,
  evidence id, RSS or heap.

### 4. Owned lifecycle

Keep the Codex-corrected lifecycle and tests intact:

1. preflight before Chrome/large assets;
2. owned Chrome loads unpacked extension and yields exact id;
3. owned Runtime is configured with that id;
4. real session and dependency snapshot;
5. generated assets are independently requalified;
6. cases run through Side Panel/public routes;
7. Chrome and Runtime process trees, profile, assets and owned root clean in
   every failure path;
8. one redacted stable receipt is written after cleanup.

Use the Windows Chrome root pid/profile ownership patterns already present in
`apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs`; do not trust a
WSL proxy pid as the Windows Chrome pid.

### 5. Offline anti-false-green tests

Extend the existing Node tests so they drive the same production runner
composition. Tests must fail for:

- missing diagnostics bridge or diagnostics available in production mode;
- a bridge that invokes an owner;
- empty/single/final-byte-mismatch progress;
- abort sampled before identity change;
- hash-only identity change;
- `cancelled`/`failed` accepted as B29/B30 success;
- hardcoded cleanup/residue/ids/evidence;
- no fresh context between cases;
- endpoint requests not recorded against the owned Runtime;
- point-in-time rather than peak resource sampling;
- DOM-count-only accessibility;
- cleanup failure or stable evidence inside the owned root.

Run targeted Extension tests, `npm run test:wp-b-visible-session`, typecheck and
`npm run build:e2e`. Do not run broad external/stage audits.

## Prohibited in this workpack

- Do not launch Chrome, visible or headless.
- Do not start a real Runtime.
- Do not generate 100 MB/1 GB assets.
- Do not read or print Desktop cookies, provider keys or private media.
- Do not play audio.
- Do not run B27/B29/B30 and do not consume the one approved visible session.
- Do not change frozen schemas, 18-code set, thresholds, B01-B30 denominator,
  T1-T4 order, Origin/auth order, asset registry, WP-A digest or historical
  evidence.
- Do not refreeze relay v11.
- Do not announce WP-B or V3 PASS and do not enter WP-C.

## Handoff

Write a new immutable evidence directory under
`docs/active/project/evidence/v3_media_companion/v3-completion/` containing:

- changed files and SHA-256;
- internal/public contract statement;
- commands and exact exits/counts;
- case-to-real-oracle map;
- proof that the bridge is passive and E2E-only;
- proof that default/offline invocation launches 0 Runtime, 0 Chrome and
  generates 0 large assets;
- secret/path/raw-media scan and cleanup report;
- remaining risks and exact stop reason;
- payload manifest generated after all evidence is stable.

Final status must be exactly:

`WP-B VISIBLE PRODUCT-SEAM IMPLEMENTED AWAITING CODEX DRY REVIEW`

Stop. Do not ask for or perform the visible run.
