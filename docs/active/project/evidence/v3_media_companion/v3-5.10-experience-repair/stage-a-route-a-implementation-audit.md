# V3-5.10 Stage A Route A implementation audit

Date: 2026-10-12. **Superseded decision: Route A / Stage A NO-GO pending
`stage-a-route-a-risk-stop-2026-10-12.md`.** Scope: exact-source task arbitration across the in-page
Navia iframe, standalone side panel, another video tab, and local Runtime.
This is an implementation-agent audit, not an organizationally independent
exit review. Earlier sealed V2/V3 evidence was not modified.

## Updated exit judgment after approved cleanup repair

The superseded NO-GO above records the original risk stop. Following user
approval, cancellation and restart cleanup hardening received a narrow
independent read-only PASS with no remaining High/Major in those reviewed
paths. Full Stage A remains **NO-GO pending an independent exit review** of
the later browser evidence. Stages B-D and final human acceptance have not
started. Do not treat a `degraded` product as a V3 visual-quality pass.

### 2026-10-12 first-use and browser cancellation follow-up

Two previously open browser paths now have isolated real-Chrome evidence, but
this does **not** upgrade full Stage A. With the temporary extension's actual
optional permission manifest (no test pregrant), headed Chrome displayed the
native Bilibili/Cookie permission prompt. An OS-level click accepted that
prompt; `chrome.permissions.contains` then returned true for both grants.
The fresh `BV1hMpE6FEXG` run showed one authoritative task across in-page,
standalone panel and a second tab, one execution and a `degraded` product.
Evidence: `first-use-runs/20261012T071542197Z-first-use-result.json` and
`first-use-runs/20261012T071542197Z-native-permission-prompt.png`. This is
first-use/identity proof, not a visual-quality pass.
The same first-use path passed again against the rebuilt extension after the
cancellation UI repair: `first-use-runs/20261012T072924079Z-first-use-result.json`
and its sibling native-prompt screenshot; one task, one execute, three matching
surfaces, permissions true/true, product `degraded`.

The cancellation browser probe held the visual materialization request after
transcription, clicked the visible cancellation control, then released the
delayed request. The first probe found a real UI defect: Runtime authority
was `cancelled`, but polling had stopped on transcript `succeeded`, so the
side panel still displayed success/materializing. The repair applies the
cancel endpoint's returned projection immediately and ignores late
materialization responses for that task. A new final-build probe returned
`cancelled` in the UI and authority, no ready/degraded product, and zero
task-private residuals after the delayed visual requests returned. Evidence:
`first-use-runs/20261012T072550497Z-cancel-result.json`; the failed probe
is preserved as `first-use-runs/20261012T072124571Z-cancel-result.json`.
The runner now isolates SQLite, Chrome profile, media task root, ASR task root
and download cache root. Targeted frontend 7/7, typecheck and build pass;
targeted Runtime 52/52 pass for the new post-transcript cancel contract. The
broader media core/materializer/store/SenseVoice regression then passed 84/84
(one dependency deprecation warning). The cancel evidence's schemaVersion is
labelled `v3-stage-a-first-use-evidence/v1` by that run's earlier recorder;
the filename, mode, and `cancelClosed` fields identify it as the cancellation
probe. The recorder is corrected for subsequent runs; the original probe
bytes are retained unchanged.
After that browser run, the projection mutation guard was tightened so a late
cancel response cannot overwrite a different tab/task's current projection.
The hook test suite passed 4/4, frontend typecheck and build passed again;
this final guard has unit coverage but has not had another browser-level
tab-switch race run. No stronger browser claim is made from the earlier run.

**Remaining NO-GO:** independent review of the later browser evidence and
Stage A fixed-denominator mapping. Fresh-task four-viewport/keyboard/Axe and
browser-level process-crash/restart probes now passed, as detailed below.
The product remains `degraded` in these probes; Stages B-D and the V3 final
human gate remain pending.

### Fresh-task Workspace replay

The first attempt added Workspace checks but read the original embedded iframe
only after switching focus to Workspace. That late read was null, making the
runner's identity check fail despite one Runtime task; the failed record is
`first-use-runs/20261012T073532327Z-first-use-result.json`. The runner was
corrected to record the embedded task ID before switching focus and to retain
the post-switch observation separately. The rerun passed:
`first-use-runs/20261012T073805798Z-first-use-result.json` plus its native
permission prompt image. On the same fresh `BV1hMpE6FEXG` task, all three
surfaces matched, one execute occurred, Workspace chapter mouse and keyboard
routing stayed valid, and widths 360/420/768/1280 each had 0 horizontal
overflow and 0 Axe serious/critical violations. This is UI accessibility and
task identity evidence for one real video; it does not establish visual
content quality or the six-video denominator.

### Browser restart with real private artifact

`first-use-runs/20261012T074135709Z-restart-result.json` is an invalidated
candidate: its residual check incorrectly assumed the task directory name was
the task ID, although the sandbox uses a random `task_*` token. It cannot
prove cleanup. The repaired held-execute probe
`first-use-runs/20261012T074319557Z-restart-result.json` resolved the exact
owner manifest before `SIGKILL` and verified that owned directory disappeared
after explicit browser retry; this covers interruption before execution, not
an in-flight private payload. A first attempt to kill after artifact creation
missed the fast write/cleanup window and produced no passing artifact.

The strict final probe installed a watcher on the manifest-matched private
directory before forwarding the real execute request, then killed Runtime only
after a non-empty published subtitle artifact appeared. Evidence:
`first-use-runs/20261012T074703895Z-restart-result.json`. The old task had a
172,751-byte `.json` subtitle artifact before `SIGKILL`; the restarted
side panel displayed `V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN`, and its visible
retry action created a different task ID. The old owned directory and
unpublished evidence path were absent after recovery; SQLite had one
published new authority/product (`degraded`) and two distinct `created`
resolution events. The probe uses the same isolated SQLite/profile/media
roots, with Bilibili/Cookie permission pregranted in the temporary test
extension. It demonstrates cleanup after a crash with a real private media
artifact, but not a crash during the later visual materializer's own write.

A separate Claude Code CLI read-only audit of that v3 probe found that the
check did not prove *when* cleanup occurred, did not bind the visible outline
to the new task tightly enough, and omitted an explicit product-state
assertion. Its audit notes are in the Claude plan artifact under the local
Claude plans directory; they are not treated as a Stage A exit approval.
The runner was tightened and rerun: `first-use-runs/20261012T075613794Z-restart-result.json`
(`v3-stage-a-browser-restart-evidence/v4`). The 172,751-byte final `.json`
artifact existed before `SIGKILL`; its owner directory still existed after
the process exited. It was gone **after Runtime startup, before the browser
retry**, establishing startup cleanup rather than attributing deletion to
the retry action. The visible outline was nested under the new task card;
the product state was explicitly `degraded`, and the two created resolution
IDs matched old and new tasks in order. The retry released the interrupted
source authority and published only the new task. This is one real subtitle
route, not a visual-materializer crash or six-video quality proof. A final
independent exit judgment on the tightened v4 runner is still required.

The next read-only Claude CLI review clarified the scope: this test restarts
the **Runtime process**, not Chrome, and cannot prove a crash inside the
backend visual materializer. It also challenged the hard-coded owner-match
field, DOM-only outline check, non-empty-but-unparsed artifact, loose error
substring, and single database snapshot. These assertions were tightened.
The resulting `v3-stage-a-runtime-restart-evidence/v5` run is
`first-use-runs/20261012T080127652Z-restart-result.json`: the old final
subtitle JSON parsed with 1,101 segments and 172,751 bytes; the owned
directory existed immediately after `SIGKILL`, disappeared during Runtime
startup, and remained absent before and after visible browser retry. The
new task's visible outline title/summary matched the published SQLite
outline, and repeated authority/product snapshots were stable. Old/new
created IDs were distinct and ordered, with one published `degraded` product.
The summary is 4,000 characters; its *quality* is explicitly deferred to
Stage B and not endorsed by this recovery evidence. Stage A still needs a
final independent review of this v5 candidate; Chrome-process restart and
visual-materializer crash are outside this specific run's claims.

### Compound first-use, Runtime crash and Workspace replay

The later isolated Chrome run
`first-use-runs/20261012T081215141Z-restart-result.json` passed with the
temporary extension's actual optional-permission manifest, a clicked native
Chrome prompt, and `cookies=true` plus `bilibili=true` in
`chrome.permissions.contains`. It published a real 172,751-byte subtitle JSON
with 1,101 segments, killed the Runtime process, observed the old owned task
directory still present after process exit, and observed its removal after
Runtime startup **before** browser retry. Visible retry created a distinct
task. The original embedded panel, standalone panel and a second video tab
restored the new ID; visible outline title and summary matched the stored
product. On the same task, Workspace widths 360/420/768/1280 had 0 horizontal
overflow and 0 Axe serious/critical violations; chapter keyboard routing was
exercised. The one published product was `degraded`: this proves
coordination/recovery/navigation, not visual completeness or summary quality.
The record's schemaVersion remains `v5` despite later compound checks; the
recorded fields, not the label alone, define the checked denominator.

Earlier compound attempts remain separate evidence, not part of this positive
run. `20261012T080812569Z-restart-result.json` failed to read the embedded
task after switching focus. `20261012T080926297Z-restart-result.json` passed
cross-surface restoration without the later viewport/first-use checks.
`20261012T081049652Z-restart-result.json` added four viewports but still
pregranted permissions. The 081215 run is the first combined positive run.

The intended Companion entrypoint holds `single_instance_lock` for its
configured process lifetime. A new child-process negative test in
`test_v3_companion_runtime.py` demonstrated that a second process cannot take
the same lock; the focused suite passed 6/6. This does not prove that arbitrary
direct `uvicorn` launches cannot share a database: the E2E runner deliberately
starts the app directly against isolated roots, whereas the supported
Companion launcher takes the lock.

### Open policy-revision discrepancy

The Route A contract candidate's protocol says a changed consent policy must
refuse attachment and require revocation/cancellation plus cleanup before
replacement. Its acceptance matrix more strongly says a same-source policy
change cancels and cleans old work before replacement. Runtime currently
returns `V3_MEDIA_SOURCE_POLICY_CONFLICT` (409) for both an active and a
published prior authority; unit tests explicitly expect that rejection.
This prevents cross-policy attachment, but a published historical product
cannot be cancelled through the in-memory acquisition cancel path, so
replacement under a revised policy is unproven. This remains an open Stage A
contract/UX gap, not a passed negative case. A decision is needed on whether
the published result is retained as history, revoked, or deleted, and how new
explicit consent becomes authoritative. Do not auto-invalidate published
evidence or silently weaken the matrix.

Implementation changes: authority uses `cancelling` until visual work and
private evidence are cleaned; `cleanup_incomplete` blocks replacement and
projects failed/pending/no-retry even after successful transcription. Explicit
restart recovery requires the old owner to be dead, checks durable sandbox
ownership and production sibling directories, removes unpublished evidence,
then releases the source. The side panel distinguishes another live process,
uncertain ownership, legacy consent provenance, and tab-generation changes.

Final checks: Runtime 661 passed, one dependency warning; focused Runtime
66 passed; frontend typecheck/build and targeted Vitest 14 passed;
`git diff --check` passed. Latest final-build real Chrome run on
`BV1hMpE6FEXG`: 45 s, one `/resolve`, seven authority GETs, one `/execute`,
same `media_task_ea375366227f4078856ccfe72d77fc73` across embedded panel,
standalone panel, and second tab. UI reported ready for available content,
while the product row was `degraded`. The runner pregranted permissions in an
isolated extension and did not verify the first-use Chrome prompt. The
independent reviewer inspected code/tests but did not rerun Chrome.

## Contract and implementation

- `sourceIdentity` (`portal:<adapter>:<media>:<playbackUnit>:<part>`) is the
  arbitration key. Adapter and consent policy ID/revision are admission checks.
  `/v1/media/acquisitions/resolve` returns `created`, `attached`, or
  `published` with one authoritative task ID. The legacy create endpoint
  rejects an active same-source collision. All three endpoints require the
  local bootstrap session and send `Cache-Control: no-store`.
- The Runtime serializes same-task acquisition and execution; only the
  `created` caller executes. An attached browser surface revokes its unused
  task-scoped credential lease. Product materialization is serialized per
  task. The SQLite authority row is reserved transactionally, and an already
  published historical product is adopted rather than duplicated.
- Published commit/restart repair is checked against the exact source and
  product projection. An interrupted, unowned authority is fail-closed until
  the authenticated, explicit `/recover` operation; active in-memory tasks
  and published products cannot be abandoned. The browser's retry action
  invokes recovery only for `V3_MEDIA_AUTHORITY_RESTART_UNCERTAIN`.
- ASR failure/cancellation now uses acquisition abort cleanup rather than
  marking acquisition successful. Cancellation while the external acquirer
  is running returns a typed 409 and leaves files owned, so cleanup cannot
  race a write. Database-reservation failure removes the half-created sandbox.

## Automated and real-browser evidence

Runtime targeted suites: 72 passed (`test_v3_media_acquisition_core.py`,
`test_v3_media_product_materializer.py`, `test_v3_media_outline_task_store.py`,
`test_v3_sensevoice_transcript.py`). Frontend `pnpm typecheck` and `pnpm build`
passed. Targeted Vitest run passed 7 tests (client/activity subset; the hook
file was not selected by that invocation). The test suite covers 16-way
same-source resolution, different part, policy conflict, retry only after
terminal cleanup, slow execute replay, concurrent cancel, reservation failure,
legacy published adoption, restart repair, authenticated recovery and ASR
failure/cancel cleanup.

Five independent headed Chrome races on real `BV1hMpE6FEXG` returned one
`created`, one `attached`, one `/execute`, one product task and identical UI
task IDs. The five authoritative IDs were:

| Run | Authoritative task ID | Approx. time | Outcome |
|---|---|---:|---|
| 1 | `media_task_cdeb004bf22a4d0d8937583469a84697` | 13 s | ready; no artificial delay |
| 2 | `media_task_f1520c1591694d01a17ac09fbcbfbe03` | 45 s | ready; 30 s execute-request delay |
| 3 | `media_task_1d65282b3f0549f489ba7b3765d06f43` | 44 s | ready; 30 s delay |
| 4 | `media_task_8aabc6e49b9b4d10b1f733144d098449` | 44 s | ready; 30 s delay, in-page-first launch |
| 5 | `media_task_5369b5f816714d2cb8129fdb043cf7d8` | 44 s | ready; 30 s delay, in-page-first launch |

The delay affected only the request timing, not the real Bilibili content or
Runtime response. Each published product was `degraded` because the visual
branch did not publish frames in these samples; `ready` here means the UI
honestly displayed the available product, not that the V3 visual-quality gate
passed. A separate in-page + side panel + second Bilibili tab run used
`media_task_578f3f56b2074ad5813db10d49eb673c`; all three surfaces showed
that ID, with one execute and top state `视频内容已就绪`.
After the final recovery API and extension build, the same three-surface
journey was repeated with `media_task_9ed3189285de42d580bf80a848b9a7bd`:
`created` + `attached`, one execute, three matching UI task IDs, product
`degraded`, top ready, and no residual isolated test directory.

A separate final-build Workspace restoration run on the existing real
`BV1pohR6rEEh` product `media_task_3ba52fcf398b42ebb3030d82c2ea24bb`
passed chapter mouse and keyboard routing. At widths 360/420/768/1280,
overflow was 0 px and Axe serious/critical findings were 0. The Chat panel
restored the same task and displayed `视频内容已就绪`. This is layout/navigation
evidence for an existing product, not a fresh first-use permission run.

Failed exploratory runs were not counted: one 643 s timeout lacked a second
surface operation because the launcher was not opened; two faster runs had
only one `/resolve` because the other surface restored a product already
published, although both displayed the same ID. A later in-page-first attempt
stayed at `首次启用` until the collapsed detail section was opened and its
one-time button clicked. The runner now performs that real interaction. It
uses a temporary extension with Bilibili/Cookie permissions pregranted; it
does **not** validate Chrome's first-use permission prompt.

## Decision and residual risks

The five earlier races remain historical evidence, but the limited-pass
decision is withdrawn after independent review found two high-severity
fail-closed gaps. **Route A / full Stage A: NO-GO.** V3-5.10 Stages B-D and
final human acceptance are not covered by this decision. A later fresh Chrome
run after the current policy-restore and transaction changes did pass one
three-surface identity check (`media_task_804e7deff81f4a229200d21eb2698cb6`,
one resolve/create, one authority read by the second surface, one execute,
one degraded product), but it does not close the independent findings.

Current targeted backend suites: 76 passed; frontend typecheck/build passed;
targeted Vitest: 14 passed. The initially attempted pytest command lacked
`PYTHONPATH=.` and failed collection; the corrected command passed.

Open items for the next audit:

1. Two Runtime processes sharing one SQLite file are outside the intended
   single-process topology. The second process fails closed on a live authority,
   but `/recover` assumes the old process is gone; enforce a process-level
   singleton before certifying cross-process recovery.
2. A task cancelled after transcript success but before product publication,
   and a policy-revision change against a published task, need explicit
   browser-level terminal/replacement acceptance. Do not infer them from the
   unit tests above.
3. Real first-use Chrome permission, four-viewport/keyboard/Axe replay on the
   new cross-surface path, and six-video content review remain unverified.
4. An external independent reviewer has not rerun the final browser script or
   reviewed the current code diff. No PX-5/PX-6/RKM status is upgraded.

## 2026-10-12 policy-switch closure addendum

The preceding decision and open-item list preserve the earlier audit state;
they are not the latest candidate. The user chose **retain isolated history
and explicitly switch** for a published source after a consent-policy
revision. `stage-a-policy-switch-development-and-acceptance-plan.md` freezes
the operation, and `stage-a-policy-switch-postfix-independent-audit-2026-10-12.md`
concludes **LIMITED PASS for policy-switch task authority only**. The three
initial independent Majors (restart replay, weak 360px content proof, missing
typed keyboard-route gate) are closed. A historical-task read-only guard was
also added at the UI and Runtime layers.

The strict real-Chrome records
`first-use-runs/20261012T092205846Z-policy-switch-result.json` and
`first-use-runs/20261012T094651278Z-policy-switch-result.json` preserve
the old product while publishing one new v2-authorized task, with 12 rendered
chapters, 830 chapter characters, keyboard route true, no horizontal overflow,
and Axe serious/critical zero at four widths. The intermediary failure
`first-use-runs/20261012T094222824Z-policy-switch-failure.json` remains
visible; it is consistent with the ordinary-extension-tab test harness
changing active-tab epoch during commit. This mechanism is not exclusively
proven, and the product retains an explicit pending-task retry.

**Full Stage A remains pending a combined independent exit review** of
first-use permissions, cross-surface identity, cancellation, Runtime crash
cleanup, four-viewport navigation, and policy switch. No Stage B-D or V3
content-quality implementation/pass follows from this addendum.
