# V3-2-0b-3 实施前审计

日期：2026-09-22

```text
V3-2-0b-3: GO
Fatal=0 / Major=0 / Minor=1
```

- 上游 README 明确 `--srt` stdout 为标准 SRT，diagnostics 在 stderr。
- 0b-1 已限制 stdout bytes；本层仍独立设置解析上限，形成双层防护。
- duration 必须由受控音频元数据传入，不信任 SRT 自报总时长。
- 12 项分母覆盖所有冻结 fault 类型。

Minor M-1：真实非空 SRT 将在 0b-5 三样本推理中验证；本阶段只能使用 contract fixture，禁止扩大为真实质量通过。该边界已写入验收计划，无 Fatal/Major。
