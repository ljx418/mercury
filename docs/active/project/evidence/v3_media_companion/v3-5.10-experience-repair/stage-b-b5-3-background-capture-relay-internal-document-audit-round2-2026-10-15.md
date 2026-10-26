# P0 Background Capture Relay 第二轮内部文档审计

日期：2026-10-15。历史结论：已被第三轮独立架构审查撤销。当前以 `stage-b-b5-3-background-capture-relay-internal-architecture-audit-round3-2026-10-15.md` 为准，状态为 `V1 REJECTED / V2 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. 复算

- 交接包：16/16 payload SHA-256 PASS。
- 外审包：18/18 payload SHA-256 PASS；总文件 19，符合少于 20 的平铺限制。
- relay architecture Markdown 与 JSON 平铺副本对权威源 byte-identical。
- Archify architecture：showcase 9/9，composition errors=0、warnings=0。
- 文档范围 git diff --check PASS。
- PRD、架构、开发计划、验收计划和 Stage Gate 均含本次内部 transport ownership 纠偏或门禁引用。
- 内部 relay schema meta + positive instance + RLY-N01..N16 registry verifier：权威目录与平铺外审包均 14/14 PASS。第一次因仓库根少上溯一级失败；第二次暴露平铺副本目录深度不同；最终采用“同目录 15/16 优先、权威路径回退”，两种入口均通过，未修改合同语义。新增两项检查分别锁定非秘密 restart tombstone 和“重启绝不续传旧 session”。

## 2. 规格与架构判断

用户动作、30 秒 ticket、Runtime API、SourceAuthority、Side Panel materialize 和本地隐私边界均保持。Background 唯一 WS owner、Offscreen 纯 PCM producer、exact-sender Port、sequence/backpressure 与 restart fail-closed 能支撑 R0-R7，不引入第二事实源或第二 materialize 编排者。

A01-A14 明确拒绝 mock/空 PCM、runner 越权、跨 run、无限 queue、秘密泄漏和 cleanup 假绿。单视频 canary、故障矩阵和独立实施审查仍是 P1 前置。

## 3. 残余项

- Minor 1：Archify deterministic deliver 已通过，但 browser visual-check 因 WSL 未发现 Chrome executable 而 skipped；视觉审阅 pending。
- Major 1（流程门禁，不是文档内容缺陷）：ClaudeCode 只读外审返回 Token Plan 429，未产生独立报告。
- Minor 2：schema/fixture 已冻结 64 KiB chunk、1 Runtime in-flight、32 chunks/2 MiB queue、固定 timeout、FailureCode 闭集，以及仅含哈希和时间的 `chrome.storage.session` restart tombstone；transferable ArrayBuffer、墓碑原子清理与 worker restart 必须由实现和真实 Chrome 证明，不能由 fixture 代替。

## 4. 门禁

Fatal=0；Major=1（外审未完成）；Minor=2。当前只能等待/恢复外部文档审查。外审 Fatal=0/Major=0 后仍需用户明确授权 R0-R7。P0/P1/六视频保持 NO-GO。

