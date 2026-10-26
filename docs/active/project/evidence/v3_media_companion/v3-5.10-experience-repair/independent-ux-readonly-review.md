# V3-5.10 independent UX read-only review and disposition

Date: 2026-10-12. Reviewer: separate read-only Agent using UX Architect and
Accessibility Auditor skills. The reviewer inspected code and design; it did
not run Chrome, Axe, a screen reader, or product tests. This record preserves
findings separately from the implementing agent's conclusions.

| ID | Severity | Code-grounded finding | Current disposition / required evidence |
|---|---|---|---|
| UX-01 | Serious | `useMediaAcquisitionTask` could stop polling when the first projection lookup preceded task creation. | Locally repaired with bounded 404/empty retry; delayed-creation and auth-error unit tests pass. Real cross-surface Chrome still required. |
| UX-02 | Serious | Workspace fetches a task on route/connect change but does not subscribe to an unpublished task's eventual terminal state. | Open. Keep Chat and Workspace visible through publish/cancel/retry/reconnect and prove matching task ID/revision without reload. |
| UX-03 | Serious | React Flow node click discarded seek result and rejection. | Local code now exposes located/blocked/error status. Real matching-tab and missing-tab click evidence pending. |
| UX-04 | Serious | Focusable frame stack expands visually, but individual frames are not keyboard actions. | Local code candidate makes each frame a keyboard-focusable evidence link. Real keyboard/focus/return Chrome evidence remains open. |
| UX-05 | Moderate | Mindmap accessible tree uses every item as a Tab stop while also implementing arrow navigation; nested buttons complicate focus order. | Open. Verify and repair Tab/arrows/Home/End, expanded state and screen-reader announcement. |
| UX-06 | Moderate | A syntactically valid but absent chapter ID was ignored silently. | Local code now shows a chapter-unavailable alert and a task-scoped recovery link; unit test passes. Browser focus/recovery pending. |
| UX-07 | Moderate | Comprehension evidence links do not preserve chapter return binding; Esc/Back can lose chapter and focus. | Local code candidate records the exact trigger and hash route and restores focus on Back/Esc; targeted tests pass. Later-chapter real Chrome evidence remains open. |
| UX-08 | Moderate | Chat clock counted only from component mount and reset on reload; last-progress age advanced only on render. | Local code now fetches existing acquisition `startedAt` and ticks while running, with explicitly labelled local fallback. Real reload/reconnect evidence pending. |

The known cross-surface duplicate-task/false-ready Major is separate and
remains the Stage A release stop. UX-01/03/06/08 local changes are **not**
accepted E2E until tested in the actual browser. UX-02/05 remain open in code;
UX-04/07 remain open for end-to-end acceptance.
No independent implementation exit audit has been performed.
