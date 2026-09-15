# T02 R2 实施前审计

日期：2026-09-11  
状态：GO。第二轮独立只读审查为 Fatal 0 / Major 0 / Minor 5；五项Minor已在实现前补入Schema或A11验收，不改变Runtime/Adapter公共合同。

## 审计结论

T01 已满足 10/10 验收并完成独立 Fatal 0 / Major 0 复审。R2 原始采集是权威修复合同规定的下一线性阶段，不与 R3/R4 并行。

第一轮独立审查发现 Fatal 3 / Major 10 / Minor 7。候选现已补入：T02-0旧路径硬退役、response.body原始字节、真实trusted入口、单写者collector、fault区间、Side Panel四视口、事件runId、seal、ID派生和脱敏规则。该合同修改只影响PX-5原始证据包，不改变Runtime产品API；修订后仍需第二轮独立审查，不自行宣布GO。

## 风险闭环

| 风险 | 严重度 | 候选处置 |
|---|---|---|
| runner 根据场景定义补事件 | Major | 单写者 append-only collector；缺观察失败，不派生成功值 |
| `evaluate/sendMessage` 冒充用户入口 | Major | 只接受真实 Event.isTrusted，并用 actionId 继承链证明 |
| response hash 取整包或重序列化 JSON | Major | 网络层 response body 原始字节单独 artifact |
| 时间邻近误配请求/页面 | Major | requestEventId、navigationId、actionId 和 authorityEventIds 显式引用 |
| Runtime 重启引用旧成功 | Major | segment 边界和 PID/session，跨 segment 引用负例 |
| token/路径泄漏 | Major | header 不入公开事件；路径 artifact 私有；全量 raw-byte scan |
| old generator 覆盖失败 | Fatal | T02 禁止调用 generator/production validator；sealed run 不覆盖 |
| 主脏工作树污染证据 | Major | detached worktree + raw hash overlay + 本地 snapshot commit |

## 放行条件

第二轮独立只读审查已确认：v2 schema与权威合同一致、12项分母无缩小、T02-0先阻断旧假raw路径、无需新增产品公共合同，Fatal 0 / Major 0。审查后进一步关闭五项Minor：count相等纳入collector invariant；fault区间结构化；业务requestId null与引用错配拆分；command必须有exitCode或signal；A11文案同步。只放行T02，不放行R3/R4/PX-6。
