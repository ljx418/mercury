# T02.3 变更边界

日期：2026-09-14

## 1. 实施代码

| 文件 | 变更 | SHA-256 |
|---|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | Status 原始响应登记、canonical fault policy、seal 前校验、Forget 恢复前 settle | `4193eb1b538a910f004566ff53b08b48ab1bdc81969d338c90d3d2f60ddfc23a` |
| `apps/chrome-extension/e2e/lib/v2PxKnowledgeStatusEvidence.mjs` | 封闭策略、响应解析、离线 Schema registry 与批量校验 | `3fe6e65745516e799b39d5f5edb3942de18affb9c2e5b9f3c39f633e0357de74` |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | canonical 正例及 generic retry/畸形响应负例 | `369bce91f1bf9239eeb0b75dbe838701a9d87948e84ddbd0f62fc06068ade4c9` |

## 2. 明确未改

- `apps/chrome-extension/entrypoints/**` 产品组件与样式：0 修改。
- `apps/chrome-extension/src/**` 产品模块与 runtime client：0 修改。
- `services/local-runtime/**`：0 修改。
- `docs/active/project/contracts/**`、OpenAPI、RuleId、109 requirements：0 修改。
- T02、T02.1、T02.2 已封存 raw、artifact、seal：0 修改。

主工作树存在其他历史未提交改动；T02.3 的真实 Chrome snapshot 在隔离 worktree 以 `127585e..98d3a8b` 的提交差异冻结，不能用主工作树整体 `git diff` 推断本阶段范围。
