# Stage A policy-switch preimplementation audit

Date: 2026-10-12. Reviewer: implementation session, static internal review;
not an independent exit review. Input:
`stage-a-policy-switch-development-and-acceptance-plan.md`, approved user
choice to retain isolated history, current Runtime/extension code and Stage A
Route A contract candidate.

## Findings and disposition

1. Source-read isolation: `MediaTaskStore.latest_for_source()` currently
   queries by update time, while acquisition/transcript latest reads use an
   in-memory latest task. The detailed plan now binds both paths to the
   durable source-authority task ID and requires typed pending instead of
   old-result fallback. **Design closure; implementation and PS-07 proof open.**
2. Atomicity: a mark-then-resolve sequence would admit races. The plan
   specifies one `BEGIN IMMEDIATE` compare-and-swap that records the new
   task, switch receipt and authority update together; sandbox creation is
   cleaned on rollback. **Design closure; PS-04/PS-09 proof open.**
3. Historical provenance: old product/evidence bytes remain unchanged under
   old task ID; current-source reads cannot attach them after switch. Direct
   historical views need an explicit banner and policy provenance. **Design
   closure; UI and PS-03/PS-08 proof open.**
4. Active work: switch endpoint does not implicitly cancel. Existing explicit
   cancellation/cleanup barrier must reach terminal before replacement.
   **Design closure; PS-06 proof open.**
5. Consent/auth: new endpoint uses existing bootstrap session, exact field
   set, registered current policy tuple, and literal confirmation. No secret
   transport or permission expansion is specified. **Design closure; PS-05
   and PS-11 proof open.**

No new Fatal or Major **design ambiguity** remains for beginning this bounded
substage. This is not an implementation PASS. Code work must proceed in
storage/API, source read isolation, UI confirmation, then fresh browser and
independent exit review. Any inability to preserve old bytes or to make the
authority swap atomic reopens a Major and stops implementation. Stage A, B-D,
and V3 final remain NO-GO pending their respective exit evidence.
