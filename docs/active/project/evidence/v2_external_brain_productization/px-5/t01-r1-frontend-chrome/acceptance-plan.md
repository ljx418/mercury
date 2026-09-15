# T01 R1 前端与真实 Chrome 验收计划

日期：2026-09-10  
状态：实施前冻结候选。所有证据来自本轮隔离快照和真实 Runtime，不复用 2026-09-08 PX-5 报告。

## 1. 自动化门槛

| ID | 场景 | 必须结果 |
|---|---|---|
| T01-A01 | 全量前端测试 | 每个 test file 单独退出 0；全量 Vitest 在约定超时内退出 0；不得 skip/exclude 解决挂起 |
| T01-A02 | Runtime 客户端错误 | 401/403 -> authentication；连接拒绝/超时 -> transport；其他API失败保留 code/reason/requestId；每请求X-Request-ID与envelope一致；token generation变化或由此abort -> stale |
| T01-A03 | 两容器认证 | Side Panel与Workspace各用稳定testid真实输入同一随机token；任一刷新/断开只清除本容器；token不出现在location/referrer、local/sessionStorage、chrome local/session/sync、IndexedDB、公开console/network/Runtime日志、DOM可见文本和截图捕获时的input value |
| T01-A04 | 晚到响应 | 延迟真实 Runtime 请求后断开或改 token；旧响应不得恢复 source、Ask、Graph、Trace、Permission 或 Forget UI |
| T01-A05 | PermissionRoot | 三个真实授权root分别grant/scan/select/import/revoke；单active-root瞬态不跨root；Windows/相对路径前端提示且Runtime拒绝；授权和扫描不自动导入；撤销后新scan/import 403，已导入来源仍可读 |
| T01-A06 | 文件安全 | 真实 PRD/架构/验收文档副本保持原始字节/hash/行引用；公开响应和证据无绝对私人路径或 token |
| T01-A07 | Forget | 正确确认成功后四面真实缺席；错误确认拒绝；任一面残留、异常或坏 shape 显示 degraded/failed，禁止成功文案 |
| T01-A08 | 用户路径 | launcher -> Side Panel 连接 -> 保存 -> 打开 Workspace -> 第二次连接 -> 查看同 source；稳定 workspace/source/operation ID 一致 |
| T01-A09 | 回归 | 后端 R1 限定测试、Runtime 全量、前端 typecheck/build、相关组件测试和真实 Chrome 全部退出 0 |
| T01-A10 | 审计 | PRD/架构矩阵无未解释偏差；独立审查 Fatal=0/Major=0；所有必需项有原始路径/hash |

## 2. 真实输入与故障

文件样本使用当前仓库 `01-prd.md`、`02-architecture.md`、`04-acceptance-plan.md` 的临时只读副本，分别建立三个授权root。网页保存使用仓库已有真实网页采集fixture，经隔离本地HTTP服务加载，不用空白页或手写假来源。Runtime使用随机至少32字符token、实际extension ID和固定合同端口17861；证据只保存token hash/长度，不保存token。截图只在password input已清空后捕获；捕获前断言input value为空，所有公开artifact raw bytes再按token原文扫描，命中即失败。

故障通过自动化层受控延迟/阻断真实 HTTP 请求，记录 fault 起止，不伪造成功响应。必须覆盖错 token、Runtime 拒绝连接、Runtime 重启换 token、断开时在途返回、撤销与 scan/import 竞争、Forget 四面残留和响应坏 shape。

后端基线必须逐名运行并记录撤销cache-hit、提交窗口撤销、Forget输入、四面重读、EvidenceRef有界构造、授权ticket和通用入口拒绝用例；不能仅记录“104 passed”。

## 3. 出门规则

必需结果分母固定为 T01-A01..A10。`failed/pending/deferred` 均阻止通过；不适用必须在实施前审计中预先批准，当前无 not_applicable。普通失败返回本计划重新分析并修复后重跑受影响链及 A09/A10。

出现新权限绕过、凭据泄漏、错误成功态、旧响应回流、跨 workspace/source 串数据、需要修改 A/C/D 公共合同或需要真实 data_service 才能通过时，立即停止并向用户报告。
