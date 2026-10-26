# ClaudeCode CLI one-click goal: WP0 R6 fault matrix

> Authorized input: Codex checkpoint `wp0-r5-accepted-2026-10-19` says `R5 PASS / R6 MAY START`.

You are implementing Navia V3 WP0 R6 in `/mnt/c/workspace/navia`. Read repository `AGENTS.md`, then:

1. `docs/active/project/design/project-stage-workflow.md`, especially section 5.1;
2. `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5-accepted-2026-10-19/`
   in manifest order, especially `10-codex-r5-checkpoint.md`, `40-r5b-acceptance.json` and
   `60-payload-manifest.sha256`;
3. every file in `docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-preimplementation-v2-2026-10-19/`;
4. `docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json`;
5. `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`;
6. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-architecture-2026-10-15.md`;
7. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-development-plan-2026-10-15.md`;
8. `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-acceptance-plan-2026-10-15.md`.

Your scope is R6 only. Do not enter R7/P1, do not change public API/schema, ticket TTL, Cookie/provider
contracts, SourceAuthority, Side Panel materialize ownership, fixed FailureCodes or thresholds. Preserve the
dirty worktree and never reset/clean/revert user changes.

Before R6-0, recompute the R5-B payload manifest, build-tree hash and production-source closure hash. They
must match the accepted checkpoint; any drift returns to R5-B acceptance even if old PASS text exists.
Use these exact commands from the repository root:

```bash
python3 -B docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-preimplementation-v2-2026-10-19/05-verify-r6-document-package.py
python3 -B docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-preimplementation-v2-2026-10-19/09-verify-r6-document-mutations.py
python3 -B docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-preimplementation-v2-2026-10-19/10-compute-r5-candidate-digests.py --payload-manifest docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5-accepted-2026-10-19/60-payload-manifest.sha256
```

The output must be exactly: payload manifest
`7ff78a7c15ca2b9eced7978f784f5d5e3517f293b6bc3e1b6351251f2b235a2f`, build tree
`2ed5f6fd789826c63fbbcea94a581c10b666e147003ad85c016221e94d6694da`, production closure
`cd587f88e794f63452fbca98f1f6ffe6b5b47f657a9dea059e3e0a456c3bf4c2`, 99 build files and 23 source
files. Any mismatch means stop before changing product or test files and report candidate drift to Codex.

Execute R6-0 through R6-5 in order. First verify the machine matrix. Implement only missing fault drivers or
real fail-closed defects. Every case needs a production-owner behavioral oracle and cleanup receipt; fixture
parsing or code-existence tests are insufficient. Use real owned Uvicorn processes for Runtime faults. All
65 behavioral cases execute fresh; R4 evidence may guide harness design but cannot satisfy an R6 case.

Do all headless/no-focus work first. Before any visible Chrome/UIAutomation/native permission action, stop
and notify the user. Then consolidate all browser lifecycle cases into one owned Chrome session, always
`--mute-audio`, exact Profile/PID, allowlisted controls only. Never touch the user's Chrome or games. If the
visible run fails, clean owned resources, return to headless correction, and do not visibly retry in the same
disturbance window.

After implementation, run exactly one consolidated checkpoint regression as specified in the acceptance
plan. Write evidence under a new immutable directory
`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r6-<UTC-run-id>/` containing:

- `10-receipt.md`
- `20-test-results.md`
- `30-prd-review.md`
- `40-case-results.json`
- `50-cleanup-and-secret.json`
- `60-handoff.md`
- `70-payload-manifest.sha256`

Report changed files, internal/public contract changes, every command and exit code, per-group counts,
fresh evidence counts, visible Chrome/Provider/audio counts, process/task/run IDs, cleanup/secret
results and remaining Fatal/Major/Minor. Success status is only `R6 AWAITING CODEX CHECKPOINT`; stop there.
On a visible safety/privacy/cleanup failure, stop immediately. At the final headless checkpoint, report
`R6 NO-GO`, preserve evidence and summarize all known independent Fatal/Major/Minor in one corrective batch
before stopping; do not split already-observable problems into serial review rounds.

Do not ask ClaudeCode to perform document external review or declare R6 PASS. Codex owns the next checkpoint.

