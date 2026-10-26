# 工作包 1 改动报告 + 仍需用户授权项（V3-5.10 状态纠偏 + B-5 恢复）

日期：2026-10-14。本报告是 navia 主干开发在第一工作包中落地的实际改动、验证结果、待授权项与独立审查窗口入口。本报告不提交、不推送；非真实 Chrome/Runtime/Provider 上传动作。

## 1. 实际改动（仅本工作包必要文档变更）

### 1.1 权威文档状态词纠偏（6 处追加备注，不改写历史失败证据）

- `docs/active/project/01-prd.md` 第 18.1 节追加「2026-10-14 V3-5.10 子阶段状态纠偏」备注块（约 10 行）。
- `docs/active/project/02-architecture.md` 第 1 节追加纠偏备注（约 10 行）。
- `docs/active/project/03-development-plan.md` 第 2309 节追加「V3-5.10 实施计划状态纠偏」备注（约 10 行）。
- `docs/active/project/04-acceptance-plan.md` 第 8.20.12a 节追加「V3-5.10 Stage A/B 验收状态冻结」小节（约 10 行）。
- `docs/active/project/stage-gates/v3-media-companion.md` 第 27 节追加「V3-5.10 子阶段状态冻结」小节（约 10 行）。
- `docs/active/project/design/v3-5.10-media-experience-repair-plan.md` 末尾追加「2026-10-14 状态冻结」块（约 10 行）。

### 1.2 B-5 恢复三件套（新落盘）

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-preimplementation-audit.md`

### 1.3 V3-5.10 状态纠偏审查包（canonical 路径，平铺 20 文件）

- 位置：`docs/active/project/external-audit-package/`（AGENTS.md 规定的 canonical 路径）。
- 19 源文件 + `AUDIT_MANIFEST.md`；顶层 SHA-256（19 内容文件拼接）`cf63f9e4d6935d04c8e48039f93d1e22cccaf776b52905b41890e50836adf692`。
- 临时位于 `external-audit-package-v3-5.10-status-correction/` 的复本已删除；所有 20 个文件已迁移至 canonical 路径。

### 1.4 V3-5.1 既有审查包保留

- canonical `external-audit-package/` 现已用于 V3-5.10 当前轮审查包（按 AGENTS.md "Before every external ChatGPT audit, clear external-audit-package/" 规则）。
- V3-5.1 完整副本备份：`docs/active/project/evidence/v3_5_1_audit_package_backup/`（19 源文件 + `AUDIT_MANIFEST.md` + `README.md`，共 21 文件），可独立复算。

### 1.5 内部自验证报告（新落盘）

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/internal-self-verification-2026-10-14.md`

## 2. 验证结果摘要

- 状态词一致性：PASS（Stage A LIMITED PASS、Stage B B-0 PASS、B-1..B-4 LIMITED PASS candidate、Route 2 CONDITIONAL GO + 实现 LIMITED PASS、B-5 FAIL/REPLAN、DeepSeek DS-1..DS-5 LIMITED PASS、B-5..B-7 / Stage C/D/E / V3-6/V3-7 NO-GO、Chat 默认 MiniMax、DeepSeek 未启用）。
- 6 固定 BVID 注册表：PASS（`BV1pohR6rEEh / BV1hMpE6FEXG / BV1VHHe6kEH3 / BV1SDHy6aEiB / BV1vSHD6tEsM / BV1FCps68EGf`）。
- Schema meta-validation（Draft 2020-12）：V2 + V2.1 PASS。
- Route 2 fixtures verifier：PASS（2/2 positive + N01/N07 schema negative + 10/10 registry；N02/N03/N04/N05/N06/N08/N09/N10 标记 implementationPending，不反映 B-5 PASS）。
- 链接交叉引用：PASS（所有 B-5 引用文件存在）。
- SHA-256 一致性：PASS（19/19 审查包文件 + 9/9 源/复制对齐）。
- 不修改 product code、不启动 Chrome/Runtime/Provider/音频、不上传：PASS。
- 工作树中其它用户/历史改动原样保留：PASS（V3-5.1 审查包已恢复并备份）。
- 中途短暂误删 V3-5.1 审查包文件已通过 `git checkout HEAD` 全部恢复，且在 `evidence/v3_5_1_audit_package_backup/` 留有完整副本。

## 3. 仍需用户授权项

### 3.1 高风险授权（必要，否则 B-5 不得启动）

- **B-5 真实 fresh 实施授权**：`approved Stage B B-5 fresh real source run for the six fixed BVIDs`；要求 fresh Runtime/database/chrome-profile/task、`--mute-audio` Chrome、Chat 默认 MiniMax、不跨 Provider 拼接/不隐式 fallback。
- **DeepSeek 任务级启用与真实项目派生文本上传授权**：当前 Chat 默认仍是 MiniMax；DeepSeek 已通过 Windows Credential Vault 安全导入、`selected=false`；任务级启用与上传须用户单独明示高风险授权。

### 3.2 文档授权（次级，可独立发布）

- **B-5 文档冻结批准**：仅冻结 `stage-b-b5-recovery-development-plan.md`、`stage-b-b5-recovery-acceptance-plan.md`、`stage-b-b5-recovery-preimplementation-audit.md` 与 V3-5.10 状态纠偏审查包内的状态纠偏与恢复文档；此批准不进入"Real Chrome 实施"。

### 3.3 门禁保留

- B-6 宿主语义审查、B-7 独立实施出门审计、Stage C/D/E、V3-6/V3-7：仍需后续用户单独授权才能逐级进入；本工作包不授权进入。

## 4. 独立审查窗口入口

- V3-5.10 状态纠偏审查包路径：`docs/active/project/external-audit-package/`（canonical 路径）。
- 顶层 manifest：`AUDIT_MANIFEST.md`（含 SHA-256 表与顶层哈希）。
- 入口请求：`01-audit-request.md`。
- 期望报告：与 `evidence/v3_media_companion/v3-5.10-experience-repair/stage-a-final-independent-exit-audit-2026-10-13.md` 同风格，含 Fatal / Major / Minor 计数与 SHA-256；包内 SHA 与 manifest 一致即视为通过；若新增 Fatal / Major 返回 dev / acceptance 修订。
- 不要求独立审查入口动 Chrome/Runtime/Provider/上传；不得在本轮未取得高风险授权时翻牌为 V3 PASS。
- V3-5.1 既有审查入口（独立、备份完整）：`docs/active/project/evidence/v3_5_1_audit_package_backup/`（21 文件）。

## 5. 自动化开发停止原因

- 本工作包为文档恢复与查证，未启动 Chrome/Runtime/Provider/音频，未修改 product code，未 commit/push。
- B-5 真实 fresh 仍需用户单独高风险授权才能进入实施门禁。