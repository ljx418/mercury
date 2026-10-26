# 验收计划状态纠偏反馈（V3-5.10）

日期：2026-10-14。来源：`docs/active/project/04-acceptance-plan.md` 第 8.20.12a 节插入的"V3-5.10 Stage A/B 验收状态冻结"。

```text
- **Stage A**：固定负向旅程 NJ-01..NJ-10 LIMITED PASS（单 BVID `BV1hMpE6FEXG`，独立审查 `stage-a-final-independent-exit-audit-2026-10-13.md`，Fatal=0 / Major=0 / Minor=3）。MiniMax 历史真实失败保留为只读，不作为当前阻塞。
- **Stage B B-0**：合同冻结 PASS（schema meta、失败码 17、负例 18、客观验收、六 BVID 注册表）。
- **Stage B B-1..B-4**：实现 LIMITED PASS candidate；仅关闭文档/单元测试级，不替代 B-5 真实 fresh。
- **Stage B Route 2（确定性 brief composer）**：文档 CONDITIONAL GO（外部独立审查 Fatal=0 / Major=0 / Minor=5，SHA-256 `b3db4ffc82283712c28737a0ee569403e1194ea280b74ab24408f2c66eb72079`），实现 LIMITED PASS；**B-5 真实六视频分母仍 FAIL/REPLAN**（`stage-b-b5-route-2-risk-stop-2026-10-14.md`）。本阶段门禁不得用 Route 2 候选/单元测试/合规模包含 fallback 判定为 B-5 PASS。
- **DeepSeek strict adapter DS-1..DS-5**：LIMITED PASS（`deepseek-chat + /beta/chat/completions + strict tool` 资格 20/20）。仅证明结构稳定，不证明内容正确，亦不改变 Chat 默认 MiniMax。
- **Chat Provider 默认**：MiniMax；DeepSeek 已导入 Windows Credential Vault、未选中；保存不等于选择；首次使用不自动切换、不诱导。
- **B-5..B-7、Stage C/D/E、V3-6/V3-7**：NO-GO；不得据任何上述候选扩大为 V3 PASS。
- 实施顺序：单任务锁单一 Provider，禁止跨 Provider 拼接/隐式 fallback；所有浏览器实例必须 `--mute-audio`；6 个固定 BVID 全程 fresh Runtime/database/profile/task；0 原始视频/音频/帧/Cookie/密钥泄漏，派生 transcript/OCR/vision-caption 文本仅在既有授权范围内发送。
```

## 审查点

- 实施顺序与 `stage-b-b5-recovery-development-plan.md` 第 3 节一致。
- NO-GO 列表与 Stage Gate 第 27 节一致。
- 不修改既有 §8.20.10 / §8.20.10a 表格或更新 V3-5.2a 交互门槛。

## 期望返回

- SHA-256 复算；与 `AUDIT_MANIFEST.md` 一致。