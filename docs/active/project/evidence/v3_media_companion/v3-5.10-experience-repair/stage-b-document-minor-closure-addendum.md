# Stage B document-audit Minor closure addendum

Date: 2026-10-13. Status: candidate for independent recheck. This addendum
responds only to Mn1-Mn5 in
`stage-b-independent-document-audit-2026-10-13.md`; it does not authorize code.

| Finding | Closure |
|---|---|
| Mn1 blocked layer implicit | Contract now states `blocked` is an existing terminal TaskStore/denominator disposition, intentionally absent from V2 `quality.status`, and produces no V2 JSON. |
| Mn2 V2 path not frozen | Contract freezes `grounded-comprehension-v2/<taskId>/revision-<taskRevision>/<evidenceCatalogSha256>.json`; V1 synthesis bytes are untouched. |
| Mn3 host model not pinned | B-6 must record a stable exact model ID, prompt SHA-256 and session before the first judgment and use them for the whole denominator; unavailable ID is NO-GO. |
| Mn4 six-video registry not pinned | `stage-b-six-video-registry.json` freezes order, BVIDs, dispositions, isolation, no substitution/reuse and `--mute-audio`. |
| Mn5 independent authority unnamed | B-7 requires a new ClaudeCode CLI/Orca reviewer with task, dispatch and prompt hash distinct from implementation and B-6. |

The prior independent report remains immutable. A new reviewer must recompute
the revised hashes, verify these closures and decide document readiness.
