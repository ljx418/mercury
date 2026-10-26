# 外部独立审查请求（V3-5.10 状态纠偏 + B-5 恢复）

日期：2026-10-14。范围：审查 V3-5.10 当前权威状态词、B-5 恢复详细开发计划、B-5 恢复验收计划与实施前审计的事实一致性、合规性与安全边界。本审查包平铺、20 个文件，包含 `AUDIT_MANIFEST.md` 与 SHA-256。位置：`docs/active/project/external-audit-package-v3-5.10-status-correction/`。

> 注：本轮审查包位于独立路径而非 `external-audit-package/`，以保持与 V3-5.1 既有审查包不混合。V3-5.1 既有审查包在 `external-audit-package/` 已恢复为原状；其完整副本存放于 `evidence/v3_5_1_audit_package_backup/`。本路径不修改 `external-audit-package/` 任何文件。

## 1. 请求背景

- Stage A 固定负向旅程 NJ-01..NJ-10 已 LIMITED PASS（Orca task `task_b307e1598b9e`，独立审查 Fatal=0/Major=0/Minor=3）。
- Stage B B-0 已冻结 PASS；B-1..B-4 实现 LIMITED PASS candidate；Route 2（确定性 brief composer）文档 CONDITIONAL GO + 实现 LIMITED PASS，但 **B-5 真实 fresh 六视频分母仍 FAIL/REPLAN**（`BV1pohR6rEEh`）。
- DeepSeek strict adapter DS-1..DS-5 LIMITED PASS（结构 20/20，不证明内容正确）。
- Chat Provider 默认仍是 MiniMax；DeepSeek 已通过 Windows Credential Vault 安全导入，`selected=false`。
- B-5..B-7、Stage C/D/E、V3-6/V3-7 仍 NO-GO；不得据任何当前候选升格为 V3 PASS。

## 2. 审查期望

- 确认 PRD / 架构 / 开发计划 / 验收计划 / Stage Gate / V3-5.10 parent plan 的状态词与上述证据一致。
- 验证 B-5 恢复详细开发计划与验收计划的实施边界：
  - 单任务锁单一 Provider；禁止跨 Provider 拼接或隐式 fallback；
  - MiniMax 仍为 Chat 默认；DeepSeek 任务级启用与上传需用户单独高风险授权；
  - 6 个固定 BVID `BV1pohR6rEEh / BV1hMpE6FEXG / BV1VHHe6kEH3 / BV1SDHy6aEiB / BV1vSHD6tEsM / BV1FCps68EGf` 全程 fresh Runtime/database/chrome-profile/task；
  - 所有 Chrome 实例显式 `--mute-audio`；
  - 0 原始视频/音频/帧/Cookie/密钥/本地路径上传；仅授权范围内派生 transcript/OCR/vision-caption 文本可发送。
- 验证 V2 / V2.1 schema meta-validation、N01..N10 负例与 composer 仅在两个 allowlisted 失败码下生效。
- 验证 Host semantic review / 独立实施出门审计 / B-6 sentinel repeat / B-7 独立出门门槛条件。

## 3. 不在审查范围

- 不要求启动 Chrome、Runtime、Provider、音频或真实 Provider 调用。
- 不要求上传任何真实项目派生文本到任何 Provider。
- 不允许修改产品代码或提交到 git。
- 不允许把候选状态升格为 V3 PASS 或 Step Gate 出库。

## 4. 期望输出

- 一份与 `evidence/v3_media_companion/v3-5.10-experience-repair/stage-a-final-independent-exit-audit-2026-10-13.md` 风格一致的独立审查报告，包含按 severity 等分计与 SHA-256。
- 报告与 manifest 均收录在本审查包；不得放在外部子目录。
- 若 Major / Fatal：返回 dev plan / acceptance plan 修订要求；若仅 Minor：附带建议，不阻止 B-5 文档冻结，但 B-5 真实 fresh 仍需用户单独高风险授权。

## 5. 路径与外部参考

- 路径与权威状态词：`docs/active/project/01-prd.md` 第 18.1 节、`02-architecture.md` 第 1 节、`03-development-plan.md` 第 2309 节、`04-acceptance-plan.md` 第 8.20.12a 节、`stage-gates/v3-media-companion.md` 第 27 节、`design/v3-5.10-media-experience-repair-plan.md` 末尾状态冻结块。
- B-5 恢复文档：`evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-{development-plan,acceptance-plan,preimplementation-audit}.md`。
- 既有 V3-5.1 审查包（与本轮无混合）：`docs/active/project/external-audit-package/`；本工作包仅在备份目录 `evidence/v3_5_1_audit_package_backup/` 留有原样副本。