# V3 剩余开发总路线

## 1. 硬依赖

```text
WP0 可信采集 relay
  -> WP1 完整 Stage A 正向/负向收口
  -> WP2 Stage B 六视频与内容质量
  -> WP3 Stage C 图文/时间线/概念图
  -> WP4 Stage D 五种导出
  -> WP5 Chat/Know + Stage E + H/V3-5.1/CX 人工签署
  -> WP6 V3-6 单一 12 页生产 run
  -> WP7 V3-7 最终独立审计与阶段收口
```

WP0 是用户批准的 Stage B fresh-run 前置修复，但不绕过 Stage A。WP0 出门后必须先以新 relay 正向路径重建 Stage A 完整候选，Stage A 出门后才允许 Stage B 六视频。WP2 必须在 B-5/B-6 后由 Codex 独立完成 B-7 实施出门审计，Fatal=0/Major=0 后才允许 Stage C。V3-6 必须引用已经签署并绑定 V3-5 build/run/hash 的 H01-H10/V3-5.1/CX submission，不能在 V3-6 后补签。

## 2. 工作包矩阵

| WP | 旧阶段 | 核心结果 | ClaudeCode 结束位置 | Codex 放行条件 |
|---|---|---|---|---|
| WP0 | P0/R0-R7 | 可信音频 capture 到持久产品终态 | 每个 R 有 checkpoint，R7 immutable candidate | 单视频 canary、故障矩阵、Fatal 0/Major 0 |
| WP1 | Stage A | 权威状态/计时/恢复与 NJ-01..10 在新 relay 上闭合 | Stage A candidate | 正向路径 + NJ 固定分母，Fatal 0/Major 0 |
| WP2 | Stage B/B-5..7 | 六视频 fresh 内容候选 | ClaudeCode交付六 run + package + B6 bundle；Codex执行 B-7 | B-7 Fatal 0/Major 0，完整 Stage B PASS |
| WP3 | Stage C | 图文大纲、时间线、概念图 | C1-C3 各自 handoff | 每子包通过，六视频回归 |
| WP4 | Stage D | 五种独立导出 | export candidate | 15 风格输出 + 六视频默认导出 |
| WP5 | V3-4.1/V3-5/E | Runtime/Chat/Know 和综合 UI | same-build machine candidate 后停 | 自动门槛通过，再由用户签 H/V3-5.1/CX |
| WP6 | V3-6 | 单一 12 页生产候选 | sealed candidate 后停 | A01-A20 全通过，已签 submission 只读绑定 |
| WP7 | V3-7 | 最终审计、报告、Git | ClaudeCode不实施本包 | Codex Fatal 0/Major 0 + 人类签署有效 |

## 3. 文档冻结门槛

- WP0、WP1、WP2：现有合同和固定分母已存在；Codex按本包验收文档组织。
- WP3：开始前 Codex 新增 `MediaWorkspaceVisualProjection` schema/fixtures/FailureCode、组件路由矩阵和实施前审计。
- WP4：开始前 Codex 新增 export profile/artifact schema、五风格 registry、取消/恢复 fixtures 和实施前审计。
- WP5：开始前 Codex把现有 `v3_knowledge_workspace_v1.schema.json` 与 Chat/Know 计划核对，补齐 ContextEnvelope/Draft/Item transaction fixtures、G1-G6 自动分母和实施前审计；上位 `IMPLEMENTATION NO-GO` 由用户在文档审查后明确解除。
- WP6：开始前 Codex冻结当前 Revision 5 Route B3 12 页 registry、collector/verifier/final schema、已签 submission binding 和授权摘要；若现有 V3-6 文档仍引用 Revision 3，必须先形成经独立审查的 amendment，禁止回退历史矩阵。

ClaudeCode不能代替这些冻结动作。缺文档时只报告 prerequisite missing 并停止。

## 4. 固定样本

- Stage A：`BV1hMpE6FEXG` 的 NJ-01..NJ-10；正向 relay 路径另用 `BV1pohR6rEEh`。
- Stage B/C/D：六视频 registry `stage-b-six-video-registry.json`；Stage C/D 开发 smoke 固定前三项，阶段总出门覆盖六项。
- Chat 普通网页：`https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API`、`https://docs.python.org/3/tutorial/`、`https://en.wikipedia.org/wiki/Artificial_intelligence`。若网络重定向或下线，记录 blocked，不得在 run 内替换；registry 修订只能由 Codex另行冻结。
- V3-6：必须使用实施前冻结的当前 Revision 5 Route B3 12 页 registry；Revision 1..4 和历史 `probe-candidates.json` 只读且不得作为 final registry。

## 5. 每工作包循环

ClaudeCode：盘点 -> 实现 -> unit/contract -> integration -> isolated failure -> real muted Chrome -> verification/prd-review/handoff -> 停止。Codex：diff/证据核查 -> 关键复算 -> 隔离 Agent 审查 -> PASS/FAIL/REPLAN。可见 Chrome、原生弹窗、焦点抢占或 UIAutomation 前必须先通知用户；所有 Chrome 显式 `--mute-audio`。

## 6. 统一证据与通过标准

候选写入 `evidence/v3_media_companion/v3-completion/wp*/<candidateId>/`，至少包含 candidate、verification、PRD review、handoff、payload manifest、脱敏日志索引、cleanup/secret scan。固定分母无 N/A、无静默删除、无跨 run 拼接；错误非零退出；owned resource=0；公开 scan=0；Codex审查 Fatal=0/Major=0。

## 7. 最终完成

WP0-WP6 实施通过、Stage B 的 Codex B-7 独立审计通过、H01-H10/V3-5.1/CX-H01..06 真实签署、WP7 最终审计、架构图/代码/报告一致且 Git 范围清晰后，才可限定声明 V3 PASS。
