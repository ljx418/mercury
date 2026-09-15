# T02 R2 合同变化

日期：2026-09-11  
状态：候选已实现并完成本地复核，等待独立复审。

## 原始证据合同

权威版本保持 `v2-px-raw-run/v2`。本轮冻结并实现：

- 13 种 event kind 的闭合集合；
- 全局连续 `sequence`、不回退 `monotonicMs` 和无缝 segment 范围；
- `dom_action -> background_request -> background_response` 的 action、navigation、requestId 和 requestEventId 绑定；
- R2 transport 分母固定为 `/v1/knowledge/*`；每个被采集 Background request 恰好一个 Background response，每个被采集 Runtime request 恰好一个 Runtime response 或 transport failure；
- Runtime request/response/transport failure 的同 navigation/action 绑定；无终态和重复终态均由 collector 拒绝；
- response entity 原始字节、artifactRef、byteLength、SHA-256 和 content-type；
- fault_start/fault_end 与 segment fault interval 的一一覆盖；
- route/container authority 不能跨 navigation 或 segment；
- screenshot 必须同时引用 route 和 container observation；
- canonical JSON seal、输入 artifact 和磁盘字节重算。

## 交付合同

每个成功 run 额外交付：

- `input/snapshot-input-manifest.json`；
- `artifacts/public/manifest.json`，权威指向 `raw/artifact-index.json`，不复制第二套 artifact；
- 根级 `cleanup-manifest.json`；
- `raw/collection-diagnostic.json`。

成功 diagnostic 必须引用 sealed raw run 的 path/hash，并且 `missingObservations=[]`。等待终态采用 30 秒有界 drain；超时只能生成失败 diagnostic，不得封存 PASS。

公共 prerequisite 文本在写入前按 home、隔离 repo、evidence root、扩展构建目录、profile root、授权路径和 token 做确定性替换；最终扫描不放宽，仍逐公共字节检查原值和 Bearer 形态。

## 非合同变化

- E2E bridge 仅存在于 `NAVIA_E2E_BRIDGE=1` 构建，不是产品公共 API。
- V1 health/settings/sidecar 请求不进入 R2 transport 因果链；它们由同 run 的 T01 真实 Chrome 回归验证。
- 未新增 Runtime endpoint、错误码、知识对象字段或 Adapter 能力。
- R2 只输出 sealed raw evidence，不输出 ScenarioResult、G1-G7、HTML 或 Human Review。
