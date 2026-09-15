# T03-2 T02.3 DerivedFacts 重放实施前审计

日期：2026-09-14。决定：`CONDITIONAL GO AFTER T03-1 REPLAY PASS`。

## 范围

从同一 T02.3 sealed run 的 event、artifact 与 Git snapshot 重新派生 source、scenario、route、Forget、fault、viewport、Axe/Keyboard、命令和 Status 事实。每个采用字段必须保留同 run event provenance；禁止继承输入 `passed`、补默认值、按最近时间猜 authority 或引用旧 T02.2 派生文件。

## 验收门槛

- 12 source 精确为 6 web + 3 local + 3 note，ID 和内容 fingerprint 唯一。
- 三入口、五 route x 四恢复、两类普通错误恢复、3 x 4 durable Forget、四 fault、四视口、Axe/Keyboard 全部由原始观察派生。
- 203 条 Status observation 全部来自 response artifact 原始字节，不归一化 `userAction`。
- gaps 为空；重复派生字节等价。
- 旧 T02.1 继续产生 `T03-IN-09`，旧 T02.2 不得进入正结果。

T03-1 replay 未 PASS 或任一分母缺失时只写 CollectionDiagnostic 并停止。
