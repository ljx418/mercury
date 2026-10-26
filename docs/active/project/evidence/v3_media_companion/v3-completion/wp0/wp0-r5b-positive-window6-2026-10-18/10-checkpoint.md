# WP0 R5-B visible checkpoint, window 6

Date: 2026-10-18

Status: `R5-B PRODUCT CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T105248Z`
- Fixed source: `BV1Bb411w741`
- Production in-page Side Panel, fresh owned Chrome/Profile/Runtime
- Explicit `--mute-audio`; Provider / sound / visible retry: 0 / 0 / 0

## Result and root cause

The driver stopped before moving the native pointer because the new hit-test proved the requested
`media-capture-start` center was covered by `explain-selection`.

Source inspection found a product defect: `TrustedTabCaptureCard` was rendered inside the default-collapsed
`chat-context-dock` details element. DOM text and layout queries still returned the hidden card, creating a
false impression that the user action was visible. Its stale geometry overlapped the composer quick-action
strip.

The product correction moves the capture card outside the diagnostic details and before the conversation
frame. It is a non-shrinking, explicit main-path action while operational context remains collapsible. The
driver keeps the exact hit-test and will fail closed on any future occlusion.

This run is negative evidence and does not authorize R6.
