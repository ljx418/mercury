# V3-5.10 Stage A NJ-01 transcript preview evidence

Date: 2026-10-12. Decision: **NJ-01 bounded PASS for the tested real Bilibili task; Stage A remains NO-GO.** This is an implementation-session self-check, not an independent Stage A exit audit.

## Scope and method

- Real page: `https://www.bilibili.com/video/BV1hMpE6FEXG` in isolated visible Chrome under Xvfb, with a fresh isolated Runtime, profile, database copy, and private media roots. Optional site/cookie permissions were pregranted in the temporary extension manifest; this run does **not** prove first-use native permission UX.
- The test held the real visual-materialization request to inspect the interval after transcription and before outline publication. It read the visible DOM in embedded Chat and standalone Chat, plus the already-open Workspace shell. Public evidence contains only per-item lengths and SHA-256 hashes, not transcript text.
- Runner: `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs`, executed with `NAVIA_STAGE_A_CHECK_WORKSPACE=1` and `NAVIA_STAGE_A_CANCEL_DURING_MATERIALIZATION=1`. `pnpm build` and `node --check` passed before the run.
- Evidence: `first-use-runs/20261012T133444873Z-cancel-result.json`, SHA-256 `47c2eac7ee6cd31708e4f0a28b236807f82f7c860601d7fbd036c9f19dcd1091`.

## Observations

1. Before cancellation, both Chat surfaces rendered an open `转写预览 · 不是全片概览` details element. Each had 3/3 timestamped, 3/3 nonempty items. Corresponding item lengths and hashes matched across the two surfaces.
2. Both Chat cards and the Workspace shell referenced `media_task_af697fbbaa404588913143bb1a10acc0`. Workspace had no published outline; Chat's top state was `正在生成图文大纲`, not `视频内容已就绪`.
3. After the visible cancel action, Runtime source authority and all three surfaces converged to `cancelled`. Two delayed visual requests returned HTTP 409, private task residue was empty, and the run's `cancelClosed` was true.
4. A bounded secret-keyword scan of the public JSON returned zero hits. The isolated browser, Runtime, and scratch roots were cleaned by the runner.

## Limits and remaining gate

This run proves the NJ-01 pre-outline preview on one real video and rechecks the already approved Route A cancellation boundary. It does not prove the preview for the six-video quality denominator, a Chrome/browser restart, absent/mismatched chapter recovery, actual successful seek, or four-viewport negative-journey visual quality. It does not close the fixed Stage A 10-item denominator or authorize Stage B-D. The combined read-only audit remains the Stage A gate until the remaining negative journeys have fresh evidence and independent review.
