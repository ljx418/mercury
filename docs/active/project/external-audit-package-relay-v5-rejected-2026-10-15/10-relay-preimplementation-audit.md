# Stage B B-5.3 P0 Background Capture Relay 实施前内部审计

日期：2026-10-15。审查对象：v5 架构、开发计划、验收计划和现有代码/真实 canary 事实。结论：`V5 DOCUMENT CANDIDATE FOR EXTERNAL REVIEW / IMPLEMENTATION NO-GO`。

## 1. 审查结论

| 维度 | 结论 | 依据 |
|---|---|---|
| PRD 一致性 | PASS | 保留可信点击、30 秒 grant、本地 ASR、同源权威、私有清理 |
| 用户体验 | PASS | 不增加操作；只修复扩展内部 transport ownership |
| 架构可实现性 | CONDITIONAL | Service Worker WS 已真实打开；v1-v4 缺陷均已拒绝；v5 修正 MessageSender/ExtensionContext 来源并把旧 task 终结固定到 Runtime finally 的内部 coordinator 调用；`runtime.getContexts` 以 Chrome 116 + manifest 最低版本闭合，仍需独立审查与真实 capability probe |
| 安全/隐私 | PASS WITH GATES | 无新云上传；exact sender/Origin、bounded queue、secret scan 已列硬门槛 |
| 验收拒假绿 | PASS | 真实 PCM、真实 Uvicorn、visible muted Chrome、同 task、runner purity、故障矩阵均固定 |
| 开发授权 | NO-GO | v5 机器合同 26/26，但外部文档审查尚未完成 |

## 2. 已关闭的方向风险

- 不再把 Offscreen WebSocket 断连误判为 Runtime、Windows 网络或 ticket 问题。
- 不延长 ticket、不绕过 user activation、不让 runner 成为第二编排者。
- 明确 Background 重启不续传旧音频，“恢复”只恢复可解释状态和新重试入口。
- P1 六视频继续被 P0 immutable candidate 和独立审查阻塞。

## 3. 实施前必须关闭

1. v1-v4 R0 已作废；不得实现旧合同、读取不存在的 `MessageSender.incognito`，或让新 worker 写旧 task。
2. v5 已冻结九类严格消息、Base64 JSON、单信用、producer bounded outstanding、quiesce/drain/finalize、20 项 FailureCode 闭集、RLY5-N01..N30 固定映射、24+8 步 trace 和对抗 verifier；26/26 只代表静态文档一致。
3. 外审必须实际运行四类对抗变异，并复核 chunk 所有权、sender、streamId、五 marker 实例、完整 trace digest 与 Runtime 单 sink 组合证据。
4. 外审必须确认 WXT manifest 的 `minimum_chrome_version: "116"` 是 R0 必改项，且不允许为旧 Chrome 增加弱 sender 校验回退。
5. 独立文档审查复核 PRD、架构、状态机、隐私和验收分母，Fatal=0/Major=0。
6. 用户明确授权本架构候选的 R0-R7 实施。

## 4. 当前 Minor

- M-1：extension CSP 的显式 loopback 声明已形成代码候选，但尚未证明它是 Offscreen 失败根因；文档不得作此宣称。
- M-2：最新 canary 目录属于临时证据，candidate 封存时必须复制必要的脱敏摘要并清理私有原件。
- M-3：Archify 图只表示本专项，不替代 V3 总体 8 页 Draw.io；后续总图需追加状态变更而非重画全局。

## 5. 判定

Fatal=0；Major=0（文档方向）；Minor=3。文档可提交独立外审。代码实施在外审与明确授权前保持 NO-GO。

