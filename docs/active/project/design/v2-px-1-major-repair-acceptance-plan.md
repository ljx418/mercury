# V2-PX PX-1 Major Repair Acceptance Plan

## Gate

PX-1 remains `FAIL / REOPENED` until every check below passes and a new independent read-only re-audit returns `Fatal 0 / Major 0`. Passing this repair does not approve PX-2 automatically until its own plans and preimplementation audit exist.

## A. Recovery semantics

- [ ] Missing `workspaceId` never navigates back to that same ID.
- [ ] Recovery chooses an ID present in the observed Runtime workspace list: existing `ws_default`, otherwise the first returned workspace.
- [ ] Empty Runtime workspace list exposes retry but no invalid recovery navigation.
- [ ] Missing source recovers to the same verified workspace Source Library.
- [ ] Injected `FORBIDDEN` renders the canonical error and recovers to a verified workspace.
- [ ] Evidence labels `FORBIDDEN` as injected contract/component coverage, not real Runtime or real Chrome authority evidence.

## B. Concurrent tab reuse

- [ ] At least 8 simultaneous valid calls execute through one coordinator and call `tabs.create()` at most once.
- [ ] All callers receive a valid result; later calls focus/update the created tab.
- [ ] A failed queued operation does not prevent the next operation.
- [ ] Invalid actions remain recoverable errors and do not enter the Chrome tab queue.
- [ ] Real Chrome simultaneous Side Panel messages leave exactly one Workspace page.
- [ ] Workspace open/focus traffic produces zero `POST /v1/knowledge/sources` requests.

## C. Route matrix

For each of `source_library`, `source_detail`, `ask`, `graph`, `permissions`:

- [ ] direct-open restores the canonical route.
- [ ] reload restores the same canonical route.
- [ ] Browser Back returns to the target route after visiting another valid route.
- [ ] close/reopen restores the same canonical route.

Matrix total must be exactly 20 passed recovery cells. Source Detail additionally requires matching URL sourceId, Runtime sourceId, title and rendered Source ID.

## D. Real evidence and regressions

- [ ] Runtime source is created from the current `docs/active/project/01-prd.md` raw bytes with a reproducible SHA-256 and idempotency key.
- [ ] WXT production output contains extension-origin `workspace.html`.
- [ ] Manifest permissions and extension CSP are unchanged.
- [ ] Runtime offline still shows `offline / unchecked / unchecked / unknown`.
- [ ] Existing PX-0.2 validator and Runtime V2 memory API regression pass.
- [ ] Screenshots are real headless Chrome product surfaces and include file hashes.

## E. Required commands

```text
npm --prefix apps/chrome-extension test -- WorkspaceRouter workspaceAuthority workspaceOpen
npm --prefix apps/chrome-extension test
npm --prefix apps/chrome-extension run typecheck
npm --prefix apps/chrome-extension run build
PYTHONPATH=services/local-runtime python3 -m pytest -q services/local-runtime/tests/test_v2_memory_knowledge_api.py
npm --prefix apps/chrome-extension run validate:v2-external-brain-productization
npm --prefix apps/chrome-extension run e2e:chrome:v2-px-workspace-router
```

## F. Required evidence

```text
docs/active/project/evidence/v2_external_brain_productization/px-1/major-repair/
  route-e2e.json
  screenshots/
  logs/
  acceptance.md
  prd-review.md
  architecture-review.md
  false-green-audit.md
  handoff.md
  independent-reaudit.md
```

## Rejection rules

- Any recovery loops on a missing workspace.
- A test fabricates a Runtime Forbidden response.
- Serial retries are used as evidence for concurrent requests.
- One representative Back/reopen sample is counted as five-route coverage.
- The report trusts self-declared counts instead of recomputing matrix cells and page count.
- Old PX-1 screenshots, review prototype or contract fixture are presented as repair evidence.
