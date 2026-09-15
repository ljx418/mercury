# T02 R2 变更文件

日期：2026-09-11  
基线：`5a34e5aef0ad493ef4374ad0ead6ea3a1c27fcbd`  
隔离候选：`c2409206e4a337314b2995665780da1ca86c7a8d`

## 采集与测试

- `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs`：真实 Chrome 双容器采集、Runtime 原始响应字节、两段生命周期、故障区间、截图、封存、脱敏和清理。
- `apps/chrome-extension/e2e/lib/v2PxRawCollector.mjs`：单写者事件、artifact 原子写入、canonical seal 和跨记录校验。
- `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs`：10 项 collector 测试，含 13 种 event kind 的逐类 Schema 负例，以及每个 Background/Runtime request 恰好一个终态的负例。
- `apps/chrome-extension/e2e/chrome-v2-px-workspace-router.mjs`：旧 PX-5 report-shaped raw 路径生产硬阻断。
- `apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs`：Windows CDP 直连、profile 限定清理和浏览器启动失败资源清理。
- `apps/chrome-extension/package.json`：增加 T02 collector 和真实 Chrome 命令。

## 被动观测

- `apps/chrome-extension/entrypoints/background/index.ts`：仅 E2E 构建暴露带 ACK 和 requestId/phase 去重的 Background request/response 观察，不替换生产 `sendMessage`。
- `apps/chrome-extension/entrypoints/sidepanel/main.tsx`：仅 E2E 构建记录真实 `event.isTrusted` 动作。
- `apps/chrome-extension/src/runtimeClient.ts`：仅 E2E 构建记录实际 `/v1/knowledge/*` Runtime transport 请求/响应边界；fetch 保持同步起始，观察 ACK 在终态返回前完成。

## 合同与文档

- `docs/active/project/contracts/v2_px_raw_run.schema.json`
- `docs/active/project/design/v2-px-5-repair-execution-contract.md`
- 本目录的开发、验收和三份实现前审计文档。
- `independent-audit.md`：用户提供的 T02 独立只读审查，结论为限定范围 PASS、Fatal 0 / Major 0 / Minor 3。
- `verify-independent-audit-minors.py` 与 `independent-audit-minor-disposition.md`：只读复核 36 条 T01 检查、420 条 Runtime transport 和 6 组 Background 完整消息；不修改 sealed run。

## 基线测试修正

- `services/local-runtime/navia_runtime/modules/agent_loop/tests/test_agent_loop.py`：把过期的 `piagent_unavailable` 期望对齐到 Runtime health 和 provider 已共同使用的 `piagent_sidecar_unavailable`；未改变生产代码。

未修改 Runtime HTTP、Adapter/Governance 或 data_service 公共实现。`chrome-mv3-unpacked` 构建差异没有进入隔离候选提交。

## 作废尝试与最终快照

早期 `373c8f7` run 暴露两个无终态 Runtime request，随后收紧 collector invariant、观察 ACK 与等待边界。V1 Sidecar health 请求不属于 R2 `/v1/knowledge/*` transport 分母，仍由 T01 回归覆盖。最终 runner 还对安全 `.tmp/t02-extension-build-*` 复制增加三次 `EINTR` 重试，不改变产品代码。正式证据只认 `t02-r2-raw-20260911T143100`，不与早期尝试拼接。
