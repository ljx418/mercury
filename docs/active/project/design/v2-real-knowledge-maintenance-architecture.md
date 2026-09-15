# V2-RKM 真实知识库与可逆记忆维护目标架构

修订：2026-09-10。状态：DOC-Closure设计输入，未批准代码开发。RKM 是 PX 之后的独立增量，不回写 PX/V2-7 历史完成声明。第二轮复审处置见contracts3.3..3.9与acceptance6..9；这些是目标设计，不是新增协议已实现或RKM-0已经启动。

## 1. 权威、事实与决策

总 PRD 第 17.3 节为目标权威；本文件为实体及数据所有权权威；同前缀 contracts、development-plan、acceptance-plan、risk-adr、gap 和 stage gate 分别拥有合同、任务、验收、取舍、图纸索引和放行状态。冲突必须回到 RKM-0，不通过文档排序静默选边。

现状来自当前未冻结工作树，不是 HEAD 完成证明：Workspace/入口/路由已存在；PX-1..4 有历史通过记录；R1 后端 F-1..6 限定复审通过，前端与 Chrome 待复验；PX-5 FAIL / REOPENED，PX-6 BLOCKED。app.py 仍实例化 MockKnowledgeServiceAdapter。DataServiceHttpClient 只构成受控 HTTP 客户端，不是已接通的真实知识 Adapter。

data_service 本地代码参考提交 `71279fdb8da99ee1ca31e840662d49b1564ab28f`，旧 spike 的 `fa8f8377...` 不作为新接口锁定。该仓有其他文档修改，禁止覆盖。API 源码 `backend/app/api/v1/data_service.py` 和 `backend/data_service/mcp_source_tools.py` 的 remove 路径主要标记 removed，不等于索引、快照和派生事实已清除。默认确定性检索与真实模型生成必须区别。

采用本机双服务：Chrome -> Navia Runtime 127.0.0.1:17861 -> data_service 127.0.0.1:8003 -> 已批准云模型。端口冲突使用明确配置并记录，不抢占既有服务。仅 data_service 可调用该阶段云模型；Runtime 传递已获云处理授权的片段，不转发模型密钥给浏览器。无 Docker、远程公网服务、第二套 Letta/Mem0 服务或 data_service Console 替代 Navia UI。

## 2. 代码实体索引

路径前缀：N=`services/local-runtime/navia_runtime/`；F=`apps/chrome-extension/`；D=`/mnt/c/workspace/data_service/backend/`。下表中的“新增”均为拟建实体，本轮没有创建这些代码文件。实现状态与验收状态是两个维度，不能把代码存在涂成通过。

| ID / 平面 | 具体代码实体 | 当前 -> 目标 / 状态 | 输入、输出与责任 |
|---|---|---|---|
| E01 P0/P1 | F src/contentBridge.ts | 已存在，保持；PX 待复验 | 用户 launcher -> sidepanel.html iframe；网页正文只由主动保存交接 |
| E02 P1 | F entrypoints/background/index.ts | 已存在，需边界复验 | OpenWorkspaceAction -> chrome.tabs；只传稳定 ID，不转发会话 token |
| E03 P2a | F entrypoints/sidepanel/main.tsx | 已存在，需修改 | 快速保存、当前空间问答、会话记忆开关 -> E05；不自动采集所有网页 |
| E04 P2b | F entrypoints/workspace/main.tsx；src/modules/knowledge_workspace/workspaceRoutes.ts、workspaceAuthority.ts | 已存在，需修改 | 五类现有 route 保留；新增维护/隐私设置路由；每次恢复经 E05 取权威 |
| E05 P3 | F src/runtimeClient.ts | 已存在，需修改 | HTTP envelope、类型化错误、内存认证、维护/策略客户端；扩展页面直发 Runtime |
| E06 P2 | F src/modules/knowledge_workspace/LocalRuntimeAccess.tsx、ServiceStatusBanner.tsx、DataServiceStatusCard.tsx、KnowledgeBuildStatus.tsx、ForgetSourceDialog.tsx、PermissionRootManager.tsx | 已存在，R1 前端待修复 | 403 与 offline 分离；Forget failed/degraded 不显示成功；两个容器 token 独立 |
| E07 P4 | N app.py；stores.py:SQLiteSessionStore | 已存在，需修改 | HTTP路由；拟增messageSequence与memory_turn_outbox，完成turn及事件同事务，E13至少一次消费/E12去重；不改A/C/D公开事件 |
| E08 P5 | N modules/memory/permissions.py:PermissionService；guards.py | 已存在，后端限定验收通过 | root/epoch/ticket；授权不读取正文；撤销禁止新读取及提交，保留已导入快照 |
| E09 P5 | N modules/memory/runtime/__init__.py:MockKnowledgeServiceAdapter | 已存在，仅合同/旧基线 | 不作为真实 RKM 验收；不得在真实服务故障后自动启用 |
| E10 P5 | N modules/memory/data_service_client.py:DataServiceHttpClient | 已存在，需修改 | 扩展 build/query/graph/units、能力协商和错误映射，保留 HTTP 单边界 |
| E11 P5 | N modules/memory/knowledge_service.py:KnowledgeServiceAdapter、RealKnowledgeServiceAdapter | 待新增 | E07/E08 -> 持久治理记录 E12 -> E10；能力而非探活决定 ready |
| E12 P5 | N modules/memory/persistence.py:KnowledgeGovernanceStore | 待新增 | SQLite 保存 Navia/DS ID 映射、幂等、outbox、策略/同意、tombstone、revision 和操作；不直接读 D 数据文件 |
| E13 P5 | N modules/memory/conversation_memory.py:ConversationMemoryService | 待新增 | 已提交 session/turn/message ID + 显式同意 -> 可追溯记忆；助手原话不是独立事实证据 |
| E14 P5 | N modules/memory/maintenance.py:MaintenanceService、MaintenanceScheduler | 待新增 | 策略+source revision -> proposal -> 校验 -> 可逆应用/恢复；串行低优先级批次 |
| E15 P5 | N modules/memory/grounding.py:GroundingValidator；usage.py:UsageLedger | 待新增 | 原始 evidence span 校验、主张关联、缺证据降级；调用/usage/估算记账，不按金额停止 |
| E16 P2 | F src/modules/knowledge_workspace/MemoryConsentPanel.tsx、MaintenanceInbox.tsx、MaintenanceRunDetail.tsx、KnowledgePolicyPanel.tsx | 待新增 | 显式开启、查看影响、接受/拒绝/撤销、暂停维护；只经 E05，不生成知识事实 |
| E17 P6 | D app/api/v1/data_service.py；data_service/service.py | 外部已存在，受控修改 | 公共 workspace/source/build/query/trace API；增加持久幂等、能力与级联删除配套合同 |
| E18 P6 | D data_service/default_adapters.py；app/llmwiki/engine.py；app/graphrag/service/ | 外部已存在，需复验/必要修复 | 唯一知识索引/图谱/派生文档所有者；过滤 tombstone、重算共享支持关系 |
| E19 P6 | D data_service/ai_provider_contract.py | 外部已存在，需修改 | 真实模型结构输出、request/usage/模型身份；fallback 标记不能算生成质量通过 |
| E20 P7 | F e2e/chrome-v2-px-workspace-router.mjs；generate-v2-external-brain-productization-report.mjs；validate-v2-external-brain-productization-report.mjs；validate-v2-external-brain-production-evidence.mjs | 已存在，R2/R3 待修复 | 原始采集、纯派生、共享规则；新 RKM profile 单独登记，不降低 PX 规则 |

## 3. 交互与授权边界

- 保留 `workspace.html#/knowledge/sources?workspaceId=...`、`sources/:sourceId`、`ask`、`graph`、`settings/permissions`。新增 `#/knowledge/maintenance?workspaceId=...`、`maintenance/runs/:runId`、`settings/knowledge?workspaceId=...`。所有 ID 编码/校验，未知 ID 返回可恢复错误，禁止缓存造数。
- 查看来源只进当前保存 source detail；打开工作台只进 library；在工作台中打开保留有效 route、无效回 library。维护入口在 Workspace 导航；Side Panel 只显示建议数及跳转，不塞入长期管理面。
- LocalRuntimeAccess 两个容器各输入 token，刷新各自丢失；403 要求认证，transport failure 才是 offline。断开认证或 scope 切换使在途响应失效，清理本容器正文/答案/图谱/Trace，另一容器不共享 token。文档不沿用旧“所有 token 均经 Background”判断。
- 文件读取同意只准读取授权 root；CloudProcessingConsent 单独允许指定 workspace/source/session 的内容发往指定 provider；MemoryConsent 单独允许指定会话后续已完成 turn 提取。打开网页、授权目录、开启云处理都不能自动启用另两种权限。
- ConversationMemory 的 source 类型为新增 `conversation_memory`，不能伪装网页/文件。原始用户陈述、助手推断、结构化摘要分别标记；冲突保留双方来源。关闭会话记忆只停止新提取，既有记忆保留并提供明确遗忘入口。

## 4. 持久性、并发与删除

data_service 拥有原始导入副本、单位、索引、图谱和派生内容；Navia SQLite 只拥有治理记录及 ID/版本映射。默认不迁移旧 Mock 资料，不访问现有私人 workspace；创建专用 Navia namespace，旧数据由用户显式重导入。数据库迁移先备份 Navia 自有库；不备份/复制任意私人目录。

来源/同意/映射持久，PermissionRoot 的 fd 与 epoch 不持久；Runtime 重启后已保存知识可读，但本地新读取必须重新授权。旧 PX “不保证恢复旧 operation”不改写；RKM 新操作经持久 outbox 和 DS operation ID 对账：能确认的取权威结果，未知提交结果显示 awaiting_reconciliation，禁止换 key 重发制造重复。前端只 poll，不能执行对账。

每 workspace 维护/索引提交串行；读可并行。远程 HTTP 不得持有 root IO 锁。root锁内校验并写入本地待提交outbox。E12保存完整authorizationContext，不以单一consentRevision代表文件/云/记忆/策略四种依据。E17检索前过滤allowedSources、revision与retention；E19模型dispatch前再次验证目的/提供方/代际，禁止先发未授权资料再过滤返回。隔离来源不得进入默认检索，归档来源可检索但标注归档。

撤销的唯一完成点是E17/E19持久屏障的revocationAck返回后：E12先记录revoking并停止本地新操作/应用，DS排队/重试必须经过统一dispatch协调器，屏障前已开始发送列入inFlightRequestIds，返回不得应用；屏障后零新发送。DS离线、超时或无法确认发送交接，保留“本地已阻止、服务端待确认”，不得标revoked或声称远程停止。具体字段/排序见contracts 3.2。已出站资料无法撤回；此协议不保证撤销点击前后所有网络字节瞬时停止。做不到则阻塞RKM-1，不谎称跨进程原子撤销。

用户永久 Forget：确认 -> 持久 tombstone -> 阻止读/生成/旧任务写回 -> DS 清除目标原始副本、派生贡献、缓存/索引/trace -> 四面重读和同源四种重开 -> verified。共享 item 保留剩余 supportingSourceIds 并重算。失败保留 tombstone 和部分执行清单，显示 failed/degraded，不能“恢复”已删除数据或宣布成功。原始宿主文件与原始聊天记录不是知识 Forget 的删除对象，界面必须说明；已生成摘要和记忆中的目标贡献必须清除。

归档/隔离不是永久 Forget：可恢复、保留原始证据，隔离不进入默认检索，可在专门管理页查看和恢复；不设到期自动永久删除。恢复只还原 Navia/data_service 自有记录，不修改宿主文件。revision/同意变化后旧 proposal 失效；模型不能直接执行 SQL、HTTP 或文件操作。

## 5. 接入依赖锁定

本轮独立审查修订：E12用ConsentDecisionSlot的(scope/provider/purpose)当前版本计算授权，历史revoked保留审计但可由同key显式CAS重授权替代；workspace新grant不覆盖source deny。E14普通pause只阻断维护run的executionEpoch，E17/E19持久pauseAck后才可声称远程停止，不撤销无关Ask。策略/授权改变的旧run在屏障与对账后终结释放槽，未知结果保持pending。详见contracts3.7/3.9与acceptance8.1，均为待实现目标协议。

2026-09-10风险复核补充：contracts3.5..3.8为RC-01..04的生命周期权威。E14运行状态与待审建议分离，默认关闭不生成建议、重启暂停不补跑；E07本地事务outbox经E13投递E12，单session授权epoch/起始sequence防历史回填，禁止跨库“提交后回调”冒充可靠投递。E05/E07/E12保留已认证控制面关闭/撤销，不因DS离线锁死。E12/E17/E18恢复与备份先核验删除账本，Forget包含派生摘要/建议/恢复快照，不靠beforeState复活内容。原实体分层/HTTP边界不变，新增内部存储设计尚未实现；验收第8节逐条覆盖。

E05/E07的目标认证与E10->E17服务认证见contracts3.3矩阵：新RKM数据API缺失/错误token或Origin返回403，功能不可用先认证后503；文件开关不解除RKM认证。E10仅连固定loopback，不跟随redirect/环境代理，用独立X-API-Key，不转发浏览器Bearer；DS匿名/dev bypass成功是阻塞项。R1既有认证不能当作这些RKM要求已实现。

E12新增aborting/aborted表示RKM授权撤销或run执行屏障中止，abortCause及对应revocationAck/pauseAck分开，ack前不标完成，不改变旧build enum/取消按钮。两类ack复用dispatch协调基础设施但以barrierType及专属generation/run epoch隔离，不能互相满足。E16区分“本地已暂停、服务端待确认”与远端ack后的“已暂停”。E17/E18的SharedSupportVerification表达派生贡献before/after，不以sharing.outbound混用云权限。E15 UsageLedger按knowledge operation、memory extraction、maintenance dispatch、model request四个主分桶记账，同一事实不重复进入分母；E20截图必须绑定本run捕获响应、图谱展示对照服务事实。详细算法/反例在acceptance6/9，不把字段存在当执行证明。

S->E反向索引位于[验收第7节](v2-real-knowledge-maintenance-acceptance-plan.md#7-场景到实体的反向索引s-15)，与[gap中心表](v2-real-knowledge-maintenance-gap.md)同步；实体变化必须检视涉及的场景及任务，不能仅修改本文件。

T05/T06必须产生真实 API snapshot、commit/tree/依赖索引、许可或内部使用说明、auth/capability matrix、请求/响应/错误映射与配套变更diff。能力矩阵只允许observed_supported、requires_ds_public_api、requires_navia_adapter、not_observed、prd_blocker；PRD必需能力不存在“可降级通过”。公开API主路径固定HTTP；MCP/CLI仅诊断，不做静默fallback。未知字段/能力不能猜测启用。

当前DOC-Closure可细化D01..09的交付要求，但不进入T05。唯一实施顺序为T01..04/PX-6通过后，经用户批准及T05预审计再开始RKM-0；不能用“合同工作仍是文档”绕开旧PX门禁。D06以39个顶层断言为固定基线，D04按现有Chat事务路径的可证伪兼容条件出门，D08由非作者的独立审查者批准gold版本；这些仍是待交付实体。

provider 候选为当前配置 MiniMax-M2.7，未在本轮测试；连接目标及提供方写入同意记录，不因模型同名复用另一提供方。密钥在服务配置，私有原始证据单独访问控制；公开包只有脱敏副本/摘要及明确不可独立复核部分。无金额熔断；并发、超时和安全边界仍有效。
