# GC-B5R source-set rebaseline decision

Date: 2026-10-24

Decision: **GC-B5R B-5 REAL-RUN IMPLEMENTATION MAY START**

## Coordinate

- WP0 relay safety: complete.
- WP-A dependency readiness: complete.
- WP-B explicit local import: PASS, B01-B30 30/30.
- GC-B5R offline implementation: PASS.
- relay v11 after Codex limited refreeze: baseline 50/50, mutations 16/16.
- Stage B B-5 real six-video run: next workpack.
- B-6 semantic review and B-7 independent exit: not started.
- Stage C/D/E and V3-6/V3-7: not complete.
- WP-C tabCapture requalification: deferred and default-off.

## Source decision

The user supplied ten normally accessible Bilibili BVIDs. Public metadata-only
inspection returned `code=0`, one part, `pay=0`, `ugc_pay=0` and `download=1`
for all ten. This inspection used no Cookie and downloaded no media; it is not
acceptance evidence for playback, audio, product acquisition or synthesis.

The first six in the user-supplied order are the fixed B-5 denominator. The
last four are frozen reserves for a future Codex rebaseline only. A running
sequencer may never substitute a reserve for a fixed source.

The canonical v2 registry is `02-stage-b-six-video-registry-v2.json`, SHA-256:

`9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454`

The historical v1 registry and all old failure evidence remain immutable.

## Authorization boundary

ClaudeCode may harden the runner for this v2 registry, perform offline and
process-level preflight, and, only after every prerequisite is green, execute
one consolidated owned-Chrome real run with `--mute-audio`. The user's prior
continuous authorization through the current development stage covers that
single batch.

No B-6/B-7, Stage C+, WP-C, public API/schema/FailureCode change, raw-media
Provider upload, denominator substitution, commit or push is authorized.

