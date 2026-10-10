# V3-2-0 双模型比较内部出门审计

日期：2026-09-18。

> 后续状态（2026-09-21）：用户最终人类结果已使 D08=`FAIL / REPLAN`；本文件记录的 pending 是机器材料出门时点状态。

## 分级

```text
Comparison material generation: PASS
Fatal: 0
Major in machine material: 0
Minor: 2
Stage-level pending gate: 1 (human comparison)
```

## 已关闭风险

- 人工听写负担：页面无 transcript textarea，只保留 160 字错误短备注。
- 机器自证：必须听原视频；small/base 只提供候选，不是 gold。
- 挑窗假绿：三个窗口固定为 30s..150s，分桶固定连续 8 x 15 秒。
- 模型身份偏见：A/B 按样本交替，页面可见文本不展示模型名。
- 导出假绿：真实 Chrome 已生成 24 judgment review，并完成双文件导入、分歧复核和 adjudication JSON。
- 隐私残留：最终 secret scan 0 hit，四类临时材料全删除。

## Minor

- M-1：模型 A/B 映射存在于 standalone HTML 脚本数据中，技术审查者可查看源码获知；普通页面可见区域保持盲态。若未来要求双盲，应由服务端分发去映射 presentation bundle。
- M-2：完整机器 transcript 为私有材料，外部审查只能复核 hash、Schema、统计和页面模板，不能在平铺公开包中逐字审查。

## 未关闭门禁

两名不同人类 reviewer 尚未提交真实 24 项结果，adjudicator 尚未关闭真实分歧。因此 D08 仍 `PENDING`。这是人类高风险验收，不允许用 QA 自动结果替代。

## 决定

```text
Human comparison page delivery: GO
V3-2-0 productionReady registry: NO-GO
V3-2-1 Runtime acquisition core: NO-GO
```
