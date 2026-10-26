# Stage B B-5.3 P0 Background Capture Relay 实施前内部审计

日期：2026-10-15。审查对象：v8 架构、开发计划、验收计划和现有代码/真实 canary 事实。结论：`V8 DOCUMENT CANDIDATE FOR EXTERNAL REVIEW / IMPLEMENTATION NO-GO`。

## 1. 审查结论

| 维度 | 结论 | 依据 |
|---|---|---|
| PRD 一致性 | PASS | 保留可信点击、30 秒 grant、本地 ASR、同源权威、私有清理 |
| 用户体验 | PASS | 不增加操作；只修复扩展内部 transport ownership |
| 架构可实现性 | CONDITIONAL | v1-v7 均 rejected；v8 增加同步 staging 所有权屏障，以现有 SQLite 产品终态作为唯一持久 authority，冻结 36/20 code inventory 与三个 revision 域，仍需独立审查与真实 capability probe |
| 安全/隐私 | PASS WITH GATES | 无新云上传；exact sender/Origin、bounded queue、secret scan 已列硬门槛 |
| 验收拒假绿 | PASS | 真实 PCM、真实 Uvicorn、visible muted Chrome、同 task、runner purity、故障矩阵均固定 |
| 开发授权 | NO-GO | v8 机器合同 39/39，但双重外部文档审查尚未完成 |

## 2. 已关闭的方向风险

- 不再把 Offscreen WebSocket 断连误判为 Runtime、Windows 网络或 ticket 问题。
- 不延长 ticket、不绕过 user activation、不让 runner 成为第二编排者。
- 明确 Background 重启不续传旧音频，“恢复”只恢复可解释状态和新重试入口。
- P1 六视频继续被 P0 immutable candidate 和独立审查阻塞。

## 3. 实施前必须关闭

1. v1-v7 R0 已作废；不得实现旧合同、读取不存在的 `MessageSender.incognito`、把进程内 acquisition succeeded 当 durable 产品终态、在 staging 前启动 daemon worker，或假定 hard crash 执行 finally。
2. v8 已冻结九类严格消息、Base64 JSON、单信用、bounded outstanding、quiesce/drain/finalize、20 项内部 relay FailureCode、RLY8-N01..N30、24+8+6 步 trace、六 handoff/product failure case、七类 recovery owner、36 项源码 inventory、边界 code mapping 和 Schema/protocol digest；39/39 只代表静态文档一致。
3. 外审必须实际运行 Schema-only 放宽与旧 port 回退变异，并复核六注入点、同步 staging/fsync/hash/shape 屏障、barrier 前后唯一 cleanup owner、SQLite 产品终态、recover published/abandoned 观察证据、36 source code 分类、三个 revision 域、connecting owner、GET 404、chunk 所有权、sender、streamId、五 marker 实例与 Runtime 单 sink 组合证据。
4. 外审必须确认 WXT manifest 的 `minimum_chrome_version: "116"` 是 R0 必改项，且不允许为旧 Chrome 增加弱 sender 校验回退。
5. 独立文档审查复核 PRD、架构、状态机、恢复 owner、公共边界不变、隐私和 A01-A18，Fatal=0/Major=0。
6. 用户明确授权本架构候选的 R0-R7 实施。

## 4. 当前 Minor

- M-1：extension CSP 的显式 loopback 声明已形成代码候选，但尚未证明它是 Offscreen 失败根因；文档不得作此宣称。
- M-2：最新 canary 目录属于临时证据，candidate 封存时必须复制必要的脱敏摘要并清理私有原件。
- M-3：Archify 图只表示本专项，不替代 V3 总体 8 页 Draw.io；后续总图需追加状态变更而非重画全局。

## 4.1 v8 机器复核

- 权威 verifier：39/39 PASS，exit 0。
- 对抗变异：12/12 均稳定输出结构化 `passed=false`、`failedChecks` 非空并 exit 2；覆盖 Schema 放宽、v7 port 回退、stage barrier 删除、worker 提前、transfer 后 handler cleanup、completed 通知冒充产品终态、强制 published、source inventory 漏项、TaskArtifact mapping 漏项、source hash 漂移、revisionDomainCount=4 和 cleanup mapping 删除。
- 源码证据：6 个边界文件 SHA-256 与 fixture 一致，六个 v7 漏项 code 均可在当前源码中定位。该结果只证明文档候选与当前源码事实闭合，不证明 v8 实现存在。

## 5. 判定

Fatal=0；Major=0（v8 内部文档复核）；Minor=3。v7 双重外审采用严格结论 Fatal=0/Major=2，已归档 rejected；v8 可重新提交双重独立外审。两份审查均 Fatal=0/Major=0 且用户明确授权前，代码实施保持 NO-GO。

