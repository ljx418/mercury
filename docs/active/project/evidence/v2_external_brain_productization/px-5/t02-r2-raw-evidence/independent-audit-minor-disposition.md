# T02 独立审计 Minor 处置

日期：2026-09-11  
对象：`t02-r2-raw-20260911T143100`  
前置结论：`independent-audit.md` 已判定 T02 PASS（限定范围），Fatal 0 / Major 0 / Minor 3。

## 1. 处置边界

本轮只读取已封存的 `raw/raw-run.json`、T01 原始结果和冻结 Workspace 合同。未修改 sealed run，未启动 Chrome、Runtime 或旧报告生成器，未改变 T02-A01..A12 分母。

可重复命令：

```text
python3 docs/active/project/evidence/v2_external_brain_productization/px-5/t02-r2-raw-evidence/verify-independent-audit-minors.py
```

命令退出码为 0，输出 `passed=true / fatal=0 / major=0 / minorOpen=0`。

## 2. M-1：T01 36 项未逐条复核

处置：CLOSED。

检查器直接读取 `.infra/t01-regression/raw/t01-real-chrome-run.json`，确认：

```text
root passed=true
checks=36
passed checks=36
failed checks=0
```

本处置复核的是 T02 run 内冻结的 T01 原始结果，不将其描述为本轮重新启动 Chrome。T01 结果仍由原始 Chrome run、截图、cleanup 和命令退出记录共同支撑。

## 3. M-2：Runtime stdout 与 420 条传输事件数量不同

处置：CLOSED AS EVIDENCE-LAYER CLARIFICATION。

`logs/runtime.log` 是 Runtime 进程生命周期/stdout 诊断，封存文件只有 2 条 access line；它不承担 R2 transport 分母。R2 transport 的权威层是浏览器内 `runtimeClient` 的 E2E transport observation，Background 只读桥接到 collector：

```text
contextId=ctx_runtime_transport
runtime_request=420
runtime_response=403
transport_failure=17
orphan or multi-terminal=0
URL scope=/v1/knowledge/*
```

实现入口为 `src/runtimeClient.ts` 的 E2E observation 与 `entrypoints/background/index.ts` 的 `navia.e2e.r2.runtime_observation` 转发；collector 映射位于 `chrome-v2-px-r2-raw-evidence.mjs`。T03 必须消费 raw event/artifact，不得从 stdout access log 推导 420 条业务传输。

## 4. M-3：Background message 未做字段级抽样

处置：CLOSED。

检查器使用 `v2_external_brain_workspace_contracts.schema.json` 的 `OpenWorkspaceAction` 与 `WorkspaceOpenResult` 对全部 6 组消息逐字段校验，而非只抽一条：

```text
request schema errors=0
response schema errors=0
request/response pairing errors=0
requestId/scenarioId/actionId mismatches=0
extension workspace URL/path/ID mismatches=0
open_workspace=2
view_source=2
open_in_workspace=2
created_new=1
focused_existing=5
```

额外确认 `open_workspace -> source_library` 且无 `sourceId`，`view_source -> source_detail + sourceId`，`open_in_workspace` 保留有效 `source_detail` 或 `ask` 上下文。

## 5. 门禁

| 项目 | 结论 |
|---|---|
| T02-A01..A12 | 12/12 PASS |
| 独立审查 | PASS，Fatal 0 / Major 0 |
| 原 Minor | 3 项均已完成补充复核，无开放项 |
| T02 | PASS（限定范围） |
| T03 | 仅允许实施前规划与审计 |
| PX-5 / V2 | 未通过 |

本文件不改变独立审查者的原文；它记录审查后补充复核和处理边界。
