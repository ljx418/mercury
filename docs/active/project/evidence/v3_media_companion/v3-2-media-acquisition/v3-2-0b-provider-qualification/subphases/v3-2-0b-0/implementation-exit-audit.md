# V3-2-0b-0 实施出门审计

日期：2026-09-22

## 独立复算

`verify_v3_asr_qualification_assets.py` 重新读取四个实际私有文件并复算 byte length / SHA-256，重算归档、许可、dependency manifest、secret scan 与质量边界：`12/12 PASS`。

## 风险计数

```text
Fatal=0
Major=0
Minor=0
```

## 决定

`V3-2-0b-0 PASS`。允许进入 `V3-2-0b-1` 的计划、验收与实施前审计。不得据此选择 Paraformer、关闭 V3-2-A06 或进入 V3-2-1。
