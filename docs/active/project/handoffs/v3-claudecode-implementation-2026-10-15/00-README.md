# Navia V3 ClaudeCode 逐阶段实施交接包

日期：2026-10-15。用途：用户明日起手动驱动 ClaudeCode 逐工作包完成 V3 实现。此目录是执行入口，不替代主 PRD、架构、合同或历史证据。

## 角色

- ClaudeCode：只执行当前获准工作包的代码实现、自验证、真实数据运行和 handoff。
- Codex：负责文档冻结、架构设计、计划纠偏、独立审查、阶段验收和下一包放行。
- 用户：逐包粘贴提示词；处理高风险授权和最终人工体验。

ClaudeCode 不得自行扩大阶段、降低分母、重写历史失败证据、宣布阶段 PASS、清理非本轮资源或承担独立外审。

## 唯一执行顺序

| 工作包 | 范围 | 当前门禁 |
|---|---|---|
| WP0 | P0 Background Capture Relay R0-R7 | 文档 PASS，可实施；Stage A/B 仍阻塞 |
| WP1 | Stage A 完整收口：正向日常路径 + NJ-01..NJ-10 | 等 WP0 Codex 实施审查通过 |
| WP2 | Stage B B-5..B-7：六视频、封包、内容质量 | 等 WP1 完整 Stage A 出门 |
| WP3 | Stage C：图文大纲、时间线、概念关系图 | 等 WP2 完整 Stage B 出门审计通过 |
| WP4 | Stage D：五种导出与恢复 | 等 WP3 出门 |
| WP5 | V3-4.1/V3-5：Chat/Know、综合交互、H/V3-5.1/CX 人工签署 | 等 WP4 出门 |
| WP6 | V3-6：单一 12 页 production run | 等 WP5 自动门槛和人工签署完成 |
| WP7 | V3-7：Codex 最终独立审计、报告与 Git 收口 | 等 WP6 immutable candidate |

任何工作包失败都停在本包，由 Codex判断修复、重新冻结或请求用户决定；不得自动进入下一包。

## 文件索引

- `01-authority-and-current-state.md`：事实基线、权威顺序、已完成与未完成。
- `02-target-architecture-and-boundaries.md`：完成态架构、所有权和禁止边界。
- `03-master-roadmap.md`：WP0-WP7 顺序、依赖、交付与总完成条件。
- `04-prd-coverage-matrix.md`：V3-0..7、Stage A-E、G1-G6 与工作包映射。
- `05-wp0-relay-acceptance.md`：可信采集 relay 实施与验收合同。
- `06-wp1-stage-a-closure-acceptance.md`：Stage A 完整收口合同。
- `07-wp2-stage-b-quality-acceptance.md`：六视频及内容质量合同。
- `08-wp3-stage-c-workspace-acceptance.md`：图文大纲、时间线与概念图合同。
- `09-wp4-stage-d-export-acceptance.md`：五种导出合同。
- `10-wp5-chat-know-human-acceptance.md`：Chat/Know、综合交互与人工签署合同。
- `11-wp6-v3-6-production-acceptance.md`：12 页生产 run 合同。
- `12-wp7-v3-7-final-acceptance.md`：最终独立审计和收口合同。
- `13-claudecode-stage-prompts.md`：逐包可直接粘贴的 ClaudeCode 提示词。
- `14-codex-review-and-handoff-protocol.md`：ClaudeCode 返回后交给 Codex 的审查协议。
- `HANDOFF_MANIFEST.md`：文件哈希和冻结状态。

## 每日使用

1. 只选择第一个未通过的工作包。
2. 将 `13-claudecode-stage-prompts.md` 中对应提示词完整粘贴给 ClaudeCode。
3. ClaudeCode 完成后不得继续下一包，必须返回 changed files、命令/退出码、真实 run、证据目录、PRD 映射和停止原因。
4. 将该 handoff 交给 Codex，按 `14-codex-review-and-handoff-protocol.md` 做独立验收。
5. 只有 Codex 明确写出 `WORKPACK PASS / NEXT WORKPACK MAY START` 后，才粘贴下一提示词。

## 全局硬规则

- 工作目录固定为 `/mnt/c/workspace/navia`；当前基线 `main/a303551a5bf89c26ff36b24ac06c7e30c334db27`，但实际工作树状态每次重新读取。
- 禁止 `git reset --hard`、`git checkout --`、`git clean`、覆盖用户差异或删除历史失败证据。
- 所有自动化 Chrome 必须显式 `--mute-audio`；不得播放声音。
- Cookie、API Key、凭据、原始音视频、未授权帧和绝对私有路径不得写入公开证据。
- MiniMax 保持默认；DeepSeek 只在用户手动选择或明确批准的研究任务中使用；单任务单 Provider，禁止隐式 fallback 或跨 Provider 拼接。
- 429/529 保存 checkpoint 并停止新增 Provider 请求；422 保存脱敏请求哈希/schema/error，修改输入或合同前不得原样重试。
- Query、Graph、Durable Forget 属于 V4；Agent 属于 V5+，不计入 V3。
