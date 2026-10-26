# WP0：P0 Background Capture Relay R0-R7

状态：`DOCUMENT PASS / IMPLEMENTATION AUTHORIZED / STAGE A/B BLOCKED`。

输入为 relay v10 Schema/fixtures、开发/验收/实施前审计和 Codex v10 文档 PASS。R0-R7 的公共 API、Origin、ticket、Cookie/provider 和产品终态合同不得变化。

| R | 实施 | 必须验证与停止点 |
|---|---|---|
| R0 | v10 合同、Chrome 116、40/20 registry、manifest/receipt | 50/50、15/15、Schema；落盘 checkpoint 后继续 R1 |
| R1 | Background transport、同步 stage、cleanup owner | worker 不早启、owner 唯一；checkpoint |
| R2 | Offscreen producer、exact sender、Base64/credit queue | 网络 0、sender/sequence/overflow；checkpoint |
| R3 | controller 单编排、stop、phase marker | 24 步 trace、旧 session 不续传；checkpoint |
| R4 | restart/crash/cancel recovery | DELETE+GET/finally+GET/hard recover/404 pending；checkpoint |
| R5 | `BV1pohR6rEEh` fresh muted canary | PCM->SenseVoice->materialize->ready/degraded；checkpoint |
| R6 | 真实故障矩阵 | permission/ticket/sender/backpressure/restart/crash/cancel/SIGTERM/cleanup |
| R7 | immutable candidate | seal/hash/scan/PRD review/handoff 后停止 |

每个 R 完成后必须更新同一 candidate 的 phase receipt、测试结果与 PRD 检视；R0-R6 不要求 Codex逐项外审，但不得跳过 checkpoint，发现 Fatal/Major 立即停。可见 Chrome、原生弹窗、抢焦点或 UIAutomation 前必须先通知用户；Chrome 必须 `--mute-audio`。

固定机器门槛：v10 baseline 50/50、mutation 15/15、Schema meta/instance、extension typecheck/test/build、capture/transcript/outline/fault/product focused pytest、`scripts/stage_b_b5_3/test/*.node-test.mjs`，失败进程非零退出。

真实 canary 使用 fresh Runtime/database/profile/task、产品端口 17861 bind preflight、真实 UI action；runner 0 次直调 controller/materialize/database。taskId/sourceIdentity 一致，三个 revision 域分别单调，SQLite ready/degraded 是唯一成功。Cookie 值和私有路径不得进入公开证据。

真实故障必须覆盖 Runtime hard kill（receipt commit 后、worker 前）、worker restart、permission 缺失、ticket replay/binding、Port/WS、tab close、cancel、SIGTERM、cleanup failure；typed code、非零退出、acquisition/asr/product/sink 残留全零。

R7 后 ClaudeCode 停止。Codex审查 Fatal=0/Major=0 才放行 WP1。声音播放、公共合同扩大、弱 sender、双 cleanup owner、runner 吞错、secret/raw-media/path hit 或条件未变重复 canary 直接 NO-GO。
