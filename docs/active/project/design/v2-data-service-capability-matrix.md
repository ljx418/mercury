# V2 data_service Capability Matrix

## Status

V2-0 spike output. This matrix maps the local data_service candidate to Navia V2 Memory requirements.

| V2 capability | data_service evidence | Current fit | V2 adapter decision |
|---|---|---|---|
| Workspace create / list / describe | `/api/v1/knowledge/workspaces/*`, `/api/workspaces*` | Good candidate | Map through V2 Adapter; do not expose root path as stable API |
| Source import | `/api/v1/knowledge/sources/import`, `/api/workspaces/{workspace_id}/sources` | Good candidate | Requires Navia idempotency wrapper and source revision policy |
| Source list / detail | `/api/v1/knowledge/sources/list`, target source detail / preview / units | Good candidate | Use target detail routes when trace or evidence needs unit-level support |
| Build lifecycle | `/api/v1/knowledge/build/*`, target build operations | Partial fit | Map operation status to Navia canonical `queued / ingesting / building / trace_ready / degraded / failed`; current public contract does not expose cancel / resume, so any service-side cancellation state remains adapter-internal and must not be presented as a successful Navia action |
| Ask with Sources | `/api/v1/knowledge/query`, `/api/workspaces/{workspace_id}/query` | Partial fit | Requires semantic evidence validator; non-empty refs are insufficient |
| Knowledge Graph | `/api/v1/knowledge/graph`, target graph query / neighbors / community | Partial fit | Use only if response includes source / unit / relation provenance |
| Source Trace | `/api/v1/knowledge/source/trace`, target source trace | Good candidate | Map evidence refs to located / fallback / blocked UI states |
| Permission root | Environment and allowed root controls exist | Insufficient product fit | Navia must own PermissionRoot UX and adapter policy |
| Forget source | Source remove route exists | Insufficient for full forget | V2 must add before / after query, graph and trace verification |
| Service status | Health, auth and capability routes exist | Partial fit | Navia Runtime must aggregate Runtime / Adapter / data_service / source states |
| Local directory scan | data_service supports scanning | No-Go by default | Only after explicit PermissionRoot grant |

## Route Selection

Recommended route for V2-1 / V2-2:

```text
Route C: Hybrid mock + spike
```

Reason:

- The data_service API is broad and usable, but Navia still needs an anti-corruption layer for status, idempotency, evidence and deletion semantics.
- Frontend and Runtime contract work should not block on a fully stable real adapter.
- MockKnowledgeServiceAdapter can give deterministic V2-1 / V2-2 tests while the real adapter matures.

Fallback:

```text
If any V2-0 data_service mapping remains unstable, use Route A: MockKnowledgeServiceAdapter first.
```

No direct V2-1+ data_service-first implementation is allowed from this matrix alone.
