# 权威基线与当前状态

## 1. 权威顺序

发生冲突时按以下顺序判断：

1. 用户最新明确指令与高风险授权；
2. `AGENTS.md` 和 `design/project-stage-workflow.md`；
3. `01-prd.md`、`design/v3-chat-know-product-convergence.md`；
4. `02-architecture.md`、`03-development-plan.md`、`04-acceptance-plan.md`；
5. `stage-gates/v3-media-companion.md`；
6. `design/v3-5.10-media-experience-repair-plan.md`；
7. 当前工作包验收文档；
8. 最新独立审查与 immutable candidate；
9. 历史 handoff、失败 run 和旧候选只用于追溯。

旧文档中的 Claude 双窗口、Claude 外审和“Codex 负责实际实现”均被本包职责替换；产品规格、合同、失败事实和固定分母不变。

## 2. 已有可信成果

| 范围 | 状态 | 不得扩大为 |
|---|---|---|
| V3-1.3 凭据通道 | PASS | 媒体获取或 V3 PASS |
| V3-1.4 本机伴侣 | LIMITED PASS | 自动启动 Runtime |
| V3-2/3/4 基础链 | LIMITED PASS/实现候选 | 最终质量或人工 PASS |
| V3-5 基础产品流 | 机器候选 | H01-H10 已签署 |
| V3-5.10 Stage A | LIMITED PASS | Stage B-E PASS |
| Stage B B-0 | PASS | 六视频内容通过 |
| Stage B B-1..B-4 | LIMITED PASS candidate | B-5/P1 通过 |
| Route 2 composer | LIMITED PASS | Provider 内容正确 |
| Relay v10 文档 | DOCUMENT PASS，Fatal 0/Major 0/Minor 3 | R0-R7 实施通过 |

relay v10 独立文档报告：`evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-background-capture-relay-independent-document-audit-v10-codex-2026-10-15.md`。

## 3. 当前第一动作

WP0 从实际工作树重新盘点开始。不得假设上一会话的未提交实现仍存在；先执行 `git status --short`、读取 `git diff`，再核对以下实体：

- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/audio_ref.py`
- `transcript_service.py`
- `coordinator.py`
- `services/local-runtime/navia_runtime/app.py`
- `apps/chrome-extension/entrypoints/background/`
- `apps/chrome-extension/src/modules/media_companion/acquisition/`
- `scripts/stage_b_b5_3/`

若工作树没有 relay 实现差异，按 v10 R0 开始；若有差异，先验证其与 v10 合同一致，不得盲目重做或覆盖。

## 4. 未完成范围

1. WP0：Background-owned Runtime WebSocket、Offscreen producer、同步 staging、持久 receipt、恢复/清理、真实 muted canary 和故障矩阵。
2. WP1：用 relay 正向路径补齐 Stage A，重新绑定固定 NJ-01..NJ-10，形成完整 Stage A 出门结论。
3. WP2：六固定 BVID fresh run、封包、宿主 LLM B-6 内容复核，以及由 Codex 独立 Agent执行的 B-7 实施出门审计。
4. WP3：真实帧图文大纲、视频秒数时间线和概念关系图。
5. WP4：至少五种独立导出及取消/恢复。
6. WP5：Runtime/Settings、Chat 实时反馈、KnowledgeDraft、Know CRUD、同 build 综合体验，并在自动门槛完成后组织 H/V3-5.1/CX 人工签署。
7. WP6：只引用已签署 V3-5 submission，执行 12 页单 run 和 A01-A20。
8. WP7：最终独立审计、Draw.io/HTML 报告和受控 Git 收口。

## 5. 实现授权边界

本交接包是计划和验收合同，不自动授予所有 WP。用户明日逐包驱动 ClaudeCode；当前仅 WP0 已有既存实施授权。WP1-WP7 必须在前一 WP 经 Codex 出门后再启动。WP3、WP4、WP5 在 ClaudeCode 开始前还要求 Codex 落盘对应版本化 schema、fixtures、FailureCode 闭集和实施前审计；缺少任一项时提示词要求停止，不允许 ClaudeCode 自行“冻结合同”。涉及新的云端内容上传、权限扩大、公开 API/schema 变化、私有 Cookie 来源变化或可见 UIAutomation 时，ClaudeCode 必须停止并说明影响。
