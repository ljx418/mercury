# V2-RKM 开发顺序、里程碑与交接计划

修订：2026-09-10。当前为DOC-Closure文档修订，所有未来实现均需用户批准。主线：R1前端/Chrome -> R2采集 -> R3共享校验 -> R4快照复验 -> PX-6人工 -> RKM-0..5；不得因新目标而绕开旧Major。DOC-Closure不是实施任务编号；唯一实施编号为T01..T10，其中T01..T04完全属于原PX修复，T05..T10才是RKM增量。当前可继续细化D01..09的计划要求，但不称为进入T05/RKM-0实施。

## 1. 任务与目标体验

| 任务 / 里程碑 | 实体及详细工作 | 完成后的用户体验 | 出门与依赖 |
|---|---|---|---|
| DOC-Closure 现状和文档闭环（非实施任务） | 同步总PRD/架构/计划/旧gap，新增本阶段文档、图纸、风险/追踪表 | 可区分当前产品与目标，不误以为Mock是外脑 | 只批准文档，不改变旧门禁；审计S00；不占用T编号，不是T05/RKM-0实施 |
| T01 R1前端及Chrome | E03..06 认证错误类型、token清理/过期响应失效、权限扫描导入、Forget失败展示；复验后端239项历史结果而非复用计数 | 两容器分别认证，授权/扫描/导入可操作，失败可理解 | 真实双容器+文件HTTP E2E、独立复审；S01/S08/S09 |
| T02 原PX-5 R2原始采集 | E20采集trusted事件、真实请求/响应字节、容器ID、mutation/navigation代际、截图；不是RKM-1后续任务 | 看到实际操作路线与证据，不是脚本填值 | 同run源/图/日志配对；无缺失或伪造；仅原PX范围，S02/S03/S13作后续关联 |
| T03 R3共享校验 | E20纯生成器、共享semantic/AST核心、原始读取器、production profiles；保留合同109例+新增生产变异 | HTML/JSON与实际操作一致，可定位失败 | 合同及生产负例独立通过；human pending时final=false |
| T04 R4与PX-6 | 双仓适用源码快照、构建/依赖索引、全量复验、中文报告/图纸、独立复审及人工体验 | 历史PX限定范围正式闭环 | PX-5机器无Major后才PX-6；不可自动签名 |
| T05 RKM-0合同冻结 | E11..19设计转机器Schema/OpenAPI，规则/负例/错误registry、API diff、前端新增组件交互原型 | 人类可审查每个新操作与风险；尚非产品 | T01..04/PX-6通过、用户批准新增实现、T05预审计无Fatal/Major；本阶段出门再要求合同/原型独立审计通过 |
| T06 RKM-1真实服务适配 | E10/E11/E17..19能力探测、workspace/source/operation/evidence映射、幂等及删除配套API；真实HTTP spike | 连接到真实服务，显示未配置/鉴权/版本/构建异常，绝不悄换Mock | S04/S08/S09/S12，真实模型未测不能标ready |
| T07 RKM-2持久知识与问答 | E12持久化/outbox/恢复；真实build/query/graph/trace接入E03..06；公共API定位引用 | 保存后重启仍保留；多来源问答有依据；图谱能回看来源 | S01..09全部适用项，包含真实服务接入后的双容器认证复验；质量指标达标、数据不串空间 |
| T08 RKM-3指定对话记忆 | E07完成turn+内部outbox同事务，E13消费/E12去重；同意epoch/游标及E16开关；出处/撤销；新记忆source适配 | 开启后开始且完成的turn可追溯；重启不丢已提交事件、不回填历史 | S10及S08/S09、RC-02故障矩阵；不改A/C/D公共事件，若必须改回合同门禁 |
| T09 RKM-4可逆维护 | E14/E15/E16政策、串行任务、Inbox、摘要版本、归档/隔离、恢复、用量统计 | 安静生成建议；明确授权后自动整理；每次动作可回看/撤销 | S11/S12及S08/S09；未授权IO/外发/永久删除=0 |
| T10 RKM-5全量出门 | 新独立证据目录，重复真实服务场景、模型质量、恢复故障、源码扫描、中文HTML及图纸 | 人工按完整用户路线体验，看到能力及限制 | S00..14，机器+独立复审通过后人工签署，才有限RKM完成 |

## 2. 每个子阶段的执行协议

实现前在该阶段 evidence 下落盘 development-plan.md、acceptance-plan.md、preimplementation-audit.md，列本表任务、合同hash、范围、案例、依赖、停止条件；不得把总计划代替子阶段审计。先复现失败用例，再实现、回归、端到端、prd-review.md、architecture-review.md、independent-audit.md、handoff.md。

现有明确的Major修复按批准边界推进；新发现重大安全、规格或假绿风险立即停止找用户确认。普通测试失败返回本阶段计划重审，修复后重跑受影响全链路，不降低门槛。不能用一个阶段的PASS代表另一个阶段。

本表S编号表示最终目标关联，精确出门范围以[验收计划第5节阶段适用矩阵](v2-real-knowledge-maintenance-acceptance-plan.md#5-独立审查补充断言与阶段适用矩阵)为准。T01..04只执行原PX承诺；T06是隔离DS协议spike，不要求T07生产持久化或T08/T09工作流先完成。T07不验尚未新增的三条管理路由；T08/T09各自补新增场景；T10全量重跑，无deferred可计通过。

每阶段requiredAssertionIds和分母在执行前冻结，必需项failed/pending/deferred均阻止本阶段通过；只有预先列入后续阶段的项目才标not_applicable并不进分母。AC01..04不依赖T05的D01..09；T05负责产出它们，T06之后才依赖冻结产物。S08-B-protocol先在T06验证，T07只读已存在retention状态，产品隔离/restore的S08-B-product属于T09，不能前移为T07出门条件。

## 3. 工程与部署交付

- 实施只触及所属实体；data_service必要修复在隔离分支，公共API变更单独diff/复审，不移动用户知识目录。
- 服务只绑loopback；使用现有WXT/React/Python栈与公共HTTP，不新增平行知识框架。候选模型/服务版本锁定失败则停止真实接入，不退回mock通过。
- Git快照不改变主工作树index/HEAD、不push；新源码/依赖/工具hash均入冻结快照。部署说明列启动/停止、健康、凭据配置、持久目录、备份恢复和权限失效，无默认本地文件扫描。
- 回滚可切回旧产品版本但真实数据保留独立namespace；不得用旧mock读取新数据或恢复已Forget的内容。备份恢复须重放删除账本，密钥与私有原始证据不入公开包。
- 新模型调用只在用户批准代码阶段、资料外发同意存在后执行。无金额硬限；超时/429/用户暂停的安全处理不取消。

## 4. 命令与证据约定

已有命令仅作未来执行入口：`npm --prefix apps/chrome-extension run test`、`typecheck`、`build`；Runtime `PYTHONPATH=services/local-runtime pytest -q services/local-runtime/tests`。不得在当前脏工作树运行会覆盖tracked构建的命令；实施时在隔离快照执行。

旧 `e2e:chrome:v2-px-production-evidence` 串联未修复生成器/validator，T03审计通过前禁跑。T02先使用专门的新run采集入口，不覆盖旧报告。RKM专用E2E/validator命令在T05写入可执行合同后登记，此刻标记PLANNED，不虚构可运行命令。

每阶段记录 changed files、contract changes、实际命令/exit/log/hash、真实数据来源、PRD覆盖、剩余风险及Integration notes。文档期的静态审计只能支持文档结论。

## 5. 第二轮复审后的执行交接要求

本日风险再核查新增RC-01..04：T05冻结contracts3.5..3.8及acceptance8全部断言/迁移设计；T06先证实DS持久撤销及派生删除协议，T07实现控制面与基础备份删除账本屏障，T08交付session事务outbox/epoch，T09交付运行终态/日程/派生恢复材料清理，T10全量复验。RKM-0..5当前仍未实现，这些不能算完成率分子。T05若发现现有Chat事务/错误合同无法容纳设计，必须先回合同门禁，不在T08临时扩A/C/D事件。

- T04与T10使用不同的最终独立审查代理/session，均不得是被审阶段的实施者或报告生成者；记录reviewerId、reviewSessionId、reviewedSnapshotHash、reviewArtifacts及decision。只改显示昵称不算轮换。找不到符合条件的审查者则保留待复审，不让生成器代签；最终人类体验签署可以仍由同一用户完成。
- T05机器合同必须逐项承接复审S-1..S-16及验收第6节新增负例，每个设计处置都有requirement/rule/base/mutation/expected-failure映射；文档处置不能算fixture通过。
- T06使用独立`navia-rkm-spike-<runId>` namespace和授权公共项目样本副本，不迁移旧Mock、不访问现有私人workspace或R1证据数据；清理仅限本run创建对象，保留日志/hash。
- T06保留真实DS公共HTTP的来源过滤、撤销屏障、幂等、删除/共享贡献before/after测试，不降为只读capability枚举。服务级S09至少验证A/B共同支持、删除A后的真实读回与DS重启；不要求尚未开发的Navia E12生产恢复、UI双容器或完整用户S09。必须报告protocol-only，完整S09在T07及后续阶段执行。
- T06的hook仅在隔离spike进程启用，含transport观测与工具hash；能力不足立即返回T05审计或停止，不能向旧PX计划插入新增产品实现。
- T04与T10证据路径物理分离，按验收6.3的run/profile绑定；PX全量通过不能折抵RKM的真实重新执行，历史样本或文档预览不得凑分母。

## 6. 剩余阶段的实施工作包（本轮文档细化，尚未执行）

2026-09-10：用户认可图纸方向，不等于批准代码。以下定义未来实现的顺序与交付；不能通过把阶段命名为“合同冻结”就跳过旧PX前置。当前允许编写这些设计、验收矩阵和审查记录；真正冻结为实施基线仍需前置通过、机器合同及对应阶段批准。

### T01：完成R1前端与真实Chrome闭环

输入：原PX修复执行合同、R1后端限定复审、当前未冻结源码，不能只用历史pytest计数。顺序：核对E05类型化错误 -> E06认证入口始终可见 -> 两容器token独立/断开清理 -> E06权限授权/扫描/选择导入/撤销及Forget失败 -> E03/E04绑定 -> 独立快照运行后端回归和真实UI。

仅修改原PX所属E03..06及其测试，涉及E07/E08行为必须回到R1合同边界。验收必须真实输入两次token，证明403不是offline，过期请求不回流；文件启用/关闭、三root和四面Forget路径按原合同执行。交付本阶段prd-review、真实Chrome原始run及独立复审；新Major停止，不前移真实DS或维护。

### T02：采集不可补写的原始观察

输入：T01明确通过的原PX路径及冻结测试snapshot。顺序：E20父进程命令采集 -> 新run/segment登记 -> trusted DOM动作关联请求 -> network entity bytes和transport失败 -> 导航/变更代际 -> PNG和metadata -> 封存只读原始索引。restart开启新segment；source ID从真实响应映射，不能以corpus位置推导。

负向试跑缺响应、错requestId、旧authority、伪手势、捕获路径错配、缺日志，必须得到collection diagnostic而不是合成成功报告。本阶段不运行旧串联生产生成器，R3尚未交付不伪称semantic完成。交付sealedRawRun与各缺失项诊断。

### T03：纯派生与共享校验

输入：T02封存原始run、原PX合同109负例、修复合同中的profile和无环封存顺序。顺序：实现raw reader -> 对原始事实纯派生 -> 与contract reader共享semantic/AST核心 -> 固定candidate/final规则适用表 -> 命令/规则集执行记录 -> 中文HTML只读展示。生成器禁止写原始run或补用户动作。

同时保留109例回归和新增原始字节/事件变异，尤其源码注入违规调用但report.violations=0仍拒绝；candidate有人审pending，final=false。交付新工具实际命令、exit/log/hash、逐规则覆盖及独立反假绿审查。没有全部执行记录不允许转T04。

### T04：PX快照复验与人审

输入：T01..03通过记录和新隔离快照。顺序：收录源码/依赖/合同/工具 -> 构建 -> G1..G7全量 -> 生成HTML/exit manifest -> 独立复审 -> PX-6人类实际体验签署。快照不修改主index/HEAD、不push。人工修改意见需新版本下游报告/签署，不复用旧human hash。

出门只声明原PX限定双容器产品验收；Mock知识不升级RAG。T04失败时后续RKM实施暂停，但不禁止当前文档研究。

### T05：RKM-0合同与新增原型冻结

输入：PRD17.3、E01..20实体表、contracts全部章节、S01..14和RC断言、原PX前置通过及新实施批准。依次交付以下命名的设计产物，文件未存在前不得写命令“已通过”：

| 编号 | 拟落盘设计产物 | 必须包含的内容 |
|---|---|---|
| D01 | RKM domain/status schema与版本索引 | 对象/嵌套字段/必填null/额外字段/ID/revision、状态转移、已有build enum兼容；源码raw hash可重算 |
| D02 | Runtime RKM OpenAPI | 每条创建/读取/修改/列表/暂停/恢复/删除入口、认证/scope、分页、幂等、所有HTTP错误与恢复动作；不照抄合并GET/PUT的简表 |
| D03 | 双仓API差异与目标协议 | 已有API snapshot、拟增请求响应/能力/拒绝/ack/结果对账；逐能力记录PRD要求、证据、责任方和处置；仅observed_supported/requires_ds_public_api/requires_navia_adapter/not_observed/prd_blocker，不允许未批准的“可降级通过”；撤销与暂停共用BarrierAck基础设施但按barrierType隔离 |
| D04 | 持久化/迁移与事务ADR | E07 session outbox/sequence，E12 schema/唯一键/outbox/tombstone，锁序/单写限制、崩溃矩阵、备份删除账本；附现有stores完整写路径及transaction owner/commit/rollback/error传播；按合同3.6四项可证伪标准判兼容，否则停止冻结 |
| D05 | 验收manifest/report/raw observation合同 | source/query/operation分母分开，Usage按knowledge_operation/memory_extraction/maintenance_dispatch/model_request四个主分桶且不重复计数；逐run/segment/动作/ID/状态/截图/claim及人审等级；无环hash和私有证据脱敏 |
| D06 | 规则/requirement/fixture注册表 | 顶层固定39项：S01..14=14、S-01..16=16、RC六项、IR三项；shape/semantic/human分层；每项唯一ID/base/raw mutation/失败码，完整根正例与隔离负例；缺项/重复/deferred缩分母必须失败 |
| D07 | 前端增量交互原型与模块规格 | E16四组件、云同意入口、旧五/新三route、首次创建/关闭/错误/暂停/恢复/冲突；明确local_blocked_remote_pending与remote_acknowledged中文状态；真实交互原型非图纸投影，独立标记模拟数据 |
| D08 | 真实语料与gold设计 | 24来源/24题、三空间/会话、维护样本、评分rubric；作者不得自审，至少一名独立审查者绑定session/输入hash/decision；gold变更新版本并重跑受影响题目；不擅自新增双人签署或伪造author/human签名 |
| D09 | 子阶段命令及证据索引 | 命令文件存在后登记、execution mode/作用目录/清理规则、预审计/交接模板及所有断言的首次执行阶段 |

这些是T05的明确出门工作，不是本轮已交付九份机器文件，也不能因当前DOC-Closure补充了要求就改写为T05已启动。D03可以冻结待验证目标协议；T06若实际API不相符必须返回D02/D03/D06修订复审，不在产品代码里猜字段。D04必须读现有Chat内部事务路径证明不改变A/C/D公开事件，兼容性不能证明则停止冻结。

### T06：RKM-1 DS协议spike与真实能力锁定

本轮独立审查补充：D03还需锁定ConsentDecisionSlot有效决定和runExecution/pauseAck协议；T06执行IR-01..03的服务级部分，T07/T09分别执行真实控制面和维护任务槽验收。禁止在T09才首次发现DS只支持workspace撤销、不支持维护run级暂停。

输入：T05通过版本和新的隔离DS namespace，固定仓库commit/tree/依赖/许可/认证。顺序：匿名/错key/地址边界探测 -> 实际capability/API diff -> 同key导入和未知提交查询 -> build/query/graph/trace/evidence稳定ID -> 授权过滤及四点撤销 -> A/B共享支持删除/重启 -> 实际provider/model/usage核对。日志与真实模型样本单列，不把受控故障接收端算模型质量。

E10/E11只作必要隔离适配，E17..19必要公共API修改先审diff，不先开发完整E12/维护UI。交付protocol-only结果、unsupported清单与DS-1继续/停止决定。删除仅标记、无ack屏障、模型fallback或匿名绕过任一存在，就不宣称真实服务ready；不得改选DS-2/3而不经用户批准。

### T07：RKM-2持久知识与真实问答

输入：真实协议锁和T05合同。顺序：E12持久映射/幂等/outbox/reconciliation/删除账本 -> E11真实Adapter替换显式配置 -> E05/E06真实状态和云同意控制面 -> 保存/双服务重启 -> E15 grounding -> Ask/Graph/Trace -> 四面Forget/共享贡献 -> 备份恢复保护。保留旧Mock仅作明确测试模式，不作故障fallback。

真实24来源与24题执行S01..09适用矩阵，未知提交、撤销与重启故障必须有原始证据。先冻结输入gold再生成，不能事后换题/换gold。交付真实路由恢复、来源ID/版本、权限、质量及删除验收。三条维护路由尚未交付，不把它们列passed。

Ask除检索/引用/grounding外，还须按gold.requiredClaims验证完整回答率>=0.9，固定六道跨来源题6/6实际覆盖双方必需结论与证据；检索到多个source不等于完成跨来源回答。T07不执行产品隔离/restore的S08-B-product，不能因此临时裁剪本阶段已经冻结的其他必需项。

### T08：RKM-3指定会话记忆

输入：T07持久服务及D04事务设计。顺序：E07内部迁移/单调sequence/完成事务outbox -> E12 consent/epoch与幂等任务 -> E13消费、同意重验与证据分类 -> E16 MemoryConsentPanel -> 与现有来源库/Forget联动。

按RC-02三崩溃点验证至少一次交接但最多一次有效source/任务，不误称任意外部模型调用exactly-once；未知发送结果保持待对账，不自动重发。三开启会话+一关闭会话、启用前在途turn、关闭/重开、跨session、原始聊天不修改均必须执行。新增memory来源单独统计，不替换T07的24来源分母。

### T09：RKM-4可逆维护与管理体验

输入：T08与Policy/Run/Proposal/Restore完整状态合同。顺序：E14串行scheduler/调度键 -> E15原始span支持校验 -> E12 proposal/version/restore CAS -> E16 Inbox/RunDetail/Policy页面及三新route -> E19/E15用量对账 -> 默认关闭/显式启用/暂停恢复/冲突/撤销/备份派生材料清理。

验收20摘要/20建议（tag/folder/archive各至少3）、10真实应用及10恢复、10冲突负例；隔离只允许明确接受，永久删除只走人工Forget。RC-01/03/04和S12实际请求分母必须执行；关闭不是隐式允许运行建议。质量不达标返回本阶段方案，不缩样本或偷偷调阈值。

本阶段补齐S08-B-product及S13-A：用户输入期间后台维护完成/失败/出建议不抢tab/window/activeElement焦点；实际可见窗口测试需预告，不以Headless或axe单独证明宿主焦点。重启暂停遵守本地零提交与DS屏障后旧epoch零发送两段门槛，屏障前已发送如实对账，不许改成“重启瞬间远程零发送”。

### T10：RKM-5全量复验与有限出门

输入：T05..09实际通过记录、全新双仓隔离快照及独立gold版本。全量执行S01..14/所有补充断言、旧PX必要回归及RKM新负例；四视口、八类route恢复、独立原始run、无环封存、中文HTML/Draw.io、不同于T04的独立审查者、最后人工体验签署。

前阶段日志可作追踪，不代替此轮必须重跑的场景。机器无新Fatal/Major但human pending时仍final=false。最终只声明冻结语料与授权范围内的真实知识服务、指定对话记忆及可逆维护，不扩大到全能外脑、自动永久删除、Docker或V3。
