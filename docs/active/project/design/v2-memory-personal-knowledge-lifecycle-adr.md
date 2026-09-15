# ADR: V2 Memory Lifecycle, Idempotency, Permission Revoke and Forget Cascade

## Status

Accepted on 2026-07-15 for the V2 planning-aligned baseline and retained as a V2-PX invariant. This revision replaces the earlier decision checklist with concrete behavior derived from the current Runtime contracts and `MockKnowledgeServiceAdapter`. V2.x automatic maintenance is governed separately by `v2-knowledge-maintenance-dream-cycle-adr.md` and is not approved for implementation.

## Context

V2 adds persistent knowledge sources. Premature implementation without lifecycle rules would cause duplicate sources, stale graph nodes, unverifiable deletion and unclear retry behavior.

## Decision

### 1. Identity, duplicate save and revision

| Topic | Frozen behavior | User-visible consequence |
|---|---|---|
| IDs | Runtime creates opaque `sourceId` and `operationId`; callers provide `workspaceId` and `idempotencyKey`. `traceId` / `EvidenceRef` are returned by Runtime authority and are never invented by either frontend container. | Side Panel and Workspace compare the same stable IDs; URLs carry IDs only. |
| Exact replay | Repeating the same save request with the same `idempotencyKey` returns the same source and operation with `idempotentReplay=true`. | Repeated click, tab reuse or reconnect does not create another source. |
| Same origin, new key | The current baseline does not perform content-hash or URL deduplication. Saving the same URL/document with a different idempotency key creates a new immutable source snapshot. | UI must not claim automatic deduplication. A duplicate warning may be added only after a new contract gate. |
| Revision | Current snapshots are immutable and start at `revision=1`; automatic revision promotion is not implemented. A changed page/file saved with a new key becomes a new source. | PX displays the returned revision but does not offer silent replace/update. |

### 2. Operation lifecycle and recovery

The canonical UI state model is:

```text
not_saved
-> queued
-> ingesting
-> building
-> trace_ready | degraded | failed
```

The current mock adapter may complete synchronously and return `operation.status=succeeded` plus `source.status=trace_ready`. The UI may animate intermediate states only as a labelled prototype demonstration; production evidence must use observed Runtime responses.

| Topic | Frozen behavior |
|---|---|
| Polling | Poll only a non-terminal `operationId`; stop on terminal status, route change or stale request. |
| Retry | No automatic retry budget is claimed. `failed/degraded` offers a user-triggered retry that creates or reuses an explicitly recorded idempotency key. |
| Cancel / resume | Not supported by the current public contract. UI must hide these commands or show `UNSUPPORTED_CAPABILITY`; it must not fake success. |
| Runtime restart | The current mock adapter is in-memory and does not guarantee durable recovery across Runtime restart. On missing operation/source, both containers show a recoverable error and reload Runtime authority; they must not restore `trace_ready` from frontend cache. |
| Container reconnect | Reopen by stable IDs, refetch status, discard stale local responses, and keep the same operation only if Runtime still returns it. |

### 3. Permission revoke

2026-09-09 accepted repair target: actual permission enforcement is specified by `v2-px-5-repair-execution-contract.md` and `../contracts/v2_local_permission.schema.json`. Grants are Runtime-session scoped, explicit POSIX paths; scan and import require separate user commands. Revocation changes the permission epoch under the commit lock, so older in-flight operations cannot commit new sources after acknowledgement. Browser reload refetches the permission list; Runtime restart requires a new grant. This is an implementation target, not proof that the previous mock-only permission endpoints enforced it.

- Revoking a `PermissionRoot` stops future scans and new imports from that root.
- Sources already imported before revoke remain readable because they are Navia knowledge records, not a continuing filesystem grant.
- Removing an imported source requires a separate user-initiated Forget action.
- UI and evidence must state this retention rule; revoke must not be presented as deletion.

### 4. Forget cascade and shared items

- Forget is user initiated, requires confirmation, and marks the source forgotten in Runtime authority.
- A successful verification requires `libraryAbsent`, `askAbsent`, `graphAbsent` and `traceAbsent` to be true.
- The current mock graph contains source/workspace nodes and does not implement shared `KnowledgeItem` recomputation. Therefore PX must record `sharedItemRecomputed=false` and an empty `supportingSourceIds` list for the mock path.
- If a future real adapter supports shared items, a retained item is valid only when `sharedItemRecomputed=true` and the report lists non-forgotten `supportingSourceIds`. This capability requires adapter mapping evidence; absence of that evidence is not a PX pass.

### 5. Evidence locator

| Source type | Canonical locator |
|---|---|
| Web page | `dom_text_quote` or `dom_selector`, with `fallback_text` when the DOM no longer matches |
| PDF | `pdf_page` plus page number and quote/fallback |
| Markdown/document | `markdown_line` plus line range and quote/fallback |
| Note | `note_block` plus stable block ID and quote/fallback |

All locator paths retain `located / fallback_shown / blocked` as distinct terminal evidence states.

### 6. Credential and service-failure boundary

2026-09-09 permission repair exception (implementation target): explicit local-file access is opt-in via an operator-provided ephemeral bearer token and exact Navia extension Origin. The token is never obtainable through the API and is entered by the user into volatile frontend memory only. When enabled, knowledge content endpoints require authentication, including query/graph/trace/source reads. Default-disabled reading workflows are unchanged. This supersedes the no-new-credential sentence below only for the approved local permission repair; no persistent credential store or real data_service credentials are introduced. Full details: `v2-px-5-repair-execution-contract.md` R0 decisions.

- PX introduces no new credential storage. Real data_service remains disabled unless a separately audited adapter configuration is present.
- Frontend, reports and logs never store raw credentials or unredacted local paths.
- The current candidate client uses one bounded request with a 2.5 second timeout and does not claim an automatic circuit breaker or retry loop.
- Timeout/auth/version failures map to canonical `dataServiceStatus` and `ErrorCode`; the user may explicitly retry after diagnosis.
- Adding persistent credentials, automatic retry/backoff or a circuit breaker requires a security/reliability ADR and new acceptance evidence.

## Consequences

- V2-PX implementation cannot invent lifecycle behavior ad hoc.
- Forget can be tested through before / after query, graph and trace.
- Permission revoke and source retention are explicit user-facing decisions.

## No-Go

- Claiming content-based duplicate detection or revision update when only idempotency-key replay exists.
- Restoring terminal success from frontend cache after Runtime loses an in-memory operation.
- Treating Permission revoke as source deletion.
- Treating `/sources/remove` as sufficient forget proof.
- Keeping query / graph / trace hits after forget without explicit shared-source explanation.
- Showing raw local paths or credentials in UI, reports or logs.

## V2-PX Cross-Container Addendum

- Side Panel 与 Extension Workspace 必须展示同一 `workspaceId / sourceId / operationId` 和 lifecycle status。
- Workspace route 只能携带稳定 ID；打开页面后必须重新读取 Runtime 权威状态，不得把前端缓存当作生命周期事实。
- 重复打开 Workspace 不得重复 ingest；tab reuse 和 idempotency 必须可测试。
- Runtime reconnect 后使用稳定 `workspaceId / sourceId / operationId` 重新查询；若 Runtime 不再返回该 source / operation，显示 recoverable error。当前基线不承诺恢复旧 operation，也不得凭 UI 缓存把 `queued / ingesting / building` 提升为 `trace_ready`。
- Forget 仍是用户主动发起、二次确认和四面验证的高风险流程；V2-PX 不实现自动遗忘。

## Future Maintenance Boundary

未来自动整理或“做梦”循环只能生成 `OrganizationProposal / SummaryRevision / ForgetCandidate`。在独立 stage gate 批准前，它们不能触发物理文件操作或最终 Forget。推荐从 suggest-only 开始，再依次评估 archive、quarantine / restore，最后才可能评估显式 opt-in 的永久遗忘。
