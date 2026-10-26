# ClaudeCode Prompt: Order-2 Diagnostic Canary

你接手 Navia V3-5.10 Stage B 的 `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTATION`。当前状态是 `GC-B6 SEMANTIC REVIEW NO-GO`。本批只实现离线诊断工具与反假绿测试；不得启动 Chrome、读取 Cookie、调用 Provider、下载、运行真实 BVID、消费新授权或执行 B6 盲评。

先读：

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`
3. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6b-fresh-candidate-blind-review-2026-10-25/`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6b-capture-corrective-codex-2026-10-25/`

## 目标

实现一个只能诊断 active registry order 2 的非候选 canary。它复用现有 authorization/grant、ledger、owned Runtime/Chrome、`run_one_bvid.mjs`、capture 与 cleanup owner，不得复制产品流程或新增备用 owner 通路。

## 必须实现

- canary 只接受 order 2 / 冻结 BVID；order 1/3..6、reserve、替换、跨 run 一律在外部动作前拒绝。
- 默认与 offline 模式启动 0 Chrome/Runtime/Provider/Cookie/下载/真实 BVID。
- 可见执行阶段只能消费一个新的 authorization id 中的 order-2 child grant；不得运行其他 child grant。
- 被动记录产品正常调用已经产生的事实：`materialize-visual` 与 fallback `materialize` 是否尝试、HTTP status、allowlisted stable error code；不得记录 body/header/token/Cookie/path/Provider identity/文本。
- 经认证公共 workspace route 记录 terminal task state 和 transcript/frame/OCR/caption 计数；PNG 必须由认证 thumbnail route 与严格 PNG 校验确认，不能把 frame 行存在当作 PNG 证明。
- 运行现有 B6 capture，并保留 `reviewCaptureFailureCodes`；禁止 detail/content 进入 durable/public evidence。
- 输出 schema 必须明确 `candidate:false`、`semanticReviewPerformed:false`、`stagePass:false`。代码中不得调用 B5/B6 aggregate、blind evaluator 或 sentinel。
- finally 必须关闭 owned Chrome/Runtime、profile/scratch/private staging；owned leak sighting 继续锁存并使结果 BLOCKED。

## 反假绿测试

至少覆盖：wrong order、reserve、authorization 重放、缺 grant、route 未尝试却声称 ready、未知 request status/code、degraded 冒充 ready、frame count 伪造、PNG route 404/坏 PNG、capture 未闭、cleanup/leak、输出出现 candidate/PASS/review 字段、默认入口产生外部动作。所有负例必须驱动真实 canary 入口并断言进程退出码。

## 验证与交付

运行新增聚焦 Node 测试、完整离线 Stage B suite、必要的 Runtime 定向测试、`git diff --check`、secret/path/raw-media 扫描与 cleanup 审计。历史证据不得改动，manifest 最后生成。

最终状态只能是：

- `GC-B6C ORDER-2 DIAGNOSTIC CANARY IMPLEMENTED AWAITING CODEX CHECKPOINT`；或
- 如实 `GC-B6C ORDER-2 DIAGNOSTIC CANARY NO-GO`。

不得执行真实 canary，不得重开 B6B，不得进入 B7/Stage C，不得宣布 Stage B/V3 PASS，不得 commit/push/reset/clean/checkout/revert。

