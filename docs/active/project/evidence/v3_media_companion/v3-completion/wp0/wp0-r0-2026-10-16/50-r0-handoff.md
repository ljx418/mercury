# WP0 R0 Handoff（2026-10-16）

Candidate: `wp0-r0-2026-10-16`
阶段结论：**R0 NO-GO（1 Major）**。R1–R7 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/`

## 1. changed files

**本轮新增（仅证据，未改任何产品代码）**

```
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/10-r0-phase-receipt.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/20-r0-test-results.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/30-r0-prd-review.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/40-payload-manifest.sha256
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/50-r0-handoff.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/r0-relay-v10-contract-baseline.json
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r0-2026-10-16/r0-relay-v10-mutations.json
```

**构建产物（`npm run build` 为 R0 固定门槛所要求）**

```
apps/chrome-extension/chrome-mv3-unpacked/**   （重新生成；该目录在会话开始前已处于 dirty 状态）
```

**未修改**

- `services/local-runtime/navia_runtime/**`（含 `app.py`、`coordinator.py`）
- `apps/chrome-extension/src/**`、`apps/chrome-extension/entrypoints/**`
- `docs/active/project/contracts/**`、`docs/active/project/fixtures/**`
- `docs/active/project/01-prd.md` / `02-architecture.md` / `03-development-plan.md` / `04-acceptance-plan.md`
- `stage-b-six-video-registry.json` v1
- 全部 `v3-claudecode-implementation-2026-10-15/` 交接包载荷（16 项 SHA-256 全部核对一致）

## 2. 合同变化

**none**。未修改任何公共 API、schema、fixture、合同、固定分母或验收阈值。

## 3. 全部命令与退出码

| # | 命令 | 退出码 |
|---:|---|---:|
| 1 | `sha256sum 00-README.md … 15-independent-document-audit.md`（交接包核对） | 0（16/16 与 manifest 一致） |
| 2 | `python3 docs/.../verify-stage-b-b5-3-background-capture-relay-v10-contract.py` | **2** |
| 3 | `python3 docs/.../verify-stage-b-b5-3-background-capture-relay-v10-mutations.py` | **2** |
| 4 | `cd apps/chrome-extension && npm run typecheck` | 0 |
| 5 | `cd apps/chrome-extension && npm test` | 0（392 tests） |
| 6 | `cd apps/chrome-extension && npm run build` | 0 |
| 7 | `cd services/local-runtime && PYTHONPATH=. ./.venv/bin/python -m pytest tests/ -k "capture or transcript or outline or fault or product" -q` | 0（180 passed） |
| 8 | `node --test`（8 份离线 node-test） | 0（134/134） |
| 9 | `node --test scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs` | 0（6/6） |

## 4. 真实 run / build / task / candidate ID

- 真实产品 run：**未执行**（R5 才需要 canary；R0 只做合同证据核对）
- extension build：已执行（`npm run build`，Σ 4.63 MB）
- task ID：**无**（未创建媒体任务）
- candidate ID：`wp0-r0-2026-10-16`（**非 immutable candidate**；R7 才产出 immutable candidate，本轮不产出）

## 5. PRD 覆盖

见 `30-r0-prd-review.md`。R0 只需证明 relay v10 冻结合同与工作树一致；
该证明**失败**，因此 WP0 未取得任何 PRD 范围的推进。

## 6. cleanup / secret scan

- Chrome 启动次数：**0**
- Provider 请求次数：**0**
- 六视频 fresh run：**未启动**
- 长驻 Runtime / Chrome 进程：结束核查无遗留
  （`run_one_bvid` / `sequencer_rb` / `running_sleep` / `navia-b5-3-canary` 均为空）
- 公开证据内容：仅固定 code 名、文件路径（仓库内相对路径）与 SHA-256；
  **无** Cookie 值、API key、凭据、原始音视频、绝对私有路径

## 7. 剩余风险（1 Major）

**M-R0-01 冻结哈希 ↔ 工作树漂移**

`verify-...-v10-contract.py:269-272` 在源文件哈希与冻结值不一致时跳过该文件的
AST 抽取，导致 4 项检查失败、6 个 boundary code 未进入 emit 集：

| 源文件 | 冻结 | 当前 |
|---|---|---|
| `…/acquisition/coordinator.py` | `de3a903564fe…` | `ddbf830f5ce5…` |
| `navia_runtime/app.py` | `40040aed9ad7…` | `518c853dadaf…` |

已排除：实现缺失（6 code 与 7 抽取符号全部存在）、抽取器缺陷（`ast.keyword`
已在白名单）、fixture 缺位（单份存在）、relay 增量缺失（漂移内容为 V3-2/V3-3
门户设置 / 媒体缓存 / 获取路由）。

ClaudeCode 不能自行处置的两条路径：
- 重冻结 fixture 哈希 → 冻结合同动作属 Codex（`03-master-roadmap.md §3`）
- 还原 `app.py` / `coordinator.py` → 会删除 +756 行既有未提交产品代码（禁止覆盖用户改动）

## 8. 自动化开发停止原因

R0 固定门槛要求 v10 baseline 50/50 与 mutation 15/15；实测 46/50 与 14/15，
两者同源于上述冻结哈希漂移。按 `05-wp0-relay-acceptance.md`
「发现 Fatal/Major 立即停」，且修复该问题需改动冻结合同证据或删除既有未提交代码，
两者均超出 WP0 授权。故在 R0 停止，不进入 R1，等待 Codex 判定。

## 9. 下一阶段 prerequisite（R1）

- [ ] Codex 就「重冻结」或「还原工作树」给出结论
- [ ] `verify-...-v10-contract.py` 达 50/50（退出码 0）
- [ ] `verify-...-v10-mutations.py` 达 15/15（退出码 0）
- [ ] Codex 接受本 R0 checkpoint
- [ ] 若 R1 需可见 Chrome / 原生弹窗 / 焦点 / UIAutomation，先通知用户并等待安排

## 10. payload hashes

见 `40-payload-manifest.sha256`。
