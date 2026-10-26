# Stage A risk stop: duplicate Media tasks across Navia surfaces

Date: 2026-10-12. Decision: **implementation stop before API contract change**.

## Reproduced behavior

An isolated headed Chrome opened `BV1hMpE6FEXG` and both Navia surfaces:
the page-injected `sidepanel.html?naviaInPage=1` iframe and a standalone
`sidepanel.html` tab. The test copied the actual extension into a temporary
directory and pregranted only its Bilibili/Cookie permissions so the real
Chrome permission popup did not block automated post-consent testing. The
actual extension manifest, user browser profile, original SQLite, and prior
sealed runs were untouched.

At least two runs produced two POSTs to `/v1/media/acquisitions`, one from
each surface, with different task IDs for the same
`portal:bilibili:BV1hMpE6FEXG:42652468500:p1`. One run reached a ready
UI while the visible transcript task ID did not match the product task ID.
The last failing probe captured both initiators and exited 2 on task-identity
closure. Three single-task probes also passed; this is a timing-dependent
failure, not a deterministic unit-test defect.

The local source-key ref guard reduces duplicate starts within one React
instance, but cannot coordinate two independent frames. The Runtime
`MediaAcquisitionCoordinator.create()` is idempotent by caller-supplied
`task_id` only. `MediaTaskStore` permits multiple task IDs for one source.
The current contract therefore cannot guarantee one authoritative task.

## Route decision required

| Route | Technical change | Cost / risk | User experience |
|---|---|---|---|
| A (recommended) | Runtime single-flight by source identity plus consent policy; `create` returns `created` or `attached` and the authoritative task ID. Browser clients only execute the created task and attach to its projection otherwise. Materialization is single-flight by task ID. | Medium: API response, coordinator lock, client attach path, cancellation/restart tests; no new media processing model. Must prove no cross-policy or cross-source attach. | Both surfaces show the same task and progress; no extra click. |
| B | Extension service-worker leader election or session-storage lease; Runtime contract unchanged. | Lower initial code but higher race and restart risk; MV3 worker suspension and multiple browser contexts can still duplicate tasks. | Usually seamless, but intermittent duplicate work remains possible. |
| C | Turn off auto-start in one surface. | Small implementation, high product regression. | User must choose a surface or manually restart; conflicts with approved one-click experience. |

Route A is preferred because only the Runtime can atomically arbitrate task
creation across all UI containers. The attach response must never share Cookie
or task-scoped credential material; an unused second lease must be revoked.
Cancellation from one surface must produce a visible shared terminal state,
not leave the other surface claiming success. On Runtime restart, temporary
acquisition can fail closed and the existing published-task restore path can
serve completed work.

## Required acceptance if A is approved

1. One real Bilibili video, two surfaces opened concurrently: requests may
   race, but exactly one response is `created`, the other is `attached`, and
   there is one authoritative task, one execution, one materialization, one
   task ID in both surfaces, and no stale ready claim after cancellation.
2. Repeat the concurrent run at least five times under different timing;
   include one surface reload, one Runtime restart, and one manual retry.
3. Deny attach when source identity or consent policy differs. Verify cleanup
   of unused task-scoped lease and no Cookie/raw-media bytes in public logs.
4. Keep the actual extension manifest unchanged. Separately disclose that
   automated pregrant does not validate the first-use Chrome permission popup.
5. Only after these pass resume Stage A terminal/retry and Stage B six-video
   content-quality work. No existing sealed candidate may be rewritten.

Internal review: Fatal=0, Major=1 open cross-surface identity/false-ready risk.
No backend/API implementation in this risk-stop step. User confirmation is
required before changing the shared acquisition contract.
