# H01-RDS 真实 data_service 实现候选与服务级验收

日期：2026-09-15。范围：只关闭 H01 的真实持久化启动阻塞，不扩大为 H01/PX-6/V2/RAG/RKM 通过。

## 1. 实现实体

- `services/local-runtime/navia_runtime/modules/memory/data_service_adapter.py`：真实 workspace/source/build/trace adapter 与显式 env factory。
- `services/local-runtime/navia_runtime/modules/memory/data_service_client.py`：目标 HTTP workspace/source/build/trace 客户端。
- `services/local-runtime/navia_runtime/modules/memory/guards.py`：`contentSnapshot` byte length/SHA-256/shape 校验。
- `services/local-runtime/navia_runtime/app.py`：Runtime 启动时选择 adapter，错误保持 fail-closed。
- `apps/chrome-extension/src/runtimeClient.ts`：只向 Runtime 提交已读取页面的受限文本快照；不直连 DS。
- `scripts/h01_real_data_service.sh`：真实双服务 start/status/stop/foreground 生命周期。

## 2. 真实样本

页面：`https://www.bilibili.com/video/BV1ZpYd66ELP`。

2026-09-15 实时 metadata：`aid=117258110176985`、`cid=41828944992`、`duration=792`、单 P、UP 主“地上足球888”、公开字幕为空。保存内容明确标注只证明页面来源持久化，不宣称字幕、ASR 或视频语义理解完成。

服务级结果：

```text
adapterStatus=ready
dataServiceStatus=connected
sourceId=src_bf23436886374c6c
sourceStatus=trace_ready
operationStatus=succeeded
same-snapshot replay=true
post-Runtime-restart sourceId=src_bf23436886374c6c
post-Runtime-restart trace entries=1
```

下游数据位于 `.navia/h01-real-data-service/workspaces/ws_default/`，包含 source、lifecycle operation、distill、LLMWiki 和 GraphRAG 状态文件。该目录属于本地 ignored 验收数据，不进入审计包。

## 3. 自动化验证

```text
Python directed H01/R1 suite: 98 passed
Python full Runtime suite: 248 passed
runtimeClient Vitest: 10 passed
frontend full Vitest: 170 passed
frontend typecheck: PASS
frontend production build: PASS
shell syntax: PASS
JSON Schema meta-validation and positive instance: PASS
Windows Chrome extension-page smoke: PASS (connected=true, Mock/unchecked=false, page errors=0)
```

真实行为已验证：首次 import/build、重复保存不新建 source、不重复 build、source list/detail、trace、完整停止和 Runtime 重启后的持久读取。不同 URL 同正文不会折叠；下游 source-list 失败时状态不会二次探测假绿为 connected。

界面冒烟截图：`h01-real-data-service-sidepanel-smoke-2026-09-15.png`，原始字节 SHA-256 为 `8baabb1b77f12bac5e605f6c95b0863b639b0aaea9bb3779f93765e37f894da5`。该截图来自全新 Windows Chrome profile 加载当前 unpacked extension 后直接打开 Side Panel，证明页面可呈现 `data_service connected` 且无 Mock/unchecked 文案；它不是原生 Side Panel 三入口人工操作，不能关闭 RDS-03 或 H01。

修复前生成的重复测试来源 `src_2db786acb5f6c124` 已通过 data_service 的 source remove API 标记为 `removed`；这只是验收环境清理，不计作 Navia 产品 Forget 证据。当前 Runtime 来源列表只返回保留的 `src_bf23436886374c6c`。

## 4. 门禁对照

| ID | 当前结果 | 证据边界 |
|---|---|---|
| RDS-01 | PASS | 双服务标准端口 real mode，状态 connected 且无 Mock 文案 |
| RDS-02 | PASS | 指定 B站页面真实 metadata 快照 import/build 到 trace_ready |
| RDS-03 | PENDING HUMAN CHROME | Side Panel/Library/Detail 3/3 尚未由人类签署 |
| RDS-04 | PARTIAL PASS | Runtime API 同快照 replay=true；三入口重复操作仍待 H01 |
| RDS-05 | PASS | 双服务停止重启后同 sourceId 与非空 trace |
| RDS-06 | PASS | 独立 17862 Runtime 指向未监听的 18003：unreachable/degraded、7 项 capabilities 全 false、userAction=reconnect |
| RDS-07 | PASS | 前端无 DS endpoint/API key/direct fetch；仅 runtimeClient 调 Runtime |

## 5. PRD 检视与停止边界

本实现符合 Runtime 权威、B 前端不直连 DS、用户主动保存、稳定 ID、故障可见和有限声明边界。它不实现或证明 Query、Graph、Durable Forget、RAG、RKM、B站字幕、本地 ASR、视频大纲、Media Mindmap 或时间反跳。

当前允许声明：`H01-RDS Runtime implementation candidate passed service-level checks; H01 is unblocked for real-Chrome human execution.`

当前禁止声明：`H01/PX-6/PX-5/V2 passed` 或 `Bilibili video understanding is implemented`。
