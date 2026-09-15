# T02 R2 原始证据采集验收计划

日期：2026-09-11  
状态：实现前冻结候选。

## 1. 固定分母

| ID | 必须结果 |
|---|---|
| T02-A01 | `v2-px-raw-run/v2` Schema 元校验、完整正例和逐 event kind 负例均退出 0 |
| T02-A02 | snapshotCommit、fresh build index、collector/schema hash 与实际原始字节一致；构建和采集来自同一隔离提交 |
| T02-A03 | 至少一个完整 segment；Runtime 重启场景产生第二 segment，PID/session/sequence 边界真实且不复用旧 authority |
| T02-A04 | 三生产入口 `open_workspace`、`view_source`、`open_in_workspace` 按 Background message `origin` 各至少 2 次真实 trusted click；同一 origin 可由该入口下不同产品按钮触发，DOM `testId` 不作为入口分母；dom_action -> background request/response -> navigation -> Runtime authority 可按 eventId 唯一追踪 |
| T02-A05 | 五个 canonical `routeIntent`：`source_library`、`source_detail`、`ask`、`graph`、`permissions` 各采集 direct-open/reload/Back/reopen；不得按 URL 第一段合并 Library/Detail，也不得把 host page 算作 Knowledge route；route/container ID 与同 navigation 的 Runtime 响应一致 |
| T02-A06 | R2 transport 采集范围固定为 `/v1/knowledge/*`；范围内每个 Background/Runtime request 恰好一个 response 或 transport_failure 终态；Runtime response artifact 是浏览器网络层解压后的 entity body 原始字节，hash/length/content-type 可重算；timeout/refused 没有伪 response；V1 health/settings/sidecar 由独立 T01 回归覆盖，不混入 V2 原始因果链 |
| T02-A07 | Permission >=3、Forget >=3；mutation 后四面重读和同源四类重开均有新 authority，不引用 mutation 前响应 |
| T02-A08 | 四类 fault 均有 fault_start/fault_end；所有相关观察落在区间内，controlled injection 不写成自然后端故障 |
| T02-A09 | Side Panel 360/420 与 Workspace 768/1280 的真实 PNG、metadata、surface、navigation/action/observation IDs 成对可重算 |
| T02-A10 | 公开 artifact 原始字节无 token 和私人绝对路径；private artifact 不进入公开包；cleanup 无存活 Chrome/Runtime/端口/profile |
| T02-A11 | 缺trusted action、wrapped sendMessage无dom_action、缺response bytes、业务请求requestId=null、requestId与response引用不一致、错runId/requestEventId、跨segment/导航authority、fault不成对/区间交叠、错hash、seal count不等于数组长度、缺截图配对、序号或时间倒退、命令无exitCode/signal、seal后写入均输出失败diagnostic和非0 |
| T02-A12 | 前端全量、Runtime 全量、typecheck、fresh build、T01 回归和独立审查均通过；Fatal=0/Major=0 |

分母固定 12；无 N/A。任一 failed/pending/deferred 阻止 T02 通过。

## 2. 防假绿规则

- `isTrusted` 必须来自页面真实事件对象；runner `evaluate`、直接 `sendMessage` 或测试 helper 不能计作三入口用户动作。
- 事件 sequence 由唯一 collector 分配；`observedAt` 和 source 端时间不用于跨进程排序。
- request/response、route、container 和 screenshot 通过 eventId 引用，不能只靠相同 requestId 或时间近似。
- raw run 不包含 G1-G7 布尔、人工签署或派生完成结论；这些属于后续 R3/R4。
- 失败运行写入新的 attempt/diagnostic，不覆盖既有 sealed raw run。

## 3. 分母与事件合同映射

| 验收项 | 原始承载 | 主要 kind |
|---|---|---|
| A01-A02 | schemaVersion、snapshot/build/collector/schema artifact、seal | 顶层 |
| A03 | Runtime/Browser session与sequence范围 | `segments[]` |
| A04 | 三入口真实动作和Background链 | `dom_action`、`background_request`、`background_response`、`navigation_start` |
| A05 | 五route四恢复与稳定ID | `navigation_start`、`route_observation`、`container_observation` |
| A06 | 实际HTTP原始字节或无响应失败 | `runtime_request`、`runtime_response`、`transport_failure` |
| A07 | Permission/Forget mutation后重读 | 上述Runtime、route、container事件 |
| A08 | 受控故障区间 | `fault_start`、`fault_end` |
| A09 | 双容器四视口 | `screenshot`及其observation引用 |
| A10 | 脱敏、visibility与cleanup | `artifacts[]`、`command_result` |
| A11 | collector invariant负例 | 全部事件层 |
| A12 | 实测命令与独立复审 | `command_result`与阶段文档 |

此处“12项”只指T02-A01..A12验收分母，不等于R1的12条EvidenceRef上限、13种event kind或G1-G7。

## 4. 必需交付

```text
runs/<runId>/
  input/snapshot-input-manifest.json
  input/build-index.json
  raw/raw-run.json
  raw/artifact-index.json
  raw/collection-diagnostic.json
  artifacts/public/**
  private/**
  screenshots/**
  screenshot-metadata/**
  logs/**
  cleanup-manifest.json
```

同时交付 changed-files、contract-changes、test-results、prd-review、architecture-review、acceptance-result、independent-audit 和 handoff。
