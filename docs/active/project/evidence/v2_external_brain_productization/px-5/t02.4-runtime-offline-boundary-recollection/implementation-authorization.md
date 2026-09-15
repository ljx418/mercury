# T02.4 实施授权摘要

状态：`AUTHORIZED`  
授权日期：2026-09-14

用户指令：“继续定位并修复该问题 然后重新自身T2.3 然后继续开发T3”。结合已冻结 T02.4 计划，解释为批准：

- 修复 R2 `runtime_offline` fault interval 因果边界；
- 新建完整、独立的真实 Chrome R2 run；
- 对新 run 执行用户授权自审；
- 通过后更新唯一 T03 production-positive 基线并从 T03-1 重放；
- 继续既有 T03-0..7 授权，但不进入 T04/PX-6/RKM。

禁止修改旧 sealed run、产品 UI、Runtime/API、Schema、63 RuleId、109 requirements、42 mutations 或 G1-G7。
