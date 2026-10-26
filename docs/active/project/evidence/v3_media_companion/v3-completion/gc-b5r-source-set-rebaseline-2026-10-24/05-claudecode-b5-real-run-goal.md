# ClaudeCode goal: GC-B5R B-5 real six-video run

Copy the complete prompt below into ClaudeCode CLI as one task. Do not shorten
it or split it into independent agents.

```text
You are implementing and executing the Navia V3 GC-B5R Stage B B-5 real
six-video workpack in /mnt/c/workspace/navia.

This is one bounded implementation-and-acceptance workpack. Continue until the
offline runner corrections, production preflight and either the single real
visible batch or an honest preflight block are complete. Do not stop after a
plan. Do not enter B-6, B-7, WP-C, Stage C/D/E, V3-6 or V3-7.

AUTHORIZATION AND CURRENT GATE

- Codex decision: GC-B5R B-5 REAL-RUN IMPLEMENTATION MAY START.
- WP0, WP-A, WP-B and GC-B5R offline implementation are complete.
- relay v11 is currently canonical green: baseline 50/50 and mutations 16/16.
- The user has explicitly granted continuous authorization through this
  development stage. After every offline and process-level prerequisite is
  green, you may execute exactly one consolidated owned-Chrome visible batch.
- Every Chrome launch must include --mute-audio. Never attach to, close, alter,
  reuse or focus the user's existing Chrome/profile. Do not interfere with the
  user's game or desktop beyond the one owned visible batch.
- Do not ask for another approval before that one batch. If a prerequisite is
  not green, do not launch Chrome or call a Provider; stop with the exact
  blocked state below.

READ BEFORE EDITING

1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md, especially section 5.1
3. docs/active/project/01-prd.md
4. docs/active/project/design/v3-media-companion-development-acceptance-plan.md
5. docs/active/project/design/v3-5.10-media-experience-repair-plan.md
6. docs/active/project/evidence/v3_media_companion/v3-remaining-acceptance-plan.md
7. The entire package:
   docs/active/project/evidence/v3_media_companion/v3-completion/
   gc-b5r-source-set-rebaseline-2026-10-24/
8. The prior GC-B5R offline implementation, corrective and Codex refreeze
   evidence packages under the same v3-completion directory.
9. scripts/stage_b_b5_3/sequencer.mjs, run_one_bvid.mjs, lib/*.mjs and all
   scripts/stage_b_b5_3/test/*.mjs before changing them.

CANONICAL INPUT

The only active source registry for this workpack is:

docs/active/project/evidence/v3_media_companion/v3-completion/
gc-b5r-source-set-rebaseline-2026-10-24/
02-stage-b-six-video-registry-v2.json

Its SHA-256 at authorization time is:
9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454

The fixed denominator, in exact order, is:

1. BV11t8w6oEtP
2. BV1QcYx6VEAj
3. BV1v58B6GEan
4. BV1M5tJ6kEvw
5. BV1HTbi6LERi
6. BV1qM9fB8Eb2

The following are reserves only and are forbidden at runtime unless Codex later
creates a new rebaseline:

- BV16woRBfEsH
- BV1w7XQB7EsS
- BV1829jBeErD
- BV1aJAjzsE4j

Preserve the old v1 registry and all historical evidence byte-for-byte. Never
silently substitute, reorder or reuse a prior source artifact. Public metadata
was checked without Cookie and is only a preflight hint, not acceptance proof.

R0 - FIX THE RUNNER BEFORE REAL ACTION

1. Make the active runner consume the canonical v2 registry, either directly
   or through a clearly named active fixture copied byte-for-byte. Do not edit
   the historical v1 registry.
2. Update FROZEN_REGISTRY_SHA256, FROZEN_SIX, registry/order tests and any test
   fixtures to the v2 primary six. Add explicit reserve rejection tests.
3. Fix the current aggregate false-green in sequencer.mjs. The final process
   exit must be nonzero for any of these conditions:
   - any source disposition is failed;
   - any source disposition is limited;
   - two or more sources are blocked;
   - fewer than six fresh source rows exist, except when an explicit fail-closed
     stop receipt identifies the condition;
   - a source is missing required evidence or final_disposition.txt;
   - source order/identity differs from the registry or a reserve is used;
   - any stale/cross-run artifact is used;
   - secret, raw-upload, audio, ownership or process-leak audit fails.
4. The only machine-positive candidate aggregate is exactly six fresh attempts
   with complete >= 5, blocked <= 1, limited = 0, failed = 0, no substitution,
   no cross-run reuse and all required receipts present. This is still only a
   B-5 checkpoint candidate, not permission to announce Stage B PASS.
5. Add negative tests that prove nonzero exit for: one failed, one limited, two
   blocked, wrong order, reserve substitution, stale artifact, missing final
   receipt, missing required evidence, upload-policy violation and leaked owned
   process. Assert the process exit, not merely a summary field.
6. Keep the existing one-command offline suite deterministic. Do not increase a
   timeout to hide readiness races and do not weaken any oracle.

R1 - PRODUCTION PREFLIGHT, WITH ZERO VISIBLE ACTIONS

Build one preflight receipt that proves all of the following before Chrome or
Provider invocation:

- the exact v2 registry digest, exact order and reserve prohibition;
- all six public metadata responses still bind to their declared BVID and are
  not pay/charge-exclusive; metadata success must not be marked complete;
- the explicitly authorized Cookie file exists and has the required Bilibili
  Cookie name(s), without printing values, lengths that reveal values, the
  private path or file contents;
- use NAVIA_BILIBILI_COOKIE_FILE when set. If absent, resolving the Windows
  Desktop known folder and the exact filename myCk.txt is allowed because the
  user explicitly authorized that file. Do not search Desktop, home, drives,
  other repositories or arbitrary directories. Never copy Cookie material into
  the repository or evidence;
- Cookie injection targets only the owned ephemeral Chrome profile by reusing
  an existing product/canary helper. Never use the user's profile;
- owned Chrome executable, build:e2e extension bundle, free CDP port, fresh
  profile and cleanup handlers are ready;
- owned Runtime port, data/config/log/media roots, SQLite database, task root
  and namespace are fresh and isolated;
- SenseVoice binary/model/VAD, ffmpeg, ffprobe and frozen yt-dlp are verified
  through product managers/status APIs and frozen digests, not assumed from a
  path;
- the isolated Runtime can obtain exactly one configured product Provider:
  providerId=minimax-cn-openai-vision and
  endpointClass=minimax_chat_completions, through a supported product bootstrap;
- do not read or print raw API keys, do not mutate SQLite directly and do not
  create a runner-owned Provider authority;
- disk, memory and execution budgets cover six fresh sequential runs;
- all process, evidence, redaction and cleanup roots are owned and outside any
  historical evidence directory.

The preflight receipt must report zero Chrome launches, visible windows,
Provider calls, downloads, imports, media tasks, Cookie injections, audio
outputs, tabCapture actions, focus events and real-source completions.

If the Cookie or Provider cannot be bound through supported product behavior,
emit EXTERNAL-INPUT BLOCK, clean owned resources and stop before Chrome. Do not
work around this with direct database writes, secret extraction, a fake
Provider, hard-coded success or a weaker oracle.

R2 - EXACTLY ONE CONSOLIDATED VISIBLE SESSION

Only after R0 and R1 are entirely green:

1. Run npm run build:e2e once from apps/chrome-extension.
2. Announce in the live progress update that the single owned visible batch is
   starting. Then launch one owned Chrome session or one explicitly planned
   consolidated owned session. Every launch command contains --mute-audio.
3. Process the fixed six in registry order, sequentially. Each source must use
   a fresh Runtime namespace, database, Chrome context/profile isolation, task
   id, source identity and dependency generation. No state or artifact may be
   inherited from another source.
4. Drive the normal product path and visible product controls. Do not call
   controller, coordinator, materializer, database, store or internal owner
   methods to manufacture success.
5. Preserve product route ownership. Automatic acquisition/download may run.
   Explicit local import may run only through its actual user-visible product
   flow. tabCapture remains deferred/default-off and is not reintroduced as an
   implicit fallback.
6. Inject only the authorized Cookie into the owned profile. Never persist it
   in source, logs, screenshots, receipts or evidence.
7. For each task, prove exactly one selected Provider authority and endpoint.
   Only derived transcript/OCR/vision-caption text may cross that boundary.
   Cookie, API key, raw video, raw audio, PCM, frame bytes, thumbnails, local
   files and private paths must have upload counters exactly zero.
8. Browser audio output must remain zero. Do not open an audio device.
9. Record product-owned route, task/source/revision/generation ids, terminal
   state, artifact/receipt hashes, Provider/endpoint identity, redacted request
   counts, cleanup and residual counts. Do not record transcript text, Cookie,
   API key, raw media, filename or private absolute path.
10. Do not blindly retry a failed visible case. On the first unexpected visible
    failure, write one redacted diagnostic, clean all owned resources and stop.
    A retry needs an identified changed condition and a later Codex decision.

R3 - VERIFICATION AND EVIDENCE

Use targeted tests while implementing. After the candidate is stable, run one
consolidated regression appropriate to the changed surface, including:

- node scripts/stage_b_b5_3/test/run_offline_suite.mjs, exit 0;
- the new registry, aggregate-exit and anti-false-green tests;
- targeted Runtime GC-B5R authority/binding/comprehension tests;
- relevant extension/canary tests and typecheck/build:e2e;
- relay v11 baseline 50/50 and mutations 16/16 if any source-scope file changes;
- secret/private-path/raw-media scans with every intentional negative listed;
- owned process/port/profile/temp-root cleanup checks.

Do not repeatedly run full suites after each edit. Follow workflow section 5.1:
targeted implementation loops, then one consolidated checkpoint regression.

Write the new evidence package only at:

docs/active/project/evidence/v3_media_companion/v3-completion/
gc-b5r-b5-real-run-2026-10-24/

It must contain at least:

- 00-status-and-scope.md
- 01-changed-file-hashes.json
- 02-commands-and-exits.md
- 03-preflight-receipt.json
- 04-six-source-case-table.md
- 05-per-source-receipts.json
- 06-provider-and-upload-boundary.json
- 07-process-ownership-and-cleanup.md
- 08-secret-path-raw-media-scan.json
- 09-prd-coverage-and-risks.md
- 10-handoff.md
- PAYLOAD_MANIFEST.sha256, generated last and verified with sha256sum -c

If the visible batch never starts, the evidence must say so and all action
counts must remain honest zeros. If it starts, record the exact number of owned
Chrome launches, visible windows, focus events, Provider calls, downloads,
imports and source attempts.

CONTRACT AND WORKTREE RULES

- Do not change public APIs, schemas, FailureCode sets, thresholds, message
  sets, Provider registry, Origin/auth ordering, denominators or historical
  evidence. If a real public/security contract change is unavoidable, stop and
  report it; do not self-authorize or self-refreeze.
- A source-scope digest-only drift with unchanged extracted code universe may
  be reported for Codex refreeze. Do not modify canonical relay fixture hashes
  or verifier digests yourself.
- Do not commit, push, reset, clean, checkout, revert or overwrite unrelated
  dirty worktree changes.
- Do not read Desktop or arbitrary user files except the exact authorized
  myCk.txt resolution described above. Do not search for secrets or media.
- Do not play sound. Do not use the user's Chrome. Clean every owned process,
  port, profile, database, task root and temporary media root in finally paths.

STOP STATE AND HANDOFF

Use exactly one final state:

1. GC-B5R B-5 REAL RUN AWAITING CODEX CHECKPOINT
   Use only after exactly six fresh attempts and all required machine evidence
   exists. Report complete/blocked/limited/failed counts without announcing
   B-5 or Stage B PASS.

2. GC-B5R B-5 REAL RUN BLOCKED AWAITING CODEX DECISION
   Use when R0/R1 or the single visible batch fails. State the one exact block,
   observed production behavior, action counts, cleanup proof and the smallest
   valid reopening condition. Do not enter B-6 or B-7.

Your final handoff must list changed files, contract changes or explicit none,
all commands and exit codes, per-source disposition, Chrome/Provider/download/
import/audio/focus counts, secret scan, cleanup, severity, residual risks and
the precise stop reason.
```

