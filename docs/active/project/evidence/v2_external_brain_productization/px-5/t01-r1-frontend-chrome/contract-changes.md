# T01 合同变更结论

日期：2026-09-11  
结论：无外部公共合同变更。

| 合同面 | 结果 | 说明 |
|---|---|---|
| Runtime HTTP / OpenAPI | 未变更 | 继续消费现有 `/v1/knowledge/*`、`X-Navia-Token` 和响应 envelope |
| Adapter / data_service | 未变更 | 本阶段仍使用既有 MockKnowledgeServiceAdapter 路径，不宣称真实 data_service 集成 |
| 数据模型 / JSON Schema | 未变更 | 未增加或修改可跨进程交换的字段、枚举或 ID 规则 |
| Event / SSE | 未变更 | 未新增事件字符串或 SSE 类型 |
| 前端内部 API | 有限定增量 | `runtimeClient.ts` 增加类型化错误和页面私有 session 控制函数；只用于两个前端容器，不改变 Runtime wire contract |
| E2E bridge | 测试专用 | 受编译期 `__NAVIA_E2E_BRIDGE__` 控制，只存在于 `build:e2e`，不得进入普通生产声明 |

不需要返回 V1.2-0 或 V2 合同评审。若后续 T02 需要改变原始证据 schema、Runtime API 或 Adapter 行为，必须另行审计，不能沿用本结论。
