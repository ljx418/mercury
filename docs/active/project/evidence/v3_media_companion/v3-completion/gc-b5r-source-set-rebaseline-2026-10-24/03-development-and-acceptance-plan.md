# GC-B5R B-5 real-run development and acceptance plan

## R0 - freeze and offline runner correction

1. Copy the canonical v2 registry into an active non-historical fixture path or
   make the runner read the canonical file directly. Do not edit the old v1
   registry.
2. Update the frozen digest/order tests to the six v2 primary sources. Reserve
   sources must be rejected by `assertFrozenIdentity` during this run.
3. Fix aggregate exit semantics before any real action. The sequencer must exit
   nonzero for any `failed` or `limited` disposition, two or more `blocked`,
   fewer than six attempted sources without an explicit stop receipt, missing
   evidence, secret/upload violation, or owned-process leak.
4. Freeze the positive candidate threshold as:
   `complete >= 5`, `blocked <= 1`, `limited = 0`, `failed = 0`, exactly six
   fresh source rows, no substitution and no cross-run reuse.
5. Add negative tests proving one failed, one limited, two blocked, reserve
   substitution, wrong order, stale artifact and missing final receipt all
   produce nonzero exit.

## R1 - production prerequisite composition

Before Chrome or Provider use, prove:

- exact v2 registry digest and source order;
- the explicitly authorized Cookie file is readable and contains the frozen
  required name without printing values;
- owned Chrome executable/build and extension bundle exist;
- Runtime port/profile/database/task roots are fresh and owned;
- model, VAD, ffmpeg, ffprobe and yt-dlp are verified through product managers;
- the isolated Runtime can obtain the selected
  `minimax-cn-openai-vision / minimax_chat_completions` configuration through a
  supported product bootstrap, without direct SQLite mutation or exposing the
  API key;
- each source's public metadata still matches its BVID and remains non-paywalled;
- disk/memory budgets and cleanup handlers are ready.

The existing runner currently lacks a proven Cookie-to-owned-profile path and
fresh isolated Provider configuration. These must be closed offline/process
level by reusing existing product/canary helpers, not by adding a second owner
or reading secrets into evidence.

Any missing prerequisite produces `EXTERNAL-INPUT BLOCK` before Chrome and
before Provider invocation.

## R2 - one consolidated real execution

- One announced batch, six sequential fresh namespaces.
- Owned Chrome only; every launch includes `--mute-audio`.
- No audio output device use and no interaction with the user's Chrome/profile.
- Each BVID gets fresh Runtime, SQLite database, Chrome profile and task ID.
- Route order remains product-owned: automatic acquisition, explicit local
  import only when genuinely selected; tabCapture remains default-off.
- Exactly one selected Provider authority per task. Only derived transcript,
  OCR and vision-caption text may cross the Provider boundary.
- Raw video/audio/frame bytes, Cookie, API key and local path upload counters
  remain exactly zero.
- Do not automatically retry a failed visible case. Save a redacted diagnostic,
  clean all owned resources and stop. A retry requires an identified changed
  condition and a later Codex decision.

## R3 - evidence and stop

For every source record task/source/revision IDs, route, terminal disposition,
receipt hashes, derivative hash, Provider/endpoint identity, six upload
counters, process/profile ownership, cleanup and residual counts. Do not record
Cookie values, API keys, raw media, transcript text or private absolute paths.

The workpack may stop in one of two states:

- `GC-B5R B-5 REAL RUN AWAITING CODEX CHECKPOINT` when six fresh attempts and
  all machine gates complete;
- `GC-B5R B-5 REAL RUN BLOCKED AWAITING CODEX DECISION` when preflight or the
  single visible batch fails.

Neither state announces B-5 or Stage B PASS. B-6 and B-7 remain separate.

