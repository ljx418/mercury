# The exact handoff (corrective)

## 1. What Codex has to check

This is the corrective of the rejected offline candidate. The three Major
findings and the three Minor findings of
`gc-b5r-offline-codex-checkpoint-2026-10-23/00-checkpoint-findings.md` are
closed; the closure map is `00-correction-report.md`.

The checkpoint is ONE consolidated verification. It must not start the real
six-video run, B-6, B-7, Stage C or WP-C, and it must not open a browser, a
visible window, a Provider or a cookie.

1. Read `00-correction-report.md` (the finding → change → test map),
   `02-production-composition-and-restart-receipts.md` (the composition and
   the restart receipts) and
   `03-preflight-and-provider-lock-negative-matrix.md` (the negative matrix).
2. Re-run the consolidated commands of `04-commands-and-results.md` and check
   the expected results — in particular the ONE offline runner command, which
   must exit 0, and the relay v11 baseline, whose exact failed checks are
   reported in `05-relay-source-drift-report.md`.
3. Check the digests of `01-changed-file-hashes.md` and the
   `PAYLOAD_MANIFEST.sha256` (verify it with `sha256sum -c`).
4. Check the preflight receipts under `preflight/`,
   `preflight-declared-exact/` and `preflight-declared-foreign/`: the action
   counters are zero, no source is passed, and a foreign identity is
   ineligible with a stable reason.
5. Check the relay source-drift report: the semantic inventories are 40/40,
   20/20 and 59/59, `unlistedBoundaryEmits` is `{}` and the ONLY drifted scope
   is the authorized `app.py`.
6. Check the scans of `07-secret-path-raw-media-and-cleanup.md` and the
   honest findings in §3.

## 2. What is still Codex's decision

* **The relay v11 refreeze.** This batch changed `app.py` (authorized) and
  therefore drifted a relay v11 source scope. The baseline reports 46/50 with
  exactly the four hash/scope-cascade checks failing; the semantic
  inventories prove the drift is scope-only. The mutations were **not run**
  (`not run: canonical baseline pending Codex refreeze`) because the
  canonical baseline is not green. The refreeze itself is Codex's; this
  batch refroze nothing.
* **Whether the real B-5 run may start.** It is still NO-GO: the real run
  needs Chrome, a cookie, network, a Provider and a media download, and an
  explicitly configured local-asset manifest. The preflight of this batch had
  **no** manifest configured, so all six sources are `not_declared` — a
  statement about the configuration, not a result.
* **The local-asset manifest for the real run.** The corrected preflight now
  validates the declared identity exactly; a manifest that does not name
  `portal:bilibili:<frozen BVID>:<unit>:<part>` per source is ineligible.

## 3. The honest findings of this corrective

**Fatal 0 / Major 0 / Minor 3** (the three Codex Minor findings are closed as
described in `00-correction-report.md`; the Minor findings below are NEW
observations of this batch, not the Codex findings):

1. **Minor — the ready generation is a fixture value.** The dependency
   catalog is frozen, so a READY dependency set always has the same
   generation. The "changed generation" case is therefore proven with a local
   asset prepared under another run's generation, compared against the REAL
   manager's current generation. A future WP-A catalog change would make a
   second ready generation possible; the correction handles that case the
   same way.
2. **Minor — the "fresh process" is a fresh manager instance.** The test
   recreates the manager over the same managed root, which reproduces the
   in-memory lease loss of a Runtime restart. It does not fork a process; the
   restart-specific behaviour under test is the empty lease map, and that is
   reproduced exactly.
3. **Minor — the readiness marker of the SIGTERM case is the stub's own
   directory.** The PH0-AR-10 case waits for the stub runner's per-BVID
   marker before it signals the sequencer. It proves the sequencer reached
   its run loop; it does not prove the sequencer's own startup latency under
   an extreme load, and the timeout was not increased to hide that.

## 4. The stop state

Nothing in this package announces GC-B5R, B-5, Stage B or V3 as PASS. The
offline candidate is corrected and awaits the checkpoint.

`GC-B5R OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT`
