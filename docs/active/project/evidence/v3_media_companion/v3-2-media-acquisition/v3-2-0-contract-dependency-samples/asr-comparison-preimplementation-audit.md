# V3-2-0 双模型比较实施前审计

日期：2026-09-18。结论：`GO FOR COMPARISON MATERIAL GENERATION ONLY`。Fatal=0、Major=0、Minor=2。

## 核查

- 用户已明确撤销人工听写要求，并要求 Agent 生成不同 ASR 输出供人类比较。
- 三个主样本已经通过真实页面、媒体和离线 ASR 可行性探针；固定窗口不变。
- 生产 small 模型已冻结；独立 base 模型来自官方 `Systran/faster-whisper-base`，MIT，精确 revision/file hash 已冻结。
- 新合同不宣称机器 gold 或 CER；人类仍必须听原视频并完成独立判断。
- 实施范围只含自动化、私有证据和验收页面，不进入 V3-2-1 产品代码。

## 风险

- Minor 1：双模型可能同时犯相同错误，因此禁止仅凭模型一致判定正确；页面强制人类对照原视频。
- Minor 2：完整机器 transcript 属私有评审材料，不进入平铺外审包；独立审查只能复算 hash、统计、页面模板和脱敏汇总。

## 门禁

```text
Comparison material generation: GO
Human independent comparison: PENDING AFTER MATERIAL GENERATION
V3-2-0 productionReady registry: NO-GO
V3-2-1+: BLOCKED
```
