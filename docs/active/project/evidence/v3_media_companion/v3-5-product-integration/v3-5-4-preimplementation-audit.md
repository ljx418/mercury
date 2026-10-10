# V3-5-4 实施前内部审计

日期：2026-10-08。决定：`GO V3-5-4-1..7`。

- Fatal：0
- Major：0
- Minor：3

## 审查结论

1. PRD 覆盖：Ask A08、seek/H08、export A12/H10 均映射到固定自动门槛；没有扩大到 V4 Know 或 Agent。
2. 架构边界：Runtime 拥有 Ask/export 事实，Extension 只渲染和经 portal adapter seek；B 前端不直连模型或媒体站点实现。
3. 输入准备：V3-5-3 已证明 fresh ready task、四类 evidence、8 route、lease 清理和去敏；V3-5-4 必须另建 fresh run。
4. 假绿防线：Ask citation 闭合、视觉问题证据类型、播放器真实回读、ZIP 解包/hash、错误页面负例均不可省略。

## Minor

- M-1：V3 低资源 Ask 采用 extractive provider，表达能力低于生成式模型；优点是无需新增密钥/下载且不会引入外部常识。接口保持可替换。
- M-2：可信 capture 的时间轴当前从播放起点建立；本轮真实 run 固定从 0 秒开始，任意中途 capture 的绝对 offset 留作后续增强，不能在 UI 中伪装。
- M-3：浏览器下载目录和 Chrome 下载行为存在平台差异；机器验收以 Runtime artifact API 字节与 manifest 为权威，同时验证真实 UI 点击触发。

上述 Minor 不降低 A01..A18。开始实施前无需新增用户高风险授权：Cookie/MiniMax 授权沿用既有任务范围，导出仅写入隔离测试目录。
