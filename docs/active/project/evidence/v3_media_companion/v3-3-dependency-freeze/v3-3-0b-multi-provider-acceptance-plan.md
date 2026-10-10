# V3-3-0b 多视觉 Provider 验收计划

日期：2026-10-08。固定门槛：`MP01..MP12`，不允许 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| MP01 | GET Provider settings | 返回 MiniMax/OpenAI 闭集 catalog、配置列表和当前选择 |
| MP02 | 保存 MiniMax 密钥 | 密钥只在系统凭据库，SQLite/响应无明文 |
| MP03 | 同时保存 OpenAI 密钥 | 两个 `secretRef` 隔离，互不覆盖 |
| MP04 | 选择未知 Provider/模型 | 400 fail-closed，写密钥次数为 0 |
| MP05 | 提交自定义 base URL | 400 fail-closed，拒绝 SSRF 面 |
| MP06 | 未测试即选择 | 409，当前路由不变 |
| MP07 | MiniMax 中性图测试 | 官方 chat-completions 多模态 shape；typed observation 与 typed usage 完整 |
| MP08 | 测试通过后选择 | 当前 Provider/模型唯一且持久化 |
| MP09 | 删除非当前 Provider | 只删除目标密钥，当前路由不变 |
| MP10 | 删除当前 Provider | 当前路由清空，不静默切换 |
| MP11 | 前端两视口与状态切换 | Provider/模型可选、密码框可真实键入；checking/offline 到 online 不清空临时输入；影响说明无重叠；Axe serious/critical=0 |
| MP12 | 全量回归与秘密扫描 | Runtime/前端/typecheck/build 通过；新增公开证据 0 secret hit |

真实 MiniMax Key 的中性 probe 是本阶段最终外部能力门槛。没有用户本机录入时，只能声明实现候选，不能声明 MiniMax 云端能力已通过。
