# WP0 R5-B low-disturbance visible checkpoint

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T103937Z`
- Fixed source: `BV1Bb411w741`
- Surface: production in-page extension Side Panel
- Chrome: one fresh owned Profile/PID, visible, explicit `--mute-audio`
- Provider calls: 0
- Audible output: 0
- Visible retries: 0

## Result

The product again reached the exact three-route fallback, `awaiting_trusted_capture`, real playback and a
decoded audio track. The trusted native click did not occur because UIAutomation returned `matchCount=0`.

The failure is in the test helper ownership predicate. Chrome page accessibility descendants are hosted by
renderer processes, while the helper required every descendant to have the browser main-process PID. The
owned main-window root was correct, but the child-process predicate removed the legitimate button.

The bounded correction keeps `AutomationElement.FromHandle(ownedMainWindow)` as the only search root,
removes the invalid descendant PID equality, and requires the unique candidate rectangle to remain fully
inside the owned main-window rectangle. The exact-name allowlist, profile/PID verification, visibility,
enabled state and valid geometry checks remain mandatory.

This run is negative corrective evidence. It does not prove R5B-05..R5B-10 and does not authorize R6.
