# V3-5.10 Stage A NJ-06 truthful seek receipts

Date: 2026-10-12. Decision: **NJ-06 bounded implementation-session PASS for one fresh real Bilibili task; Stage A remains NO-GO.** No independent combined Stage A exit claim is made.

## Fresh passing sequence

The isolated Chrome/Runtime run opened `https://www.bilibili.com/video/BV1hMpE6FEXG`, created `media_task_129d330fc1bf4c0aa3204eb56265b1ef` and published its outline. The runner selected a later chapter with requested position 915,580 ms, not the near-zero first chapter. With a matching video tab open, the chapter control returned `located`, observed 915,580 ms and delta 0 ms. After both matching video tabs were closed, the same control returned `blocked` with `V3_MEDIA_PAGE_IDENTITY_INCOMPLETE`; zero matching video tabs existed before and after that blocked action. No new video tab was opened.

Passing public result: `first-use-runs/20261012T142302556Z-seek-result.json`, SHA-256 `2f8de34c54d6843027135f04bff398042f0839f967251252a0b547b80e046b1b`. Exit code 0. The same run satisfied its existing ready-task identity, four-viewport/Axe, chapter keyboard and mindmap keyboard checks. The public JSON had zero hits for the bounded transcript/focus-text and Cookie/Bearer marker scan. The isolated browser, Runtime and scratch roots were cleaned.

## Failed and weaker attempts retained

- An earlier probe failed at a 360px outline screenshot whose pixel signal was one color; it never reached seek and is not a passing result.
- `first-use-runs/20261012T141047288Z-seek-result.json` reached a matching-page `located` receipt but requested only 80 ms. It is too close to the initial player position to prove a meaningful jump and is not used for NJ-06 exit.
- A later probe selected a 915-second chapter but the button was hidden by a closed/re-rendered details element; it timed out without a receipt. The runner now requires the user-visible chapter to stay expanded before clicking, without force-clicking.
- `first-use-runs/20261012T141542048Z-seek-result.json` exposed standalone Chat's immediate `分析受阻` while source authority remained `active` and task state `created` during the test-only 30-second execute delay. The product now displays an attached/waiting state for that combination and checks the same authority/task again after 45 seconds before exposing a same-task retry warning. The final run also asserts that this false terminal state does not appear. The 45-second stuck-created watchdog still needs a separate focused acceptance check; the present run does not prove that timeout path.

## Boundary

This is one video, one chapter-origin seek, and a missing-tab negative. It does not prove all five seek origins, wrong-video-tab behavior, multipart boundaries, the full twelve-page matrix or complete Stage A. Site/cookie permissions were pregranted only in the temporary extension; native first-use permission UX is outside this run.
