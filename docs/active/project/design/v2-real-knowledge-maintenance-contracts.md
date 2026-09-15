# V2-RKM 合同设计与兼容约束

状态：DOC-Closure文档设计，非已发布 API。修订：2026-09-10，回应独立复审S-1..S-16及第二轮G-1..G-7。本文件列出T05/RKM-0必须转换为JSON Schema/OpenAPI/正负夹具的字段与语义；这些机器合同当前尚不存在，不能声明后续全部编码已就绪或RKM-0已经启动。

## 1. 通用规则

继续使用 Runtime `ok/data/error/request_id` envelope；请求和响应禁止额外字段的具体规则由每个 Schema 明确，不将旧草案 camelCase envelope 恢复为权威。ID 为非空 opaque string，公共 URL 只带 ID，ISO-8601 UTC 时间只作记录，顺序/因果由 revision 和实际 observation sequence 判断。每个可写对象带 schemaVersion、workspaceId、revision；应用变更必须提交 expectedRevision，失配 409，不自动覆盖。

幂等键 8..160 字符，作用域 workspace+操作类型+actor，绑定规范请求 hash。规范请求使用 UTF-8 JSON、键排序、无 BOM/尾换行、数组保持业务顺序（fileIds 先验证唯一再排序），摘要算法 SHA-256。相同 key/body 返回同一操作，异 body 409；重放也须验证当前权限。源内容 fingerprint 对原始 bytes 计算，不二次反转义。

现有 build 状态 `not_saved/queued/ingesting/building/trace_ready/degraded/failed/forgotten` 保留；MaintenanceRun.state是独立域 `queued/running/paused/completed/degraded/failed`，完整转移见3.5。idle仅指没有活动run的派生显示，review_required仅指存在pending建议的派生显示，不是run状态。归档/隔离使用 retentionState=`active/archived/quarantined/forgotten`，不混入 build enum。Runtime offline 保持 null/unchecked/unknown 权威规则。

## 2. 拟新增对象

| 对象 | 必填字段（除通用字段） | 约束 / 权威 |
|---|---|---|
| KnowledgeSourceMapping | sourceId, backendWorkspaceId, backendSourceId, contentSha256, sourceType, retentionState, createdAt | E12 持久化；一个 Navia ID 只对应同一 backend identity，不按数组位置映射 |
| KnowledgeOperationRecord | operationId, type, idempotencyKey, requestSha256, phase, backendOperationId(null可用), authorizationContext, createdAt, updatedAt, abortCause(null/auth_revoked/run_paused) | phase=queued/submitting/awaiting_reconciliation/running/aborting/aborted/succeeded/degraded/failed；授权撤销见3.4，run屏障中止见3.9；未知远程结果不得填 succeeded |
| CloudProcessingConsent | consentId, scopeType(workspace/source/session), scopeId, providerId, modelPolicy, allowedPurposes[], state(granted/revoking/revoked), desiredState, revocationAck(nullable), grantedAt, decisionRefs[] | purpose=ask/build/memory_extract/maintenance；decisionRefs绑定3.7的当前决定槽；旧审计记录不参与当前冲突计算；更换provider重获同意 |
| MemoryConsent | consentId, sessionId, enabled, enabledAfterMessageId, enabledAfterSequence, consentEpoch, targetWorkspaceId, cloudConsentId(null可用), changedAt | 仅开启后开始且完成的turn；服务端游标和持久事件见3.6；cloudConsentId为null时禁止云提取；不允许客户端任意指定其他session数据 |
| ConversationMemoryRecord | memoryId, sourceId, sessionId, turnId, messageIds[], statementKind, evidenceRefs[], sourceRevision, createdAt | statementKind=user_statement/assistant_inference/derived_summary；messageIds必须实际存在；推断不得升级用户事实 |
| KnowledgeMaintenancePolicy | policyId, enabled, mode(suggest_only/reversible_auto), allowedActions[], sourceScopeIds[], trigger, timeZone(nullable), timeZoneConfirmed, localTime, batchSize, concurrency, cloudConsentId(null可用) | 默认disabled/suggest_only/manual；timeZone=null、timeZoneConfirmed=false；daily启用前由Policy所有者显式提交并确认IANA时区，服务端不得从部署机推导；localTime默认02:00；调度与重启见3.5，不后台扫描文件 |
| MaintenanceRun | runId, policyId, policyRevision, inputSnapshot[], state, cursor, startedAt(null可用), finishedAt(null可用), usageRecordIds[], pauseReason(null可用), taskResults[], executionEpoch, pauseState(not_requested/pending/acknowledged), pauseAck(null可用) | inputSnapshot含sourceId/revision/hash；任务与终态见3.5，维护独立屏障见3.9；不承诺撤回已出站模型请求；恢复重验输入与同意 |
| OrganizationProposal | proposalId, runId, action, reason, affectedSources[], expectedRevisions[], evidenceRefs[], reversibility, state | action=tag/virtual_folder/summary_revision/archive/quarantine/forget_candidate；state=pending/accepted/rejected/applied/reverted/stale/failed；quarantine与forget_candidate永不自动永久删除 |
| SummaryRevision | summaryId, sourceIds[], supportingRevisions[], claims[], previousSummaryId(null可用), generationMetadata | claims含text+evidenceRefIds；仅从原始来源提取；grounding失败不发布；无证据不算成功 |
| RestoreRecord | restoreId, proposalId, beforeState, afterState, expectedRevision, outcome, verifiedAt(null可用) | outcome=restored/conflict/failed；冲突不得覆盖新状态；四面与支持关系复验 |
| UsageRecord | usageId, sourceEventId, eventKind, stageBucket, purpose, providerId(null), modelId(null), requestId, attemptId, outcome, attempts, workspaceId, sourceId(null), operationId(null), runId(null), taskId(null), inputTokens(null), outputTokens(null), estimatedCost(null), currency(null), rateSource(null) | sourceEventId绑定权威原始事件且全局唯一；eventKind=knowledge_transport/memory_task/maintenance_task/provider_request；stageBucket由3.10唯一函数映射为knowledge_operation/memory_extraction/maintenance_dispatch/model_request；每实际事件恰好一条账本记录，稳定ID仅连接父任务；attempts不等于成功数；未知usage/价格为null；成本仅提示，绝不触发金额硬停 |

## 3. 公共路由设计

旧 `/v1/knowledge/*` 路由保持；新增路由统一认证，不因文件功能关闭而放开记忆/维护内容 API。工作区/来源权限逐请求核验。写入请求仅接受本路由白名单字段。

| 方法 / 路径 | 输入 -> 输出 | 行为 |
|---|---|---|
| GET/PUT `/v1/knowledge/cloud-consents/{consentId}`；POST `/v1/knowledge/cloud-consents` | scope/provider/purposes + expectedRevision -> consent | revoked 不撤回已发送字节；禁止下一次外发，丢弃在途结果应用 |
| GET/PUT `/v1/knowledge/sessions/{sessionId}/memory-consent` | workspaceId, enabled, cloudConsentId, expectedRevision -> consent | 会话必须存在；开启时服务端确定游标；客户端不得回填历史游标 |
| GET `/v1/knowledge/memories?workspaceId=...&cursor=...` | workspace/cursor -> items,nextCursor | limit默认20，上限100；游标绑定workspace和snapshotRevision，过期409后重新读 |
| GET/PUT `/v1/knowledge/workspaces/{workspaceId}/maintenance-policy` | policy + expectedRevision -> policy | 权限/动作白名单验证；永久删除不是allowedActions |
| POST `/v1/knowledge/maintenance/runs` | workspaceId,policyId + Idempotency-Key；重试可选retryOfRunId -> run | 用户手动或已授权scheduler；只处理已导入source快照；重试仅选旧run失败任务，不由客户端任意构造任务 |
| GET `/v1/knowledge/maintenance/runs/{runId}` | ID -> run/proposalIds | 返回可恢复状态，不返回密钥/宿主路径 |
| POST `/v1/knowledge/maintenance/runs/{runId}/pause`、`/resume` | expectedRevision -> run | 与旧 build cancel/resume 无关；resume 重验同意与source revision |
| GET `/v1/knowledge/maintenance/proposals?workspaceId=...` | cursor/limit -> items,nextCursor | 同上游标；隔离与归档可筛选，不能混成已遗忘 |
| POST `/v1/knowledge/maintenance/proposals/{proposalId}/decision` | decision(accept/reject),expectedRevision -> proposal | 普通用户确认而非模型命令；重复接受幂等 |
| POST `/v1/knowledge/maintenance/proposals/{proposalId}/restore` | expectedRevision + Idempotency-Key -> RestoreRecord | 串行恢复，保留审计和冲突信息 |
| GET `/v1/knowledge/usage?workspaceId=...` | 时间范围 -> calls/outcomes/tokens/estimatedCost | 没有budgetExceeded、不拒绝超过金额的调用；安全或429失败单独统计 |

同意列表/创建后的ID和初始revision由Runtime响应提供；不存在对象GET返回404，更新不隐式创建。Consent撤销使用PUT请求desiredState=revoked，返回state=revoking/revoked及下述确认状态，不把尚未确认的撤销显示为完成。全部新增路由为拟发布目标，RKM-0需完整示例与错误Schema。

### 3.1 首次对象的创建

新增 POST `/v1/knowledge/sessions/{sessionId}/memory-consent` 与 POST `/v1/knowledge/workspaces/{workspaceId}/maintenance-policy`。创建请求只能创建默认关闭对象，不得同时开启；Idempotency-Key必填。默认MemoryConsent为enabled=false、enabledAfterMessageId=null、enabledAfterSequence=null、consentEpoch=0、cloudConsentId=null；默认Policy为enabled=false、mode=suggest_only、allowedActions=[]、sourceScopeIds=[]、trigger=manual、timeZone=null、timeZoneConfirmed=false、localTime=02:00、batchSize=20、concurrency=1。两者初始revision=1。服务端不得从Runtime、浏览器或部署宿主的本机时区填充timeZone；用户在PUT中选择daily时必须同时提交明确确认的IANA timeZone并令timeZoneConfirmed=true，否则422/REQUEST_INVALID。服务端对sessionId或workspaceId建立唯一约束；重复同key返回原结果，其他key碰到既有对象返回409 already_exists及安全对象ID，不覆盖。既有会话/空间第一次打开设置也走此显式创建步骤，禁止读取时隐式写入；UI处理409后GET权威对象。取得revision后才能PUT开启。客户端不可写enabledAfterMessageId/sequence/epoch，服务端在开启事务中确定起始游标。CloudConsent的显式授权创建另见3.7，不套用本节默认关闭对象规则。

### 3.2 授权上下文和撤销协议

以authorizationContext替代单一consentRevision：包含contextId、workspaceId、allowedSources[{sourceId,revision,contentSha256}]、purpose、providerId、cloudConsents[{id,revision}]、memoryConsent{id,revision}(仅提取时必填)、permissionTicket{id,epoch}(仅本地读取时必填)、policy{id,revision}与runExecution{runId,executionEpoch}(仅维护时必填)、workspaceGeneration。多个依据不能压成一个revision。所有生成输入必须属于allowedSources；query文本也须获得ask目的授权。

作用域决策：只对3.7的当前决定槽求值；针对当前来源和purpose/provider，显式source或session级决定优先于workspace级；更具体的当前revoked为拒绝，不被workspace grant覆盖；同优先级冲突拒绝。历史被替代的记录只供审计，不永久阻止显式重授权。没有适用grant则不外发。混合来源按逐来源交集过滤；retentionState=quarantined/forgotten一律不进入默认检索或模型上下文，archived可检索但标注归档。隔离详情只可通过显式管理读取，不借此自动恢复云处理权限。DS必须在检索前及每次模型dispatch前执行同一约束并核对revision/hash/generation，不能先生成再由Navia过滤答案。

撤销采用可观察两步确认，不承诺点击瞬间跨进程原子停止：

1. Navia本地事务递增workspaceGeneration、置state=revoking、禁止新本地读取/派发/结果应用，持久记录待确认撤销。
2. 经公共HTTP通知DS撤销context/generation。DS持久化拒绝代际，并在独立dispatch协调锁下阻止排队任务、后续模型调用和重试取得发送资格。所有出站调用只能经过E19统一dispatch；锁不涉及root IO，不持有跨模型响应等待。
3. dispatch的开始发送事件与DS撤销屏障串行化：屏障前已开始发送的请求列入inFlightRequestIds，不能撤回字节，但其返回不得应用；屏障后禁止开始新发送。若发送交接/存储无法有界确认，DS不得返回完成ack。
4. DS返回完整`BarrierAck{barrierType=authorization_revoke,workspaceId,scopeKey,appliedAt,lastDispatchSequence,inFlightRequestIds,workspaceGeneration,revocationId}`后，Navia才置state=revoked；不得接受maintenance_pause分支或字段缺失的ack。DS离线/超时保持revoking，显示“本地已阻止，服务端撤销待确认”，恢复后先对账撤销再允许任务，绝不自动回granted。已有source读取是否允许按各自scope规则处理。

对CloudProcessingConsent增补state=granted/revoking/revoked、desiredState、revocationAck(nullable)；MemoryConsent和Policy增补revocationState=not_requested/pending/acknowledged。关闭enabled先在本地生效；需要撤销跨服务任务时ack前UI不得声称全链路完成。RKM-1必须验证DS排队/重试/发送屏障的真实能力；无法实现则阻塞接入。对已出站资料无法撤回的风险始终保留。

### 3.3 客户端认证与关闭状态矩阵（S-1/S-11）

本表为RKM目标，不声称现有R1代码已经实现。RKM新增内容/策略/用量API及真实Adapter模式下的knowledge读写，全部先认证；文件开关不再决定这些路由是否受保护。旧PX接口的任何认证变更仍需原合同门禁，不在本文静默改动。

| 调用方向/状态 | 权威校验与结果 | 密钥/网络边界 |
|---|---|---|
| Side Panel或Workspace -> Runtime | 精确extension Origin白名单 + Runtime本地会话Bearer；Origin错误或缺失403；Bearer缺失/错误/失效403，error.code=TOOL_PERMISSION_DENIED，reason=authentication_required | 两容器各自内存token；不进URL、网页、Background消息、localStorage或日志；不将Origin视为身份凭据 |
| Runtime会话凭据未配置/尚未可用 | 受保护数据API一律403，reason=runtime_auth_unconfigured；UI提示配置连接，不返回任何正文/对象是否存在 | 不自动创建默认token，不为测试跳过认证；健康端点只返回非敏感进程状态 |
| 已认证但RKM执行功能关闭/能力未配置 | 新生成/运行/应用返回503，reason=rkm_unavailable；控制面读取/关闭/撤销例外见3.7 | 不fallback至Mock；不返回旧私有缓存；关闭不等于免认证 |
| 已认证且文件功能关闭 | RKM内存/云同意/维护API仍认证后按scope处理；任何文件grant/scan/import拒绝，沿用文件合同禁用错误 | 不把文件权限扩大到云处理/记忆 |
| E10 Runtime -> DS | 独立服务密钥通过`X-API-Key`发送；DS部署必须启用`DATA_SERVICE_REQUIRE_API_KEY=1`且配置非空有效key | 不是转发浏览器Bearer；服务到服务不伪造extension Origin；密钥只在两服务配置中，脱敏记录credentialRef |
| DS key缺失/错误，或DS允许匿名/dev bypass | E10不发送知识正文；显示auth_required，相关操作failed/degraded；匿名探测成功视为不安全配置并阻塞RKM-1 | RKM-1必须实测匿名/错key拒绝，不能只看环境变量；HTTP状态按实际DS合同映射，不改写伪成功 |
| DS -> 模型 | 仅E19受控dispatch读取独立provider密钥；仍验证authorizationContext | 浏览器与Navia公共响应不含DS/provider密钥，三种凭据不可互换 |

E10目标URL仅允许固定配置的loopback数值地址（127.0.0.1或[::1]）和端口，拒绝userinfo、任意用户传入URL、非loopback解析和redirect；不使用环境代理转发资料。公网TLS部署不属于本轮。loopback降低暴露面但不防恶意同用户进程，服务密钥仍必需。测试客户端的Origin只用于显式测试，不计真实浏览器用户入口。公共HTTP调用成功与scope/提供方授权成功是两个独立条件。

### 3.4 撤销中止与共享支持关系（S-9/S-10）

撤销只新增RKM操作phase，不改变旧buildStatus，也不提供旧PX的cancel/resume按钮。queued/submitting/running/awaiting_reconciliation在授权撤销后进入aborting：停止本地派发/应用，等待DS取消排队与重试、记录已发送集合并持久ack。DS离线则保持aborting、consent=revoking；异常原因写lastError，不能伪造aborted。收到匹配generation的ack且应用屏障已持久后才aborted；这只证明不再应用结果/发新请求，不证明网络响应已停止或提供方删除资料。aborting/aborted禁止转succeeded；若重新授权，必须创建新operation并绑定新context。已succeeded历史operation不改成aborted，后续撤销限制新使用；永久Forget另建删除操作及账本。

不新增`KnowledgeSource.sharing.outbound`来混用“外发授权”和“共享知识贡献”。外发权威唯一是authorizationContext；共享贡献使用拟新增`SharedSupportVerification`：workspaceId、forgetOperationId、forgottenSourceId/revision、observedAt、items[{itemId,itemRevisionBefore,itemRevisionAfter,action=recomputed/removed/failed,supportingSourcesBefore[],supportingSourcesAfter[],evidenceRefsAfter[],resultArtifact{path,sha256}}]。每个supportingSource含sourceId/revision，不能只列名称。`supportingSourceIds`是after集合的派生兼容字段，必须严格相等。

两个source共同支持item时，删A后必须重新核验B能支持哪些claim；不可仅删A引用而保留A独有内容。after空则item/相关edge删除；有剩余则保留真实支持的部分、提升revision，失败保留tombstone并degraded/failed，不可verified。跨workspace支持禁止。使用公共API及原始span复验 before/after，不用UI数组变空当成功；永久Forget、维护restore与重启均沿用该规则。

### 3.5 维护运行与调度的封闭决策（RC-01）

Policy默认disabled且mode=suggest_only。disabled时只能查看已有建议/记录、拒绝建议、发起撤销；不能生成新建议、应用、restore或排定新任务。用户显式开启后，suggest_only允许生成建议但不自动应用；用户接受建议仍需当前policy/source/同意验证。reversible_auto仅可自动执行allowedActions中的tag/virtual_folder/summary_revision/archive，quarantine只允许用户接受后应用，forget_candidate只能提示用户另行走永久Forget确认。空allowedActions或空sourceScopeIds不代表“全部”，发起run返回REQUEST_INVALID；UI必须先完成配置。

| 当前state | 事件与下一state | 必须满足的持久事实 |
|---|---|---|
| 无run | 合法手动/定时触发 -> queued | E12原子写run、inputSnapshot、任务键；不在响应后才登记 |
| queued | 获取workspace执行租约 -> running；暂停/关闭 -> paused | 每workspace最多一个queued/running/paused未终结run；重复触发返回现有run，不排隐形积压 |
| running | 暂停/关闭/重启 -> paused | 本地立即禁止新dispatch及应用；pauseState=pending直到3.9的DS屏障ack，未确认不宣称远程停止；已发/未知结果对账，不撤回已发字节 |
| paused | 用户resume -> running | 3.9匹配pauseAck、policy仍启用且revision未变、原授权依据仍有效、快照revision/hash相符、旧请求已对账；新executionEpoch及新子operation，不复用aborted操作 |
| paused | 授权永久撤回、policy revision/范围变化、输入失效 -> degraded/failed | 完成屏障与对账后，未完成任务记录失效原因；有成功任务为degraded，否则failed；释放执行槽，用户可建新快照run。DS未知则保持paused/pending，不能为腾槽伪造完成 |
| running | 全部任务已确认成功 -> completed | taskResults逐项有证据；suggest_only生成完建议即可completed，pending人工决定另计，不假称已应用 |
| running | 有任务失败/冲突且无待定远程结果 -> degraded；全部失败 -> failed | 未知远程结果仍留paused待对账，不能归入成功；不存在空任务completed |
| completed/degraded/failed | 终态不重开；显式retry创建新run | 只选失败任务，新的输入快照/授权/幂等键，已成功任务不重复应用 |

非终态finishedAt必须null，三终态必须非null；startedAt在首次running产生且不随resume改写。taskResults绑定taskId/sourceId/action/operationId/outcome/evidence，不以游标数替代结果。cursor指最后确认完成任务，不指已派发任务。旧operation的aborting/aborted继续按3.4处理，不并入run state。

daily使用Policy所有者在用户配置或浏览器提示中明确确认并持久化的IANA timeZone及localTime=02:00；部署机时区和后续系统时区变化均不得隐式改Policy。唯一调度键为policyId+当地日期，夏令时重复时刻仅一次、不存在时刻跳过；离线错过不补跑，不唤醒机器。Runtime恢复把未终结run置paused(reason=runtime_restart)，本地在用户resume前零新提交；DS仍运行时可能在收到暂停通知前发送旧队列，必须登记为屏障前事件，不能承诺重启瞬间远程停发。DS持久pauseAck后旧epoch零新发送/发布，新epoch只能由用户resume创建；有paused run时新日程记skipped_active_run。用户修改Policy时区须显式保存并递增revision。并发租约由E12事务维护；禁止两个Runtime写同一治理数据库而各自调度。

### 3.6 已完成对话的可靠交接（RC-02）

E07在现有SQLiteSessionStore内拟新增session单调messageSequence与`memory_turn_outbox`，不改A/C/D公开事件。E12仍是Consent/知识操作权威；不要求跨两个SQLite库原子提交，也不新增消息中间件。开启/关闭同意与turn开始/完成通过同一个session协调锁排序；锁内只做本地事务，不调用DS或模型。开启事务在E12写入当前E07最大sequence和递增consentEpoch；enabledAfterMessageId只是对应的显示ID，空session时ID=null、sequence=0，不表示允许历史回填。

仅开启后开始且完成的turn符合条件：用户消息sequence必须大于enabledAfterSequence，turn开始与完成的consentEpoch相同且enabled=true；开启前已经开始但尚未结束的turn不得提取。关闭后再开启用新epoch/游标，不补关闭期消息。E07完成turn的最终消息和outbox行在同一SQLite事务提交，事件只存eventId/sessionId/turnId/messageIds/sequence区间/consentId/epoch，不复制正文。事务失败不能标turn已成功提交；仅转交E13失败不能回滚已经提交的聊天。

E13至少一次读取outbox，逐次重验Consent/云授权/tombstone，通过E12唯一键(sessionId,turnId)登记任务与远程提交outbox；成功登记后才ack E07事件。ack丢失允许重放，但只能返回同一任务，不再提取/建source；撤销epoch的事件标suppressed，不在重授权后复活。崩溃发生在消息提交前、提交后登记前、登记后ack前均有确定性恢复。Runtime重启先完成撤销对账再消费，未知远程操作按原key查询，不能凭事件重放再调用模型。原始聊天内容不因为事件ack、Forget或恢复而修改。

本地协调必须覆盖全部写入入口，T05/D04逐项列出现有stores调用路径、连接/transaction owner、commit/rollback点和错误传播。兼容的可证伪判据固定为：最终assistant消息与对应memory_turn_outbox可在同一现有SQLite事务提交；任一写失败均保持原消息提交失败语义；不新增或修改A/C/D公开事件、响应字段或ErrorCode；现有非记忆会话路径的提交次序与恢复结果不变。任一判据无法由源码路径、事务测试设计和迁移回滚矩阵证明即判不兼容，停止D04冻结并回合同门禁，不在T08临时扩公开合同。并发多Runtime写同一session数据库不支持，部署必须拒绝第二个写进程。

### 3.7 控制面可用性与重新授权（RC-03）

只有RKM运行/模型功能不可用而E12仍可读写时，认证与scope通过后，GET已有consent/policy/run/usage、PUT关闭或desiredState=revoked、pause仍可使用；新run/生成/应用/restore/开启返回503。DS离线不得阻止本地关闭/撤销持久化，响应明确revoking/pending而非全链路成功。E12不可用则失败，UI明确“撤销尚未持久化”，不能返回成功；缺/错凭据仍拒绝，控制面例外不是匿名后门。恢复服务必须先同步所有pending撤销，再允许新的外发。

CloudConsent的POST要求用户明确确认scope/provider/purposes，初始revision=1、state=granted；没有对象或没有grant就是拒绝，不增加隐式默认grant。PUT撤销只能granted -> revoking -> revoked；scope/provider/purposes变更先撤销旧对象并取得ack，再POST新consentId重新确认。revoked对象不原地变回granted，旧context/operation不复用。任一scope撤销递增workspaceGeneration，使该workspace全部旧context失效；不把其他同意改成revoked，但所有新任务必须重新计算有效依据。该保守设计会暂停无关在途任务，代价是重新确认/重试，不冒险使用旧代际。

为避免旧拒绝永久阻止重授权，E12持久化`ConsentDecisionSlot`：key=(workspaceId,scopeType,scopeId,providerId,purpose)，字段decisionRevision、activeConsentId、decision=granted/revoking/revoked。每key恰好一个当前决定，历史Consent/Slot版本保留审计；评估仅取当前Slot。POST必须带expectedDecisions[{key,decisionRevision,activeConsentId}]，首次空槽用revision=0、id=null；替代旧拒绝时必须同key且旧撤销ack已完成。新grant/slot更新在一个E12事务CAS，任一key冲突则整体409/revision_conflict、零创建，不能以时间戳“最新者胜出”。旧对象不是重新granted，而是从被替代key的当前决定中退出；decisionRefs记录新槽版本。

scope/provider/key改变不会删除原key拒绝，新的workspace grant不能替代source/session deny。一个旧Consent覆盖多个purpose时先整体撤销，随后仅对用户再次确认的purpose逐槽新建grant，其他槽仍revoked；不支持本轮隐式部分撤销接口。并发新确认只有一个CAS成功，另一个返回409后重读。DS授权校验必须绑定当前slot版本和context，不能只凭历史consentId仍存在就放行。同scope重授权、部分purpose再确认及并发替代是强制负例/正例对。

### 3.8 永久遗忘优先于恢复（RC-04）

RestoreRecord只恢复产品自有可逆状态，不能撤销永久Forget。用户restore时及最终提交时均以E12/DS持久tombstone校验所有支持来源及revision；任一来源已forgotten则409/INVALID_TRANSITION/revision_conflict，标proposal=stale、outcome=conflict，零应用。不能从beforeState复制旧摘要或重新导入原始聊天/文件补足来源。恢复隔离/归档同样重验当前权限，不恢复旧cloud/memory grant。

Forget级联必须包括SummaryRevision正文、OrganizationProposal含来源内容的reason/证据快照、RestoreRecord的beforeState/afterState内容及未消费memory outbox/operation结果。可保留不可恢复正文的最小ID/删除状态审计记录；其他source共同支持的内容按SharedSupportVerification重算，不直接全删。备份恢复先重放独立删除账本并清理旧恢复材料，再开放查询/任务；删除账本缺失或无法证明新鲜度时保持恢复隔离并拒绝服务，不能宣布完成。该规则只约束Navia/DS管理的备份，不能承诺擦除用户另行保存或提供方留存的副本。

### 3.9 维护暂停的独立执行屏障（本轮独立审查IR-02/03）

普通pause不撤销CloudConsent/Policy，不递增整个workspaceGeneration，也不阻止无关Ask。维护context必须带runExecution，E12初始executionEpoch=1。pause或Runtime恢复未终结run时：本地持久paused/pauseState=pending、禁止该run的新提交/应用 -> 公共HTTP请求DS阻断(runId,executionEpoch) -> E17/E19在该run的dispatch及写回资格处持久屏障 -> 回完整`BarrierAck{barrierType=maintenance_pause,workspaceId,scopeKey,appliedAt,lastDispatchSequence,inFlightRequestIds,runId,blockedThroughEpoch}`。不得接受authorization_revoke分支或字段缺失的ack。同一run小于等于blockedThroughEpoch的任务永远不能新发送或发布新结果；所有在途发送如实列明。屏障前已经真实提交的结果只能对账，不能假装从未发生。DS离线保持“本地暂停，服务端待确认”，不显示完全暂停。

用户resume只在ack匹配、旧operation结果全部已知、原policy/授权仍有效时允许；E12事务递增executionEpoch，剩余任务保留taskId但新建operation/context及retryOfOperationId，已确认成功的任务不重复派发。被屏障终止的旧operation标aborted，不允许转succeeded；旧迟到draft不应用。屏障前已提交的变更从真实对账更新taskResults，不重做；未知提交不能换key重试。DS只在收到带有效授权的新epoch上下文时允许该run后续发送，旧epoch始终阻断。

Policy关闭/修改或授权撤销时，普通pause与授权屏障可以都在pending；完成相关ack及对账后旧run终结degraded/failed并释放槽，不把旧run裁剪成新scope、也不通过重新grant复活其aborted子操作。用户新建run只能使用当前授权/新快照。若仅用户普通暂停且policy/授权未变，可按前款继续原run。暂停按钮与状态提示不能把本地状态当远程事实；RKM-1必须验证run级协议，完整UI及scheduler留RKM-4。

3.2授权撤销与3.9维护暂停复用DS dispatch协调基础设施，但必须冻结为判别联合而非可选字段大对象。公共字段固定为`barrierType,workspaceId,scopeKey,appliedAt,lastDispatchSequence,inFlightRequestIds`。`authorization_revoke`分支必须且只允许增加`workspaceGeneration,revocationId`；`maintenance_pause`分支必须且只允许增加`runId,blockedThroughEpoch`。ID均为opaque string，禁止用分隔符拼接。授权scopeKey=`consent-slot:sha256:`+小写十六进制SHA-256(RFC 8785规范JSON数组`["consent-slot",scopeType,scopeId,providerId,purpose]`的UTF-8字节)；维护scopeKey=`maintenance-run:sha256:`+小写十六进制SHA-256(RFC 8785规范JSON数组`["maintenance-run",runId]`的UTF-8字节)。解析器必须按原始字段重新计算scopeKey，先按barrierType选分支，再校验所有公共/专属字段，不允许拿pauseAck满足撤销、拿revocationAck满足暂停或忽略额外分支字段。T05负例必须包含含冒号、Unicode和空字符串段的不同输入组合，证明不会碰撞或被字符串拆分器误配。每个ack的幂等键、查询结果和错误码独立。

E16用户状态固定区分：`local_blocked_remote_pending`表示E12已阻止本地新提交/应用但DS尚未确认，中文显示“本地已暂停，服务端待确认”；`remote_acknowledged`表示匹配ack已持久化，显示“已暂停”。前者不得显示完全暂停、不得启用resume；DS失联或重启恢复未终结run均先进入前者。该显示状态是合同派生，不新增MaintenanceRun.state。

### 3.10 Usage主分桶的确定性归类（G-3）

每一条原始可计量事件由权威发射方持久生成不可复用的sourceEventId，先确定eventKind，再由封闭函数映射stageBucket，不允许依据purpose、是否含runId或调用方页面自行选择：`knowledge_transport -> knowledge_operation`（Runtime与知识服务间非模型save/build/query/graph/trace/forget传输）；`memory_task -> memory_extraction`（创建、提取、提交或对账记忆任务本身，但不含其中的模型外发）；`maintenance_task -> maintenance_dispatch`（创建、派发、应用、恢复或对账维护任务本身，但不含其中的模型外发）；`provider_request -> model_request`（已到send_started或发送交接结果unknown的模型/provider尝试，不论由Ask、记忆或维护触发；仅intent_created且未取得发送资格不生成该类UsageRecord）。

一个维护任务触发模型调用时产生两条不同sourceEventId：maintenance_task记录任务派发，provider_request记录实际模型发送；二者具有不同usageId并以同一runId/taskId关联，不是同一事件重复计数。一个记忆任务同理。四类原始集合K/M/T/P按sourceEventId两两不相交，`UsageRecord.sourceEventId集合 = K ∪ M ∪ T ∪ P`，且每个sourceEventId恰好一条记录。模型实际发送/费用分母只取P中具有send_started或发送交接unknown原始证据的记录；父任务K/M/T不进入该分母。若同一sourceEventId被映射两桶、遗漏/孤儿、eventKind与stageBucket不匹配、provider_request缺发送观察、或非provider事件伪造token/cost，均失败。T05须为四种映射各提供正例，并为错桶、双桶、sourceEventId复用/遗漏/孤儿、父任务冒充模型请求、模型请求并入父任务提供负例。

## 4. Adapter 与跨项目映射

KnowledgeServiceAdapter 方法固定为 status/list_workspaces/list_sources/get_source/save_source/get_operation/query/graph/trace/forget/commit_authorized_batch；旧 R1 验证方法语义保留。真实实现 E11 通过 E10 调 D `/api/workspaces` 和 workspace-scoped sources、build/start、build/operations、query、graph/query、source/trace、units/evidence API。`status=ok` envelope 不等于请求业务成功；须检查内部 status/capabilities、source状态与operation终态。

RKM-1 配套 API 设计要求：DS source import 接受并持久校验 Idempotency-Key；暴露按该key查询提交结果；Forget 支持删除操作ID、generation/tombstone、各存储清理结果与共享支持来源；能力接口显式声明这些特性。必须同时具备3.2节authorizationContext过滤、dispatch屏障、持久撤销及ack；拟新增公共操作为validate_authorized_context/revoke_context/query_authorized，精确HTTP路由在RKM-0/1 API diff中冻结。不允许Navia自行读DS文件“补齐”接口。API snapshot逐字段对应后才能冻结实际路由/版本，当前不能伪称候选接口均已存在。

另需3.7当前ConsentDecisionSlot校验与3.9run级pause屏障/ack：属于目标协议，不是假定现有DS支持。D03需冻结精确路由/请求/错误及版本协商；RKM-1先做服务级同scope重授权、暂停/恢复代际、旧结果对账spike，不前移完整维护产品。

D03必须提供逐能力矩阵，字段固定为capabilityId、prdRequirementIds、targetProtocol、observedEvidence、implementationOwner、firstVerificationStage、disposition。disposition只能是`observed_supported/requires_ds_public_api/requires_navia_adapter/not_observed/prd_blocker`；不得出现“可降级通过”。PRD必需能力若无法由DS公共API或已批准的Navia Adapter补齐即为prd_blocker并阻塞T06。缩减PRD目标只能由用户明确批准后重新修订PRD、架构、合同和验收；不以Mock fallback、私读DS workspace或UI过滤冒充支持。

Ask必须携带 backend真实检索证据及generationMetadata（provider/model/fallbackMode）；有证据但fallback只能显示降级，不能算真实生成通过。精确 source/unit/evidence ID、引用文本及定位必须回读公共 API 校验。Graph按source/证据过滤，不在前端构造关系。对话记忆摘要的永久Forget只删除知识副本及派生贡献，原始聊天删除属于另一个明确用户动作。

## 5. 错误与兼容门槛

现有HTTP错误码继续使用REQUEST_INVALID/TOOL_PERMISSION_DENIED/INVALID_TRANSITION等，新增details.reason闭合为 already_exists/authentication_required/runtime_auth_unconfigured/rkm_unavailable/cloud_consent_required/cloud_consent_revoked/provider_scope_changed/revision_conflict/reconciliation_required/unsupported_capability/grounding_failed/backend_unavailable；3.1的创建冲突为HTTP409、error.code=INVALID_TRANSITION、details.reason=already_exists；3.3的503使用error.code=INVALID_TRANSITION、details.reason=rkm_unavailable。实际冻结时必须核对现有enum，不以自由字符串掩盖新合同。费用估算缺失是usage未知，不是业务错误。RKM-0必须加入两个并发创建请求的负例，确保不会生成两个对象。

T05/RKM-0必须完成 Schema/OpenAPI/TS/Python映射设计、root正例和RFC6902负例、规则执行层及失败码registry、读写权限表；T06/RKM-1在真实spike后冻结DS精确API。D06顶层注册表固定39项，封闭集合如下；不得只依赖区间展开或扫描标题推导：

```text
S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S14,
S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08,
S-09, S-10, S-11, S-12, S-13, S-14, S-15, S-16,
RC-01a, RC-01b, RC-02a, RC-02b, RC-03, RC-04,
IR-01, IR-02, IR-03
```

集合计数固定为14+16+6+3=39。子场景使用父ID加稳定后缀，不改变顶层分母；遗漏、重复、改名、failed/pending/deferred移出必需集合均必须失败。文档合同不能替代可执行schema或真实spike。所有测试命令在登记前检查文件存在，未实现命令明确标记planned。
