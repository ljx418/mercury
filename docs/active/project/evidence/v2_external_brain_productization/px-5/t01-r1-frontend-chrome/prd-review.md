# T01 PRD 规格检视

日期：2026-09-11  
结论：T01 范围内无 Fatal/Major 规格偏差；T01 通过不等于 PX-5 或完整 V2 通过。

| PRD 要求 | 本轮覆盖 | 结论 |
|---|---|---|
| `01-prd.md:1753` 四域服务状态 | 真实 Runtime 在线、认证失败、transport offline；offline 固定为 `offline/unchecked/unchecked/unknown` | PASS |
| `01-prd.md:1759` 本地文件默认关闭、显式授权 | 三个真实文件分别授权、扫描、选择、导入和撤销；Windows 路径前端拒绝 | PASS |
| `01-prd.md:1760` Forget 二次确认与 before/after | 精确确认后验证 Library/Ask/Graph/Trace 四面缺席；坏结果由组件测试拒绝 | PASS |
| `01-prd.md:1863-1873` Side Panel/Workspace 双容器与稳定 ID | 两个容器独立认证，稳定 `workspaceId/sourceId/operationId` 一致，Workspace 重读 Runtime | PASS |
| `01-prd.md:1885-1887` Route A `workspace.html` | 从真实宿主和原生 Side Panel 打开 Workspace，fresh build 可解析页面 | PASS（T01 路径） |
| `01-prd.md:1954` 不伪造离线下游事实 | transport 失败由前端推导 offline，下游为 unchecked/unknown | PASS |
| `01-prd.md:2087` 当前 PX 状态 | 更新后的实现证明 R1 前端与真实 Chrome T01；不据此写 PX-5/PX-6 完成 | PASS |

未覆盖且不得由 T01 声明：PX-5 原始证据生成器与生产 validator、G4 完整架构扫描、PX-6 人工产品体验、真实 data_service、RKM AC01..AC10、自动维护或 Monica-like UX。

残留 Minor：Side Panel poller 对非 transport 的短暂状态回落可进一步收紧；当前单元测试和真实 403 路径均能最终显示 `authentication_required`，不构成 T01 Major。该项进入 T02 启动审计清单。
