# Commands and exact exits and counts

The validation of this pass. No broad external or stage audit was run, and the
completed WP-B regression was NOT repeated: this pass changes the product seam
and the harness, so the targeted suites below are the ones that cover it.

| # | command | exit | count / result |
|---|---|---|---|
| 1 | `node --test e2e/lib/v3WpBVisibleSession.node-test.mjs` | 0 | **49 passed, 0 failed** |
| 2 | `npm run test:wp-b-visible-session` | 0 | **49 passed, 0 failed** |
| 3 | `npx vitest run src/modules/media_companion/tests/LocalMediaImportClient.test.tsx` | 0 | **33 passed** (2 of them are the new identity-switch cases) |
| 4 | `npx vitest run src/modules/media_companion/tests/MediaCredentialWorkspacePageComposition.test.tsx` | 0 | **3 passed** |
| 5 | `npx vitest run src/modules/media_companion/tests/localImportDiagnostics.test.ts` | 0 | **8 passed** |
| 6 | the three targeted Extension suites together | 0 | **3 files, 44 passed** |
| 7 | `npx tsc --noEmit -p tsconfig.json` | 0 | clean, except the **pre-existing** `vitest.config.ts` `module` overload error |
| 8 | `npm run build:e2e` | 0 | the E2E extension build succeeded, 4.69 MB |
| 9 | `pytest` — the Runtime local-import suites (19 files) | 0 | **264 passed** |
| 10 | `node e2e/v3-wp-b-local-import-owned-session.mjs` (the default, offline) | 0 | `{"phase":"offline","launched":false,"generatedAssets":0,…}` |
| 11 | `NAVIA_WP_B_SESSION_PHASE=visible-run node e2e/v3-wp-b-local-import-owned-session.mjs` | 1 | **refused** before it touched anything: a visible session needs `NAVIA_WP_B_VISIBLE_APPROVED=1` |
| 12 | `node --check` on every changed harness module | 0 | every module parses |

## What was deliberately NOT run

| command | why |
|---|---|
| any Chrome launch | the phase forbids it |
| the Runtime | the phase forbids it |
| the 100 MB / 1 GB assets | the phase forbids it |
| B27 / B29 / B30 | the single approved visible session must not be consumed |
| the relay v11 verifier | the refreeze is Codex's; only the inventory is reported |
| the broad external or stage audits | the phase forbids them |
