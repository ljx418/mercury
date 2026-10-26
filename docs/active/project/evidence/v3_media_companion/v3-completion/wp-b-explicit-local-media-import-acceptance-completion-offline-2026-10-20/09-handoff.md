# WP-B acceptance completion — handoff

**State: `WP-B ACCEPTANCE COMPLETION READY FOR ONE VISIBLE RUN`**

Everything that can be proven OFFLINE is proven. Three cases — **B27, B29 and
B30** — need ONE approved visible Chrome session, and this note states exactly
what that session is, so Codex can request the user's single approval.

---

## 1. What is in the package

| file | content |
|---|---|
| `00-acceptance-completion-report.md` | this phase's report |
| `01-changed-file-hashes.json` | the SHA-256 of every changed file, taken from the FINAL stable worktree |
| `02-commands-and-exits.md` | every command of the consolidated regression and its exit code |
| `03-ac1-hard-kill-and-restart-receipt.md` / `.json` | the nine real kill points and the fresh-process recovery |
| `04-b01-b30-case-oracle-map.md` | every case, its exact oracle and its named test |
| `05-owned-chrome-harness-readiness.md` | the owned-session rules and their offline proofs |
| `06-relay-v11-inventory.json` | the relay v11 inventory, reported and NOT refrozen |
| `07-secret-path-raw-media-scan.json` | the secret / private-path / raw-media scan |
| `08-cleanup-report.md` | the owned process, port, temp and media cleanup |
| `09-handoff.md` | this note |
| `PAYLOAD_MANIFEST.sha256` | the verified payload manifest |

The builder is `services/local-runtime/scripts/build_wp_b_acceptance_completion_evidence.py`.
It hashes the worktree, writes the hash record and the manifest, and then
**re-hashes every listed file and fails if anything moved** — the exact failure
that invalidated the previous candidate.

## 2. Contract changes

**None.** The three frozen schemas, the 18-code closed set, the thresholds, the
B01–B30 denominator, the T1–T4 order, the Origin/auth order, the asset
registry, the WP-A digests and the v10/v11 historical evidence are all
byte-identical.

What changed is **conformance**: the implementation now MATCHES the frozen
contracts it had drifted from (the barrier record's schema version and shape,
the barrier phase vocabulary, the visual receipt's schema version, the frame
artifact ids, the public container enum and the source-identity check). Seven
such divergences were found by the new B01 oracle and fixed.

## 3. The one visible session

### The exact command

```bash
cd apps/chrome-extension
npm run build:e2e                                  # the PRODUCTION extension build

NAVIA_WP_B_SESSION_PHASE=visible-run \
NAVIA_WP_B_VISIBLE_APPROVED=1 \
NAVIA_WP_B_SEED_MEDIA=<absolute path to the authorized seed> \
NAVIA_CHROME_EXECUTABLE="<absolute path to Chrome>" \
NAVIA_WP_B_CDP_PORT=9731 \
node e2e/v3-wp-b-local-import-owned-session.mjs
```

Without `NAVIA_WP_B_VISIBLE_APPROVED=1` the runner refuses **before it touches
anything**, so an accidental invocation can never open a visible window.

### The seed requirement

`NAVIA_WP_B_SEED_MEDIA` must point at ONE explicitly authorized real media file
that satisfies the FROZEN registry requirements:

| requirement | value |
|---|---|
| container | `mp4`, `webm` or `matroska` |
| duration | 30,000 – 300,000 ms |
| streams | a real video stream **and** a real audio stream |
| speech | at least 3 non-empty local SenseVoice segments |
| frames | at least 3 distinct frame digests |

The runner validates all five with the real ffprobe, the real local SenseVoice
and the real frames **before** it uses the seed. A seed that fails is an
`EXTERNAL-INPUT BLOCK`, never a reason to synthesize, pad or truncate it.

### The expected duration and storage

| item | expectation |
|---|---|
| the 100 MB asset | 105 s, 96–112 MiB, 1280x720, 30 fps |
| the 1 GB asset | 1080 s, 0.95–1.05 GiB, 1280x720, 30 fps |
| the asset generation | roughly 5–15 minutes on the local CPU |
| the disk during the session | about 1.3 GB for the assets, plus the owned profile |
| the browser session | roughly 10–20 minutes for the three cases |
| the whole session | **under 45 minutes**, one Chrome process, one profile |

### What the session does, in order

1. resolve and validate the authorized seed;
2. generate the two registry assets and prove neither is sparse (the allocated
   ratio is measured after the encode);
3. launch the owned Chrome — `--mute-audio`, the owned profile, the owned port,
   the production extension;
4. **B27** — a real Extension `XMLHttpRequest` is aborted and the import is
   cancelled through the **real** Runtime `DELETE` and status routes. No
   `FakeXhr`, no mocked transport;
5. **B29** and **B30** — the real assets enter through the Side Panel file
   input and reach a real product, with the frozen RSS/heap, progress, product,
   UX and accessibility oracles collected;
6. clean up every owned path in a `finally`.

### The cleanup plan

| step | what |
|---|---|
| 1 | terminate the owned Chrome PID |
| 2 | remove the owned profile directory |
| 3 | remove the owned asset directory |
| 4 | remove the owned evidence directory |
| 5 | remove the owned temporary root |

The plan is checked to own **nothing** outside its own root, and the offline
tests prove it.

### The safety rules

* `--mute-audio` is always passed: no test may open an audio output device.
* The user's Chrome and the user's profile are never referenced; the plan is
  checked against their known locations and refuses to build if one appears.
* The session owns one profile directory, one PID and one debugging port.
* The B29/B30 assets are generated from the seed by LOOPING it; they are never
  sparse, never padded and never truncated, and the allocated ratio is measured
  and enforced.

## 4. What the next owner should know

1. **The frozen schema is the truth, and the implementation now matches it.**
   The new B01 oracle is the gate that keeps it that way: it meta-validates the
   three schemas, proves the Runtime's constants equal them, and validates the
   fixtures. Seven real divergences were found and fixed by it.
2. **The barrier's phase vocabulary is the frozen one.** `none` does not exist;
   the two consumer terminals are PHASES as well as flags, and the frozen
   vocabulary has no "not started" member, so the store carries the first phase
   as a placeholder. The recovery only ever acts on the durable receipts, so
   the placeholder can never authorise a release.
3. **The visual terminal is durable.** There is no in-memory claim; the durable
   barrier is the only owner, and the startup reconciliation closes a window
   that a crash could otherwise leave open forever.
4. **A tampered receipt is raised, not reported as absent.** An absent receipt
   would have silently moved the local route onto the downloader path, which the
   local route may not use.
5. **The one-shot token is verified before the other gates and consumed only
   when the write starts.** A wrong token is still refused first; a request
   refused for another reason leaves the token usable.
6. **The relay inventory is still 46/50 with no unlisted emits.** The drift is
   the frozen extractor's scope. **No refreeze was performed** — not of
   `app.py`, not of the coordinator, not of the source inventory, not of the
   verifier.

## 5. The boundaries that were not crossed

* No Chrome was launched, visible or headless.
* No audio was played; no test opened an audio output device.
* No Desktop, repository or drive was searched for media: the seed came only
  from the explicitly authorized variable.
* Nothing was committed, pushed, reset, cleaned, checked out or reverted, and
  no unrelated dirty-worktree change was overwritten.
* WP-B was not announced as PASS, WP-C was not entered, nothing was
  self-refrozen, and no external document review was performed.
