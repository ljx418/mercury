# V3-5.10 Stage A NJ-05 chapter recovery

Date: 2026-10-12. Decision: **NJ-05 bounded implementation-session PASS on one fresh real Chrome task; Stage A remains NO-GO.** This is not an independent combined Stage A exit audit.

## Failure and repair

The first real run opened a syntactically valid but absent chapter, showed the correct task-scoped alert and returned to the same outline when the recovery link was activated with Enter. However, keyboard focus landed on `BODY`. That run produced `first-use-runs/20261012T140028324Z-chapter-recovery-result.json` and is not the passing candidate. `SemanticOutlineView` now remembers a recovery-link activation and focuses the first chapter-index link after the chapter query clears. A focused component regression passed 14/14 tests.

The first run's public result initially included the focused link's text, which could contain transcript words. Because it was not sealed, that field was removed from the prior public JSON immediately and from the runner before a new run. The prior result is retained only as a redacted historical diagnostic; its original bytes and hash must not be cited as acceptance evidence.

## Fresh passing evidence

- Real page: `https://www.bilibili.com/video/BV1hMpE6FEXG` in isolated Chrome under Xvfb with fresh Runtime, profile, database copy and private media roots. Site/cookie permissions were pregranted only in the temporary extension; native first-use permission UX is outside this run.
- Runner mode: `NAVIA_STAGE_A_CHECK_WORKSPACE=1 NAVIA_STAGE_A_CHAPTER_RECOVERY_CHECK=1`.
- Result: `first-use-runs/20261012T140323401Z-chapter-recovery-result.json`, SHA-256 `fa93662370ada4b91f136cad26329a6f379b983aced1af7330881598c10cf36f`; process exit 0.
- The absent `chapter_deadbeefdeadbeef` produced `该章节不属于当前视频任务`. Enter on `返回本任务大纲` cleared the query, preserved `media_task_955ada8d99344467af6bc61489012618`, did not show `无效媒体路由`, and focused an `A` element in the chapter index rather than `BODY`.
- The same run also satisfied its original ready-task identity, Workspace chapter keyboard, mindmap keyboard and four-viewport checks. A bounded public JSON scan found no focus text, transcript excerpt or Cookie/Bearer marker. The isolated harness cleaned its scratch environment.

## Boundary

This is a single-video chapter-recovery result, not proof of six-video quality, every bad route, every focus transition or complete Stage A exit. The Stage A ten-item fixed denominator and independent combined review remain required before Stage B.
