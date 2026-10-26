# WP-B visible product seam — handoff

**State: `WP-B VISIBLE PRODUCT-SEAM IMPLEMENTED AWAITING CODEX DRY REVIEW`**

The product seam and the deterministic user-flow driver are implemented, and
the offline evidence is green. **The visible run was NOT performed.**

---

## 1. What Codex should review

| area | the sources |
|---|---|
| the passive Extension diagnostics | `apps/chrome-extension/src/modules/media_companion/localImportDiagnostics.ts`, `.../LocalMediaImportClient.ts`, `.../settings/LocalMediaImportCard.tsx`, `apps/chrome-extension/entrypoints/sidepanel/main.tsx` |
| the E2E-only Runtime channel | `services/local-runtime/navia_runtime/modules/media_companion/local_import/observations.py`, `.../manager.py`, `.../consumer_barrier.py`, `services/local-runtime/navia_runtime/app.py` |
| the user-flow driver | `apps/chrome-extension/e2e/lib/v3WpBVisibleSession/driver.mjs` |
| the harness wiring | `.../realAdapters.mjs`, `.../index.mjs`, `.../preflight.mjs`, `.../cases/b27.mjs`, `.../cases/b30.mjs` |
| the offline proofs | `apps/chrome-extension/e2e/lib/v3WpBVisibleSession.node-test.mjs` (49 tests), `apps/chrome-extension/src/modules/media_companion/tests/localImportDiagnostics.test.ts` (8), `.../LocalMediaImportClient.test.tsx` (33) |
| the runner | `apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs` |

## 2. The future one-session command

```bash
cd apps/chrome-extension
npm run build:e2e

NAVIA_WP_B_SESSION_PHASE=visible-run \
NAVIA_WP_B_VISIBLE_APPROVED=1 \
NAVIA_WP_B_SEED_MEDIA=<absolute path to the authorized seed> \
NAVIA_WP_B_COOKIE_FILE=<absolute path to the explicitly supplied cookie file> \
NAVIA_WP_B_TARGET_B27=<a real Bilibili video URL> \
NAVIA_WP_B_TARGET_B27_SECOND=<a SECOND real Bilibili video URL> \
NAVIA_WP_B_TARGET_B29=<a real Bilibili video URL> \
NAVIA_WP_B_TARGET_B30=<a real Bilibili video URL> \
NAVIA_WP_B_EVIDENCE_ROOT=<a stable directory OUTSIDE the owned root> \
NAVIA_WP_B_CDP_PORT=9731 \
NAVIA_CHROME_EXECUTABLE="<absolute path to the owned Chrome>" \
NAVIA_MEDIA_FFMPEG_PATH=/usr/bin/ffmpeg \
NAVIA_MEDIA_FFPROBE_PATH=/usr/bin/ffprobe \
NAVIA_ASR_ROOT=<the product's ASR root> \
node e2e/v3-wp-b-local-import-owned-session.mjs
```

## 3. The requirements of that session

| requirement | value |
|---|---|
| the seed | an explicitly authorized real media file, 30–300 s, a real video and a real audio stream, at least 3 non-empty local SenseVoice segments, at least 3 distinct frame digests. It is never padded, truncated, sparsified or substituted, and nothing is searched for. |
| the cookies | an explicitly supplied cookie file, injected into the OWNED browser context only. The Desktop and every other repository are never read. |
| the identities | four explicit Bilibili URLs. Every case gets its own, and B27 gets a SECOND one to switch to. |
| the storage | about 1.3 GB for the two registry assets, plus the owned profile |
| the duration | roughly 10–20 minutes for the assets and 10–20 minutes for the three cases |
| the vision Provider | the user's own configured Provider; the harness chooses none |
| the cleanup | the owned Chrome tree, the owned Runtime tree, the profile, the assets, the temporary root — then ONE redacted receipt in the stable destination |

## 4. The state of the three cases

| case | state |
|---|---|
| B27 | **PENDING_VISIBLE_RUN** |
| B29 | **PENDING_VISIBLE_RUN** |
| B30 | **PENDING_VISIBLE_RUN** |

None of them is reported as passing. WP-B and WP-C remain unpassed, and the
single approved visible session is untouched.

## 5. The boundaries this pass did not cross

* No Chrome, visible or headless; no Runtime; no large asset; no audio.
* No Desktop cookie read, no provider key read, no private media read.
* No frozen schema, code set, threshold, denominator, order, registry, digest or
  historical evidence change.
* No relay v11 refreeze, and nothing committed, pushed, reset, cleaned, checked
  out or reverted.
