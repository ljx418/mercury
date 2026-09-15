# PX-5 架构检视

> 2026-09-09 撤回：本文件后续内容为旧记录，原 PASS / Major 0 / 仅待人工签署结论失效。当前 PX-5 FAIL / REOPENED，PX-6 BLOCKED_BY_PX5_MAJOR。参见 [中断恢复证据复核](resumption-evidence-audit-2026-09-09.md)。未补齐证据前不得签署或放行。

## 2026-09-08 历史记录（不作为当前放行依据）

日期：2026-09-08

- P0 -> P7 调用边界保持不变，Workspace 与 Side Panel 均未直连 data_service。
- Architecture Scan Manifest v2 绑定 3 个冻结根、26 个真实源文件、当前 commit、source tree/path index、ruleset 和 allowlist。
- production validator 重读实际源码并执行 TypeScript AST import/call/new 检查，不信任 Report 自报 `violations=0`。
- Drawio 保持 8 页并同步 PX-5 为绿色、PX-6 人工门禁为黄色。

Fatal 0，Major 0，Minor 0。
