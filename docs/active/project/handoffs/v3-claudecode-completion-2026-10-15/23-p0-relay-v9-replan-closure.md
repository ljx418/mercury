# P0 Relay v9 重规划闭环

日期：2026-10-15。状态：`V9 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## 1. v8 第二轮结论

v8 修订包完成双路审查，但结论不一致：Claude 为 PASS；严格 reviewer 为 `DOCUMENT REPLAN`，Fatal=0、Major=2、Minor=2。按更严格结论优先，v8 已拒绝，报告保留为历史证据：

- `stage-b-b5-3-background-capture-relay-independent-document-audit-v8-round2-claude-2026-10-15.md`
- `stage-b-b5-3-background-capture-relay-independent-document-audit-v8-round2-subagent-2026-10-15.md`

两个 Major：owner manifest 没有冻结原子发布、父目录 fsync、确定性发现与损坏 fail-closed；offscreen sibling/helper 不在 discovery roots，新增边界码可让 v8 verifier 假绿。两个 Minor：checkpoint 顶部仍指向旧 canary，Archify browser visual-check 仍 pending。

## 2. v9 修订

1. owner manifest 固定为 `private_asr_staging_root/<taskId>/owner.json`；字段包含 taskId、pid、process start token、源/暂存 SHA-256、byte length、WAV shape 与 state。
2. 发布顺序固定为 canonical temp `O_EXCL` write -> file fsync -> atomic replace -> parent-directory fsync -> ownership-transfer receipt；worker 只能在 receipt 后启动。
3. 真实 hard-crash kill 点固定在 parent-directory fsync/receipt 后、worker 前。recover 只凭 validated authoritativeTaskId 定位 manifest，不依赖进程内存。
4. `OM9-N01..N08` 覆盖 missing、torn/invalid JSON、identity、hash、length/shape、state、path escape/symlink 与缺 parent-directory-fsync receipt；全部复用 `V3_MEDIA_CLEANUP_INCOMPLETE`。
5. source authority 扩为 11 个带 SHA-256 的 scope，新增 Bilibili acquirer 与 yt-dlp downloader；unique source inventory 由 36 扩为 40，target 仍为 20。
6. Python 使用 semantic AST boundary selector；TypeScript 使用 compiler AST boundary-value selector。四个递归 roots 覆盖 Runtime acquisition、Runtime 顶层、capture 模块与 offscreen entrypoint。
7. discovery universe 必须精确等于 40-source inventory + 冻结 non-relay allowlist；offscreen sibling、nested helper、imported emitter 或任意未登记 `V3_MEDIA_*` 都必须结构化拒绝。
8. checkpoint §13 已指向 19:04 visible muted Chrome 与 v9 文档门禁；旧 `capture-command-not-observed` 只保留为历史。

## 3. v9 机器权威

- Schema：`docs/active/project/contracts/v3_media_capture_internal_relay_v9.schema.json`
- Fixture：`docs/active/project/fixtures/v3-media-capture-internal-relay-v9-fixtures.json`
- Verifier：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-contract.py`
- Mutation verifier：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v9-mutations.py`
- 当前基线：50/50 PASS；actual semantic boundary set=40、frozen inventory=40、差集为空、unlisted boundary emit=0、discovered universe closed。
- 隔离对抗变异：12/12 PASS。11 个危险变异的内层 verifier 均 exit 2；offscreen direct/nested helper 与 Python acquisition 新 emit 均被发现；非边界词法对照 exit 0。

## 4. 架构图收口

- JSON：`docs/active/project/design/v3-p0-background-capture-relay-architecture.json`
- HTML：`docs/active/project/design/v3-p0-background-capture-relay-architecture.html`
- JSON SHA-256：`bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7`
- HTML SHA-256：`22502d6f296c1f9a474b0d15e25291953f554beaea3f4eac0a67f8e77255c044`
- Archify deterministic validation/delivery：9/9，composition 0 error / 0 warning。
- Browser visual-check：未执行，保持 pending；不得声明视觉 PASS。

## 5. 门禁

v9 文档一致性、Archify 更新、隔离对抗变异与平铺审计包已经完成；当前只允许双路从零外审。两份报告均 Fatal=0/Major=0 后，仍需用户明确 `approved P0 Background Capture Relay R0-R7 implementation` 才可修改产品代码。P1 六视频继续 BLOCKED；不得运行 Chrome、Runtime、Provider 或媒体。

