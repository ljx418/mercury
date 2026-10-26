# WP0 R5-B visible checkpoint, window 3

Date: 2026-10-18

Status: `R5-B CORRECTIVE READY / POSITIVE STILL REQUIRED / R6 IMPLEMENTATION NO-GO`

## Run

- Run ID: `r5b-positive-20261018T104325Z`
- Fixed source: `BV1Bb411w741`
- Surface: production in-page extension Side Panel
- Chrome: one fresh owned Profile/PID, visible, explicit `--mute-audio`
- Provider / audible output / visible retry: 0 / 0 / 0

## Result and root cause

The product reached the production three-route fallback, `awaiting_trusted_capture`, real playback and a
decoded audio track. The first exact-name UIAutomation click on `启用并分析当前视频` succeeded and produced
an owned screen rectangle. The later exact-name lookup for `捕获当前标签页` returned `matchCount=0`.

This disproves the previous hypothesis that renderer PID equality was the only problem: dynamically rendered
extension-iframe controls are not guaranteed to appear in Chrome's top-level UIAutomation subtree. Further
relaxing the tree search would require desktop scanning and is prohibited.

The bounded correction uses the first successful exact-name owned-control observation as a same-session
screen calibration. Later controls use their fresh CDP center plus that calibration, then execute a real OS
pointer click through the helper that revalidates Profile, owned main PID and main-window bounds. It never
uses a persisted or absolute desktop coordinate, and geometry mismatch fails closed.

This run remains negative evidence and does not authorize R6.
