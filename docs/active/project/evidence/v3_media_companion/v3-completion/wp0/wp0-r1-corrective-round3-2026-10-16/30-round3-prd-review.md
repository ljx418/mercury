# WP0 R1 第三轮纠偏 PRD / 架构不变量检视（2026-10-16）

Candidate: `wp0-r1-corrective-round3-2026-10-16`
状态：**R1 AWAITING CODEX REFREEZE**

## 1. Codex 第三轮 Major / Minor 逐项关闭

| 编号 | 门禁要求 | 本轮实现 | 判定 |
|---|---|---|---|
| M-R1-C3-01 | 生产 restart adapter 必须调用真实 authenticated Runtime，不得自消息伪装 | 新增 `RuntimeRelayRecoveryAdapter`；Background 注入 `bootstrapLocalRuntimeSession` / `cancelMediaAcquisition` / `getMediaAcquisition`；删除 `command:"delete"` / `"recover"` / 带 `taskId` 的 `"status"` 自消息；`Boolean(response)` 假成功改为 `readAcquisitionState` 严格判定 | ✅ |
| m-R1-C3-01 | 终态闭集与 `MediaAcquisitionTask.state` 一致 | 新增 `ACQUISITION_TERMINAL_STATES = succeeded/degraded/blocked/failed/cancelled`；移除 `ready` / `published` | ✅ |

## 2. 第三轮最小纠偏范围逐条落实

| handoff §4 要求 | 实现 | 判定 |
|---|---|---|
| 1. 抽出可注入的生产 recovery adapter | `RuntimeRelayRecoveryAdapter`，注入 `RelayRuntimeClient` 三函数 | ✅ |
| 2. 使用现有 `bootstrapLocalRuntimeSession` / `cancelMediaAcquisition` / `getMediaAcquisition` | Background `relayRuntimeClient` 逐一接线 | ✅ |
| 3. worker 重启建立新进程内 session；旧 token 不持久化/恢复 | `ensureSession()` 每次新 adapter 必 bootstrap；`bootstrapCount` 可观测；静态断言无 token 持久化 | ✅ |
| 4. `connecting` 固定 bootstrap → DELETE → GET | adapter `cancelThenObserve`；测试断言精确顺序与 taskId | ✅ |
| 5. 其余四 phase 固定 bootstrap → GET | adapter `observe`；测试断言无 cancel | ✅ |
| 6. 一次 reconcile 不重复 bootstrap；并发单飞 | `#sessionPromise` single-flight；`bootstrapCount===1` 断言 | ✅ |
| 7. 传播 401/403/offline/transport/API error；保留 marker + 固定码 | `classifyRuntimeError` 分类；reconciler 统一 `RUNTIME_DISCONNECTED` | ✅ |
| 8. 终态严格 5 项，其他不清 marker | `ACQUISITION_TERMINAL_STATES` | ✅ |
| 9. 删除或停用 `recover(sourceIdentity)` | adapter 与 reconciler 双双删除；静态测试剥离注释后断言无 `sourceIdentity` | ✅ |
| 10. 生产代码不得用 `Boolean(response)` 判成功 | `readAcquisitionState` 拒绝 `{ok:false}` / 无 task / 无 state | ✅ |

## 3. 404 策略（handoff §5.8）

本轮**显式建模而非扩大公共合同**：404 通过两条既有路径被吸收 ——

- Runtime 返回 `{ok:false, error}` 信封 → `readAcquisitionState` 判为
  `api` kind 失败；
- Runtime client 抛出带 `httpStatus` 的错误 → `classifyRuntimeError` 判为
  `api` kind。

两者都让 reconciler 返回 `runtime-unavailable` + 固定
`V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` 并**保留 marker**，不把 404 当作
终态、不自行清 marker。404 的最终产品语义仍属 R4，R1 只保证「不假成功、
不错清」。

## 4. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | 不变 | ✅ |
| Offscreen 直接联网（不允许） | 不变 | ✅ |
| 音频生产/downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变；6 项 barrier 测试全绿 | ✅ |
| barrier 后 cleanup 归 transcript service，handler 禁止再 cleanup | 不变 | ✅ |
| streamId 仅一次性 | 不变 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 不变 | ✅ |
| 超限 enqueue 前 abort | 不变 | ✅ |
| 单一 capture control plane | 不变 | ✅ |
| restart 不恢复旧音频/票据/序列 | adapter 只调 bootstrap/DELETE/GET；无 `sourceIdentity` | ✅ |
| **restart 必须通过真实 authenticated Runtime**（本轮新增不变量） | Background 不再自消息；三个真实 client 函数接线 | ✅ |

## 5. 冻结合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| v10 schema / fixture / 40-source / 20-target registry | **未修改** | ✅ |
| 验收阈值 / 固定分母 | 未修改 | ✅ |
| 公共 API / Runtime endpoint / Origin / ticket TTL | 未修改 | ✅ |
| Cookie / provider 合同 | 未修改 | ✅ |
| BVID 分母 / grounded comprehension / SourceAuthority / Side Panel materialize | 未修改 | ✅ |
| `runtimeClient.ts` | **未修改**（直接复用既有三个导出函数） | ✅ |
| marker 字段（严格 6 项） | 未修改 | ✅ |

**内部合同变化**：有 —— 生产 recovery adapter 换为真实 Runtime client；
`RelayRecoveryAdapter` 成员由 `deleteAcquisition` / `getTask` / `recover` 改为
`cancelThenObserve` / `observe`；新增 `ACQUISITION_TERMINAL_STATES`。
**公共合同变化：none**。

## 6. 严重度与状态

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | M-R1-C3-01 关闭 |
| Minor | 0 | m-R1-C3-01 关闭 |
| 待重冻结 | 1 | v10 verifier 45/50 + 14/15；8 个「缺失」code 全部仍在工作树（零真实删除）；根因为 2 个 R1 必须改的冻结 scope 文件漂移 + 新增模块未入 scope |

## 7. 未启动事项声明

- R2–R7 未启动；WP1–WP7 未启动
- Chrome 0 次；Provider 0 次；六视频 fresh run 0 次；真实产品 run 0 次
- 声音播放 0 次；可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未 commit / push / reset / clean / revert
- 未修改任何冻结证据；未宣布 R1 PASS
