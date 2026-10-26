# WP0 R5-B single-window checkpoint

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T103228Z`
- Fixed source: `BV1Bb411w741`
- Surface: production in-page extension Side Panel
- Chrome: fresh owned Profile/PID, visible, explicit `--mute-audio`
- Provider calls: 0
- Audible output: 0

## Observed path

The production path reached `awaiting_trusted_capture`, the exact three-route fallback completed, the real
video exposed decoded audio, Cookie permission was confirmed, and no credential or private path appeared in
the UI. The run stopped before capture because the owned-PID UIAutomation helper returned `status=null`.

The root cause was deterministic: the PowerShell script allowed 20 seconds for the target control to become
unique, visible and enabled, but Node killed that process after 15 seconds. The helper now has a 30-second
process budget for a 20-second UIAutomation wait and reports process error/signal details.

A second headless review found two additional reliability defects before another visible run was allowed:
the helper used the obsolete `取消采集` label while the product renders `取消`, and it searched the whole
desktop automation tree. The helper now uses the exact product label and searches only the owned Chrome main
window obtained from the verified owned PID. This reduces both false negatives and the risk of interacting
with an unrelated window.

This run is corrective evidence only. It does not satisfy R5B-05..R5B-10 and does not authorize R6.
