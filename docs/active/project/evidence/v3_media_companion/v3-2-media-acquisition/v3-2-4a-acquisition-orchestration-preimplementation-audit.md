# V3-2-4a 实施前内部审计

日期：2026-10-07。决定：`GO FOR V3-2-4a IMPLEMENTATION ONLY`。

## 1. 复核结果

- PRD 顺序：与 `01-prd.md` §18.4 完全一致。
- 架构：只新增 extension application service 和 Runtime execute 边界，沿用既有 adapter/coordinator/capture，不建立 B站专用 UI 通道。
- 权限：不新增 Chrome/host 权限，不读取新 Cookie 名。
- 假绿：前两条失败不能由 UI 写入；available page subtitle 不能被转换成失败；真实 capture 必须由可信点击。
- 验收：A01..A18 均有用户操作、观察和硬门槛，无 N/A。

## 2. 审计意见闭环

| ID | 发现 | 处置 | 状态 |
|---|---|---|---|
| M-1 | 原实现只有 eligibility 查询，没有产品 execute API | 冻结无 body execute API 和 Runtime authority | CLOSED |
| M-2 | coordinator 会把可回退异常直接终结 | 冻结 expected-failure 非终态语义 | CLOSED IN DESIGN |
| M-3 | UI 可调用通用 route-failure endpoint | 前两路由 Runtime 内部写入；第三路客户端方法限制联合类型并由可用性 guard 控制 | CLOSED IN DESIGN |
| M-4 | 生产 Runtime 未构造真实 downloader | 只允许读取冻结 manifest 和显式工具路径；缺失即 offline，不静默 mock | CLOSED IN DESIGN |
| M-5 | 现有 UI 用 `current` 占位 sourceIdentity | 开始前必须读取真实 content-bridge context 并生成规范 identity | CLOSED IN DESIGN |

## 3. 严重度

Fatal=0，Major=0，Minor=1。

Minor：本 session 同时承担文档与实施，组织独立性不足；实施后必须单独生成候选并交由独立 reviewer 做只读出门审查。该项不允许跳过真实 A01..A18。

实现复核补充：audio input 与 capture completion receipt 两个结果断点已纳入合同 A17/A18；不得以 `input_acquired` 或 `stopped` 代替 transcript terminal evidence。

用户“继续开发”指令视为 V3-2-4a 限定实施授权；不授权 V3-2-5 或后续阶段。
