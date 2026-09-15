# T02.1 变更文件

日期：2026-09-12

## 1. 新 run 冻结快照

快照：`9205336cc8ae11024bd9a98e2896dfe37edbdb1e`。相对原 T02 accepted snapshot `c2409206e4a337314b2995665780da1ca86c7a8d`：

| 文件 | 变更 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 12-source、第三次 view_source、错误恢复、真实 Axe/键盘采集及失败诊断 |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | canonical route error 和 raw collector 回归；总数 11 |
| `docs/active/project/contracts/v2_px_raw_run.schema.json` | `route_observation.errorCode` 使用 canonical 封闭枚举 |
| `docs/.../t03-r3-semantic-reporting/audit-t03-input-readiness.py` | 参数化 run root，并从真实 artifact 重算完整 input denominator |
| `docs/.../t02.1-r2-production-input-recollection/{development-plan,acceptance-plan,preimplementation-audit}.md` | T02.1 计划与门禁 |
| `apps/chrome-extension/entrypoints/workspace/style.css` | 经单独批准，仅修改两条 Source Detail 文本颜色 |

## 2. 快照后只读审计材料

以下文件不参与产品 snapshot，也不修改 sealed run：

```text
verify-t02.1-candidate.py
candidate-verification.json
t03-input-readiness-result.json
t03-input-old-run-regression.json
t02.1a-*-plan/audit/result.md
changed-files.md
contract-changes.md
test-results.md
prd-review.md
architecture-review.md
false-green-audit.md
acceptance-result.md
handoff.md
manual-claude-audit-request.md
```

## 3. 未触及区域

未修改 `services/local-runtime/**`、产品 HTTP/API、Adapter/data_service、Permission/Forget 语义、63 RuleId、109 contract requirement、Human Review 或旧 T02 sealed run。
