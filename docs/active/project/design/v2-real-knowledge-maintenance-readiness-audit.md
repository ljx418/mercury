# V2-RKM 文档设计审计与实施准备度

## 2026-09-10 DOC-Closure 第二轮处置与复核（最新）

第二轮ClaudeCode CLI审查原文见[round2审查](../evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-round2-2026-09-10.md)，本轮逐项纠偏见[round2处置记录](../evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-round2-remediation-2026-09-10.md)。原审查文件保持字节不变；其中“36项”和“可批准RKM-0进入D01..09冻结”的结论已被明确supersede，不得作为当前门禁。

当前active权威统一为：`DOC-Closure`不占T编号；实施只有T01..T10；D01..09是T05出门交付而非当前产物；顶层必需断言为显式封闭的39项；T05只有在T01..04/PX-6通过、用户批准代码且T05预审计Fatal=0/Major=0后才能开始。DS必需能力不得降级放行。

G-1..G-7已落到字段级决定：Chat同事务outbox兼容标准、DS五类能力处置、Usage sourceEventId与K/M/T/P唯一分桶、BarrierAck判别联合及无碰撞scopeKey、本地待确认与远端已确认UI、Policy所有者确认IANA时区、gold作者不得自审且至少一名独立审查者。T07/Stage Gate/图纸统一S01..09，图纸只引用D01..09。

三名未参与编辑的只读审查者分别做迭代复核，最终限定范围均为Fatal=0/Major=0/Minor=0；范围和初始发现见处置记录第6节。静态检查确认8页、104 vertex、56 edge、72/72 XML/HTML业务节点一致，14 REQ、E01..20、T01..10、AC01..10、D01..09及39项注册表可枚举。未运行产品、Runtime、模型、迁移或机器合同测试。

结论：`DOC-Closure candidate PASS, pending external ClaudeCode CLI review`。当前文档足以指导下一实际阶段T01的开发前计划、审计和验收，但用户尚未批准代码，PX-5/PX-6仍未完成；不能直接进入T05/RKM-0，也不能声明RKM、RAG或完整外脑已实现。新的平铺19文件包供ClaudeCode CLI复审。

以下章节保留先前审查时点，发生冲突时以上述最新段落和处置记录为准。

## 2026-09-10 多轮独立文档审查（前一轮）

用户认可图纸方向并要求细化全部剩余阶段，但仍未批准代码。本轮补充development6的T01..10详细工作包、D01..09冻结产物及acceptance9的AC01..10执行卡。独立审查记录见[分阶段实施文档审查](../evidence/v2_real_knowledge_maintenance/rkm-staged-implementation-review-2026-09-10.md)。

两个独立只读session未参与编辑：Carver进行3轮合同/生命周期审查，依次3 Major、剩1 Major/1 Minor、最终限定范围0/0/0；Anscombe进行2轮阶段计划/验收审查，先4 Major/1 Minor，修订后限定范围0/0/0。数字不相加为项目总缺陷数；后轮是针对原发现及关联变化的复核，不是全面产品安全证明。两位审查者均未执行产品、模型、机器合同或真实DS验证；本轮不是ClaudeCode CLI已审查。

实质修订包括当前ConsentDecisionSlot、run级pauseAck及旧run释放；重启本地/远程停止时点分开；AC01..04与D产物解耦；S08-B协议/产品分阶段；必需deferred不能缩分母；跨来源必要结论覆盖；后台不抢焦点独立用例。PRD/架构/合同/计划/图纸已同步。

明确结论：在本轮独立审查范围内，文档可指导后续逐阶段细化和实施准备；不能声明现在可直接编码全部阶段，也不能保证写完代码就满足PRD。原PX前置、用户实际批准、T05机器合同/原型/迁移冻结、T06真实协议与后续质量/Chrome验收仍是独立出门条件。PX-5 FAIL/PX-6 BLOCKED/RKM-0..5 NOT_IMPLEMENTED保持。

有必要继续交ClaudeCode CLI审查，重点为跨仓可实现性、D产物的机器化完整性、同意/暂停/任务槽协议和反假绿规则。当前平铺包按用户本次“少于20”限制为18载荷+清单=19文件；外部审查尚待进行，清单只证明字节完整性。

下文各轮记录保留历史时点；其中“待独立复审”描述当时状态，以本节及新审查记录为本次交接结论，仍不构成代码批准。

## 2026-09-10 风险再核查（本次最新结论）

不能声明此前问题已全部通过验收或全部自动化开发输入完备。本次发现四项实现语义仍不充分：RC-01维护终态/日程，RC-02完成turn到记忆任务的事务交接，RC-03DS离线/功能关闭时的撤销入口，RC-04永久Forget与restore/备份材料的优先级。已修订合同3.5..3.8、PRD17.3、架构21.3、详细计划、验收8及八页图，保持原PX前置和双仓职责。

| 层级 | 本次判断 | 下一门槛 |
|---|---|---|
| 既有S-1..S-16意见 | 设计处置已有落盘，原独立审查未被改写；不能视为新增fixture通过 | RKM-0逐项机器合同/负例及独立复审 |
| RC-01..04新发现 | 文档方案已补充，本次主代理自检，不冒充独立复审通过 | 对照契约/图纸确认保守行为与产品目标一致 |
| PRD与目标架构追踪 | 保留14需求、E01..20、实施任务T01..10、S01..14；DOC-Closure不占T编号；未增加部署服务/默认文件访问/自动永久删除 | 本轮修订须人审；真实职责由后续源码与E2E验证 |
| 全阶段自动化实施准备度 | 尚不完整，不批准跳过PX及RKM-0/1 | 机器合同、事务API、真实DS协议与模型质量分别过门禁 |
| 目标完成与出门 | 有明确验收路线，不保证结果必过 | 真实语料、重启/撤销/恢复、双容器和人工签署全过 |

剩余风险及DS-1/2/3方案取舍见risk-adr；当前保持DS-1公共HTTP受控适配，未批准重构或减范围。最新检查与原图hash保留在[风险闭环记录](../evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md)第6节。旧日期/旧图数量只能作为历史记录，不挪作本次结果。

## 2026-09-10 初次修订状态（历史）

已按[第二轮独立复审](../evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-2026-09-10.md)补充S-1..S-16的设计与验证义务，逐项见[处置记录](../evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md)。该审查原文302行/28,066字节保持不变；新修订由主代理完成，尚未获得另一Agent对本轮修改的独立通过结论。

新增认证矩阵、用量/截图/gold/图谱/宿主保护证据模型、aborting/共享支持结构及阶段/审查者/目录隔离。图04调整三类同意横向对照，S->E反向表已同步。机器合同、可执行负例和真实DS协议仍未实现，不能把“设计已补充”算作RKM-0冻结通过。PX-5 FAIL/PX-6 BLOCKED不变，当前仅文档。

下文是2026-09-09审计的历史记录；其中图元/连线数量和截图检查仅对应当天版本。2026-09-10新图和审计包检查记录在上述处置文档，勿跨版本挪用结果。

## 2026-09-09 历史审计记录

日期：2026-09-09。审计对象：本轮新增RKM文档、总PRD17.3、现有实现实体索引、两份八页图纸及离线技术预览。当前仅文档开发，没有产品实现批准。

## 结论分层

| 审计层次 | 当前结论 | 不能推导的声明 |
|---|---|---|
| 产品方向与文档设计 | 可交人类审查；十四需求已映射实体/任务/操作/门禁 | 不等于真实Adapter或维护已实现 |
| 独立设计复审 | 第一轮4 Major，经修订第二轮在该范围未发现剩余Fatal/Major；1 Minor已修正 | 不等于整个项目Fatal/Major=0 |
| 图纸结构与技术预览 | 两图各八页；ID/连线/图元边界检查通过；预览72业务节点文字一致、未检测溢出 | 技术预览不是产品截图，也不替代原生Draw.io人审 |
| 可执行开发输入 | RKM-0机器合同/原型增量、RKM-1双仓真实API spike待交付 | 不能声称所有自动化编码输入完整 |
| 既有阶段 | R1后端限定通过；前端/Chrome待复验；PX-5 FAIL / REOPENED、PX-6 BLOCKED | 不重写历史证据，不以新文档放行旧Major |
| 新增功能验收 | RKM-0..5 NOT_IMPLEMENTED；真实模型/持久化/维护验收未执行 | 不声明RKM完成、RAG ready、完整外脑、V3完成 |

当前可批准的是文档方向。再次获实际开发批准后，仍按R1前端/Chrome -> R2 -> R3 -> R4 -> PX-6 -> RKM-0..5推进；不能跳过阶段预审计。

## 多轮独立审查与修订记录

使用Software Architect技能整理实体、分层、约束和取舍。独立只读审查者Banach，代理ID `01a0855a-a584-77a3-bc2f-d01a3c513e80`，未参与文档写入，未运行产品服务或模型。

事实审查首先指出：旧图仍称Workspace不存在、真实Adapter未接通、DS remove非级联、检索fallback非真实生成、聊天存储非记忆授权、Dream no-network与获准云处理需分阶段说明。本轮更新了这些现状与边界。

第一轮新设计复审提出四项Major，处置如下：

| 发现 | 修订实体/文档 | 设计复查结论 |
|---|---|---|
| 首次Consent/Policy无法创建 | contracts3.1增加POST默认关闭revision1、唯一约束、幂等和409后GET；S10-A/S11-A | 第二轮确认设计闭环 |
| 来源授权/隔离没有进入DS实际过滤 | E17检索前、E19dispatch前按allowedSources/revision/purpose/provider/generation检查；S08-A/B | 第二轮确认设计闭环；实际能力待spike |
| 撤销没有跨服务生效点 | authorizationContext替代单revision；本地revoking、DS持久屏障ack、离线待确认、已出站列表；S08-C..F | 第二轮确认设计闭环；不保证已发送字节撤回 |
| 早期阶段依赖后期功能出门 | 验收第5节阶段适用矩阵；原PX不扩范围，RKM-1仅协议spike，后续分阶段补全 | 第二轮确认设计闭环；deferred不得计passed |

第二轮原文限定结论：“上轮四项 Major 已在文档设计层面得到修正。本次针对这些修订及关联文档，未发现剩余 Fatal/Major；有一项 Minor，执行风险仍然保留。”Minor为already_exists未纳入错误闭合表，已补入contracts5并明确HTTP409/INVALID_TRANSITION/details.reason=already_exists及并发创建负例义务。此小改由主代理逐字核对，未声称独立代理再次执行第三轮复审。

## 本轮实际静态验证

1. 用Python标准库ElementTree解析新旧Draw.io。两图均8页；逐页ID唯一，source/target引用存在，所有vertex在页面边界内。新图1600×1000，104个vertex（72业务节点与32标题/说明/页脚）、55条边；旧图1600×900，112个vertex、42条边。旧图保持原ID/geometry/边，修改过期现状文案。
2. 核对29个声明“当前存在”的Navia/data_service代码路径，全部存在。路径存在不证明职责实现或当前验收通过；数据服务删除与query语义另经只读代码审查。
3. PRD与gap追踪表均覆盖RKM-REQ-01..14。验收S01..14每项含用户步骤、预期、门槛和失败证据；新增创建/授权过滤/撤销子断言及阶段矩阵已落盘。
4. Linux Playwright首尝试因缺libnspr4.so启动失败，未算通过。改用已安装Windows Chrome、独立临时profile和headless CDP，只加载本地预览HTML；没有使用用户浏览器profile，也未加载扩展/Runtime。
5. Headless检查72个节点的渲染高度均未超过文本容器，节点文本与图纸生成模型72/72一致。1680px桌面截图八页；390px下图纸容器可横向滚动，未观察页面级横向溢出。截图位于 `../evidence/v2_real_knowledge_maintenance/documentation/diagram-page-1.png` 至 `diagram-page-8.png`。主代理查看关键架构/维护/验收页，修改了穿越中间节点的连线及过窄标签间距。最终导出后的原生Draw.io字体/边标签仍需人审。
6. 测试Chrome执行Browser.close，并核查无命令行含rkm-doc-review的残留Chrome进程。用户后续打开的审核窗口不是测试实例，不主动关闭。
7. 未运行npm build、pytest、原生产生成器/validator、产品端到端、数据迁移或模型调用；没有Git提交/push、没有修改data_service。apps/services在本轮前后的tracked diff hash与status hash一致（见下）。

```text
git diff --binary -- apps services | sha256sum
fbbf267e375c70fe7aecd8e16c2bba1b481af61400bbd3ea3dcadb9f435106df

git status --short -- apps services | sha256sum
865bcd13226c1e94acae2766c25d243e2e177458fa767081184e7c8f9210d2b5
```

这两项是工作树范围防误改检查，不是所有未跟踪文件字节的完整密码学证明；主工作树原有更改全部保留。

## 剩余风险与后续审计

- DS是否能提供来源过滤、幂等、持久撤销屏障、真实级联及共享贡献重算尚待验证；失败必须阻塞RKM-1，不直读DS存储或悄用Mock补齐。
- 机器Schema/OpenAPI、规则registry、正负fixture与新增组件交互原型未实现，RKM-0必须分别审计；本文不是可执行合同通过证明。
- 模型候选配置不能证明可达、支持结构化输出或质量达标；24题/20摘要等阈值必须真实执行后再判断。
- 生产重启持久性、备份删除账本回放、真实Chrome认证/路由/维护可访问性仍无本轮证据。
- 云端已发送资料无法撤回，不以revocationAck承诺提供方日志删除。费用只统计/估算，不设金额硬限；权限、安全和并发限制仍保留。

建议再交ChatGPT审查这套文档，重点检查：双仓边界与实际API差异、三类同意与DS屏障、首次创建/重启/Forget生命周期、阶段矩阵是否循环依赖、旧PX到RKM是否过度承诺、图纸与MD是否一致。外部包是文档审查包，不是产品验收包；包含文件及来源hash见固定目录 `../external-audit-package/AUDIT_MANIFEST.md`。

停止原因：本轮文档任务完成至人类审核候选；用户尚未批准实际代码，原PX出门与RKM机器合同/真实spike仍未完成。不得自动进入生产实现或宣布最终验收通过。
