# PX6-0..5 PRD 规格检视

日期：2026-09-15

## 结论

PX6-0..5 没有新增或改变产品体验，只把 T04.1 中已采集的真实 Chrome 体验转换为可审查机器包。与 `01-prd.md` 的 Route A、双容器、稳定 ID、Runtime 权威、Permission 与用户主动 Forget 边界一致。

## 体验覆盖

| PRD 体验 | 本轮证据 | 状态 |
|---|---|---|
| Side Panel 三入口 | 真实 trusted action 与 background 配对 | machine verified |
| 五 route 四恢复 | 5x4=20 cells | machine verified |
| invalid route 回库 | 2 个普通恢复 | machine verified |
| durable Forget | 三来源 x 四恢复同源有序 | machine verified |
| 四故障状态 | 四个独立注入区间与观察 | machine verified |
| 双容器四视口 | Side Panel 360/420；Workspace 768/1280 | machine verified |
| 可访问性 | Axe 0/0；Keyboard 5/5 | machine verified |
| 人类可感知质量 | H01..H07 可见 Chrome 操作 | pending human |

## 不越界

本轮不声明 RAG、自动记忆维护、Knowledge Dream Cycle、默认本地文件访问、真实 data_service 产品化或 V2 全部完成。机器审查不能替代 H01..H07。
