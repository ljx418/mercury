# WP0 R5-B visible checkpoint, window 5

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T104954Z`
- Fixed source: `BV1Bb411w741`
- Production in-page Side Panel, fresh owned Chrome/Profile/Runtime
- Explicit `--mute-audio`; Provider / sound / visible retry: 0 / 0 / 0

## Result and root cause

The DPI-aware projected point passed the owned-window boundary and a real OS pointer action was issued, but
the card remained in its initial `捕获当前标签页` state. Private geometry showed the target center at local
`y=621.78125`, near the bottom of the iframe.

The runner tried to center controls by assigning `scroller.scrollTop` from `element.offsetTop`. `offsetTop`
is relative to the offset parent, not necessarily the selected scroller, so the calculation did not prove
that the point was visible, unobscured or topmost. The pointer was therefore valid at the window boundary but
did not activate the intended element.

The correction uses native `element.scrollIntoView({block: "center"})`, computes fresh geometry, and requires
`document.elementFromPoint(center).closest("[data-testid]")` to identify the exact requested control before
any native projection. A mismatch fails closed. This negative run does not authorize R6.
