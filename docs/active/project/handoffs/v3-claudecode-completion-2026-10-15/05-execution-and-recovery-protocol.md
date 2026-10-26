# Claude Code 双窗口执行与限流恢复协议

## 1. 分工

### `navia-主干开发`

承担高 token 工作：源码全链检视、实现、测试补齐、真实 runner、六视频/12 页执行、证据封包和实现 handoff。不得签署自己的独立 PASS。

### `navia-审查`

承担高 token 独立工作：diff 审查、合同/测试复算、真实证据抽样、哈希/分母/隐私/清理核对和独立报告。除指定 independent audit 文件外只读。

### Codex

维护权威 PRD/架构/计划，纠偏阶段范围，核对两个 Claude 窗口的事实，执行独立功能验收与出门判断，准备人类验收。Claude 报告不是自动批准。

## 2. Token 使用策略

- Claude 优先处理跨多文件调用链、长 diff、测试日志、真实 run 和审计包；Codex 不重复全文读取，只复核关键文件和结论。
- 每个 Phase 新开上下文时先读本包和本阶段 <=12 个权威文件；用 `rg` 定位，不递归通读全部 evidence。
- 日志落盘后只在聊天输出摘要、路径、哈希和失败码，避免重复粘贴大日志。
- 主干和审查不得并发修改同一文件；审查必须等待主干 handoff 的 immutable candidate ID。

高 token 工作默认交给 Claude Code：跨目录调用链追踪、长 diff、测试矩阵实现、真实 Chrome/Runtime runner、六视频/12 页证据生成、外审包逐文件复算和独立审查报告。Codex 保留 PRD/架构/计划权威、候选事实抽查、关键命令独立复跑、假绿识别和出门决策。Claude 的自报测试数、总结表或 PASS 文本不能代替 Codex 对原始结果、进程归零、关键 payload 与状态机的抽查。

为避免套餐重置前浪费上下文，Claude 每次只承担一个已冻结子阶段，并在上下文接近上限前先写 checkpoint；不得在同一上下文同时做 P0 修复、P1 六视频和 P2 封包。外审窗口只在主干生成 immutable candidate ID 后开始，不能边实现边审查。

## 3. 强制 checkpoint

每个子阶段在开始、实现完成、测试完成、真实 run 完成、外审提交前更新一个 `*-handoff.md`，至少记录：

- 当前目标和授权；HEAD 与 worktree 范围；已修改文件。
- 最后成功命令及退出码；未完成命令；进程/PID/端口/profile/run ID。
- 已通过、失败、未运行的测试；真实数据来源和 seal。
- 禁止数据上传计数、secret scan、cleanup 状态。
- 下一条安全命令；Fatal/Major/Minor；是否允许继续。

## 4. 429 / 529

- 视为供应商临时可用性中断，不视为产品质量失败，也不能记为 PASS。
- 立即停止新增 Provider 请求，保存 checkpoint、当前 task/run 和已完成样本；不得把部分 run 与下次 run 拼接为验收结果。
- 若阶段合同允许同一请求幂等重试，最多按既定 backoff 重试；套餐重置前不做高 token 循环。
- 可继续离线任务：源码修复、单元测试、fixture、文档、secret scan、cleanup。真实完整 run 必须在服务恢复后新鲜执行。
- Claude Code 本身返回 429/529 时，同样不得反复提交长提示词。先读取终端最后输出，确认文件是否已落盘，记录最后完整动作和未完成动作；套餐恢复后从 checkpoint 继续，不从头重新扫描仓库。

## 5. 422

- 视为请求/Schema/模型能力不匹配。禁止不改变输入地重复请求。
- 落盘经过脱敏的 endpoint class、model、schema version、request hash、HTTP 状态和响应错误码；不得落盘密钥或完整私有输入。
- 返回合同/适配器修复阶段，补最小复现和负例；若需修改公共合同，回到文档冻结与独立审查。
- 若 422 来自 Claude Code/宿主工具而非产品 Provider，先缩短请求并确认工具输入格式；不得把工具协议错误记入产品 Provider 质量统计。

## 6. 中断恢复

- 先检查进程、端口、profile、private artifact 和 task 状态；只清理由本轮创建且可证明所有权的资源。
- `finishedAt=null`、runner 被终止、缺 seal 或 cleanup 未完成的 run 一律 diagnostic-only。
- 恢复真实验收必须使用新的 run ID；不得仅从剩余 BVID 续跑后与旧结果合并。
- 若套餐恢复，先执行一个不含私有内容的 capability probe，再进入完整真实 run。

## 7. Claude Code 调度顺序

1. 主干窗口只接收当前冻结子阶段；第一项固定为 P0，不携带 P1-P9 实现任务。
2. 主干完成 plan/acceptance/preaudit、代码、自验证和 handoff 后，生成 immutable candidate ID（至少包含 Git HEAD、dirty diff hash、payload hashes、build hash、run ID）。
3. 审查窗口只在 immutable candidate 生成后启动；只读复算并单独写 independent audit。
4. Codex 核对审查报告与原始证据。Fatal/Major 非 0 时只把具体问题返回主干，不把整仓重新交给 Claude 扫描。
5. Fatal=0/Major=0 后才冻结下一阶段输入，防止主干上下文把未来计划误当当前授权。

## 8. 套餐/服务错误处理表

| 错误 | 当前子阶段状态 | 允许动作 | 禁止动作 |
|---|---|---|---|
| Claude 429 | `PAUSED_BY_TOOL_QUOTA` | 写 checkpoint，等待重置；Codex 可继续文档/事实抽查 | 重复粘贴长 prompt、推断已完成 |
| Claude 529 | `PAUSED_BY_TOOL_AVAILABILITY` | 保存最后完整命令和 diff；稍后 capability probe | 把服务故障记为产品失败 |
| Claude/工具 422 | `INPUT_REJECTED` | 缩短/修正工具输入，确认是否落盘 | 原样重试或写入产品 Provider 统计 |
| 产品 Provider 429/529 | `EXTERNAL_PROVIDER_INTERRUPTED` | 停止新请求、清理、用新 run 重验 | 拼接部分样本或隐式换 Provider |
| 产品 Provider 422 | `CONTRACT_MISMATCH` | 脱敏记录 hash/schema/error，返回 adapter/合同 | 降低 schema 或当作内容 blocked |

## 9. 最小 checkpoint 文件

每个 Claude 子阶段都维护 `checkpoint.json` 或等价 Markdown，字段至少为：

```json
{
  "stage": "P0",
  "status": "in_progress|candidate|paused|failed",
  "head": "<git sha>",
  "dirtyDiffSha256": "<hash>",
  "authorization": "<exact scope>",
  "lastCompletedAction": "<text>",
  "nextSafeAction": "<text>",
  "commands": [{"commandHash": "<hash>", "exitCode": 0}],
  "runIds": [],
  "ownedPids": [],
  "ownedPorts": [],
  "cleanupComplete": true,
  "secretHits": 0,
  "fatal": 0,
  "major": 0,
  "minor": 0
}
```

不得保存 Cookie、API key、私有路径或完整私有 payload。恢复时先验证 checkpoint 所指文件与 hash 仍存在，再继续 `nextSafeAction`；不重新执行已成功且已封存的 Provider 请求。

