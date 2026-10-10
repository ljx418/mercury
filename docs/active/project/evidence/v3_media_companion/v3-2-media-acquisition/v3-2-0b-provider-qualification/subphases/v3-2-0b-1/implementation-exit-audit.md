# V3-2-0b-1 实施出门审计

日期：2026-09-22

## 审计

独立 verifier 从 JUnit、Python AST 与真实 binary probe 重算固定 16 项分母，结果 16/16。公开 JSON 的 Cookie/token/Authorization/宿主绝对路径命中 0。

```text
Fatal=0
Major=0
Minor=0
```

## 决定

`V3-2-0b-1 PASS`。允许进入 `V3-2-0b-2` 的计划、验收和实施前审计。catalog/manager/API/UI 尚未接入，Paraformer 仍不可由用户安装或选择。
