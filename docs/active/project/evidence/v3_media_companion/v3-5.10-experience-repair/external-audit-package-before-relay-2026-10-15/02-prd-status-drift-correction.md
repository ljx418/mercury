# PRD 状态纠偏反馈（V3-5.10）

日期：2026-10-14。来源：`docs/active/project/01-prd.md` 第 18.1 节插入的"V3-5.10 子阶段状态纠偏"备注。

```text
> **2026-10-14 V3-5.10 子阶段状态纠偏**（仅修正当前权威状态词，不改写历史证据）：
> - Stage A：固定负向旅程 NJ-01..NJ-10 取得 `LIMITED PASS`（Fatal=0 / Major=0 / Minor=3，单 BVID `BV1hMpE6FEXG`、临时扩展预授权 fixture、四视口 bounded evidence）。Orca worker `task_b307e1598b9e` 在 `stage-a-final-independent-exit-audit-2026-10-13.md` 独立复算。
> - Stage B B-0：合同冻结 PASS（schema meta、失败码 17、负例 18、客观验收、固定 BVID 注册表）。
> - Stage B B-1..B-4：实现候选 `LIMITED PASS candidate`（注意：未构成 Stage B 出门，不替代 B-5 实测）。
> - Stage B Route 2（确定性 brief composer）：文档 CONDITIONAL GO（Claude Code CLI 独立复算 Fatal 0/Major 0/Minor 5，外部审查报告 SHA-256 `b3db4ffc82283712c28737a0ee569403e1194ea280b74ab24408f2c66eb72079`），实现 LIMITED PASS 但 **B-5 真实六视频分母仍 FAIL / REPLAN**（`BV1pohR6rEEh` 多次 `V3510B_BRIEF_LENGTH_INVALID`；`stage-b-b5-route-2-risk-stop-2026-10-14.md`）。
> - DeepSeek strict adapter DS-1..DS-5：LIMITED PASS（20/20 schema 合规；结构成功仅证明 JSON 形状，不证明内容正确性，亦不替代默认权限）。
> - Chat Provider 默认：MiniMax 保持默认；DeepSeek 已通过 Windows Credential Vault 安全导入，模型 `deepseek-chat`、能力标签 `deepseek_beta_strict_tool_v1`，**未选中**；首次使用不自动切换、不诱导。
> - B-5..B-7、Stage C/D/E、V3-6/V3-7：均 **NO-GO**，不得据任何 Stage A/Route 2/DeepSeek DS 候选扩大为 V3 PASS。
```

## 审查点

- 状态词与 `evidence/v3_media_companion/v3-5.10-experience-repair/` 下的 `stage-a-*`、`stage-b-*`、`stage-b-route-2-*`、`stage-b-deepseek-strict-adapter-*` 和 `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md` 是否一致。
- 不引入与历史 V3-3..V3-5.2 证据冲突的状态词。
- 不删除 PRD 第 18.1 节既有"2026-10-12 用户批准 V3-5.10 Media Experience Repair"原句。

## 期望返回

- SHA-256 复算确认；与 `AUDIT_MANIFEST.md` 中文件 SHA-256 一致。
- 无新增 Fatal / Major；Minor 控制在 ≤2 个并归入"状态冻结范围声明"。