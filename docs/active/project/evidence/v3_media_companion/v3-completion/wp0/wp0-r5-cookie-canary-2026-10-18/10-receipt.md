# WP0 R5 cookie canary receipt

## Decision

`R5 NO-GO / FIXED INPUT DID NOT EXERCISE RELAY`. R6 was not entered.

The user-authorized `myCk.txt` passed the product parser and was imported through Settings > 媒体与语音 > B站登录态下载. The UI reported configured, verified, and enabled. One visible production canary was then run on the frozen BVID through the in-page Navia user entry.

## Real result

- taskId: `media_task_a9e631cb571a48098c8f066419a04aba`
- sourceIdentity: `portal:bilibili:BV1pohR6rEEh:42216784482:p1`
- acquisition: `succeeded`
- selected route: `credentialed_subtitle`
- transcript: 598 nonempty timestamped segments
- transcript revision: 3
- outline product: `degraded`, revision 6
- UI: `视频已就绪`, busy state exited
- visual materialization: first request 503, frozen text fallback 200, later governed visual retry 200

This is a valid product success, but it produced no Offscreen PCM and did not invoke SenseVoice. Therefore it does not satisfy R5 oracle 3–5 and cannot be called R5 PASS.

## Changed product files

- `apps/chrome-extension/entrypoints/sidepanel/main.tsx`
- `apps/chrome-extension/src/modules/media_companion/MediaCompanionLaunchCard.tsx`
- `apps/chrome-extension/src/modules/media_companion/tests/MediaCompanionLaunchCard.test.tsx`
- `apps/chrome-extension/e2e/lib/r5UserReachableLaunch.node-test.mjs`

Public contract changes: none.

