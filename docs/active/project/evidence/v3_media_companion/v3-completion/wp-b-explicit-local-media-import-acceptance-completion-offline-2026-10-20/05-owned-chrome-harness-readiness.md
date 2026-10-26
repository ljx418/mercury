# WP-B AC3 — the ONE owned-Chrome session is ready

The session that will run **B27, B29 and B30 together** exists, is deterministic
and is owned. In this offline phase it was **prepared and proven, never
launched**: no Chrome process, no visible window, no focus event, no audio
output device, and no gigabyte on disk.

## What was built

| file | role |
|---|---|
| `apps/chrome-extension/e2e/lib/v3WpBLocalImportOwnedSession.mjs` | the decision logic: the launch plan, the ownership rules, the seed validator, the asset plans, the cleanup plan, the offline guard |
| `apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs` | the ONE session runner that will execute the three cases |
| `apps/chrome-extension/e2e/lib/v3WpBLocalImportOwnedSession.node-test.mjs` | 7 offline tests that prove every rule above |

## The rules the offline tests prove

1. **Owned.** The profile directory is `navia-t01-profile-<token>` under a
   temporary root the run created itself; the debugging port is the run's own; the
   PID is the run's own.
2. **Never the user's Chrome.** The plan is checked against the user's profile
   markers (`AppData\Local\Google\Chrome\User Data`, the macOS and the Linux
   equivalents) and refuses to build if one of them appears.
3. **Always muted.** `--mute-audio` is in the argument list, and the ownership
   assertion fails without it.
4. **The production extension.** `--load-extension` and
   `--disable-extensions-except` point at the built WXT output.
5. **Only the authorized media.** The seed may ONLY come from
   `NAVIA_WP_B_SEED_MEDIA`. An absent variable, or a path that is not a
   readable file, is refused. There is no search and no substitute.
6. **The seed is validated before use.** The real ffprobe must show BOTH a video
   and an audio stream and a duration inside the registry's 30–300 s window; the
   real local SenseVoice must produce at least 3 non-empty segments; the real
   frames must give at least 3 distinct digests. A seed that fails any of them
   is an `EXTERNAL-INPUT BLOCK`, never a reason to synthesize, pad or truncate.
7. **The assets follow the frozen generator.** libx264 / yuv420p / 1280x720 /
   30 fps / 8M video and aac / 48 kHz / 2 channels / 160k audio, the seed
   **looped** with `-stream_loop -1` and cut at the target duration. The
   allocated ratio is measured after the encode and a sparse result is refused.
8. **The cleanup is complete.** The owned PID is terminated and every owned path
   — the profile, the assets, the evidence and the temporary root — is removed
   in a `finally`, whatever happened. The cleanup is checked to own nothing
   outside its own root.
9. **The offline phase is inert.** `assertOfflinePhaseIsInert` refuses a plan
   that carries generated assets, and the runner's offline branch launches
   nothing, generates nothing and removes its own root.

## The offline run

```
$ node e2e/v3-wp-b-local-import-owned-session.mjs
{"phase":"offline","launched":false,"generatedAssets":0,"ownedRootRemoved":true}
```

```
$ npm run test:wp-b-owned-session
# tests 7
# pass 7
# fail 0
```

## What the later, approved run will do

One session, in this order:

1. resolve and validate the authorized seed (ffprobe, SenseVoice, frame hashes);
2. generate the two registry assets (100 MB and 1 GB) and prove neither is
   sparse;
3. launch the owned Chrome, muted, with the production extension;
4. run **B27** — a real Extension `XMLHttpRequest` is aborted and the import is
   cancelled through the **real** Runtime `DELETE` and status routes, with no
   `FakeXhr` and no mocked transport;
5. run **B29** and **B30** — the real assets enter through the Side Panel file
   input and reach a real product, with the frozen RSS/heap, progress, UX and
   accessibility oracles collected;
6. clean up every owned path in a `finally`.

The exact command, the expected duration and storage, the seed requirement and
the cleanup plan are in `09-handoff.md`.
