# Stage B B-5.3 P0 Background Capture Relay 实施前内部审计

日期：2026-10-15。审查对象：架构、开发计划、验收计划和现有代码/真实 canary 事实。结论：`CONDITIONAL DOCUMENT GO / IMPLEMENTATION NO-GO`。

## 1. 审查结论

| 维度 | 结论 | 依据 |
|---|---|---|
| PRD 一致性 | PASS | 保留可信点击、30 秒 grant、本地 ASR、同源权威、私有清理 |
| 用户体验 | PASS | 不增加操作；只修复扩展内部 transport ownership |
| 架构可实现性 | CONDITIONAL PASS | Service Worker WS 已真实打开；Port + transferable buffer 是 Chrome 内部能力，但真实 PCM 链尚待实现 |
| 安全/隐私 | PASS WITH GATES | 无新云上传；exact sender/Origin、bounded queue、secret scan 已列硬门槛 |
| 验收拒假绿 | PASS | 真实 PCM、真实 Uvicorn、visible muted Chrome、同 task、runner purity、故障矩阵均固定 |
| 开发授权 | NO-GO | 内部 FailureCode/fixture 常量和外部文档审查尚未完成 |

## 2. 已关闭的方向风险

- 不再把 Offscreen WebSocket 断连误判为 Runtime、Windows 网络或 ticket 问题。
- 不延长 ticket、不绕过 user activation、不让 runner 成为第二编排者。
- 明确 Background 重启不续传旧音频，“恢复”只恢复可解释状态和新重试入口。
- P1 六视频继续被 P0 immutable candidate 和独立审查阻塞。

## 3. 实施前必须关闭

1. 已关闭（文档）：R0 已冻结 `CaptureAudioPort` schema、queue 上限、FailureCode 闭集、positive trace 和 RLY-N01..N16；verifier 12/12 PASS。
2. 实施时必须证明 transferable `ArrayBuffer` 在 WXT/Chrome runtime Port 的实际发送和所有权转移；fixture 只证明合同可表达。
3. 实施时必须证明 Service Worker restart 通过非秘密 storage.session marker 被新 worker 识别，并在旧 socket close 后验证 Runtime sink=0、清 marker；不能只靠超时猜测，也不能恢复旧 session。
4. 独立文档审查复核 PRD、架构、状态机、隐私和验收分母，Fatal=0/Major=0。
5. 用户明确授权本架构候选的 R0-R7 实施。

## 4. 当前 Minor

- M-1：extension CSP 的显式 loopback 声明已形成代码候选，但尚未证明它是 Offscreen 失败根因；文档不得作此宣称。
- M-2：最新 canary 目录属于临时证据，candidate 封存时必须复制必要的脱敏摘要并清理私有原件。
- M-3：Archify 图只表示本专项，不替代 V3 总体 8 页 Draw.io；后续总图需追加状态变更而非重画全局。

## 5. 判定

Fatal=0；Major=0（文档方向）；Minor=3。文档可提交独立外审。代码实施在外审与明确授权前保持 NO-GO。

