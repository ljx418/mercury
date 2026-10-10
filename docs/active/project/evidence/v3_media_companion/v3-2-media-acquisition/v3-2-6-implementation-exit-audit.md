# V3-2-6 实现出门自动审计

日期：2026-10-08。

## 0. 决定

`V3-2-6 LIMITED PASS / V3-2-7 PREIMPLEMENTATION MAY PROCEED`。

- Fatal：0。
- Major：0。
- Minor：1：实施与本轮自动审计属于连续代理工作，不具备组织独立性；V3-2.7 最终候选必须由不同 reviewer session 复核。

## 1. 防假绿结论

- 14 个 fault 各自独立 task 和独立 evidence hash；没有用聚合值替代逐项 receipt。
- 失败 run 未封存为候选；FaultMatrix 与 UI 候选均只有一个权威 run。
- F01..F14 使用真实 HTTP、socket、文件系统、RLIMIT、子进程、lease/grant 与 coordinator 边界，不生成成功媒体或 transcript。
- A10 使用真实 B站页、真实内容脚本身份、真实 Chrome 扩展和真实 Runtime；未使用静态 HTML 或 mock projection。
- 未把组件测试替代 Chrome 证据；组件测试只作为双容器回归补充。
- fault-support 无生产导入；签名 profile 绑定一次性 `/tmp` root，run 后已删除。
- 公开 evidence 扫描未发现 Runtime token、Cookie 值、profile 或私有 task root。

## 2. 允许与禁止

允许按冻结顺序进入 V3-2.7-0..7 单 run 出门工具与候选实施。

禁止复用本阶段单页 UI run 替代 12 页分母；禁止复制本阶段 FaultMatrix 到 V3-2.7，V3-2.7 必须在其全新单 run 内重放并封存；禁止提前写 `v3_2Passed=true` 或扩大为 V3-3。
