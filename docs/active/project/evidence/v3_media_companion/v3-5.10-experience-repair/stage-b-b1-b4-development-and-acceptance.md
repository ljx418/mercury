# Stage B B-1..B-4 development and acceptance

Date: 2026-10-13. Status: implementation entry approved by B-0 exit.

## Development sequence

1. B-1: add a pure evidence-span analyzer and temporal quality metrics.
2. B-2: request and validate brief, claims, chapters, evidence closure and limits.
3. B-3: persist a private revision/hash-bound V2 derivative with atomic replace;
   preserve historical V1 and prior bytes on provider or validation failure.
4. B-4: adapt V2 to the existing API and Overview. Show the brief, claims and
   visible limited state; keep transcript as collapsed inspection material.

## Acceptance

- Focused backend tests cover all frozen semantic invariants and stale-write guards.
- Existing V1 comprehension tests remain green.
- Frontend tests prove claims replace chapter excerpts in “主要表达与关键依据”,
  and a limited projection does not receive complete styling.
- Runtime tests prove API compatibility and zero raw-media disclosure counters.
- Typecheck/build pass without changing the public route family.

## Stop conditions

Any unknown evidence accepted, raw transcript prefix promoted to a brief, stale
revision/hash committed, V1 bytes changed, limited state shown as complete, or
Major PRD deviation stops implementation and returns to planning.

## PRD check

This scope directly repairs the reported low-value Overview content. It does not
claim semantic quality until B-5/B-6 real-source and host-model review pass.

