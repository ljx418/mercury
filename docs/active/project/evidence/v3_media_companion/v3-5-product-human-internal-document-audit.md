# V3-5 产品体验文档内部独立复审

日期：2026-10-08。范围：V3-5 产品集成、双容器路由、真实执行路线、ASR 资源提示、唯一一轮人工验收。当前仍是文档冻结阶段，不授权产品代码实现。

## 1. 第一轮：规格与架构一致性

结论：`Fatal=0 / Major=1 / Minor=1`。

- PRD 边界保持：V3-5 只把 V3-1..4 的真实媒体结果产品化，不声明 V4 知识导入、Agent、跨站全支持或 V3 最终通过。
- 数据流保持单向：Portal Adapter -> Runtime task/event -> Side Panel/Workspace。前端不直连模型，不从 sample registry 推导执行结果。
- 8 条 canonical media route 与旧 transcript replace 迁移已写入开发/验收文档；Knowledge router 保持独立。
- 人工验收只判断可见体验，不要求 Cookie、听写、日志、hash 或模型比较。
- Major：旧 product acceptance v1 无法记录 registry class 与 observed route 的差异，存在字幕类样本实际走 ASR却显示快路径的假绿风险。
- Minor：逐步截图必须来自未来 fresh build；当前概念/历史截图不能作为 H01..H10 证据。

## 2. 修订

新增 `v3_media_product_acceptance_v2.schema.json`，历史 v1 不修改。v2 强制 `taskExecution`：

1. `registryClass` 与 `observedRoute` 分开记录；
2. `routeDrift` 与 `fallbackReasonCodes` 成对约束；
3. 本地 ASR/capture ASR 强制资源提示、非零内存/临时磁盘、可取消和临时媒体删除；
4. Schema 负责 shape 与强常量，语义 verifier 负责 class/route 映射、算术及非零资源事实；
5. fresh run 只接受 v2，v1 只读归档。

测试覆盖：Schema meta、ASR 回退正例、字幕快路径正例，以及 routeDrift、fallback reason、提示可见性、localAsr、取消、清理、内存、临时磁盘共 8 类假绿负例。定向结果 `23 passed`。

## 3. 第二轮：防假绿与可实施性复审

结论：`Fatal=0 / Major=1 / Minor=1`。

- 原 Major 已在文档与合同层关闭：v1 不能作为 fresh receipt；v2 缺 `taskExecution` 必失败。
- Schema 与 semantic verifier 责任边界明确，不以 Schema 能验证所有跨字段事实为由过度承诺。
- ASR 资源数字来自当次 Runtime observation，不是静态产品文案；UI 必须显示 observed route。
- V3-4 sealed run 和 LIMITED PASS 不修改，route drift 只作为 V3-5 输入风险处理。
- 当前唯一 Major 是外部独立文档审查尚未完成；在其关闭前 V3-5 implementation 仍为 NO-GO。
- Minor 保持：真实截图与人类页面只能在自动门槛 A01..A18 全绿后生成。

## 4. 出门判定

文档候选足以提交外部审查，但不构成代码授权。外审必须独立确认：

- v1 历史合同未被修改，v2 才是 fresh-run 唯一合同；
- routeDrift 固定映射和 ASR 资源/清理约束能拒绝假绿；
- Media router 不侵入 Knowledge router；
- 人工 H01..H10 不承担自动化工作；
- V3-5 通过最多只放行 V3-6，不等于 V3 或完整产品通过。

外审 `Fatal=0 / Major=0` 且用户另行明确授权后，才允许进入 V3-5-0..7 实施。
