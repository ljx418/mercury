# T02.3 PRD、架构与假绿检视

日期：2026-09-14
性质：实施代理内部只读复核，不替代外部审查。

## 1. PRD 规格

T02.3 没有创建、删除或改变用户功能。新 run 重新覆盖已冻结体验：三入口、保存后查看来源、12 个真实来源、五类 route 的 direct-open/reload/Back/reopen、无效 route 回库、Permission、三个来源 Forget 后四种重开均不可复活、四故障、双容器四视口、Axe 和 Keyboard。

结论：未缩小 PRD 分母，未把 review fixture 当产品证据，未声明 RAG、自动维护或 PX-6 人工签署完成。

## 2. 目标架构

变更仅位于 P7 Evidence：

```text
真实 Runtime response bytes
-> R2 Artifact Collector
-> v2PxKnowledgeStatusEvidence 离线合同校验
-> errors=0
-> raw collector seal
```

P0 Host、P1 Extension Shell、P2 Side Panel/Workspace、P3 runtimeClient、P4 Runtime、P5 Adapter、P6 data_service 均未修改。Status Schema 仍是唯一权威；采集器不得修正 Runtime 数据。

## 3. 假绿防线

- checker 读取 response artifact 原始字节和 artifact index，不信任 UI 文本或报告布尔值。
- 未知 fault 无默认策略；generic `retry` 的回归必须失败。
- 校验发生在 `seal()` 前；错误 run 没有 sealed raw。
- 旧 T02.2 必须持续复现 7 个错误，证明没有放宽 Schema 或静默归一化。
- 全新 run 自含全部分母，不跨旧 run 补数。
- exact-one-terminal、artifact hash/length、canonical seal、privacy、cleanup 均由独立 verifier 重算。
- 本地 34/34 只能生成候选，不能关闭独立审查门槛。

## 4. 内部结论

Fatal 0 / Major 0 / Minor 0。剩余风险只有组织独立性：外部审查者仍需从平铺包重算全部关键事实。
