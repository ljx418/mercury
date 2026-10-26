# WP-B acceptance-completion checkpoint

**Decision: `WP-B FINAL CORRECTIVE NO-GO / ACCEPTANCE COMPLETION MAY START`**

The final-corrective implementation closes the previously reported F1-F7 main paths, and targeted
Codex reruns passed (`Runtime 23/23`, `Extension 34/34`). It is not yet eligible for relay refreeze or
WP-B PASS because one durable production gap and several fixed-denominator false greens remain.

## Accepted implementation

- Extension status schema, bearer, Runtime envelope, absolute URL and production parent composition.
- Imported-frame conversion to production artifacts, real materialize-visual routing, zero local-route
  downloader/credential dispatch, real product projections and thumbnail route.
- Barrier-less startup recovery, owned orchestration-future failure settlement, real coordinator
  cleanup on restart, and the corrected WP0 asynchronous receipt oracle.
- B21/B22 real receipts are useful evidence. No visible Chrome or audio playback occurred.

## Blocking findings

### A1 - Visual terminal is not crash-durable (Major)

`MediaProductMaterializer` durably commits and publishes the visual product, then invokes
`_claim_visual_terminal()`. A kill between those operations leaves the barrier's `visualTerminal=false`.
After restart, `materialize_visual()` returns the already-terminal product before invoking the callback,
while orchestrator recovery only waits for both consumer receipts. Cleanup can therefore remain blocked
forever.

The current once-guard is process memory and records the claim before calling the hook. A hook failure
also suppresses retry in that process. The fix must use durable product/barrier facts and an idempotent
barrier operation; it must survive a kill after product commit and before/during callback.

### A2 - `28/28` is not supported by the recorded production oracles (Major)

The authoritative acceptance plan defines behavior, not merely test labels. The submitted case table
over-counts at least these gaps:

- B01: no three-schema meta-validation, public/internal fixture validation, or asset-registry gate is
  mapped or run.
- B10: missing Content-Length and chunked transfer are not driven through the routed endpoint.
- B11: the routed ASGI path does not prove all required 64 KiB, 1 MiB+1 and 8 MiB transport chunks.
- B12: 0%, 50% and EOF-before-complete interruption are not driven through the public API with writer,
  store, staging and retry cleanup oracles.
- B13: the fixture creates MP4/WebM/MKV, but MKV is never prepared and accepted by a case-bearing test.
- B14: exact 4-hour and +1 ms duration are absent; a reduced injected limit is not the frozen boundary.
- B15: missing tool, timeout and non-zero tool exit are absent despite the case claiming them.
- B16: task-quota exact/over boundary is not attributed to the case.
- B19: generation and artifact mutations are not proven alongside task/source mutations.
- B24: tests directly transition the store instead of cancelling real awaiting/uploading/verifying/
  preparing owners and asserting XHR/worker/process/two-sandbox cleanup and retry.
- B25: only terminal store reversal is tested; cancel-vs-ready/bind/terminal races and the single cleanup
  owner are not.
- B26: several barrier states are fabricated with a private `_advance()` helper instead of a real fresh
  process reading production transitions and the public GET result.
- B27: `FakeXhr` and mocked JSON transport prove component intent, not a real Extension XHR abort/cancel
  against Runtime.

These are acceptance-oracle gaps. Do not rewrite working product code unless a new production test
first demonstrates a defect.

### A3 - Evidence candidate is no longer byte-identical (Major)

The package manifest verifies its own evidence files, but `10-changed-file-hashes.json` does not match
the current worktree for:

- `services/local-runtime/tests/test_wp_b_c7_production.py`
- `services/local-runtime/tests/test_wp_b_fc4_fixed_cases.py`

The candidate must be re-signed only after implementation and tests stop changing.

### A4 - WP-B remains 28/30 at best

B29 and B30 are mandatory fixed-denominator cases, not optional post-WP-B work. They need an explicitly
authorized `NAVIA_WP_B_SEED_MEDIA`, generated registry-compliant 100 MB and 1 GB assets, and one real
Side Panel run. No asset search or substitution is authorized.

## Gate sequence

1. Close A1 and all offline A2/A3 items with targeted tests.
2. Run one consolidated offline regression and produce a `READY FOR ONE VISIBLE RUN` receipt.
3. Stop and obtain user approval before any Chrome launch or focus-capable action.
4. In one later owned Chrome session, with `--mute-audio`, execute B27 real transport plus B29/B30 and
   clean every owned process/profile/asset.
5. Only after 30/30 and a stable candidate may Codex perform the single relay v11 refreeze/checkpoint.

WP-C remains locked. No external document audit, self-refreeze or stage PASS is authorized.
