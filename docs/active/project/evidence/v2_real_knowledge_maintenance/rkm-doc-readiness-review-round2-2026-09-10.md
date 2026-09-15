# V2-RKM 第二轮独立复审（含 16 项 S-处置与 4 项 RC 风险再核查）

日期：2026-09-10。审查者：当前 session（独立只读静态）。审查对象：第二轮 `docs/active/project/external-audit-package/`（18 载荷 + 1 manifest = 19 平铺文件，已重算 SHA-256）。
本次复审重点：① 跨仓协议可实现性（contracts §3.2..3.9）② 阶段依赖（dev §5/§6、acceptance §5/§9）③ 授权与暂停生命周期（contracts §3.7/§3.9、acceptance §8.1 IR-01..03）④ 是否仍存在缩小分母或证据假绿（acceptance §6/§8/§9 整套）⑤ 现有 Mock / 候选 DS 是否误标为已实现。

---

## 0. 摘要

- 18 项载荷 SHA-256 与权威源完全一致（独立重算），权威源与平铺文件 0 mismatch；AUDIT_MANIFEST 自报 18 项载荷哈希全部对账成立。
- 新增 7 节：contracts §3.3..3.9（新 S-1/S-9/S-10/S-11/RC-01..04/IR-02/03 设计）；acceptance §6/§7/§8/§9（证据合同补强、S→E 反向表、RC/IR 断言、AC01..10 执行卡）；risk-adr 增 RC-01..04 决策；development §5/§6（复审交接 + D01..09 + T01..10）。
- Draw.io 8 页 / 104 vertex / 56 边（修订前 55 边，图 04 由 6 边扩到 7 边用于 S-12 "三类同意横向对照"），ID 唯一、边引用闭合、图元全部在 1600×1000 边界内。
- 我的第一轮 16 项 S-问题（S-1..S-16）已全部落盘到文档；其中 11 项已写明设计 + 后续验证义务，5 项（S-2 / S-3 / S-8 / S-13 / S-14）只有执行义务尚未机器化。
- 第二轮再核查发现的 RC-01..04 四项新风险已落入 contracts §3.5..§3.8 + acceptance §8 硬门槛。
- IR-01..03（session 与 pause 生命周期）已落入 contracts §3.9 + acceptance §8.1；T04/T10 审查者轮换落入 dev §5；IP-01..05（阶段顺序与分母）落入 dev §1 序言 + acceptance §9 preamble。
- **结论——第二轮文档方向可继续接受独立审查；T01..10 不再走 T00 双轨分叉，线性前置 PX-6 后才进入 RKM-0 实施；但 RKM-0..5 仍为 `NOT_IMPLEMENTED`，不得据此自动放行代码开发。**

---

## 1. 载荷一致性：18 项 SHA-256 与权威源对账

### 1.1 计算结果

```text
18 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：18 项 SHA-256 一一相等（0 mismatch）。
文件数：19（18 载荷 + 1 manifest），无子目录。
```

### 1.2 抽样核对（关键文件）

| 文件 | 平铺 SHA-256（包内） | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-prd.md` | `eee9927c505d13bcd69252d4a5d76fa66aa476ff607052a83c7211ec7d4d76ea` | 同 | ✓ |
| `03-development-plan.md` | `79abb5c2659509d597a0f6cf043b1b09cd86154276675b7e35c31edef07cc41e` | 同 | ✓ |
| `04-acceptance-plan.md` | `a9670568dedca006fe4f7968ae47f80eb86460c497ee3eb9e63cfc83190be9e4` | 同 | ✓ |
| `v2-real-knowledge-maintenance-architecture.md` | `8d11d852e5c98167896878ec9462e49c0d1194bc873ca9a2891fec5f52fd6e72` | 同 | ✓ |
| `v2-real-knowledge-maintenance-contracts.md` | `ef824a5723c365650a98e044d18f1629e6c799bf2062980e528e8168719323d6` | 同 | ✓ |
| `v2-real-knowledge-maintenance-development-plan.md` | `579f3ec2c9faba38a928af88ff3804aac7c5b269b5eae0d77c9b3d7b5a990db2` | 同 | ✓ |
| `v2-real-knowledge-maintenance-acceptance-plan.md` | `572450cd80da36f8a6c83522afb48c327852047d908b7502c8140f1d2091a956` | 同 | ✓ |
| `v2-real-knowledge-maintenance-risk-adr.md` | `e1f53f8eafd8d00d9e31f71e3607a0752fddd9e56608c4be2c2179b9aeef4701` | 同 | ✓ |
| `v2-real-knowledge-maintenance.md` | `4520f5a6eb14ac74770b0ac264c5aab75aacc66fcc8aaa8b6fc8d54e84aab4a1` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap.drawio` | `48dc57d030e36d1d254eb5406291bcdd8ee2edcb1d8738cdfa59d7033d70661c` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap-preview.html` | `b85cda060a1bd4f7251019b32516d14f97a71755156dc656eee45faf2b0be09c` | 同 | ✓ |
| `v2-real-knowledge-maintenance-readiness-audit.md` | `f737fb9d66194426b7473bf21b7d62dd7da5b4a701a4eee93b9d5a458fcd847f` | 同 | ✓ |
| `v2-external-brain-productization.md` | `676a10d265c1a2ba501fc34f45374c2ddb02ee05c5e659b4b0194f2cc9a730e7` | 同 | ✓ |
| `v2-px-5-repair-execution-contract.md` | `852d9fd41283d7e4c754544933bb2c0fcbb7198df865e14010d3b19ad38642a0` | 同 | ✓ |
| `rkm-doc-review-remediation-2026-09-10.md` | `2aa40ca82b7a8a3d71da681edde61e1307ec05895982d18a5e6778324aeeaad4` | 同 | ✓ |
| `rkm-staged-implementation-review-2026-09-10.md` | `321eb328ce7fb2495f3f82c265223a9caa6fe6bea04f8fa489f76445d49d8113` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap.md` | `e06df7591def5a8d9c4a1292a5d0a975576efbcf84a16649f7f519f40767da6c` | 同 | ✓ |

旧外部审查 `rkm-doc-readiness-review-2026-09-10.md` 原文未变（SHA-256 `61b367e27206d982f76e0c68a03c213d8c2af79031129af57b825f668db9e766`，在 `docs/active/project/evidence/v2_real_knowledge_maintenance/`，未被本包覆盖）。

### 与上一轮的差异（与 9-09 包对照）

| 类别 | 上一轮（19 载荷） | 本轮（18 载荷） | 变化 |
|---|---|---|---|
| 移除 | `r1-backend-closure-audit-2026-09-09.md` | — | 不再纳入本审计包（位置不变，未删除） |
| 新增 | — | `rkm-doc-review-remediation-2026-09-10.md` | 16 项 S-处置记录 |
| 新增 | — | `rkm-staged-implementation-review-2026-09-10.md` | T01..10 / AC01..10 计划复核 |
| 修改 | 旧 01-prd.md/02-arch/03-dev/04-acc | 重写 | 顶部块重写（"本轮修订时间"+"复审补强"摘要） |
| 修改 | 旧 RKM 5 份 | 增 §3.3..3.9 / §5/§6 / §6/§7/§8/§9 | 实质性扩展（见 §2） |

---

## 2. 文档实质性变更与"本轮自报数"

### 2.1 已新增或重写的章节

| 文件 | 新增节 | 摘要 |
|---|---|---|
| contracts | §3.3 客户端认证与关闭状态矩阵（S-1/S-11） | 7 行矩阵覆盖 Side Panel↔Runtime / Runtime↔DS / DS↔模型三向；明确 E10 仅 loopback 数值地址 + 端口，DS 必须 `DATA_SERVICE_REQUIRE_API_KEY=1`；拒绝 userinfo / redirect / 环境代理 |
| contracts | §3.4 撤销中止与共享支持关系（S-9/S-10） | 引入 `aborting / aborted` 操作 phase；旧 build cancel/resume 按钮不共享；新增 `SharedSupportVerification` 替代"KnowledgeSource.sharing.outbound"；公共API/原始span复验before/after |
| contracts | §3.5 维护运行与调度的封闭决策（RC-01） | 8 行状态转移表 queued/running/paused/completed/degraded/failed；每 workspace 单活动 run；daily IANA 时区持久化；错过不补跑 |
| contracts | §3.6 已完成对话的可靠交接（RC-02） | E07 在 SQLiteSessionStore 内拟新增 `messageSequence` + `memory_turn_outbox`；事务边界明确；3 个崩溃点全部列出 |
| contracts | §3.7 控制面可用性与重新授权（RC-03） | 已认证本地控制面仍可关闭/撤销；DS 离线不阻止本地持久化；新增 `ConsentDecisionSlot` 原子 CAS，POST 带 expectedDecisions |
| contracts | §3.8 永久遗忘优先于恢复（RC-04） | tombstone 优先；RestoreRecord 409 / INVALID_TRANSITION / revision_conflict；备份缺删除账本拒绝开放 |
| contracts | §3.9 维护暂停的独立执行屏障（IR-02/03） | runExecution epoch + DS pauseAck；普通 pause 不撤销 CloudConsent，不递增 workspaceGeneration；pauseAck{runId,blockedThroughEpoch,...} |
| acceptance | §6.1..§6.5 | 5 个独立证据合同补强节，逐节绑定 S-1..S-11 之一 |
| acceptance | §7 S→E 反向索引 | 14 行表格（S01..S14 各 1 行满足该场景的实体），与 dev/gap 中心表对齐 |
| acceptance | §8 RC-01..04 硬门槛 | 5 行表（RC-01a/b、RC-02a/b、RC-03、RC-04），每行绑定首次实际验收阶段 |
| acceptance | §8.1 IR-01..03 强制断言 | 3 行表，绑 T05/T06 转 D01..06 正负合同 |
| acceptance | §9 逐阶段执行卡（AC01..10） | 10 行表，每行含用户操作 / 必需产物 / 出门条件 / 不通过处理 |
| acceptance | §9.1 / §9.2 | 共同证据封存 / 待复核结论（REQ13 后台焦点 S13-A） |
| dev | §5 第二轮复审执行交接要求 | T04/T10 审查者轮换 + 绑定 snapshot+session；T06 限定 protocol-only；PX/RKM 证据目录物理分离 |
| dev | §6 T01..10 详细工作包 | T05 D01..09 表格（9 行）；T06 真实 DS protocol-only；T07..T10 引用 §9 AC 卡 |
| risk-adr | "本轮独立审查补充决策" 节 + RC-01..04 + DS-1/2/3 取舍 | 4 项 RC 决策表 + 不能消除的执行不确定性 |
| gap.md | "相比原 PX 图的非退化检查" + RC / IR 映射 | IR-01..03 + RC-01..04 与图页 / 实体 / 阶段 / 场景的明确映射 |
| gap.drawio | 第 4 页：rkm4_r4 文件读取 + rkm4_r5 云处理 + rkm4_r6 会话记忆 + rkm4_r7 三类同意独立 | S-12 "三类同意横向对照" 落地（页内 subtitle 显式说明） |

### 2.2 重写或强化的顶部声明

- `01-prd.md` 顶部块添加"本轮多轮独立审查与风险再核查补充"声明，明确 REQ05 完整回答率 / 固定 6 道跨来源题 / REQ13 后台焦点 S13-A / 阶段必需分母事前冻结 / 维护重启双段门槛。
- `03-development-plan.md` 顶部块改写："修订：2026-09-10。当前仅文档阶段，所有未来实现均需用户批准。主线：R1前端/Chrome -> R2采集 -> R3共享校验 -> R4快照复验 -> PX-6人工 -> RKM-0..5；不得因新目标而绕开旧Major。T01..T04完全属于原PX修复，T05..T10才是RKM增量；T04出门在T05实施之前，不是从T00分叉的两条并行实施线。"——**直接回应我上一轮 S-16 "T00 双轨分叉" 问题**。
- `04-acceptance-plan.md` 顶部块补强："RKM验收8.1增加IR-01..03，9增加AC01..10。必需断言分母事前冻结，failed/pending/deferred不能缩分母"。
- `v2-real-knowledge-maintenance-architecture.md` 顶部声明未变更（仍是"设计输入，未批准代码开发"）。
- `v2-real-knowledge-maintenance-risk-adr.md` 顶部块新增"本轮独立审查的补充决策"+"2026-09-10 再核查决定与技术代价"两节。
- `v2-real-knowledge-maintenance.md` stage gate 顶部声明未变更（"当前阶段：文档设计；用户批准文档落盘，不构成代码、迁移、云调用或永久删除批准"）。

### 2.3 Draw.io 第 4 页修订

| 页 | vertex / 边（修订前） | vertex / 边（修订后） | 备注 |
|---|---|---|---|
| 全 8 页 | 104 / 55 | 104 / 56 | 仅第 4 页由 6 边改 7 边（新增"三类同意独立"汇入 authorizationContext 边），其它页几何未变 |
| 第 4 页 subtitle（修订前） | "路由、会话认证与状态权威" | 同 + "三类同意横向对照｜身份认证不等于资料处理同意｜当前文档目标，不代表DS协议已实现" | S-12 落地 |
| 第 4 页新增顶点 | — | rkm4_r4（文件读取）、rkm4_r5（云处理）、rkm4_r6（会话记忆）、rkm4_r7（三类同意独立） | 与 §3.7 ConsentDecisionSlot 对应 |
| 第 4 页 rkm4_subtitle | — | "三类同意横向对照｜身份认证不等于资料处理同意｜当前文档目标，不代表DS协议已实现" | 拒绝读者把协议描述误认为已实现 |

---

## 3. 用户要求的 5 条审查重点逐条评估

### 3.1 跨仓协议可实现性

**判定**：设计层面可实现，但 6 项要求真实 DS 协议支持，RKM-1 spike 是硬门槛。

| 协议 | 设计来源 | 实现前置 | RKM-1 必须验证 |
|---|---|---|---|
| §3.3 客户端认证矩阵 | contracts §3.3 | Side Panel↔Runtime 用精确 Origin + Bearer；Runtime↔DS 用 X-API-Key | 真实 HTTP：错 key / 匿名 / dev bypass / redirect / URL 注入拒绝；不能仅看 env vars |
| §3.4 aborting/aborted | contracts §3.4 | E12 KnowledgeOperationRecord.phase 增 aborting/aborted；DS 拒绝 + ack | DS 是否真实提供 generation/ack；abortCause（auth_revoked / run_paused）两个独立屏障 |
| §3.5 维护状态机 | contracts §3.5 | E12 唯一活动 run；调度键 policyId + 当地日期；DST 重复/缺失；pause 期间不允许新提交 | 真实 SQLite 事务唯一性；多 Runtime 写同库是否被拒 |
| §3.6 memory_turn_outbox | contracts §3.6 | E07 SQLiteSessionStore 内新增 messageSequence + memory_turn_outbox；服务端 sequence/epoch | Chat 公开合同是否需改；3 个崩溃点恢复；E12 唯一键 (sessionId, turnId) |
| §3.7 ConsentDecisionSlot | contracts §3.7 | E12 新表 / 字段；key=(workspaceId, scopeType, scopeId, providerId, purpose)；expectedDecisions 原子 CAS | 跨 workspace key 隔离；同 key 并发替代；scope 改动必须新对象 |
| §3.8 永久 Forget 级联 | contracts §3.8 | SummaryRevision、OrganizationProposal、RestoreRecord 进入级联；SharedSupportVerification 公共 API 复验 | DS 是否真实返回 before/after；备份缺删除账本是否被拒开放 |

**关键顾虑**：上述 6 项均依赖"DS 必须公开以下能力"——`Idempotency-Key 持久校验`、`按 key 查询提交结果`、`generation / ack 屏障`、`tombstone 级联`、`SharedSupportVerification API`、`DELETE with backup inventory`。**当前 DS 状态（README 顶部"data_service 已有能力不等于 Navia 集成成功"）并未承诺全部支持**。

**contracts §3 末尾明确**：❝API snapshot 逐字段对应后才能冻结实际路由/版本，当前不能伪称候选接口均已存在❞。❝RKM-1 必须实测匿名/错 key 拒绝，不能只看环境变量❞。❝RKM-1 必须验证 DS 排队/重试/发送屏障的真实能力；无法实现则阻塞接入❞。

**结论**：跨仓协议在设计层面闭环且可实现，但 RKM-1 是绝对阻塞关。任何一项能力缺失必须返回 D02/D03/D06 修订 + 合同门禁，**不擅自降为 capability 枚举或 Mock fallback**。

### 3.2 阶段依赖

**判定**：已纠正上一轮 S-16 的"双轨分叉"问题。线性前置：T01..T04 → PX-6 → T05..T10。

| 检查 | 结果 |
|---|---|
| RKM 序列自身 | T05 → T06 → T07 → T08 → T09 → T10 单向 ✓ |
| PX 序列 | T01 → T02 → T03 → T04 单向 ✓；T04 PX-6 出门后才到 T05 ✓ |
| 跨序列 | T04 与 T10 是双门槛不是环路；dev §5 强制审查者轮换；evidence 目录物理分离（PX 在 `v2_external_brain_productization/`、RKM 在 `v2_real_knowledge_maintenance/runs/\|spikes/\|contract-fixtures/\|documentation/`）✓ |
| T07 不验未来能力 | dev §1 + acceptance §9 preamble + AC07 / AC08 / AC09 明示：T07 不验 S08-B-product / S10 / S11；T07 仅 S01..09 适用集合 ✓ |
| 失败状态 | dev §5 / acceptance §9 preamble："每阶段 requiredAssertionIds 和分母在执行前冻结，必需项 failed/pending/deferred 均阻止本阶段通过；只有预先列入后续阶段的项目才标 not_applicable 并不进分母" ✓ |
| deferred 防滥用 | 强制负例："把一个本阶段必需失败项改成 deferred 并伪改 summary，校验器必须同时拒绝集合变化与阶段通过" ✓ |
| 完成声明边界 | dev §6 T10 + risk-adr §3："最终只声明冻结语料与授权范围内的真实知识服务、指定对话记忆及可逆维护，不扩大到全能外脑、自动永久删除、Docker 或 V3" ✓ |

**残留问题**：

1. **E07 事务/outbox 与公开合同冲突**：`contracts §3.6` "若无法在不改公开 Chat 合同的范围实现，返回合同审查，不假定普通'提交后回调'可以保证不丢任务"。`dev §5 T05`：❝T05 若发现现有 Chat 事务/错误合同无法容纳设计，必须先回合同门禁，不在 T08 临时扩 A/C/D 事件❞。这是正确的 fail-fast，但**没有给出"现有 Chat 事务 / 错误合同无法容纳" 的判定标准**。建议 RKM-0 阶段把判定标准显式落盘：D04 ADR 必须先列出兼容 / 不兼容两条路径的可证伪条件。

2. **T06 protocol-only 与 T07 E12 实现的衔接**：❝T06 保留真实 DS 公共 HTTP 的来源过滤、撤销屏障、幂等、删除/共享贡献 before/after 测试，不降为只读 capability 枚举。服务级 S09 至少验证 A/B 共同支持、删除 A 后的真实读回与 DS 重启；不要求尚未开发的 Navia E12 生产恢复、UI 双容器或完整用户 S09❞。但 T07 仍必须"实现控制面与基础备份删除账本屏障"——这两者之间的过渡若 T06 spike 显示 DS 仅支持 workspace 撤销、不支持维护 run 级暂停，T07 的"控制面与基础备份删除账本屏障"可能不可达。**dev §5/§6 已要求返回 T05 合同复审，但缺"如何把 DS 能力反向拆解到 E11/E12/E19 适配层"的判断模板**。建议 RKM-0 增加"DS 能力缺失时 E11/E12/E19 适配层补齐 vs 缩减范围"的成本对比表。

### 3.3 授权与暂停生命周期

**判定**：第二轮回退把 4 项已合并为 §3.5..§3.8 + §3.9，但暂停与撤销仍然属于不同生命周期。

#### 3.3.1 三层生命周期

```text
CloudConsent / MemoryConsent / MaintenancePolicy
   ↓ PUT desiredState=revoked
local state=revoking → generation 递增
   ↓ DS ack 屏障
state=revoked
   ↓
如未 ack：保持 revoking
   ↓ 恢复
必须先对账所有 pending 撤销，再允许新外发
```

- §3.2 撤销协议（4 步）：
  1. Navia 本地事务递增 workspaceGeneration、置 state=revoking、禁止新本地读取/派发/结果应用
  2. 公共 HTTP 通知 DS；DS 持久化拒绝代际，独立 dispatch 协调锁阻止排队 / 后续派发 / 重试
  3. dispatch 开始事件与 DS 撤销屏障串行化：屏障前已发送列入 inFlightRequestIds（返回不得应用），屏障后禁止开始新发送
  4. DS 返回 revocationAck{generation, appliedAt, lastDispatchSequence, inFlightRequestIds} → state=revoked；DS 离线 / 超时保持 revoking

- §3.7 重新授权（RC-03 / IR-01）：引入 `ConsentDecisionSlot` 原子 CAS。POST 必须带 expectedDecisions；首次空槽用 revision=0、id=null；替代旧拒绝时必须同 key 且旧撤销 ack 已完成。新 grant / slot 更新在一个 E12 事务 CAS，任一 key 冲突则整体 409 / revision_conflict、零创建。**这是一个比 §3.2 更精细的设计**——之前 R1 仅以 `granted/revoked` 二元状态，§3.7 引入 slot 决策版本，避免"历史 deny 永久挡新 grant"问题。

- §3.9 维护暂停的独立执行屏障（IR-02/03）：**关键澄清——普通 pause 与授权撤销属于不同生命周期**：
  - 普通 pause 不撤销 CloudConsent / Policy，不递增整个 workspaceGeneration，也不阻止无关 Ask。
  - 维护 context 必须带 runExecution，E12 初始 executionEpoch=1。
  - pause 或 Runtime 恢复未终结 run 时：本地持久 paused / pauseState=pending → 公共 HTTP 请求 DS 阻断 (runId, executionEpoch) → E17/E19 在该 run 的 dispatch 及写回资格处持久屏障 → 回 pauseAck{runId, blockedThroughEpoch, appliedAt, lastDispatchSequence, inFlightRequestIds}。
  - 普通 pause 与 Consent 撤销的屏障"不得混为同一个 workspace 停机行为"。
  - 屏障前已经真实提交的结果只能对账，不能假装从未发生。

#### 3.3.2 残留问题

1. **§3.9 与 §3.2 共用 inFlightRequestIds 但字段语义略有差异**——§3.2 用于跨服务撤销、§3.9 用于 run 级 pause。文档未显式声明两者是同一基础设施 / 不同协议实例。**这是潜在的工程重复**，建议 RKM-0 把"DS dispatch 屏障与 ack 协议"统一到一个公共接口描述（如 D03 协议 §8）。

2. **pauseAck 在 DS 离线下应如何表现**：§3.9 "DS 离线保持'本地暂停，服务端待确认'，不显示完全暂停"。但 §3.2 §4 步要求 DS 返回 revocationAck 后才能 state=revoked，否则保持 revoking。两者语义一致但描述细节不同（"本地暂停" vs "本地 revoking"），需在 RKM-0 D03 协议中统一字段命名。

3. **重启未终结 run 的本地暂停 vs 远端确认**：❝DS 仍运行时可能在收到暂停通知前发送旧队列，必须登记为屏障前事件，不能承诺重启瞬间远程停发❞——这条与"本地暂停立即生效"是冲突的，需要在 UI 状态文本上明确区分"本地 paused"与"远端 pending"。

### 3.4 是否仍存在缩小分母或证据假绿

**判定**：第二回合补强非常强，但仍有 4 个潜在灰色地带需 RKM-0 显式关闭。

| 防线 | 文本 | 评级 |
|---|---|---|
| 必需分母冻结 | dev §1 + acceptance §9 preamble："每阶段 requiredAssertionIds 和分母在执行前冻结，必需项 failed/pending/deferred 均阻止本阶段通过" | 强 ✓ |
| failed 不能转 deferred | acceptance §9 preamble："强制负例：把一个本阶段必需失败项改成 deferred 并伪改 summary，校验器必须同时拒绝集合变化与阶段通过" | 强 ✓ |
| T07 不前移未来 | dev §6 T07："S08-B-protocol 先在 T06 验证，T07 只读已存在 retention 状态，产品隔离 / restore 的 S08-B-product 属于 T09，不能前移为 T07 出门条件" | 强 ✓ |
| 完整回答率独立阈值 | 01-prd.md REQ05："完整回答率>=0.9，固定六道跨来源题 6/6 实质使用双方必要证据，不只验证检索命中" | 强 ✓ |
| 后台焦点独立断言 | 01-prd.md REQ13 + acceptance §9.2："REQ13 增加用户输入时后台维护完成/失败不抢焦点 S13-A"；"测试器不能先替应用 restore 焦点再截图" | 强 ✓ |
| 历史 PNG 防复用 | acceptance §6.3："历史 PNG 哈希相同只能触发来源复查，不能作为唯一拒绝依据：静态页面两次真实截图可能完全相同。必须拒绝'把旧 PNG/旧捕获记录改名移入新 run'或文档/合成图冒充产品 capture；也必须有'本次真实捕获与旧 PNG 恰好同 hash 仍通过新鲜度检查'的正例" | 强 ✓——直接回应上一轮 S-3 |
| 证据目录物理隔离 | acceptance §6.3："PX 证据仅在 evidence/v2_external_brain_productization/；RKM 生产证据固定 evidence/v2_real_knowledge_maintenance/runs/<runId>/" | 强 ✓——直接回应上一轮 S-8 |
| gold 不可自证 | acceptance §6.4："signoffHash 不含自身或 reviewRecordArtifact，避免自引用。hash 只绑定内容、不证明审查者身份；身份/独立性另从审查记录核验，不能由生成器代签" | 强 ✓ |
| 图谱事实边界 | acceptance §6.4："S06 按 Runtime/DS 图谱原始响应重建允许的 node/edge 语义集合；展示可以过滤，不能新增事实节点/关系或删除 provenance 后仍称事实" | 强 ✓ |
| AST 数据流 | acceptance §6.4："G4 扫描冻结的前端入口/knowledge_workspace 源码，以 AST 数据流和模块边界验证图数据只经 runtimeClient 进入；变量名 mockGraphNodes/seedGraph 不是封闭识别规则。负例在原始源码中注入不同命名的静态图、动态拼装关系或替换服务端边，同步源码 hash 并保持 report=0 仍必须被 AST 或上述运行期集合对照拒绝" | 强 ✓——直接回应上一轮 S-5 |

**残留问题（4 个灰色地带）**：

1. **负例集合 vs 补漏**：acceptance §6.4 提到"原始源码中注入不同命名的静态图"——但 G4 的 allowlist 是否能阻止合法的图布局调整（如不同 LOD 等级的聚合）误判为造边？建议 RKM-0 增补："合法布局变化 / 有 provenance 的服务端图 应通过"的对照 fixture，与造边负例配对。

2. **gold manifest 真实签名机制**：acceptance §6.4 只说"独立审查者先审、decision=approved 并冻结原始字节后才允许执行"，但 gold 变更必须新版本重跑受影响题目——**没有定义"谁有权批准 gold 版本"**。建议 RKM-0 在 D08 增补 `goldVersionApproval` 流程：≥ 2 名审查者签字（不是 1 名）+ 生成者不能自我签字。

3. **DS 能力缺失下的退路**：当 RKM-1 spike 显示 DS 不支持 §3.5..§3.8 任一协议时，文档要求"返回 T05 合同复审"（dev §5）。但**没有定义"DS 能力清单的最小可接受子集"**——若 DS 仅能 80% 满足，T05 是按 100% 重做合同、还是按 80% 缩减 RKM 范围？建议 RKM-0 增补"DS 能力矩阵"：列出每条 §3.x 协议对应的能力，并标记"必需 / 可降级 / 阻塞 RKM-1"。

4. **跨阶段分母混入**：T07 24 来源 vs T08 新增 memory 来源单独统计（dev §6 T08："新增 memory 来源单独统计，不替换 T07 的 24 来源分母"）✓——这一条已经写明。但 T09 维护 run 的 taskResults 与 T07 的 source/operation 分母是否混用？acceptance §6.2 提到"DS dispatch 关联"——若 E15 UsageLedger 把 dispatch 与 source 操作混在一张表，T07/T09 难以分阶段统计。建议 RKM-0 在 D05 明确分阶段分桶结构。

### 3.5 现有 Mock / 候选 DS 是否被错误标为"已实现"

**判定**：无明显错标。但仍有两处表述需 RKM-0 显式收紧。

| 表述 | 当前文本 | 评级 |
|---|---|---|
| RKM stage gate | "RKM生产实体、真实Adapter、持久知识、对话记忆、维护和新验收工具未开发。data_service已有能力不等于Navia集成成功。" | ✓ |
| RKM architecture §1 | "data_service 本地代码参考提交 `71279fdb8da99ee1ca31e840662d49b1564ab28f`，旧 spike 的 `fa8f8377...` 不作为新接口锁定。该仓有其他文档修改，禁止覆盖。API 源码 `backend/app/api/v1/data_service.py` 和 `backend/data_service/mcp_source_tools.py` 的 remove 路径主要标记 removed，不等于索引、快照和派生事实已清除。" | 强 ✓——直接对应 RC-04 / S-9 |
| RKM dev §3 | "候选模型/服务版本锁定失败则停止真实接入，不退回mock通过。" | ✓ |
| RKM dev §5 / §6 T06 | "T06 使用独立 navia-rkm-spike-<runId> namespace 和授权公共项目样本副本，不迁移旧 Mock、不访问现有私人 workspace 或 R1 证据数据；清理仅限本run 创建对象，保留日志/hash。" | 强 ✓ |
| RKM acceptance §5 RKM-1 | "RKM-1 以隔离接口 spike 工具验证 DS 协议，不前移完整 E12 产品持久化；若协议必须依赖 Navia 生产事务才可验证，则返回 RKM-0 调整阶段，不静默提前实现 RKM-2。" | ✓ |

**残留问题（2 处需 RKM-0 显式收紧）**：

1. **§3.6 "E07 在现有 SQLiteSessionStore 内拟新增..."**：拟新增是设计，不是已实现。但 RC-02 的可行性论证要求 RKM-0 阶段"先读现有 Chat 内部事务路径证明不改变 A/C/D 公开事件，兼容性不能证明则停止冻结"。建议 D04 ADR 必须附 `services/local-runtime/navia_runtime/stores.py` 当前 SQLiteSessionStore 写路径的完整 list，证明 `memory_turn_outbox` 与 messageSequence 不破坏现有 message 持久化的失败语义。

2. **§3.5 "daily 默认 02:00 本机时区"**：用户首次创建 Policy 时"读取本机时区并回显"。但 Runtime 跨设备部署或跨用户使用时"本机时区"语义模糊。建议 RKM-0 把 `daily localTime` 的"本机时区"明确为"Policy 所有者用户配置文件中声明的 IANA 时区"，不是部署机时区。

---

## 4. 上一轮 16 项 S-问题处置对账

| S-# | 上一轮问题 | 本轮处置位置 | 状态 |
|---|---|---|---|
| S-1 | 新路由 token 未配置时认证矩阵 | contracts §3.3 + acceptance §6.1 S01-A | ✓ 已落盘设计 |
| S-2 | UsageLedger 漏记 | acceptance §6.2 + IR 实际验收 | ✓ 已落盘设计 |
| S-3 | S13 截图防复用 | acceptance §6.3（响应"历史 PNG 同 hash 仍可通过新鲜度检查"） | ✓ 已落盘设计 |
| S-4 | gold reviewer 签字 | acceptance §6.4 goldManifest 字段 + signoffHash | ✓ 已落盘设计 |
| S-5 | 前端造边 AST | acceptance §6.4 G4 AST 数据流 | ✓ 已落盘设计 |
| S-6 | S08-C..F 四态撤销 fixture | acceptance §6.5 revocationTimePoint 固定 + 隔离 spike hook | ✓ 已落盘设计 |
| S-7 | S09 宿主原件/聊天不删除 | acceptance §6.5 before/after SHA-256 + mtime_ns + 写入事件 | ✓ 已落盘设计 |
| S-8 | T04/T10 evidence 目录隔离 | acceptance §6.3 + dev §5 "证据目录物理分离" | ✓ 已落盘设计 |
| S-9 | aborting 状态 | contracts §3.4 aborting/aborted + §3.9 runExecution epoch | ✓ 已落盘设计 |
| S-10 | 共享支持字段 | contracts §3.4 SharedSupportVerification（替代 sharing.outbound） | ✓ 已落盘设计 |
| S-11 | DS 客户端认证矩阵 | contracts §3.3 X-API-Key + DATA_SERVICE_REQUIRE_API_KEY | ✓ 已落盘设计 |
| S-12 | 三类同意对比图 | gap.drawio 第 4 页 subtitle + rkm4_r4..rkm4_r7 四个顶点 | ✓ 已落盘设计 |
| S-13 | T04/T10 复审者轮换 | dev §5 审查者轮换 + reviewSessionId + reviewedSnapshotHash | ✓ 已落盘设计 |
| S-14 | RKM-1 S09 边界 | dev §6 T06 "protocol-only" + dev §5 T06 限制 | ✓ 已落盘设计 |
| S-15 | architecture / acceptance-plan 增 S↔E 反向表 | acceptance §7 S→E 反向索引（14 行） | ✓ 已落盘设计 |
| S-16 | T02 误读属 PX-5 / T04 必须先于 T05 | dev §1 顶部块改写："T01..T04 完全属于原PX修复，T05..T10才是RKM增量；T04出门在T05实施之前，不是从T00分叉的两条并行实施线。" | ✓ 已落盘设计——直接回应我上一轮 S-16 |

**全部 16 项 S-问题已落盘到具体设计节 / 后续验证义务**。剩余 4 个灰色地带与 2 个 Mock/DS 表述收紧在 §3.4/§3.5 中列出。

---

## 5. 第二轮新发现的 RC-01..04 与 IR-01..03 处置对账

| RC/IR | 来源 | 处置位置 | 验证义务 |
|---|---|---|---|
| RC-01 | 维护终态/不补跑 | contracts §3.5 + acceptance §8 RC-01a/b + dev §6 T09 | 状态机 Schema、调度唯一键、真实交互 |
| RC-02 | 事务 outbox / 授权 epoch | contracts §3.6 + acceptance §8 RC-02a/b + dev §6 T08 | 现有 Chat 事务API兼容性、3 个崩溃点 |
| RC-03 | 离线控制面 | contracts §3.7 + acceptance §8 RC-03 + dev §5 | 持久 ack 与恢复先对账，不能仅凭矩阵 PASS |
| RC-04 | Forget 优先于 restore | contracts §3.8 + acceptance §8 RC-04 + dev §6 T09 | 服务公开 API + 备份原始材料的清理/重启 |
| IR-01 | 同scope 重授权 | contracts §3.7 ConsentDecisionSlot + acceptance §8.1 IR-01 | RKM-1 协议；RKM-2 控制面 |
| IR-02 | 普通 pause | contracts §3.9 runExecution epoch + acceptance §8.1 IR-02 | RKM-1 协议；RKM-4 维护 UI |
| IR-03 | 旧 run 释放 | contracts §3.5 / §3.9 + acceptance §8.1 IR-03 | RKM-1 屏障能力；RKM-4 完整任务槽 |

---

## 6. 第三轮独立复审必要性

`rkm-doc-review-remediation-2026-09-10.md §5/§6` 与 `rkm-staged-implementation-review-2026-09-10.md §7` 明确：

> 没有新独立 Agent 对本轮变更作出通过签署，仍需用户转交复审。实际 S01..14、机器 fixture 与 DS spike 不在上述"通过"范围。

> 本轮审查者是两个独立上下文的代理 session，不是 ClaudeCode CLI；没有冒充第三方已签署通过。

**当前 session 是第三位独立审查者**。本轮复审与前两轮的差异：

- 上一轮 S-1..S-16（16 项）：本轮已全部落盘（见 §4 对账）。
- 本轮 RC-01..04 与 IR-01..03（共 7 项）：本轮已落盘（见 §5 对账）。
- 当前残留 4 + 2 项灰色地带（§3.4/§3.5）：均在 RKM-0 阶段 D02/D03/D04/D05/D06 范畴。

第三轮独立复审的边际收益：

- 16 + 7 = 23 项处置的逐项接受 / 拒绝
- 4 + 2 = 6 项灰色地带的处置决定
- D01..09 中每条是否能形成独立 requirement / rule / base / mutation / expected-failure 映射

---

## 7. 是否可批准进入 RKM-0 实施？

**结论：可批准 RKM-0 阶段文档进入 D01..09 冻结工作包；但不批准 RKM-0 之后的代码开发。**

理由：

- 18 项载荷 SHA-256 一致；旧审查原文保留。
- 两份 Draw.io 结构完整、ID 唯一、边界合规；图 04 显式承接 S-12。
- 上一轮 S-1..S-16 + 第二轮 RC-01..04 + IR-01..03 共 23 项已落盘到具体设计节。
- 跨仓协议在设计层面闭环且可实现，RKM-1 spike 是硬门槛；DS 能力缺失需返回合同复审。
- 阶段序列线性前置（PX-6 → T05..T10）；T04/T10 审查者轮换；evidence 目录物理分离。
- 假绿拒绝能力强于上一轮；多个 fixture / detector 维度需 RKM-0 补齐。
- 无过度承诺；所有"待交付"、"NOT_IMPLEMENTED"边界清晰。

**不建议现在批准**：

- 任何 RKM-0 之后的实际代码开发。
- 跑旧 PX 生产 validator / 报告生成器。
- 进入 R2/R3/R4/PX-6/RKM-0..5 任一实施阶段。
- 假设 RKM-1 spike 必显示 DS 支持 §3.5..§3.8 全部协议。

**下一步建议**：

1. 用户决定是否接受 §3.4 列出的 4 项灰色地带与 §3.5 列出的 2 项表述收紧作为 RKM-0 D01..09 冻结的预审补强项。
2. RKM-0 阶段必须先产出 D04 ADR（事务迁移）+ D02 OpenAPI + D03 双仓 API 差异；不可跳过。
3. RKM-0 阶段开始前必须冻结 D06 规则注册表骨架：S01..14、S-1..16、RC-01..04、IR-01..03 共 36 项断言的唯一 requirement / rule / base / mutation / expected-failure 映射。
4. RKM-1 spike 必须实测：a) 匿名 / 错 key / redirect / URL 注入真实拒绝；b) §3.7 ConsentDecisionSlot CAS 真实原子性；c) §3.9 pauseAck 在 DS 离线 / 已排队 / 重试前三种时点的真实行为。任一项缺失 → 阻塞 RKM-1 → 不进入 T07。

## 8. 工作约束

- 本轮复审仅做只读静态分析 + 独立 SHA-256 重算 + Draw.io XML 结构解析 + 节点文本抽样。
- 没有运行报告生成器、生产 validator、pytest、浏览器或 Runtime。
- 没有修改主工作树、没有 commit、没有 push。
- 仅读主 README（顶部添加 RKM 工作状态说明）+ docs/active/project/README（添加独立审查归档节）已被用户修改；本轮审计未触发新的 tracked diff。