# Codex implementation gate

Decision: **GO for GC-B5R-OFFLINE only**.

## Gate basis

1. WP-B final evidence establishes the current input fallback and v11 baseline.
2. The V3 PRD still requires Stage B B-5..B-7; these were not satisfied by
   local-import acceptance.
3. WP-C is explicitly conditional and WP-A/WP-B now cover the critical fallback
   scenario, so tabCapture requalification is not on the critical path.
4. The offline batch has fixed scope, twelve acceptance obligations, no real
   network/media/browser activity, and explicit stop rules for contract changes.
5. The expensive six-video and human/independent reviews are separated from the
   implementation loop, preventing repeated full acceptance.

Live gate verification on 2026-10-23:

- WP-B final `PAYLOAD_MANIFEST.sha256`: 7/7 OK, exit 0.
- relay v11 contract verifier: 50/50, exit 0.
- relay v11 mutation verifier: 16/16, exit 0.
- six-video registry and grounded contract SHA-256 match the values pinned in
  this package.
- documentation diff check: exit 0.

## Authorization

ClaudeCode may inspect and minimally edit the GC-B5R production composition,
runner, and directly related tests. It may run only the offline validation in
`05-claudecode-implementation-goal.md`.

Not authorized: Provider calls, Chrome, cookie injection, media downloads or
imports, six-video execution, large assets, audio, public contract changes,
refreeze, Stage C+, commit, or push.

The next Codex action occurs only after ClaudeCode returns
`GC-B5R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT`.
