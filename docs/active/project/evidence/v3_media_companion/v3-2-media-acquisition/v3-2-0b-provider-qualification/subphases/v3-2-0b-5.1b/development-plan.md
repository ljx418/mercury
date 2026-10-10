# V3-2-0b-5.1b 质量失败状态传播开发计划

日期：2026-09-22。状态：实施前计划。

## 目标

将 Paraformer 的真实机器门禁失败从证据层传播到生产 closed catalog 与 Settings。用户必须看见“当前真实质量门禁未通过”，而不是过期的 `qualification_pending`。

## 范围

- `catalog.py`：Paraformer `quality_status=failed_current_gate`，保留 installable=true、selectable=false、Tiny effective fallback。
- Settings：失败文案不声称已完成人工盲评，只声明真实质量门禁未通过。
- 更新生产单测、当前 verifier、真实 Settings E2E 断言；历史 run/审计包不修改。

不改变资产、Provider、安装流程、资源披露、选择门禁或用户数据。
