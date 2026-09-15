# T02 R2 手工 Claude Code CLI 独立审查请求

日期：2026-09-11  
待审 run：`t02-r2-raw-20260911T143100`  
快照提交：`c2409206e4a337314b2995665780da1ca86c7a8d`  
当前门禁：`CANDIDATE PASS / T02-A12 PENDING`。

## 1. 审查决策

请只读审查 PX-5/T02 的 R2 sealed raw evidence，按 `T02-A01..T02-A12` 固定分母逐项给出 PASS/FAIL，并列出 Fatal、Major、Minor。最终只能选择：

```text
T02 PASS，且只允许进入 T03 实施前规划与审计
或
T02 FAIL，列出可复现 blocker
```

本轮不是 R3/R4/PX-6 审查，不要求 derived facts、production report、HTML 或 Human Review。不得把 R2 PASS 扩大为 PX-5、V2 或完整外脑完成。

## 2. 必须采用的权威口径

1. A04 三入口按 `background_request.payload.message.origin` 计数，`open_workspace`、`view_source`、`open_in_workspace` 各至少 2；DOM testId 不是入口分母。
2. A05 按 `source_library`、`source_detail`、`ask`、`graph`、`permissions` 五个 canonical routeIntent；不得按 URL 第一段合并 Library/Detail，Host Page 不算 Knowledge route。
3. Schema 元校验使用 `jsonschema.Draft202012Validator.check_schema(schema)`，之后再校验 raw-run 实例；不得把 Schema 当作自身实例。
4. R2 transport 范围固定为 `/v1/knowledge/*`；范围内每个 `runtime_request` 必须恰有一个 `runtime_response` 或 `transport_failure`。V1 health/settings/sidecar 由同 run 的 T01 回归覆盖。
5. 早期 `t02-r2-raw-20260911T052000` 和其他失败尝试均已作废，不得与本 run 拼接。
6. Mock Adapter 是本阶段冻结事实；不得误标为真实 data_service。

## 3. 必须独立重算

- Draft 2020-12 Schema 元校验、完整实例和 collector invariant；
- seal、snapshot、build index、collector/schema bytes、全部 artifact path/hash/length；
- 每个 Background/Runtime request 的 exact-one terminal outcome；
- 三 origin、五 route x direct-open/reload/Back/reopen；
- Permission >= 3、Forget >= 3、四面重读、四类同源重开与新 authority；
- 四类 fault 的 start/end 和区间；
- 8 张 PNG 的 magic、解码尺寸、metadata、hash 和观察引用；
- public/private 分离、公开字节脱敏、cleanup、残留进程；
- fresh build、typecheck、collector、前端全量、Runtime 全量和 T01 36 checks。

公开证据归档不包含 `.infra/**` 或 `private/**`。`raw-run.json` 仍保留 private artifact 的元数据记录，用于确认 private bytes 没有进入公开包；不得要求在外部审计包内公开本地授权正文、token 或 SQLite。

## 4. 本地候选结果，不得直接采信

```text
Schema meta: PASS
Schema instance errors: 0
validateRawRun errors: 0
segments/events/artifacts/scenarios: 2 / 1033 / 861 / 64
runtime requests/responses/failures/orphans: 420 / 403 / 17 / 0
background requests/responses/orphans: 6 / 6 / 0
origins: 2 / 2 / 2
public/private artifacts: 855 / 6
public files rescanned: 859, private path/Bearer hits: 0
build index: 91 files
collector/frontend/runtime/T01: 10 / 169 / 307 / 36 passed
cleanup: PASS
```

## 5. 已知审查基础设施中断

两次自动 Claude CLI 审查分别因 20 分钟无输出和 `max turns (24)` 中断，均未产出审查结论。因此当前 A12 仍是 Pending。本文件用于用户手工发起新的 Claude Code CLI 审查；不得把 CLI 中断记为产品失败，也不得把本地复核记为独立 PASS。

建议独立审查结果落盘到：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
  t02-r2-raw-evidence/independent-audit.md
```
