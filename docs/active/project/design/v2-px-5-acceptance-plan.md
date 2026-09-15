# V2-PX-5 自动化验收计划

日期：2026-09-08

2026-09-14 状态增量：T03 与 T04 已取得限定独立通过，但 G7/Human/final 保持 pending/pending/false。T04 独立审计遗留一个 replay `artifactRoot` 命名 Minor；T04.1 必须使用全新 run 完整重跑后关闭。T04.1 外审和用户实现授权前 NO-GO，PX-6 在 T04.1 通过前 BLOCKED。

## Gate

| Gate | PX-5 自动化标准 |
|---|---|
| G1 | 三个真实 Side Panel 入口各 >=2；view source trace-ready >=3；trusted click 与 Background requestId 可追踪 |
| G2 | Library/Detail/Ask/Graph/Permissions 各覆盖 direct-open/reload/Back/reopen；invalid/forbidden >=2 |
| G3 | 跨容器稳定 ID >=4；tab reuse 无 ingest；Permission >=3；Forget >=3 且同源四类重开均 SOURCE_NOT_FOUND |
| G4 | 三个冻结根目录的实际源码、commit/working-tree index、ruleset/allowlist 可重算；两类 AST scan 0 violations |
| G5 | runtime_offline、adapter_blocked、data_service_unreachable、source_failed/degraded 各 >=1；故障注入与自然状态分开标记 |
| G6 | axe serious/critical 0；键盘断言全过；360/420 Side Panel 和 768/1280 Workspace 真实 PNG 无 blocker |
| G7 自动部分 | 九 Schema、全部文件/hash、PX-0.2 109 negative、V2-7 回归、HTML/JSON/审计文档全通过 |
| G7 人工部分 | PX-5 固定 pending，转交 PX-6；不得自动签署 |

## 当前可执行入口

本节旧生产命令已经撤销。T04 历史 LIMITED PASS 不授权重跑。T04.1 完成外部文档审查并取得用户实施授权后，只允许通过冻结的 T04 orchestrator 在全新空目录启动；不得运行旧 generator、旧 production validator 或任何会覆盖既有 PX-5 报告的命令：

```text
pnpm --dir apps/chrome-extension exec node e2e/run-v2-px-r4-snapshot-revalidation.mjs \
  --input-manifest <absolute-snapshot-input-manifest> \
  --output-root <new-empty-t04.1-run-root>
```

该入口必须在内部顺序执行 R4-P frozen-input replay 与 R4-E fresh real-Chrome 两泳道，记录每一步 argv、cwd、环境 allowlist、stdout/stderr、退出码和产物 SHA-256。不得使用 `NAVIA_T02_SKIP_PREREQUISITES`，不得跨 run 拼接，任一步失败必须返回非零并停止生成 ExitManifest。

## 必需产物

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
  t04-r4-snapshot-revalidation/
    runs/<new-t04.1-run-id>/
      snapshot-input-manifest.json
      source/
      replay/
      fresh/
      snapshot-revalidation.json
      exit-manifest.json
      public/t04-public-evidence.tar.gz
      logs/
    implementation-handoff.md
    prd-review.md
    architecture-review.md
    false-green-audit.md
    independent-implementation-exit-audit.md
```

`public/t04-public-evidence.tar.gz` 必须在 `exit-manifest.json` 之前生成，并排除 ExitManifest 与后续独立审计，避免自引用。新 T04.1 候选中 replay invocation 根与每个 step implementation/stdout/stderr ArtifactRef 必须全部为 `replay_validation`；不允许 alias。ExitManifest 保持 unsigned，Human Review、G7 和 final 仍为 pending、pending、false。

PX-5 PASS 只表示自动化候选证据完整。最终 Report 必须保持 `passed=false`，直到 PX-6 人工核查。
