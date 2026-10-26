# Stage B DeepSeek 严格适配器实施前审计

日期：2026-10-14。结论：**CONDITIONAL GO，仅批准 DS-1..DS-5；DS-6/DS-7 仍须逐门禁执行。**

## 审计结论

- Fatal 0 / Major 0 / Minor 2。
- 固定元组 `deepseek-chat + /beta/chat/completions + strict tool` 为 20/20 Schema-valid。
- 普通 JSON Object 为 0/3，已从允许路径排除。
- 既有 Stage B 独立语义验证和原子发布不变，故结构成功不能提升失败内容。
- MiniMax 默认、DeepSeek 手动选择、首次使用中性展示的产品边界不变。

## 风险闭环

| 风险 | 处置 |
|---|---|
| Provider 返回合法但错误内容 | 继续执行 V2/V2.1 语义、时间、证据闭合验证；失败不发布 |
| strict beta 行为变化 | 固定端点、模型、Schema hash；失败关闭，不切换 JSON mode |
| 一个任务混用供应商 | factory 在任务开始时解析单一 Provider；收据固定 provider/model/mode |
| 密钥泄露 | 适配器只从安全凭据对象取值；日志、报告、异常不含响应正文和密钥 |
| 设置保存即自动启用 | 禁止；保存和选择是两个动作，默认保持 MiniMax |

## Minor

- M-1：DeepSeek beta strict endpoint 仍是外部能力，需保留运行时能力测试与明确不可用错误。
- M-2：20/20 使用合成证据，只批准接口适配；内容质量仍须固定六视频 B-5/B-6 验收。

## 实施授权解释

用户指令“如果研究确实保证 provider 的结构性返回，则批准适配器修改”已由 DS-0 的 20/20 精确 Schema 结果满足。授权不包括自动把 DeepSeek 设为默认，也不包括跳过真实视频和人工语义门禁。
