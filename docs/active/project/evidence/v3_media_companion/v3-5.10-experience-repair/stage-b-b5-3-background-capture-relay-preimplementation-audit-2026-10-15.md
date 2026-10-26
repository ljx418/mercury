# Stage B B-5.3 P0 Background Capture Relay 实施前内部审计

日期：2026-10-15。审查对象：v10 架构、开发计划、验收计划和现有代码/真实 canary 事实。结论：`V10 DOCUMENT CANDIDATE FOR ONE CODEX INDEPENDENT REVIEW / IMPLEMENTATION WAITS FOR THAT REVIEW`。

## 1. 审查结论

| 维度 | 结论 | 依据 |
|---|---|---|
| PRD 一致性 | PASS | 保留可信点击、30 秒 grant、本地 ASR、同源权威、私有清理 |
| 用户体验 | PASS | 不增加操作；只修复扩展内部 transport ownership |
| 架构可实现性 | CONDITIONAL | v1-v9 均 rejected；v10 增加 SQLite FULL ownership receipt 与 manifest hash 绑定、imported enum AST closure 和无字节码审计执行，以现有 SQLite 产品终态作为唯一持久 authority，仍需一次 Codex 独立审查与真实 capability probe |
| 安全/隐私 | PASS WITH GATES | 无新云上传；exact sender/Origin、bounded queue、secret scan 已列硬门槛 |
| 验收拒假绿 | PASS | 真实 PCM、真实 Uvicorn、visible muted Chrome、同 task、runner purity、故障矩阵均固定 |
| 开发授权 | WAITING SINGLE REVIEW | v10 机器合同 50/50、mutation 15/15；用户已批准实际开发，单次 Codex 独立审查 Fatal=0/Major=0 后直接进入 R0-R7，不再要求 Claude 或第二份文档外审 |

## 2. 已关闭的方向风险

- 不再把 Offscreen WebSocket 断连误判为 Runtime、Windows 网络或 ticket 问题。
- 不延长 ticket、不绕过 user activation、不让 runner 成为第二编排者。
- 明确 Background 重启不续传旧音频，“恢复”只恢复可解释状态和新重试入口。
- P1 六视频继续被 P0 immutable candidate 和独立审查阻塞。

## 3. 实施前必须关闭

1. v1-v8 R0 已作废；不得实现旧合同、读取不存在的 `MessageSender.incognito`、把进程内 acquisition succeeded 当 durable 产品终态、在 staging 前启动 daemon worker，或假定 hard crash 执行 finally。
2. v10 已冻结九类严格消息、Base64 JSON、单信用、bounded outstanding、quiesce/drain/finalize、20 项内部 relay FailureCode、RLY10-N01..N30、24+8+6+13 步 trace、8 个 owner/receipt 负例、六 handoff/product failure case、七类 recovery owner、manifest 原子发布/目录 fsync、SQLite FULL receipt、composite cleanup、40 项源码 inventory、non-relay allowlist、边界 code mapping 和 Schema/protocol digest；50/50 与 15/15 只代表实施合同一致。
3. 单次 Codex 外审必须实际运行 baseline/mutation，并复核 receipt 跨重启可判定、manifest hash 绑定、imported enum 拒绝、无 `.pyc`、唯一 cleanup owner、四类残留全零、SQLite 产品终态、40/20 code closure、三个 revision 域、sender/streamId 与 Runtime 单 sink 组合证据。
4. 外审必须确认 WXT manifest 的 `minimum_chrome_version: "116"` 是 R0 必改项，且不允许为旧 Chrome 增加弱 sender 校验回退。
5. 独立文档审查复核 PRD、架构、状态机、恢复 owner、公共边界不变、隐私和 A01-A18，Fatal=0/Major=0。
6. 用户明确授权本架构候选的 R0-R7 实施。

## 4. 当前 Minor

- M-1：extension CSP 的显式 loopback 声明已形成代码候选，但尚未证明它是 Offscreen 失败根因；文档不得作此宣称。
- M-2：最新 canary 目录属于临时证据，candidate 封存时必须复制必要的脱敏摘要并清理私有原件。
- M-3：Archify 图只表示本专项，不替代 V3 总体 8 页 Draw.io；后续总图需追加状态变更而非重画全局。

## 4.1 v10 机器复核

- 权威 verifier：50/50 PASS，exit 0。
- 隔离 mutation verifier：15/15 PASS，exit 0。14 个危险删改稳定结构化 exit 2；包括 parent fsync、SQLite receipt write/hash 与跨文件 imported enum emitter；非边界词法对照 exit 0。所有 Python 以 `-B` 和 `PYTHONDONTWRITEBYTECODE=1` 执行。
- 源码证据：11 个精确边界 scope 的 SHA-256 与 fixture 一致；Python/TypeScript semantic AST boundary set 精确等于 40 项 inventory；四个递归 discovery root 的完整 `V3_MEDIA_*` universe 恰等于 inventory + non-relay allowlist。该结果只证明文档候选与当前源码事实闭合，不证明 v9 实现存在。

## 5. 判定

Fatal=0；Major=0（v10 内部机器复核）。用户已明确要求收敛外审并继续实际开发；仅保留一份 Codex 独立文档审查。该审查 Fatal=0/Major=0 后，既有用户授权直接放行 R0-R7，不再生成新文档版本或等待 Claude Code。

