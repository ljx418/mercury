# T02 R2 架构检视

日期：2026-09-11  
结论：T02 采集实现未偏离已冻结 P0-P7 边界。

## 观察链

```text
P0 Host Page
-> P1 Background / Workspace open action
-> P2a native Side Panel / P2b workspace.html
-> P3 shared runtimeClient
-> P4 Local Runtime
-> P5 Mock Adapter / Governance
-> R2 single-writer collector
-> sealed raw run + artifact index
```

三入口动作来自浏览器 `event.isTrusted`，Background 与 Runtime 只提供被动 E2E 观察出口，不替换生产消息或 transport。route/container/screenshot 只能引用同 navigation、同 segment 的先前 Runtime authority；Runtime restart 后创建新 segment，旧 authority 不能复用。

R2 transport 观察边界固定为 `/v1/knowledge/*`。Background E2E 观察使用 ACK 与 requestId/phase 去重；Runtime 请求开始时间保持与生产 fetch 一致，collector 在封存前有界等待每个知识请求的唯一终态。V1 sidecar/health 不被混入 V2 因果链，由同 run 的 T01 真实 Chrome 回归独立覆盖。

## 边界结论

- 前端未直连 data_service，也未在前端创建 KnowledgeItem/EvidenceRef/graph fact。
- 未修改 Runtime HTTP 或 Adapter 公共合同。
- 公共与 private artifact 通过 visibility 和索引分离；授权路径正文不进入公开证据。
- 旧 report-shaped PX-5 runner 在生产模式初始化前即硬失败，不能生成伪 raw PASS。
- A/C/D 服务实现目录未改变；仅修正一条与现有 Pi Sidecar canonical code 不一致的历史测试期望。

R2 尚未实现 derivedFacts、productionValidation、report envelope 或 Human Review，这些必须留给 R3/R4/PX-6。
