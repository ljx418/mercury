# V2-RKM 文档方向与风险审查（第二轮独立复审）

日期：2026-09-10。审查者：当前 session（独立只读静态）。审查对象：`docs/active/project/external-audit-package/` 平铺 20 文件（含 `AUDIT_MANIFEST.md`）。
本次复审依据用户提问的 5 条审查重点：MD 与 Draw.io 是否一致、双仓权限与撤销协议是否可实现、阶段是否存在循环依赖、验收能否拒绝假绿、是否过度承诺。

---

## 0. 摘要

- 19 项载荷 SHA-256 全部匹配权威源，`v2-memory-personal-knowledge-base-gap.drawio` 经哈希与权威源三重核对一致（详见 §1）。
- 两份 Draw.io 各 8 页、ID 唯一、边引用闭合、图元全部在页边界内；新图 104 vertex / 55 边与审计自报数对账一致。
- MD 与 Draw.io 实体 / 阶段 / 生命周期一致；E01..20、S01..14 在 7 份 RKM 文档与总 PRD17.3 / 总架构 17.1 / 总开发计划 / 总验收计划四份总文档间可定位。
- 撤销协议在 contracts 3.2 / architecture §4 / acceptance S08-C..F / risk-adr D09 四份文档中描述一致；DS ack 屏障、inFlightRequestIds、workspaceGeneration、expectedRevision 是统一语义。
- 阶段序列 R1 frontend → R2 → R3 → R4 → PX-6 与 RKM-0 → RKM-1 → RKM-2 → RKM-3 → RKM-4 → RKM-5 是两条独立序列，没有循环依赖，但 T10 RKM-5 与 T04 PX-6 都需要人工签署并重跑全量复验。
- 假绿拒绝能力强：S00..14 每项含用户步骤 / 预期 / 阈值 / 失败证据；G4 保留负例字节变异规则；human pending 时 final=false；deferred 不计入 passed 分母。
- 无过度承诺：审计包自身明确"不是产品验收包"、"不得宣布全部自动化开发输入完备"、"已出站资料无法撤回保留"、"RKM-0 / RKM-1 待交付"。

**结论**：V2-RKM 文档方向可进入下一轮独立设计复审 / 独立 ChatGPT 审查；当前**不可批准**任何 RKM-0 之后的实际代码开发，原因与另一审查者给出的"4 项设计 Major"已闭环、未发现剩余 Fatal/Major"一致，但需以下次级问题关闭后批准 RKM-0 合同冻结。

---

## 1. 载荷一致性：19 项 SHA-256 重算与对账

```text
本地独立重算：19 项载荷哈希全部匹配 AUDIT_MANIFEST.md 中声明的哈希（diff exit 0）。
权威源 vs 平铺副本：19 项权威源 SHA-256 与平铺文件 SHA-256 一一相等（0 mismatch）。
文件数：20（19 载荷 + 1 manifest），无子目录。
```

复核细节：

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-prd.md` | `d14d8d6faa340934b7c56baa25c6468a262d979d56e137df6f8c2d15724da876` | 同 | ✓ |
| `02-architecture.md` | `bbdc17ba57477038efdbf0f91509a302ad63003aee370b9747d898041de427e3` | 同 | ✓ |
| `03-development-plan.md` | `6c597cfaa42197420e0e071a66a3c674da0d1687cb6811adf2d5c1959addb93e` | 同 | ✓ |
| `04-acceptance-plan.md` | `262157de5464ca4edb20809892250fe037513d04de0bcc932f6ca68983c06301` | 同 | ✓ |
| `v2-real-knowledge-maintenance-architecture.md` | `db188d6c7c9dabd0e9ba3362cc184ce1dc8ba57dc67855343877fe4a1f8a8807` | 同 | ✓ |
| `v2-real-knowledge-maintenance-contracts.md` | `4b3533e0c6fdfd2947e30250511b9018a304d5af31ad9a4de5db6920cad6f82d` | 同 | ✓ |
| `v2-real-knowledge-maintenance-development-plan.md` | `fea4e5a7046c67494cc1f086bd72ebdcd6ab7100e630587483bd56ca4656a5ad` | 同 | ✓ |
| `v2-real-knowledge-maintenance-acceptance-plan.md` | `a82926515c98e9a29b223405c624c638e84c6d0ff663c1947445d3a90cc354ce` | 同 | ✓ |
| `v2-real-knowledge-maintenance-risk-adr.md` | `f0a53c77bdc1a8b18cba787ef28ef05e224c145d7c8cc6f9d86350929615ccff` | 同 | ✓ |
| `v2-real-knowledge-maintenance.md` | `66be8811ef2617ba15470e10e23d4c630d3dc8e44f91e0cd90e8ffd274578f1c` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap.md` | `e51b78691157cfeac66f358323d870e7d307c408d9f02ba4a18c02a5e3014750` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap.drawio` | `180488aaff411eca8be6902f455e0fc1825eb8582b63476c50fdb47837c7b756` | 同 | ✓ |
| `v2-real-knowledge-maintenance-gap-preview.html` | `90fe42d140cdafe12f42e91b08768968c727722c4f7503bee86c821d71237a25` | 同 | ✓ |
| `v2-real-knowledge-maintenance-readiness-audit.md` | `9cd66dd95ac4ae1b1caf43f2db75b4e479816423b01ff4e7ffd7207e34c12c16` | 同 | ✓ |
| `v2-external-brain-productization.md` | `676a10d265c1a2ba501fc34f45374c2ddb02ee05c5e659b4b0194f2cc9a730e7` | 同 | ✓ |
| `v2-memory-personal-knowledge-base-gap.md` | `f651ee8ed5103127bbb591b487d63fac6554441d2cfea69c4afcb0721aa9769b` | 同 | ✓ |
| `v2-memory-personal-knowledge-base-gap.drawio` | `eb3a220fee85842771981f8ec9081f68f83c2c46d4a510800e2c0b6c480d93ae` | 同 | ✓ |
| `v2-px-5-repair-execution-contract.md` | `852d9fd41283d7e4c754544933bb2c0fcbb7198df865e14010d3b19ad38642a0` | 同 | ✓ |
| `r1-backend-closure-audit-2026-09-09.md` | `bfe21d25854cc47c7c4f3fd2d5a07493f9ac09b1959b86eadc56b2b170197db8` | 同 | ✓ |

**审计包完整性结论成立**：未发现静默替换、未发现缺失文件、未发现散落在 `external-audit-package/` 之外的相关文件被偷换。

---

## 2. MD 与 Draw.io 一致性

### 2.1 新旧 Draw.io 结构独立重算

| 项 | 新图（RKM） | 旧图（PX 历史） |
|---|---|---|
| 页数 | 8 | 8 |
| 总 vertex | 104（每页 13） | 112（旧图非均匀分布：15/17/14/18/13/13/11/11） |
| 总边 | 55（7+8+7+6+7+8+6+6） | 42（7+10+7+10+5+0+3+0） |
| 页边界内 vertex | 100% | 100% |
| ID 唯一性 | 0 重复 | 0 重复 |
| 边 source/target 缺失 | 0 | 0 |
| 页分辨率 | 1600×1000 | 1600×900（与 readiness-audit §35 一致） |

新图与 readiness-audit 自报"新图 1600×1000、104 vertex、55 边"完全一致；旧图自报"1600×900、112 vertex、42 边"也完全一致。

### 2.2 RKM-REQ / E01..20 / S01..14 跨文档覆盖

| 维度 | 总 PRD17.3 | 总架构 §17 | RKM architecture | RKM contracts | RKM development-plan | RKM acceptance-plan | RKM gap |
|---|---|---|---|---|---|---|---|
| RKM-REQ-01..14 | ✓ 14/14 | 引用 | 引用 | 引用 | T01/T07 等 | S01 等 | ✓ 14/14 |
| E01..20 实体 | 提及 | 提及 | ✓ 20/20 | 4/20 (E10/11/12/19) | 11/20 | 2/20 (E07/12) | ✓ 20/20 |
| S01..14 场景 | 引用 | — | — | — | 11/14 | ✓ 14/14 | ✓ 14/14 |

发现：

- **RKM architecture 不引用 S01..14**：架构文档只描述实体责任与边界，不直接对应验收场景。这是可以接受的分层（架构→开发→验收），但需要在 RKM-0 阶段把 S↔E 反向映射写入 contracts 或 gap.md，否则独立审查者无法仅凭架构验证"实现覆盖"全部场景。
- **RKM acceptance-plan 不引用 E 实体**：验收计划只描述场景与门槛，不点名 E01..20。同样的反向映射问题：RKM-0 应把"每个 S 由哪些 E 满足"显式落盘到 acceptance-plan 的补充矩阵或 gap.md。
- **gap.md 是唯一覆盖 E01..20 + RKM-REQ-01..14 + S01..14 三者的"中心表"**：`v2-real-knowledge-maintenance-gap.md:14-30` 的追踪表 14 行 × 6 列完整。这张表是 RKM-0 阶段必须保持同步的"事实源"。

### 2.3 三个本轮新增章节的图内位置

| 章节 | 出处 | 图页 |
|---|---|---|
| 三类同意（文件 / 云 / 会话） | contracts §3.2, risk-adr D05 | gap.md 提示图页 03/04/08 |
| 永久 Forget 与共享 item 派生贡献 | architecture §4, acceptance S09 | 图页 03/07/08 |
| 可逆维护（Inbox / Restore / 隔离 / 归档） | acceptance S11, risk-adr D04/D10 | 图页 05/06/07 |

图纸并未单独覆盖三类同意的三个并列流；建议在 RKM-0 把"云同意 vs 会话记忆 vs 文件读取"在图 04 单独画一条横向对比而非分散在三页，否则审查者无法直接验证 D05 "三类同意独立"。

### 2.4 历史 PASS 是否被新文档覆盖

`v2-real-knowledge-maintenance-gap.md:46`：**"原图仍是 PX 历史与限定修复方向的权威图，不能将其中历史 PASS 当作当前 PX-5 全绿"**。这条边界明确写入图纸索引，未把旧 PASS 偷换为新 PASS。

`v2-real-knowledge-maintenance-architecture.md:9` 明确"`app.py` 仍实例化 `MockKnowledgeServiceAdapter`。`DataServiceHttpClient` 只构成受控 HTTP 客户端，不是已接通的真实知识 Adapter"，与当前实现代码一致。✓

**结论**：MD 与 Draw.io 在结构与关键事实上无重大不一致；E↔S 反向映射缺失是 RKM-0 阶段工作包，不影响本轮文档方向审查。

---

## 3. 双仓权限与撤销协议可实现性

### 3.1 三类同意的最小一致性

| 同意 | contracts 字段 | architecture 实体 | acceptance 场景 |
|---|---|---|---|
| 文件读取（PermissionRoot） | E08 `PermissionService`（R1 已实现） | E08 P5 | S08 部分 |
| 云处理（CloudProcessingConsent） | contracts §2 + §3.1 | E11 / E12 / E19 | S08-A..F |
| 会话记忆（MemoryConsent） | contracts §2 + §3.1 | E07 / E13 / E16 | S08 + S10 |

contracts §3.1 明确三类同意全部"默认关闭 / POST 默认 revision=1 / 显式 PUT 开启 / 409 already_exists / 不隐式创建"。三份文档对"默认关闭 + 409 唯一约束"的描述完全一致。✓

### 3.2 撤销协议的 4 步（contracts §3.2 ↔ architecture §4 ↔ acceptance S08-C..F ↔ risk-adr D09）

```text
1. Navia本地递增workspaceGeneration、置state=revoking、停止新操作/应用 → E12 持久
2. 公共HTTP通知DS撤销 context/generation；DS持久化拒绝代际；独立dispatch协调锁阻止后续派发
3. dispatch开始事件与DS撤销屏障串行化：
   - 屏障前已发送：inFlightRequestIds记录，返回不应用
   - 屏障后开始新发送：禁止
4. DS返回revocationAck{generation, appliedAt, lastDispatchSequence, inFlightRequestIds} → state=revoked
   DS离线/超时：保持 revoking，显示"本地已阻止、服务端撤销待确认"
```

四份文档对此协议描述完全一致；`risk-adr D09` 显式承认"已出站请求不可撤回"、"不能把进程内 ticket 宣传为远程事务锁"。

### 3.3 可实现性疑虑（次级问题，不阻断文档方向）

1. **DS 协议未冻结**：`v2-real-knowledge-maintenance-contracts.md:72` 明确"API snapshot 逐字段对应后才能冻结实际路由/版本，当前不能伪称候选接口均已存在"。RKM-1 必须实际验证，否则"协议 4 步"无法成立。**已落入 RKM-1 阻塞条件**：`risk-adr D09` "做不到则阻塞RKM-1，不谎称跨进程原子撤销"。✓
2. **HTTP 出站令牌 / Origin 边界**：`architecture.md:13` "Runtime 传递已获云处理授权的片段，不转发模型密钥给浏览器"。但 contracts / architecture 没有明确"对 data_service 的 HTTP 调用也使用 loopback + 同源 / 独立 bearer"；建议 RKM-0 在 contracts §3 增加"DS 客户端调用认证矩阵"，否则 E10 `DataServiceHttpClient` 可能用不安全的认证路径。
3. **双仓会话认证 vs RKM 新增云同意 / 会话记忆**：R1 之前实现的双容器 token（bearer / Origin 精确匹配）只保护本地文件功能开启后的路径；RKM 的云处理与会话记忆走 `/v1/knowledge/*` 默认开放路由——但 contracts §3 顶部要求"新增路由统一认证，不因文件功能关闭而放开记忆/维护内容 API"。**此处需 RKM-0 阶段明确"功能关闭" ≠ "路由关闭"**：当 token 未配置时 `/v1/knowledge/cloud-consents/*` 应 401/403 而非放任。**当前 contracts §3 文本未明确**。
4. **撤销窗口内的 DS 重试**：contracts §3.2 第 3 步只约束"开始发送事件与屏障串行化"，未约束"DS 已入队但未开始发送"的请求是否需要 abort。`risk-adr D09` 承认"排队/重试必须经过统一dispatch协调器"，但 contracts 未给字段。建议 RKM-0 在 `KnowledgeOperationRecord.phase` 增加 `aborting` 状态。
5. **永久 Forget 对共享 item 的字段要求**：contracts §3 "Forget 支持删除操作ID、generation/tombstone、各存储清理结果与共享支持来源"；但 §2 `OrganizationProposal` 字段未定义"共享 item supportingSourceIds 在 Forget 后保留"的强制结构。建议 RKM-0 显式增加 `KnowledgeSource.sharing.outbound` 字段集。

### 3.4 S08-C..F 四态撤销是否可单独验证

| 子场景 | 时点 | 期望 |
|---|---|---|
| S08-C | Navia 本地校验后撤销 | 本地事务递增 workspaceGeneration，state=revoking；DS 尚未收到通知 |
| S08-D | DS 排队后撤销 | DS 队列内新派发=0；屏障前已发送列入 inFlightRequestIds |
| S08-E | DS 离线时撤销 | 保持 revoking；显示"服务端待确认"；恢复后先对账 |
| S08-F | DS 内部重试前撤销 | DS 重试链路不得重新取得发送资格；屏障后已发送=0 |

四态分别要求不同能力的真实验证，RKM-1 必须每个子场景单独 spike。`acceptance-plan.md:55` 把 S08-C..F 一并归入 RKM-1 矩阵，可行但需要隔离 spike 工具能注入四种时点。**当前 contracts / acceptance 没有为 S08-C..F 单独定义 fixture 维度**，建议 RKM-0 增加 fixture matrix `revocationTimePoint ∈ {after_local, after_ds_queue, ds_offline, before_ds_retry}`。

---

## 4. 阶段依赖与循环检查

### 4.1 序列图

```text
T00 文档闭环 ─┬─→ T01 R1前端 ─→ T02 R2采集 ─→ T03 R3校验 ─→ T04 R4+PX-6 ───┐
              │                                                            │
              └─→ T05 RKM-0合同 ─→ T06 RKM-1 spike ─→ T07 RKM-2 ─┐          │
                                                                   ↓          ↓
                                                              T08 RKM-3 ─→ T09 RKM-4 ─→ T10 RKM-5（最终人工）
```

### 4.2 循环检查

| 检查 | 结果 |
|---|---|
| RKM 序列自身 | T05 → T06 → T07 → T08 → T09 → T10 单向无环 ✓ |
| PX 序列自身 | T01 → T02 → T03 → T04 单向无环 ✓ |
| 跨序列 | T00 分叉；T04 与 T10 各自独立终点，**不形成环**但**都需要人工签署 + 全量复跑**——不是循环，是双门槛 |
| 验收场景依赖 | S11（可逆维护）需要 S08 / S09 → 由 RKM-3 / RKM-2 提供；T09 → T07/T08 顺序，无环 ✓ |
| S10（对话记忆）依赖 S08 记忆同意 → RKM-3 在 RKM-2 之后，单向 ✓ |
| S12（用量）需要 Ask 真实调用 → RKM-2 之后，RKM-4 完成 S12 全部 ✓ |
| S14（隔离交付）需要 S01..13 全部完成 → RKM-5 终点 ✓ |

### 4.3 次级依赖问题

1. **T10 与 T04 双门槛重叠**：T10 RKM-5 要求"独立复审及人工体验"；T04 PX-6 也是。两个 gate 各自需要独立复审 + 人工签署。两份文档对"复审者是否为同一人"未约束；建议 RKM-0 阶段明确"复审者轮换 / 不可复用"。
2. **RKM-1 spike 与 RKM-2 实现的边界**：RKM-1 是"DS 接口级 spike"，不要求"生产 E12 重启恢复 /真实产品 UI"。但 acceptance S09 服务协议部分要求"DS 返回删除 operation ID、generation/tombstone、各存储清理结果与共享支持来源"。RKM-1 不能在 E12 缺失的情况下跑完整 S09 E2E；建议 RKM-1 把 S09 服务协议限制到"DS 端能力枚举 + 错误码"而非完整 E2E。
3. **T05 RKM-0 与 T06 RKM-1 串联**：T05 必须先产出机器 Schema/OpenAPI / fixture / 原型增量，T06 才能 spike。但 RKM-0 也要做"RKM-0 独立设计复审 Fatal/Major=0"。如果 T05 复审发现新设计 Major，RKM-0 自身需重审 → 推迟 T06。这是线性流，无环但是单点风险。
4. **数据迁移前置**：contracts §3.1 提到"默认不迁移旧 Mock 资料，不访问现有私人 workspace；创建专用 Navia namespace，旧数据由用户显式重导入"。但 RKM-1 spike 测试数据是否需先做迁移？建议在 RKM-0 spike 计划里固定：spike 用 Navia namespace + 临时数据，不动 R1 历史数据。

---

## 5. 假绿拒绝能力

### 5.1 已有的强约束（acceptance-plan §1-4）

- S00..S14 每项"含用户步骤、预期、门槛和失败证据"——**操作级不可绕开**。
- §1 24 语料固定门槛：12 真实网页 + 6 授权md/txt + 6 笔记，至少 20/24 完成真实 ingest；blocked/degraded 单列，**不能计真实生成成功**。
- §1 24 题硬指标：检索命中率 ≥ 0.9、groundedClaimRate ≥ 0.9、引用可解析率 = 1、无证据 6/6 拒答、冲突 6/6 保留冲突。
- §3 "RKM-0交付新的规则/requirement registry 与机器合同；不能把原PX的63规则/109负例集合冒充新增维护覆盖"——**新旧规则不能合并冒充**。
- §3 G4 "扫描必须实际读取快照源码，负例插入违规 import/网络调用且同步 hash、report 仍0时也拒绝"——**防止 G4 validator 自证通过**。
- §3 "Graph首期max_nodes=120，与DS接口绑定；超过明确truncated及返回数量，不声称完整覆盖"——**截断必须显式**。
- §3 "fallback不能计真实生成成功；空主张/空引用分母为0不记1，记未通过"——**空集不洗白**。
- §4 "deferred从不计入passed或本阶段承诺覆盖分母"。
- §4 "human pending则final=false"——**无人工签署不通过**。
- §4 "私有字节不进入公开HTML、外部ChatGPT包或截图"——**私有数据不可外传**。

### 5.2 次级问题

1. **S12 用量是否会被"次数等于真实请求数"绕过**：acceptance-plan §2 S12 要求"次数等于真实请求数"，但若 E15 `UsageLedger` 漏记某次出站调用，且无负例 fixture 检测"漏记"，则该字段可被静默构造满足。**建议 RKM-0 在 E15 增加负例 fixture**："关闭 ledger 后服务仍能 dispatch；ledger 启用时每次 dispatch 必有对应 UsageRecord"。
2. **S13 UX 真实四视口与"图片/metadata 配对"**：PX-5 历史曾因合成对照图计入产品证据被复审退回。S13 已写"截图位于 `../evidence/v2_real_knowledge_maintenance/documentation/`"且复审者用 headless Chrome + 临时 profile + 无扩展 + 无 Runtime 加载。**但 acceptance-plan 未禁止"再次复用历史 PNG"**。建议在 RKM-0 增加 fixture：metadata.imagePath 必须等于 paired PNG bytes，且 SHA-256 不在已知历史 PNG 集合中。
3. **S05 gold 先冻结**：`acceptance-plan §1` "gold在模型执行前绑定原始span与可接受主张，由未参与生成的审查者复核"。这是良好做法，但**未指明 gold 由谁构造 / 是否经过审稿者独立签字**。建议 RKM-0 增加 "goldManifest.json 含 reviewerId / reviewAt / signoffHash"。
4. **S06 图谱"前端造边"防线**：acceptance-plan §2 S06 "API 图谱/Trace/截图；前端造边、静默truncate失败"。但当前 contracts §4 "Graph按source/证据过滤，不在前端构造关系"。**未给出"如何检测前端造边"的 fixture**。建议 RKM-0 在 G4 增加 AST 负例：禁止前端模块包含 `mockGraphNodes` / `seedGraph` / 硬编码 workspace→node 映射。
5. **S08-C..F 四态撤销的可观测信号**：acceptance-plan §5 要求"屏障后新dispatch=0、屏障前已发送列表完整且返回应用=0"。但 fixtures 怎么注入"已发送未返回"和"已开始发送"这两个时点？建议 RKM-0 spike plan 明确"用确定性 hook（如 monkey patch E19 `dispatch`）让 in-flight 状态可观测、可阻塞、可注入"。
6. **S09 "宿主原件/聊天不删除"边界**：acceptance-plan §2 S09 "宿主原件/聊天不删除"作为硬门槛。但 fixtures 怎么验证"没有物理修改宿主文件"？建议 RKM-0 增加：Forget 前后宿主文件 mtime / SHA-256 不变，且 backup-before-forget 流程不复用宿主备份目录。
7. **RKM-5 "不允许沿用阶段 partial 为全绿"**：acceptance-plan §5 RKM-5 已写明。但 **T04 PX-6 的"全量复跑"和 T10 RKM-5 的"全量复跑"在 evidence 目录上是否复用？**若复用，可出现"PX 阶段分母已部分计入 RKM 阶段"的假绿。建议 RKM-0 显式 RKM evidence 目录与 PX evidence 目录物理隔离。

### 5.3 总体判断

acceptance-plan 的假绿拒绝能力 **显著强于** PX-5 历史候选的假绿（PX-5 历史曾因生成器补写、合同结果冒充生产、validator 自证通过而被复审退回）。RKM 文档对假绿的预判在文本层面充分，但**多个 fixture / detector 维度留待 RKM-0 阶段补齐**——这是 RKM-0 的工作包，不是本轮文档方向审查的阻止项。

---

## 6. 过度承诺审查

### 6.1 文档明确禁止的声明（已写入多处）

- stage gate `v2-real-knowledge-maintenance.md:32` "禁止：PX-5/PX-6通过、RKM实现、真实RAG ready、自动永久遗忘、全功能外脑、媒体理解或V3完成。模型配置存在不等于可达，原型不等于产品，Schema不等于semantic/E2E。"
- acceptance-plan §4 "允许的最终目标声明限'V2-RKM 在冻结语料和授权范围通过真实知识服务、指定对话记忆及可逆维护验收'，不声称全站全格式/自动永久遗忘/完整自主外脑/V3完成。"
- 总 PRD17.3 §17.4 "不得声明 RKM、RAG、完整外脑或自动维护已完成；将来通过也只允许冻结语料和授权范围内的有限声明"
- 总 PRD17.3 §17.4 "RKM-0机器合同与RKM-1真实spike尚未完成，当前不声称全部自动化开发输入完备"
- 总 PRD17.3 §17.1 "PX 报告不得把整理建议卡、自动摘要或自动遗忘写成已实现"
- risk-adr §3 "DS当前remove主要标记removed；跨索引真实删除及共享item重算未证明"
- risk-adr §3 "模型可达性、费率、上下文质量尚未在本轮调用验证；不收费、不假定可用"

### 6.2 当前审计包可能引起误读的措辞

1. `v2-real-knowledge-maintenance-development-plan.md:9` "T00 现状和文档闭环 | … | 完成后的用户体验：可区分当前产品与目标，不误以为Mock是外脑 | 只批准文档，不改变旧门禁；审计S00" → **清晰** ✓
2. `v2-real-knowledge-maintenance-architecture.md:14` "data_service 只构成受控 HTTP 客户端，不是已接通的真实知识 Adapter" → **清晰** ✓
3. `v2-real-knowledge-maintenance-readiness-audit.md:9` "产品方向与文档设计 | 可交人类审查；十四需求已映射实体/任务/操作/门禁 | 不等于真实Adapter或维护已实现" → **清晰** ✓
4. `v2-real-knowledge-maintenance-readiness-audit.md:63` "建议再交ChatGPT审查这套文档" → 把审查范围限定为文档包，无产品承诺 ✓
5. `v2-real-knowledge-maintenance-readiness-audit.md:11` "技术预览不是产品截图，也不替代原生Draw.io人审" → **清晰** ✓

### 6.3 间接可能引起误读的位置

1. `v2-real-knowledge-maintenance-development-plan.md:11` "T02 R2原始采集 | E20采集trusted事件、真实请求/响应字节、容器ID、mutation/navigation代际、截图 | 看到实际操作路线与证据，不是脚本填值"。T02 仍属于 PX-5 R2，不是 RKM。但阅读者可能误以为"RKM-1 完成后即可做 T02"。**建议明确"此处 T01..T04 是原 PX 修复路径，不属于 RKM-0..5"**。
2. `v2-real-knowledge-maintenance-development-plan.md:27` "T01..04只执行原PX承诺；T06是隔离DS协议spike，不要求T07生产持久化或T08/T09工作流先完成。"→ **清晰** ✓
3. `v2-real-knowledge-maintenance-acceptance-plan.md:5` "S01..14为未来真实功能验收。量化阈值冻结为目标，失败需修复，不得把结果反向调成门槛" → **清晰** ✓
4. `v2-real-knowledge-maintenance.md:33` "机器合同、服务spike及产品体验证据尚缺，因此当前不能声称'全部自动化开发输入已经完备'" → **清晰** ✓

### 6.4 总体判断

文档未做过度承诺；所有声明都明确边界（"待交付"/"NOT_IMPLEMENTED"/"不能伪称"/"未在本轮验证"）。审查包自我限定为"文档审查包"，无产品通过暗示。

---

## 7. 次级问题清单（不阻断文档方向，需 RKM-0 关闭）

按严重度排序：

| 编号 | 类别 | 描述 | 来源文档 | 建议处理 |
|---|---|---|---|---|
| S-1 | 双仓协议 | `/v1/knowledge/cloud-consents/*` 等新路由在 token 未配置时是否 401/403 未明确 | contracts §3 顶部 | RKM-0 增补"功能关闭 ≠ 路由关闭"约束 |
| S-2 | 假绿 | E15 UsageLedger 漏记检测 fixture 缺失 | acceptance-plan §2 S12 | RKM-0 增加 UsageRecord 漏记负例 |
| S-3 | 假绿 | S13 截图防复用：未禁止历史 PNG 复用 | acceptance-plan §2 S13 | RKM-0 metadata.imagePath SHA-256 不在已知历史 PNG 集合 |
| S-4 | 假绿 | S05 gold 缺少 reviewer 签字字段 | acceptance-plan §1 | RKM-0 goldManifest.json 加 reviewerId/reviewAt/signoffHash |
| S-5 | 假绿 | S06 前端造边的 AST 检测规则未定义 | acceptance-plan §2 S06 | RKM-0 G4 增加 AST 负例（mockGraphNodes/seedGraph/硬编码） |
| S-6 | 假绿 | S08-C..F 四态撤销的 fixture 维度缺失 | acceptance-plan §5 | RKM-0 spike plan 明确 revocationTimePoint ∈ {after_local, after_ds_queue, ds_offline, before_ds_retry} |
| S-7 | 假绿 | S09 宿主原件/聊天不删除的可观测缺口 | acceptance-plan §2 S09 | RKM-0 增加宿主文件 mtime / SHA-256 不变 fixture |
| S-8 | 假绿 | T04 PX-6 与 T10 RKM-5 evidence 目录是否隔离未明确 | acceptance-plan §5 RKM-5 | RKM-0 物理隔离 evidence 目录 |
| S-9 | 跨仓协议 | KnowledgeOperationRecord.phase 缺 aborting 状态 | contracts §3.2 | RKM-0 增加 aborting |
| S-10 | 跨仓协议 | KnowledgeSource 缺 sharing.outbound 字段 | contracts §3 | RKM-0 增加 sharedSupportingSources 结构 |
| S-11 | 跨仓协议 | DS 客户端调用认证矩阵缺失 | contracts §3 / architecture §3 | RKM-0 增补 E10 客户端认证矩阵 |
| S-12 | 跨仓协议 | architecture 缺"云同意 vs 会话记忆 vs 文件读取"图示对比 | gap.md | RKM-0 在图 04 增加横向对比 |
| S-13 | 阶段依赖 | T04 与 T10 复审者不可复用未约束 | dev-plan T04/T10 | RKM-0 明确复审者轮换 |
| S-14 | 阶段依赖 | RKM-1 S09 服务协议边界 vs 完整 E2E 边界 | acceptance-plan §5 RKM-1 | RKM-1 spike plan 限制"DS 端能力枚举"而非完整 S09 E2E |
| S-15 | E↔S 反向映射 | RKM architecture 与 acceptance-plan 缺 S↔E 反向表 | gap.md | RKM-0 增补 S↔E 矩阵 |
| S-16 | 文档误导 | T02 R2 仍属 PX-5 路径，建议明确标注 | dev-plan §1 | RKM-0 微小修订 T02 描述 |

S-1 至 S-11 是协议层与假绿防御层问题，**应在 RKM-0 阶段合同冻结前关闭**；S-12 至 S-16 是图与文档次级问题，可在 RKM-1 / RKM-5 之前补齐。

---

## 8. 是否可批准进入 RKM-0 实施？

**结论：可批准文档方向进入下一轮独立复审与 ChatGPT 外部审查；RKM-0 合同冻结实施应在 S-1..S-11 关闭后启动。**

理由：

- 19 项载荷哈希一致。
- 两份 Draw.io 结构完整、ID 唯一、边界合规；MD↔Drawio 在实体 / 场景 / 阶段上基本闭环（缺 S↔E 反向映射但可补）。
- 撤销协议在 4 份文档中描述一致；DS ack 屏障语义统一。
- 阶段序列无环；T04 与 T10 是双门槛而非环路。
- 假绿拒绝能力文本层面强于 PX-5；多个 fixture / detector 维度需 RKM-0 补齐。
- 无过度承诺；所有"待交付""NOT_IMPLEMENTED"边界清晰。

**不建议现在批准**：

- 任何 RKM-0 之后的实际代码开发（S-1..S-11 未关闭；RKM-0 自身也需独立设计复审）。
- 跑旧 PX 生产 validator / 报告生成器（即使为 RKM 准备证据也不行，因 E20 历史 T02/T03 工具有未闭环问题）。
- 进入 R2 / R3 / R4 / PX-6 / RKM-0..5 任一实施。

**下一步建议**：

1. 把本文档作为下一轮独立复审 / ChatGPT 外部审查的输入。
2. 用户决定是否接受 S-1..S-11 作为 RKM-0 合同冻结的预审补强项；其中 S-1（路由认证矩阵）和 S-2 / S-3（UsageLedger + 截图防复用）属于**阻塞级**——不关闭则 RKM-1 spike 无法验证。
3. 把 S-12 至 S-16 列为 RKM-1 / RKM-5 之前的清理项。
4. 用户批准 RKM-0 后，由独立审查者对 RKM-0 机器合同与原型增量做第三轮独立复审（readiness-audit 显式承认"未单独进行第三轮独立复审"，本轮复审建议补做）。