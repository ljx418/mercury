# PX-5 防假绿审计

> 2026-09-09 撤回：本文件后续内容为旧记录，原 PASS / Major 0 / 仅待人工签署结论失效。当前 PX-5 FAIL / REOPENED，PX-6 BLOCKED_BY_PX5_MAJOR。参见 [中断恢复证据复核](resumption-evidence-audit-2026-09-09.md)。未补齐证据前不得签署或放行。

## 2026-09-08 历史记录（不作为当前放行依据）

日期：2026-09-08

- source fingerprint 从仓库原始字节重算，12 个 hash 唯一。
- screenshot 校验文件、SHA-256、PNG 解码尺寸、Manifest viewport 和 capture surface。
- manifest/report/execution/screenshot 的 scenario ID 集合完全一致。
- 生产入口 requestId 来自页面实际消息代理，Runtime 响应来自网络观察。
- Runtime offline 使用 transport abort；其他故障明确标记 controlled injection。
- Forget 同时检查 Runtime list 和 direct-open/reload/Back/reopen，不接受只隐藏 UI。
- G4 重读源文件执行 AST scan，不信任报告布尔值。
- contract fixture、prototype、`virtual/*` 和 V2-7 渲染图均未计入产品截图。
- 自动化未填写 reviewer，Report 保持 not-passed claim。

Fatal 0，Major 0，Minor 0。
