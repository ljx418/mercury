# V3-5.10 Stage A NJ-04 delayed-read route isolation

Date: 2026-10-12. Decision: **NJ-04 bounded implementation-session PASS for one fresh real Chrome task; Stage A remains NO-GO.** This does not substitute for the independent combined Stage A audit.

## Real browser sequence

The isolated Chrome opened `https://www.bilibili.com/video/BV1hMpE6FEXG` and created `media_task_881419417823496b8843c6b11674c8c4`. The runner delayed only the first Workspace GET for this task's transcript projection. While that request was held, it navigated Workspace to the nonexistent but valid-shaped `media_task_ffffffffffffffffffffffffffffffff`. Runtime returned HTTP 404 for the unknown task; Workspace showed `无法读取该媒体任务`, an empty rendered task ID, and zero task-content nodes. After the held old request returned HTTP 200 (revision 1, `created`), the unknown route still showed only the error. Browser Back restored the original route and visible original task ID/content.

Evidence: `first-use-runs/20261012T135152769Z-route-drift-result.json`, SHA-256 `4fcd145b4775045ab26cf6b5dc973f215182cce8f274d3d442b9b93d4a1ef8a6`. The runner exited 0 and removed its isolated browser/Runtime/database/media scratch. The public JSON had zero hits for the bounded Cookie/Bearer secret-keyword scan.

## Boundary

The site/cookie permissions were pregranted in the temporary extension, so this is not first-use permission evidence. The run validates one real pending-task route race, not every route, published-outline race, browser process restart, six-video content quality, or the fixed Stage A denominator as a whole. No product code was changed for NJ-04; the delay was test-only and did not alter Runtime responses.
