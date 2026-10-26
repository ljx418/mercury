# WP-B corrective continuation decision

Date: 2026-10-20

Decision: **SAME CORRECTIVE BATCH MAY CONTINUE**

Coordinate: `WP-A PASS / WP-B corrective implementation incomplete / C3-C7 authorized / WP-C locked`.

## Classification

The ClaudeCode result is not a new checkpoint candidate. It stopped because its execution budget was
exhausted while six findings from the already-authorized corrective plan were still open. No new
external audit or new planning cycle is justified. Continue the same corrective batch.

## Accepted incremental work

- C1 schema/id/public projection correction is retained. Targeted contracts/store/manager tests pass
  37/37 in the Codex environment.
- C2 fixed the production PUT function's sync/async defects and exception cleanup. The targeted suite
  passes, and the code now uses synchronous `begin_stream()` plus `async for request.stream()`.
- The frozen schemas, 18-code set, thresholds, B01-B30 denominator, T1-T4 order and relay inventories
  were not expanded.

## Evidence correction

The C2 test constructs a Starlette `Request` and directly invokes `put_local_import_content`; it does
not traverse the ASGI router or middleware. Its digest assertion only proves a nonempty local hash,
not that the canonical digest/manifest is durably stored and later consumed. Therefore C2's code fix
is accepted, but full authenticated HTTP/CORS/durable handoff proof remains part of C6/C7.

## Still open

1. C3: prove acquisition task/source eligibility before import/quota/writer allocation.
2. C4: production orchestration from durable upload through preparer, T1-T4, transcript and visual
   materialization.
3. C5: durable barrier receipts/terminal state, real coordinator APIs, startup recovery and exactly-once
   cleanup.
4. C6: exact CORS, authenticated Runtime URL/bearer, actual XHR abort/polling and production card mount.
5. C7: production-composition tests and restart/hard-kill oracles, including a true routed HTTP PUT.

These are the same one Fatal and five Major findings already authorized. Missing B29/B30 seed media
is a separate external-input gate and must not be considered until C3-C7 are closed.

## Relay decision

Do not refreeze `app.py` or `coordinator.py`. The current 46/50 source-hash result is expected while
authorized implementation is incomplete. Codex will make one limited refreeze only after C3-C7,
B01-B28 production evidence and code inventories are stable with no Fatal/Major findings.

## Stop rule

Use `01-claudecode-continuation-goal.md`. ClaudeCode must continue implementation rather than repeat
this diagnosis. It may stop only after C3-C7 are closed or after a newly discovered blocker is reduced
to a reproducible failing production test that cannot be resolved within the frozen contract.

