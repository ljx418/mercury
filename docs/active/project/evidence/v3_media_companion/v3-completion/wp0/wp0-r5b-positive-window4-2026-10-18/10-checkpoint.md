# WP0 R5-B visible checkpoint, window 4

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T104655Z`
- Fixed source: `BV1Bb411w741`
- Production in-page Side Panel, fresh owned Chrome/Profile/Runtime
- Explicit `--mute-audio`; Provider / sound / visible retry: 0 / 0 / 0

## Result and root cause

The product reached `awaiting_trusted_capture` after the real three-route fallback and exposed a decoded audio
track. Exact-name calibration succeeded. The calibrated native point was `1024,818`, but the point helper
rejected it against a reported owned-window rectangle of `20,20,660,470`.

The window was launched at 1280x900 and UIAutomation reported physical-pixel control coordinates. The
PowerShell process was DPI-unaware, so `GetWindowRect` was virtualized to logical coordinates while the CDP
projection and pointer remained in physical coordinates. The boundary rejection was correct for its inputs,
but the inputs used incompatible coordinate spaces.

The correction declares Per-Monitor-V2 DPI awareness before any UIAutomation/Win32 rectangle comparison in
both the calibration and projected-pointer scripts. Profile, owned PID and window-boundary checks remain.
This run is negative evidence and does not authorize R6.
