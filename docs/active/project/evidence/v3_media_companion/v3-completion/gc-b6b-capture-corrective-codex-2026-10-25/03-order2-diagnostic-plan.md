# Order-2 Diagnostic Canary Plan

## Purpose

Determine whether frozen source order 2 can produce a reviewable `ready`
product and, if not, identify the stable visual-materialization failure without
spending another complete six-source batch.

The canary is never a B5/B6 candidate, never performs semantic scoring, and
can never emit a stage PASS state.

## Architecture

```text
offline canary implementation and anti-false-green tests
  -> Codex checkpoint
  -> fresh one-use authorization + zero-action preflight
  -> consume only the frozen order-2 child grant
  -> one owned visible product flow, --mute-audio
  -> passive Runtime response observations
       materialize-visual: attempted/status/stable error code
       text fallback: attempted/status/stable error code
  -> terminal task state + evidence-kind counts
  -> B6 capture result + stable diagnostic codes
  -> owner cleanup/process audit
  -> DIAGNOSTIC READY | DIAGNOSTIC BLOCKED
  -> Codex decision on a new full B6B candidate
```

## Offline implementation requirements

1. Add a dedicated canary entry point that accepts only registry order 2 and
   refuses every other primary or reserve source.
2. Reuse the existing authorization owner, child-grant verification, action
   ledger, owned Chrome/Runtime isolation, capture, and cleanup code. Do not
   create a second owner path.
3. Observe normal product calls passively. Persist only method, route class,
   status, and an allowlisted uppercase error code. Never persist response
   bodies, headers, credentials, paths, Provider identity, or content.
4. Record terminal task state and counts for transcript/frame/OCR/caption
   evidence. Counts must come from the authenticated public workspace route or
   the existing machine receipt, not direct SQL fabrication.
5. The canary must hard-code a non-candidate schema and reject any attempt to
   produce aggregate, review row, sentinel, or PASS output.
6. Add process-level tests for wrong order, reserve use, missing/newly reused
   authorization, missing diagnostics, fabricated frame counts, cleanup
   failure, and accidental candidate language.
7. Default/offline execution must perform zero external actions.

## Later visible canary exit

`ORDER2 DIAGNOSTIC READY FOR CODEX` requires task state `ready`, at least one
real PNG-backed frame, closed seek/capture, exact action accounting, and clean
owned shutdown. Any degraded state, missing frame, visual error, privacy
refusal, or cleanup defect yields `ORDER2 DIAGNOSTIC BLOCKED` with stable codes.

Neither result authorizes a full B6B rerun by itself.

