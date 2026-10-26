# WP0 R5-B window 11 handoff

Date: 2026-10-18

## Changed files

- Evidence documents in this directory
- `docs/active/project/design/project-stage-workflow.md` low-disturbance clarification

Product code: none in this checkpoint.

## Contract changes

None implemented. A relay v10 internal sender-policy change is proposed and remains unauthorized.

## Proposed single corrective batch

1. Preserve strict validation when `MessageSender.documentId` is present.
2. When it is absent, require the exact extension ID, exact bundled Offscreen URL, absent tab, absent-or-zero frame,
   exactly one matching `OFFSCREEN_DOCUMENT`, exact extension origin, matching incognito state, and a non-empty
   `ExtensionContext.documentId`; bind that context ID for replacement detection.
3. Reject zero/multiple contexts and every mismatch with the existing fixed public failure code.
4. Preserve relay v10 as historical evidence; create relay v11 and replace the v10 fifth sender-negative
   semantic with an authoritative-context-missing/ambiguous/mismatched/replaced case. A missing optional sender
   document ID alone is not a v11 failure; a missing or ambiguous authoritative Offscreen context remains a failure.
5. Add production-class positive and negative tests, create the v11 verifier/mutations, run one consolidated offline
   checkpoint, then spend one later visible muted canary budget.

## Low-disturbance execution

All implementation, contract, unit, integration, build, and secret checks run without a visible window. Only the
final stable positive canary may use one owned visible Chrome with `--mute-audio`; it must not touch the user's
browser/game and must be cleaned immediately.
