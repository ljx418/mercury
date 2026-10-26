# WP0 R5-B window 11 PRD review

Date: 2026-10-18

Decision: `NO-GO PENDING INTERNAL SECURITY CONTRACT DECISION`

- User-reachable launch, secure session, Cookie-backed acquisition attempts, and trusted capture eligibility were
  exercised with real data.
- The run remained silent, single-attempt, owned, and fully cleaned.
- The frozen exact-sender rule is stricter than the real Chrome sender object observed for the Offscreen Port.
- Repeating the same run without changing code or contract would be a false retry and is prohibited.
- Relaxing sender identity to URL-only is rejected because it would weaken the capture trust boundary.
- A bounded unique-context fallback can preserve exact extension, URL, context type, origin, incognito, tab/frame,
  and replacement protections while accommodating an absent optional `MessageSender.documentId`.
- That fallback changes the internal security contract and its negative-case meaning, so implementation and
  refreezing must wait for a single explicit checkpoint.

R5-B/R5 cannot pass, and R6 implementation cannot start, from this evidence.
