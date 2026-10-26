# ClaudeCode CLI Goal：WP-B 显式本地视频导入

门禁：仅当本包 `10-codex-implementation-gate.md` 明确写出 `V3 post-R7 / WP-A PASS / WP-B IMPLEMENTATION MAY START` 才执行。在 `/mnt/c/workspace/navia` 工作，只实施 WP-B，完成后停在 `WP-B AWAITING CODEX CHECKPOINT`。

## 必读

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`，尤其 5.1
3. `docs/active/project/01-prd.md` §18.13
4. `docs/active/project/design/v3-media-companion-risk-adr.md` ADR-V3-14
5. 本目录 `00-package-status.md` 至 `06-risk-and-review.md`、`09-independent-document-audit.md`、`10-codex-implementation-gate.md`
6. 3 个 `docs/active/project/contracts/v3_media_local_import_*_v1.schema.json`
7. 5 个 `docs/active/project/fixtures/v3-media-local-import-*.json` 与资产 registry
8. `docs/active/project/design/wp-b-explicit-local-media-import-prototype/index.html`、`architecture.html`
9. WP-A checkpoint：`docs/active/project/evidence/v3_media_companion/v3-completion/wp-a-media-dependency-readiness-corrective-2026-10-19/80-codex-checkpoint.md`

## 实施顺序

严格按 B0-B8：

1. 先运行文档 verifier、schema/fixture mutations、WP-A/v11 门禁，不改分母。
2. 先写 contracts/store/manager tests，再实现 SQLite FULL/CAS、startup reconciliation、token 内存所有权和内部分片 writer。
3. 先写 OPTIONS/Origin/bearer/token/writer-not-created tests，再接 `app.py` 四 API。
4. 实现 verified ffprobe/ffmpeg preparation、WAV、1..8 帧和 canonical ImportedVisualReceipt。
5. 实现 coordinator bind 与 `LocalMediaConsumerBarrier`。local route 必须移除 transcript 的早 cleanup，并由 ASR/视觉各交 terminal receipt 后单点清理。
6. 实现 strict Extension client、XHR progress/abort/generation guard、LocalMediaImportCard 和 A11y。
7. 完成 B01-B28，包含新进程 hard-kill/restart；再按资产 registry 完成 B29/B30。
8. 只执行一次集中回归，落 implementation evidence 后停止等 Codex checkpoint。

## 不可变边界

- 单文件必须来自用户手势；不扫描目录、不接收/保存 fileName/path/url/hash/lastModified/relativePath，不持久化 File/handle。
- raw content 只能 `request.stream()`；ASGI chunk 可大于 1 MiB，writer 必须用 memoryview 切为 <=1 MiB。禁止 `request.body()`、Base64、全量 multipart buffer。
- local-import API 必须经过 privileged exact Origin、bearer、one-shot token；拒绝发生在 writer 创建前。
- 原视频、WAV、未选帧不进 Provider、知识库、日志、Trace 或公开证据。只有现有 governed selected-frame 流程可发送获授权证据帧。
- local route 不调用 downloader、credential resolver、tabCapture；不创建第二 SourceAuthority；自动 route 顺序不变。
- 原视频必须在 input bind、audio owner receipt、visual receipt 三者 durable 后才能删除。ASR/视觉均 terminal 后 barrier 才能清共享输入。
- 不修改 WP-A 固定来源/摘要、relay v11 历史材料、Cookie/Provider 边界、WP-C 支持级别。
- 不 commit/push/reset/clean/checkout/revert，不覆盖 dirty worktree或历史证据。
- 测试无声。可见 Chrome 先通知用户，owned profile、`--mute-audio`、集中一次、不抢焦点、结束清理。

## 验证与证据

B01-B30 每项必须有生产路径、驱动、oracle、负例、cleanup。B29/B30 使用资产 registry 和私有 `NAVIA_WP_B_SEED_MEDIA`；先验证真实语音与动态帧，再真转码到目标范围。禁止 sparse/truncate/padding/mock。若没有合格私有 seed，必须 `WP-B NO-GO`，不得降低 oracle。

运行 Runtime contracts/store/manager/API/preparer/barrier/coordinator tests、Extension client/component/orchestration tests、真实 hard-kill probe、资产 probe、Runtime media focused、Extension media subtree、typecheck、build、v11 baseline/mutations。内循环只跑受影响测试；稳定后一次集中回归。

在 `docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-implementation-2026-10-19/` 写：phase receipt、changed files+SHA、命令/退出码、B01-B30、真实 run/task/import/product id、durable receipts、资源峰值、PRD review、secret/path/raw-media scan、cleanup、handoff、manifest。

任一 Fatal/Major、合同需扩张、B29/B30 无法真实证明、认证边界失败、路径/秘密/原始媒体泄漏、重启 GET 404、双消费者残留非零或可见 Chrome 未提前通知时，写 `WP-B NO-GO` 并停止。全部完成也不得宣布 WP-B/V3 PASS；写 `WP-B AWAITING CODEX CHECKPOINT`，不进入 WP-C，不做 Claude 文档外审。
