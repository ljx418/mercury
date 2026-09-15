# T02.1 PRD 规格检视

日期：2026-09-12  
结论：`PASS FOR T02.1 SCOPE / NO PRODUCT COMPLETION CLAIM`

## 1. 对照结果

| PRD/PX-5 要求 | 底层证据 | 结论 |
|---|---|---|
| 三个真实用户入口 | native Side Panel trusted click；2/2/3 | PASS |
| Route A 五路由恢复 | 每路由 direct-open/reload/Back/reopen | PASS，20/20 |
| invalid/forbidden 可恢复错误 | INVALID_ROUTE、WORKSPACE_NOT_FOUND 与真实回库点击 | PASS，2 条 |
| 稳定 workspace/source/operation ID | 同 navigation Runtime authority 与 source registry | PASS |
| 真实 source corpus | 6 web + 3 explicit local + 3 note；每项不同 bytes/hash | PASS，12/12 |
| Permission | 3 个真实 Runtime 权限流程 | PASS |
| Forget | 3 个 source；四面 verification 与四种同源重开新 authority | PASS |
| 四类服务故障 | 4 个不重叠 controlled intervals | PASS |
| 双容器与四视口 | Side Panel 360/420；Workspace 768/1280 | PASS |
| 可访问性机器门槛 | axe serious/critical 0；keyboard 5/5 | PASS |
| 证据真实性 | raw bytes、eventId、path/hash/length、seal 可重算 | PASS |

## 2. 目标体验检视

用户能从真实 Side Panel 保存/查看来源、进入 Workspace，在 Source Library、Source Detail、Ask、Graph、Permissions 间直开和恢复；无效 route 可回来源库；Source Detail 辅助标签和 Evidence 说明达到普通文本 4.5:1 门槛；Forget 后同一来源四种重开读取新的 Runtime `forgotten` authority。

截图抽查未发现颜色修复导致的信息层级、遮挡或溢出退化。该体验仍运行在冻结的 Mock Adapter，不能表述为真实 data_service 或 RAG。

## 3. 范围边界

T02.1 仅补足 PX-5/R3 的 production-positive 原始输入，不生成派生 G1-G7 结论，不签署 Human Review，不证明 T03/R4/PX-5/PX-6/V2 完成。RKM 自动维护、Dream Cycle、自动遗忘、默认本地文件访问仍不在本阶段。
