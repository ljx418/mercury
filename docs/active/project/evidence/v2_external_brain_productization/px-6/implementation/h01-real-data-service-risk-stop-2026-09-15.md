# H01 真实 data_service 人工验收阻塞记录

日期：2026-09-15

## 事实

- 人工截图：Runtime online、Adapter ready、`data_service unchecked`。
- UI 消息：`V2 mock adapter is ready. Real data_service adapter is not enabled in V2-1.`
- Runtime `GET /v1/knowledge/status` 返回同一状态。
- `services/local-runtime/navia_runtime/app.py` 当前实例化 `MockKnowledgeServiceAdapter()`。
- `DataServiceHttpClient` 已存在并能探测目标 HTTP envelope，但没有成为知识 API 的产品 adapter。

## 判定

```text
PX6 machine candidate: unchanged
H01 under original mock-first PX wording: not reclassified
H01 under user's real-persistence expectation: BLOCKED
PX-6 final: BLOCKED
V3 persistent media artifact prerequisite: BLOCKED by H01-RDS
```

Mock 中保存的真实网页内容仍是内存测试事实，不等于真实 `data_service` 持久化。禁止通过隐藏状态卡、改成 connected 文案、降低 H01 前置或复用旧机器截图来通过。

## 恢复条件

按 `docs/active/project/design/v2-px-6-h01-real-data-service-unblock-plan.md` 完成 RDS-01..07，并生成新的真实服务证据；旧 PX-6 sealed run 不得改写或拼接。

## 2026-09-15 修复进展

- `DataServiceKnowledgeAdapter` 与显式 real-mode factory 已实现；默认 Mock 未被伪装成 real。
- 前端保存已携带完整受限 `contentSnapshot`，Runtime 重算 UTF-8 byte length 与 SHA-256。
- 指定 B站页面 `BV1ZpYd66ELP` 的实时 metadata 快照已通过 Runtime 写入真实 DS，达到 `trace_ready`。
- 同快照重复保存返回相同 `sourceId` 且 `idempotentReplay=true`；Runtime 重启后来源和非空 trace 仍可恢复。
- Query、Graph、Forget capability 保持 false/fail-closed。
- 风险状态从“无法开始 H01”变为“允许开始 H01 真实 Chrome 验收”；RDS-03/三入口 RDS-04 未签署前，H01、PX-6、PX-5 和 V2 仍不得声明 PASS。

实现候选证据见 `h01-real-data-service-implementation-candidate-2026-09-15.md`。
