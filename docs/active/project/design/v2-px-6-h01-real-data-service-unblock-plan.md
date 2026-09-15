# PX-6 H01 真实 data_service 解阻计划

日期：2026-09-15。状态：Runtime 实现候选已完成；真实 Chrome 三入口待人类验收；旧 PX-6 机器候选和 sealed runs 保持只读。

## 1. 阻塞事实

本地人工验收截图显示 Runtime online、Adapter ready，但 `dataServiceStatus=unchecked`，并明确提示当前使用 `MockKnowledgeServiceAdapter`。运行时复核确认 `services/local-runtime/navia_runtime/app.py` 固定实例化 Mock；现有 `DataServiceHttpClient` 只完成 HTTP 边界 spike，未接入产品 adapter。

因此当前只能证明真实 Chrome 操作了一个内存 Mock，不能满足用户新增的 H01 条件“真实知识服务持久化”。刷新页面或修改文案均不能关闭该阻塞。

## 2. 限定修复目标

新增显式的 `data_service` adapter 模式，只关闭 H01 所需的最小真实链路：

```text
Runtime status -> data_service connected
read current page -> user clicks Save
-> Runtime adapter imports source into ws_default
-> real build reaches trace_ready
-> Side Panel / Workspace Library / Source Detail read same sourceId
-> repeated entry opens do not import again
-> Runtime restart can read the persisted source
```

Ask、Graph、Forget、自动维护和完整 RAG 不计入本修复 PASS；未实现能力必须在 capability map 中为 false 或明确 degraded，不能回落到 Mock 伪成功。

## 3. 实现边界

- Runtime 以 `NAVIA_KNOWLEDGE_ADAPTER=mock|data_service` 显式选择；默认保持 `mock`，未知值启动失败。
- 真实模式读取 `NAVIA_DATA_SERVICE_URL` 和可选 `NAVIA_DATA_SERVICE_API_KEY`；URL 只允许 localhost，密钥不得进入前端或公开证据。
- data_service 不可达、认证失败或版本不匹配时 fail-closed，不静默回退 Mock。
- 前端仍只调用 Runtime；不得直连 `data_service`。
- 默认 workspace 固定为 `ws_default`；adapter 负责创建或读取。
- source 内容来自用户已读取的当前页上下文；必须提交 `contentSnapshot={encoding,text,byteLength,sha256}`，Runtime 重算 UTF-8 长度和 SHA-256。Web 快照最多 24,000 字符/128 KiB；不能只保存标题或首条 500 字符 evidence ref。
- idempotency key 和 source ID 必须跨重复入口稳定；旧 sealed evidence 不参与新验收。
- `sourceRefs` 必须作为下游公开 metadata 的受限字段持久化，使 Runtime 重启后 trace 仍非空；不得只存在进程内存。
- 不同 URL 即使正文相同也必须形成不同 canonical source identity；同 URL 同快照保持稳定 content-addressed source。

本地启动入口冻结为 `scripts/h01_real_data_service.sh`。`start/status/stop` 仅管理自身记录的 PID；若标准端口被其他进程占用则拒绝覆盖。默认 DS 数据根为 `.navia/h01-real-data-service/workspaces`，外部 `data_service` 仓库保持只读。

## 4. H01-RDS 验收

| ID | 操作 | 必须结果 |
|---|---|---|
| RDS-01 | 启动真实 data_service 与 Runtime real mode | 状态显示 `connected`，文案不含 Mock |
| RDS-02 | 在真实网页读取并保存 | data_service workspace 中出现一条真实 source，最终 `trace_ready` |
| RDS-03 | 三入口打开 | 3/3 指向同一 workspaceId/sourceId |
| RDS-04 | 重复三入口 | source 数不增加，重复 ingest=0 |
| RDS-05 | 重启 Runtime 后打开 | 同一 sourceId 仍可列出和查看 trace |
| RDS-06 | 停止 data_service 后刷新 | 显示 unreachable/degraded，禁止显示 ready/trace_ready |
| RDS-07 | 扫描前端源码 | 无 data_service endpoint、API key 或直接 fetch |

任一项失败，H01 维持 failed，PX-6 final 维持 blocked。

2026-09-15 Runtime 级候选状态：RDS-01、RDS-02、RDS-05、RDS-07 已通过；RDS-06 已以不可达目标验证 fail-closed；RDS-04 的同一请求重复保存已通过。RDS-03 与三入口范围的 RDS-04 必须由真实 Chrome 人工流程完成，故 H01 仍未 PASS。

## 5. 与现有门禁的关系

- 旧 PX6-0..5 machine limited pass 不撤销，也不能证明 RDS-01..07。
- H01-RDS 通过后才允许人类执行升级后的 H01。
- H01-RDS 不等于 RKM、RAG、Ask、Graph、Forget 或 V3 完成。
- 真实 adapter 的后续能力必须继续按 V2-RKM 合同和独立审计推进。
