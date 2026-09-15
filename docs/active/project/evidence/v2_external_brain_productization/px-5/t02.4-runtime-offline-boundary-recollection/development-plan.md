# T02.4 Runtime offline 边界修复与完整真实 Chrome 重采开发计划

日期：2026-09-14。状态：`IMPLEMENTED / SELF-AUDIT PASS`。

## 1. 目标

修复 R2 采集器把 Runtime 关闭窗口中的成功响应纳入 `runtime_offline` fault interval 的因果边界错误。只修改 P7 采集/校验代码并完整重采；不修改产品前端、Runtime、API、Schema、63 RuleId、109 requirements、42 mutations 或 G1-G7。

## 2. 允许修改实体

| 实体 | 修改目的 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | Runtime 确认退出并排空在途观察后再开始 offline interval；seal 前 fail closed |
| `apps/chrome-extension/e2e/lib/v2PxKnowledgeStatusEvidence.mjs` 或同层新 helper | 纯函数重算 offline interval 内 request/terminal 因果 |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | 成功边界与“fault start 前/后 response”负回归 |
| T02.4 verifier/readiness/evidence 文档 | 独立重算新 run 通过及旧 T02.3 精确失败 |

禁止修改 T02/T02.1/T02.2/T02.3 sealed runs，禁止删除旧 response，禁止在 T03 派生层归一化。

## 3. 算法

1. `startNavigation(runtime_offline)`。
2. 向 Runtime 发送 SIGTERM，等待进程退出并 flush 日志。
3. 在尚未开始 fault interval 时 drain CDP/bridge 观察直至 settled；所有关闭前成功 response 保留在 raw，但不属于 offline interval。
4. 调用 `startFault(runtime_offline)`，打开 Workspace 并观察真实 offline UI。
5. 对 interval 内每个 Runtime request 建立终态集合；必须 `response=0 && transport_failure=1`。
6. 若不满足则写 diagnostic、拒绝 seal；满足后才结束 fault 和 segment。
7. 使用全新 snapshot/run 完整重采并执行 T02.3 全部分母与新增边界分母。

## 4. 实施顺序

1. 先写纯函数和回归测试，证明旧 T02.3 sequence 1331/1332 被拒绝。
2. 修改 runner 的 fault 起点和 pre-seal 检查。
3. 运行 build/typecheck、collector、frontend、Runtime、T01 Chrome、Axe、Keyboard。
4. 创建 `t02-r2-runtime-offline-boundary-production-input-<timestamp>` 全新 run。
5. 本地完整目录与公开归档使用同一 verifier；旧 T02.3 作为负例。
6. PRD/架构/false-green 审计 Fatal 0/Major 0 后才可更新 T03 基线。

## 5. 停止条件

任何产品代码/合同变更、前置失败、offline interval 出现 response、分母缩减、跨 run 引用、seal/privacy/cleanup 失败或新 Major 均立即停止。失败 run 不封存、不进入候选。
