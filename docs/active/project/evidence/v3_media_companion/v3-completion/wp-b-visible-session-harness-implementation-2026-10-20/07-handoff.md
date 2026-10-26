# WP-B visible-session harness — handoff

**State: `WP-B VISIBLE HARNESS IMPLEMENTED AWAITING CODEX DRY REVIEW`**

VH1–VH6 are implemented and the eight offline adapter-test groups pass. The
harness is ready for a Codex dry review. **B27, B29 and B30 remain
`PENDING_VISIBLE_RUN`**, and the user's single visible-run budget has not been
spent.

---

## 1. The future one-session command

```bash
cd apps/chrome-extension
npm run build:e2e                                  # the PRODUCTION extension build

NAVIA_WP_B_SESSION_PHASE=visible-run \
NAVIA_WP_B_VISIBLE_APPROVED=1 \
NAVIA_WP_B_SEED_MEDIA=<absolute path to the authorized seed> \
NAVIA_WP_B_EVIDENCE_ROOT=<stable evidence destination, OUTSIDE the owned root> \
NAVIA_WP_B_CDP_PORT=9731 \
NAVIA_CHROME_EXECUTABLE="<absolute path to the owned Chrome>" \
NAVIA_MEDIA_FFMPEG_PATH=/usr/bin/ffmpeg \
NAVIA_MEDIA_FFPROBE_PATH=/usr/bin/ffprobe \
NAVIA_ASR_ROOT=<the product's ASR root> \
node e2e/v3-wp-b-local-import-owned-session.mjs
```

Without `NAVIA_WP_B_VISIBLE_APPROVED=1` the runner refuses **before it touches
anything**.

## 2. The seed requirement

`NAVIA_WP_B_SEED_MEDIA` must point at ONE explicitly authorized real media file
that satisfies the FROZEN registry requirements:

| requirement | value |
|---|---|
| container | `mp4`, `webm` or `matroska` |
| streams | a real video stream **and** a real audio stream |
| duration | 30,000 – 300,000 ms |
| speech | at least 3 non-empty local SenseVoice segments |
| frames | at least 3 distinct frame digests |

A seed that fails any of them is an `EXTERNAL-INPUT BLOCK`. It is never
padded, truncated, sparsified or synthesized, and no other media is ever
searched for.

## 3. The expected duration and storage

| item | expectation |
|---|---|
| the 100 MB asset | 105 s, 96–112 MiB |
| the 1 GB asset | 1080 s, 0.95–1.05 GiB |
| the asset generation | roughly 10–20 minutes on the local CPU |
| the disk during the session | about 1.3 GB for the assets, plus the owned profile |
| the three cases | roughly 10–20 minutes |
| **the whole session** | **under 45 minutes**, one Chrome process, one profile |

## 4. The owned topology

| resource | owner | how it is owned |
|---|---|---|
| the Runtime | the harness | its own PID, its own private data/config/log/media roots, its own port (17861, proven free), a bounded health wait, a tree termination in the `finally` |
| Chrome | the harness | its own PID, its own `navia-t01-profile-*` directory, its own debugging port, `--mute-audio` always, one owned window |
| the extension | the production build | loaded through the browser-level `Extensions.loadUnpacked`, then the id, the service worker and the Side Panel target are verified |
| the assets | the harness | generated under the owned root from the authorized seed, measured, and removed in the `finally` |
| the probes and the frames | the harness | under the owned root, each registered for removal |
| the receipt | the harness | written to the STABLE destination AFTER the cleanup |

**The user's Chrome, the user's profile, an existing Runtime and every other
process are never touched.** An occupied Runtime port is a refusal, not a
reuse.

## 5. The cleanup order

1. terminate the owned Chrome PID and its tree;
2. terminate the owned Runtime PID and its tree;
3. remove the owned profile directory;
4. remove the owned asset directory;
5. remove the owned temporary root (every probe, frame and intermediate);
6. remove the owned evidence directory;
7. **then** write the redacted receipt to the stable destination.

## 6. What Codex should check in the dry review

| item | where |
|---|---|
| the three executors are real and are bound to the frozen oracles | `e2e/lib/v3WpBVisibleSession/plan.mjs`, `.../cases/b27.mjs`, `.../cases/b29.mjs`, `.../cases/b30.mjs` |
| no case calls an owner directly | the case modules; only the browser and Runtime adapters are used |
| the owned Runtime and Chrome lifecycles | `.../runtime.mjs`, `.../chrome.mjs` |
| the redaction and the stable destination | `.../receipt.mjs` |
| the dependency resolution | `.../preflight.mjs`, `.../assets.mjs` |
| the offline proofs | `e2e/lib/v3WpBVisibleSession.node-test.mjs` (32 tests) |
| the runner's refusal without the approval flags | `e2e/v3-wp-b-local-import-owned-session.mjs` |

## 7. The boundaries this pass did not cross

* No Chrome was launched, visible or headless.
* No audio was played; no audio output device was opened.
* No 100 MB or 1 GB asset was generated.
* No Desktop, other repository or arbitrary drive was read for media.
* No public API, schema, 18-code set, threshold, B01–B30 denominator, T1–T4
  order, Origin/auth order, asset registry, WP-A hash or historical evidence
  was modified.
* The relay v11 inventory was not refrozen, and nothing was committed,
  pushed, reset, cleaned, checked out or reverted.
* B27, B29, B30 and WP-B/V3 are NOT announced as passing, and WP-C is not
  entered.
