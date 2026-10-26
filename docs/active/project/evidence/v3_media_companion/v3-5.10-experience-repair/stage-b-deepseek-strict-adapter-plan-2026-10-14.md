# Stage B DeepSeek 严格结构适配器实施与验收计划

日期：2026-10-14。范围：V3-5.10 Stage B Provider 结构合同，不扩大到 Stage C。

## 1. 决策依据

- 普通 `chat/completions + json_object` 实测 0/3 满足候选 Schema，禁止用于 Stage B。
- `deepseek-chat + /beta/chat/completions + strict tool` 初测 3/3，固定生产元组资格复测 20/20。
- 资格探针只使用合成证据；报告不保存密钥、提示词、响应正文或真实项目数据。
- 结构保证只覆盖 JSON 形状。事实正确性、时间覆盖与证据闭合仍由 Navia 语义验证器裁决。

## 2. 实施边界

1. 新增 `DeepSeekStrictGroundedSynthesisProvider`，复用既有分块、整片合成、一次修复与原子发布流程。
2. 每个任务使用精确 JSON Schema；Tool 必须由服务端强制选择，`strict=true`。
3. 仅支持已冻结任务：分块候选、Stage B 候选、两类 Stage B 修复和证据问答。未知任务失败关闭。
4. HTTP 错误、超时、缺少 tool call、拒绝、非法参数或 Schema 不匹配均失败关闭；不得回退到普通 JSON、MiniMax 结果或本地拼接结果。
5. MiniMax 保持默认。DeepSeek 适配器只有 Settings 的 Chat Provider 中由用户明确选择后才进入生产任务；保存凭据不等于选择。
6. 不上传原视频、音频、截图、Cookie、密钥或本地路径；只上传既有授权范围内的派生文字与证据 ID。

## 3. 子阶段

| 子阶段 | 内容 | 出门条件 |
|---|---|---|
| DS-0 | 资格冻结 | strict tool 20/20；普通 JSON 0/3 记录保留 |
| DS-1 | 精确 Schema 构造器 | meta-schema PASS；任务白名单与 evidenceId 枚举固定 |
| DS-2 | 严格 Tool 适配器 | 正例、缺 tool call、额外字段、未知任务、超时全部测试 |
| DS-3 | Navia 语义门禁衔接 | 既有 Stage B 负例不被结构成功绕过 |
| DS-4 | Provider 设置与显式选择 | MiniMax 默认；DeepSeek 保存后不自动选择；首次使用无供应商诱导 |
| DS-5 | 合成数据端到端 | 结构、收据、失败关闭与原子性 PASS |
| DS-6 | 固定六视频 B-5 | 仍使用单一声明路由；不得跨 Provider 合并 |
| DS-7 | B-6/B-7 | 宿主语义审查与独立出门审计 |

## 4. 验收门槛

- 结构：严格模式资格复测 20/20；适配器不会解析普通 message content。
- 语义：未知证据、时间逆序、原文前缀 brief、重复 claim、缺失尾部证据继续失败。
- 路由：任务收据记录 Provider、模型、结构模式；单任务只能有一个权威 Provider。
- 设置：默认仍为 MiniMax；用户未显式选择 DeepSeek 时生产调用不得使用 DeepSeek。
- 安全：报告和公开产物密钥命中 0；真实媒体上传计数保持 0。

## 5. 明确非承诺

20/20 不证明 DeepSeek 内容质量优于 MiniMax，也不批准自动切换、静默 fallback、供应商混合或 Stage B PASS。固定六视频与宿主语义审查仍是后续独立门禁。
