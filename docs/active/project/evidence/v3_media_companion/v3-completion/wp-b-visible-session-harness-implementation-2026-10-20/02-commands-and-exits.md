# Commands and exit codes

The offline validation of this pass. No broad WP-B regression was repeated:
this pass modifies only e2e harness and test assets, so the completed Runtime
and Extension WP-B regressions were NOT re-run.

| # | command | exit | result |
|---|---|---|---|
| 1 | `node --test e2e/lib/v3WpBVisibleSession.node-test.mjs` | 0 | **32 passed**, 0 failed — the eight offline adapter-test groups |
| 2 | `npm run test:wp-b-visible-session` | 0 | 32 passed, 0 failed |
| 3 | `node e2e/v3-wp-b-local-import-owned-session.mjs` (the default, offline) | 0 | `{"phase":"offline","launched":false,"generatedAssets":0,…}` |
| 4 | `NAVIA_WP_B_SESSION_PHASE=visible-run node e2e/v3-wp-b-local-import-owned-session.mjs` | 1 | **refused** before it touched anything: a visible session needs `NAVIA_WP_B_VISIBLE_APPROVED=1` |
| 5 | `npx vitest run src/modules/media_companion/tests/LocalMediaImportClient.test.tsx src/modules/media_companion/tests/MediaCredentialWorkspacePageComposition.test.tsx` | 0 | **34 passed**, 2 files |
| 6 | `npx tsc --noEmit -p tsconfig.json` | 0 | clean, except the **pre-existing** `vitest.config.ts` `module` overload error |
| 7 | `npx wxt build` | 0 | the production extension built, 4.67 MB |
| 8 | `node --check` on every new module | 0 | every module parses |

## What was deliberately NOT run

| command | why |
|---|---|
| the Runtime WP-B regression (267 cases) | this pass changes no product module; the directive says not to repeat it |
| the Extension media-companion subtree (512 cases) | the same |
| the relay v11 verifier | the refreeze is Codex's; only the inventory is reported |
| any Chrome launch | the phase forbids it |
| any large asset generation | the phase forbids it |
