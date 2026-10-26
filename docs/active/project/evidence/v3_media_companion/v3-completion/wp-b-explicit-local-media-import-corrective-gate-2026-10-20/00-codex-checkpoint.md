# WP-B Codex implementation checkpoint

Date: 2026-10-20

Decision: **WP-B NO-GO / CORRECTIVE IMPLEMENTATION MAY START**

## Coordinate

`V3 post-R7 / WP-A PASS / WP-B implementation candidate rejected / WP-B corrective implementation authorized`

WP-C and V3 closeout remain locked. This checkpoint does not accept the implementation
evidence label, the reported 25/30 denominator, or a relay v11 refreeze.

## Accepted evidence

- The implementation evidence manifest verifies 6/6.
- Upload/store/preparer test assets and five hard-kill injection points are useful inputs for
  the corrective round.
- No sound or Chrome was used and the reported owned resources were cleaned.
- B29/B30 still require a registry-compliant private seed with at least 30,000 ms of real
  speech. The 12,290 ms host corpus cannot satisfy that oracle and the oracle must not be
  lowered.

## Rejected conclusions

The missing seed is not the only blocker. A read-only production-code review found two Fatal
and six Major findings. Therefore B01-B28 are not accepted as 25 PASS/PARTIAL outcomes and the
current candidate is not eligible for a source-scope refreeze.

### Fatal

1. The production PUT handler awaits synchronous `begin_stream()` and synchronously iterates
   `request.stream()`. A valid first upload raises before body streaming and can retain an open
   writer/session.
2. The production Runtime never composes the preparer, T1-T4 consumer barrier, transcript task,
   or product materializer. B21/B22 are structurally disconnected, not merely missing a seed.

### Major

1. Browser reachability is broken: local-import OPTIONS omits exact allow-origin, the XHR uses a
   relative extension URL without Runtime bearer, and `LocalMediaImportCard` is not mounted in a
   production eligible-blocked surface.
2. Consumer terminal state is process-local, the audio-owner receipt is discarded, and barrier
   cleanup calls coordinator methods with incompatible signatures/nonexistent methods.
3. Startup recovery is not composed and recovery can delete shared input before T3/audio staging.
4. Runtime and Extension records do not conform to the three frozen schemas (`schemaVersion`,
   `media_import_*`, `recoverable`, `media`, durable phase/terminal fields).
5. POST create does not prove the referenced task/source is an eligible blocked acquisition before
   allocating an import record/quota.
6. Client abort does not abort XHR, the UI treats one GET as completion, and core API/barrier/
   hard-kill tests use substitutes or weak oracles that cannot prove the production composition.

## Frozen evidence decision

Relay v11 remains at the last accepted WP-A baseline:

- `app.py`: `3c306a0113d2c53d18d6bdf353e55c61567bdaad55f75728a6dad551629b77c2`
- `coordinator.py`: `ddbf830f5ce5d15b2270deba636ad5620531ef122ef28ee6903a5f8ad603cb5c`
- source authority digest: `0e074285ade637bb1a4dbedd05b35623619a6f053ffef7dd00c08209afc7c206`

The current implementation may legitimately require both source files to change, but Codex will
refreeze them once only after production composition and acceptance are stable, target/source code
inventories are unchanged, and the corrective checkpoint has no Fatal/Major findings.

## Gate

ClaudeCode may execute the single corrective batch defined by `01-corrective-plan.md` using the
complete prompt in `02-claudecode-corrective-goal.md`. It must stop at
`WP-B CORRECTIVE AWAITING CODEX CHECKPOINT`; it must not enter WP-C or self-refreeze relay v11.

