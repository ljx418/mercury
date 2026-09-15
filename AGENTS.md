# Navia Agent Onboarding

This file is the first stop for any external coding agent working in this repository.

## Project Snapshot

Navia is a Chrome companion-reading MVP with a Python local runtime and a WXT/React Chrome extension. V1.2 is a modular AI reading stage: it splits the Chat tab into independently developed A/B/C/D modules and a final Integration pass.

Current V1.2 rule:

```text
A/C/D service modules live under services/local-runtime/navia_runtime/modules/
B frontend renderer modules live under apps/chrome-extension/src/modules/
Integration wires old entrypoints to module implementations.
```

## Choose Your Workpack

| Workpack | Owns | Primary directory | Stage gate |
|---|---|---|---|
| A Page Reading | Extract, clean, annotate, chunk, and summarize page facts | `services/local-runtime/navia_runtime/modules/page_reading/` | `docs/active/project/stage-gates/v1.2-a-page-reading.md` |
| B Renderer | Render SSE, structured summaries, artifacts, debug, and mindmaps | `apps/chrome-extension/src/modules/` | `docs/active/project/stage-gates/v1.2-b-chat-renderer.md` |
| C Mindmap | Generate Mermaid and source maps from structured page JSON | `services/local-runtime/navia_runtime/modules/mindmap/` | `docs/active/project/stage-gates/v1.2-c-mindmap.md` |
| D CoreProvider / Adapter | Adapt CoreProvider, enforce governance, map ToolResult/Artifact/Event/Trace | `services/local-runtime/navia_runtime/modules/agent_loop/`, `services/local-runtime/navia_runtime/modules/adapters/` | `docs/active/project/stage-gates/v1.2-d-agentic-loop.md` |
| Integration | Wire A/B/C/D to existing app/runtime entrypoints and run E2E | existing entrypoints listed in V1.2-E | `docs/active/project/stage-gates/v1.2-e-integration.md` |

## Required Reading Before Editing

Read these first:

```text
docs/active/project/01-prd.md
docs/active/project/interaction-prd/窗口交互_PRD.md
docs/active/project/design/v1.2-ai-reading-workspace-partition.md
docs/active/project/design/v1.2-integration-contract-matrix.md
docs/active/project/contracts/v1_2_adapter_contracts.md
docs/active/project/AGENT_ONBOARDING.md
docs/active/project/V1_2_AGENT_WORKPACKS.md
```

Then read the matching module package under `docs/active/modules/`. Implementation directories keep only code, fixtures, tests, and short README pointers.

For any external ChatGPT document audit, also follow:

```text
docs/active/project/EXTERNAL_AUDIT_PACKAGE_PROCESS.md
```

## Hard Rules

- Do not change another module's implementation directory.
- Do not change public API, event, data model, or adapter contracts without returning to V1.2-0.
- B frontend modules must not call A/C/D services, MCP, Skill, or external APIs directly.
- A and C must not call piAgent or any CoreProvider.
- D is `CoreProvider + Adapter Layer`, not a from-scratch full AgentCore rewrite.
- `MockCoreProvider` is the default implementation target for contract tests.
- `piAgentProvider` cannot be implemented for real until repo, version or commit, license, runtime, and tool invocation model are locked.
- piAgent or any CoreProvider must not write `ArtifactRecord`, SSE, EventStore, Trace, or UI directly.
- No V1.2 work may introduce RAG, long-term memory, multi-agent orchestration, browser automation, default local file access, network search, voice, desktop pet, deep research, or PPT generation.
- Before every external ChatGPT audit, clear `docs/active/project/external-audit-package/` and repopulate it only with the current audit's files. Never mix files from different audit rounds.
- The external ChatGPT audit directory must be flat and contain at most 20 files total, including `AUDIT_MANIFEST.md`. Select only the highest-priority current files; do not create batch subdirectories.

## Handoff Requirements

Before handoff, add or update evidence in your module area and provide:

- changed files.
- contract changes, or explicit "none".
- tests run.
- real fixture or real Chrome evidence.
- PRD coverage.
- remaining risks.
- Integration handoff notes.

Use:

```text
docs/active/project/MODULE_HANDOFF_TEMPLATE.md
```
