# R7 开发计划

1. **R7-0 门禁复核**：核验 R0-R5 checkpoint、R6 58/65 与 scope amendment；v11 baseline/mutations 必须全绿。
2. **R7-1 产品默认行为**：确认生产仲裁器不会静默进入 tabCapture；若当前会自动进入，做最小改动将其改为 blocked/experimental choice，不删除 relay 代码。
3. **R7-2 候选封存**：记录 source tree、build tree、关键合同、模型与依赖状态摘要；不得包含 Cookie、API key、token 或原始媒体。
4. **R7-3 集中回归**：只执行一次 typecheck、extension tests/build、Runtime focused tests、v11 baseline/mutations 和 capture 静态合同。修复内循环只跑受影响测试。
5. **R7-4 反假绿审计**：核验无 mock 冒充生产、无 G2 7/7 声明、无文件导入声明、无跨 run 拼接。
6. **R7-5 closeout**：生成 receipt、test results、PRD review、limitations、cleanup/secret receipt、immutable manifest 和 handoff。Fatal/Major 非零则 NO-GO。

R7 不启动 Chrome、Provider 或六视频；若产品默认行为只能经真实 Chrome 判断，停止并单独申请一个可见窗口，不复用 R6 失败运行。

