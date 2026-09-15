# V2-RKM 分阶段实施文档多轮独立审查

日期：2026-09-10。当前是文档审查阶段，用户认可图纸方向，但尚未批准实际代码开发。

## 1. 正式结论与边界

本轮在原有PRD、P0-P7目标架构和八页Draw.io基础上补充10个详细工作包、10张验收卡及9类RKM-0待冻结产物。未改变双容器、Runtime权威、data_service受控适配、显式授权和可逆维护方向。

**可作为分阶段计划继续接受独立审查；不能声明所有阶段已经具备可直接编码的机器输入，更不能保证开发后自动验收必过。**

| 对象 | 本轮判断 |
|---|---|
| 文档方案与阶段依赖 | 两个独立只读session在各自最终复核范围未发现剩余Fatal/Major/Minor；不外推为全项目零风险 |
| 原始PRD相关体验 | 有需求、实体、任务、用户操作及量化门槛追踪；目标是否实现仍须真实证据 |
| 可执行合同与新原型 | D01..09是T05的计划交付物，不是已存在或已通过的成果 |
| 跨仓真实能力 | T06必须验证真实DS公共协议、授权屏障、删除/恢复与模型路径，不把候选接口写成已支持 |
| 原PX | R1后端仅历史限定通过；前端/Chrome需复验；PX-5 FAIL / REOPENED，PX-6 BLOCKED |
| 新阶段 | RKM-0..5 NOT_IMPLEMENTED；不得声明真实RAG、完整外脑或自动维护已完成 |
| 本轮验证 | 文档结构、文本同步、技术图纸预览和范围检查；未执行产品或模型验收 |

**有必要交ClaudeCode CLI复审。**本轮审查者是两个独立上下文的代理session，不是ClaudeCode CLI；没有冒充第三方已签署通过。用户实际开发批准、每阶段预审计及出门条件仍不可省略。

## 2. 审查轮次

两位审查者只读、未参与文件编辑、未运行生产测试或调用模型。第一位审合同/生命周期，第二位审阶段依赖/验收；后轮复核各自发现及关联修订，非全仓安全审计。

| 审查者/会话 | 范围 | 第一轮 | 修订后复核 |
|---|---|---|---|
| Carver / 01a08a42-b2f4-7090-912e-93d0509704ea | PRD/架构/合同的同意、暂停、重启、任务释放语义 | Fatal 0，Major 3；未另列Minor | 第二轮Major 1、Minor 1；第三轮限定范围Fatal/Major/Minor均0 |
| Anscombe / 01a08a48-8f48-7280-9eba-18918c61f0fe | T01..10、AC01..10与原PX前置、PRD门槛一致性 | Fatal 0，Major 4，Minor 1 | 第二轮限定范围Fatal/Major/Minor均0 |

上述数字不可相加为全项目缺陷总数。两者均未验证实际Schema、迁移、真实DS、真实Chrome双容器或模型质量；最终零发现仅适用于所述文档范围。两个session均已结束。

## 3. 发现、修订与必须保留的实现验证

| 编号 | 首轮问题 | 文档修订 | 后续验证义务 |
|---|---|---|---|
| IR-01 | 历史deny与新grant无当前决策机制，重新授权可能永远受旧deny阻挡 | contracts3.2/3.9引入按workspace/scope/provider/purpose的ConsentDecisionSlot、decisionRevision及expectedDecisions原子CAS；不同scope不覆盖，旧撤销ack后方可替换同键 | 并发grant、旧deny、新purpose、source/session拒绝、撤销未ack负例 |
| IR-02 | 维护pause只改本地状态，无法阻止DS已排队dispatch/写回 | runExecution epoch、pauseState及DS pauseAck分开；旧epoch屏障后零新dispatch/应用；不影响无关Ask | 暂停前/后请求序列、在途清单、旧结果对账、新epoch新operation；unknown不得新key重放 |
| IR-03 | 政策/授权变化后旧run永久占槽或被错误resume | barrier确认及结果对账后按部分结果终结旧run并释放槽；新范围/新授权新run，未知结果保留pending | scope变更、旧run部分成功、失联对账、并发新run、旧operation禁止复活 |
| IP-01 | T01..04被未来D产物反向阻塞 | 既有PX按原合同执行；D01..09由T05产生，T06+按依赖消费 | 禁止以RKM新增验收覆盖或放行原PX缺陷 |
| IP-02 | T07出门依赖T09才开发的quarantine产品UI | S08-B拆为T06协议、T07读取/过滤既有状态、T09用户维护操作、T10全链路 | 各阶段不得把未来能力标成当期passed |
| IP-03 | failed转deferred可能缩小验收分母 | 阶段开始前冻结requiredAssertionIds及分母；必需failed/pending/deferred均阻塞 | 负例：必需项改deferred并伪造summary仍必须失败 |
| IP-04 | 只回答跨来源问题的一部分也可能通过grounding | gold冻结非空requiredClaims及支持来源/片段；完整回答率>=0.9，固定6个跨来源问题6/6实际表达并支持双方必要结论 | 单来源答案、无关第二引用、遗漏必要结论、空answer不得通过 |
| IP-05 | 后台不抢焦点只有口号，无独立操作断言 | S13-A真实输入中触发任务完成/失败/建议，检查窗口、tab、activeElement和输入连续性 | 可见焦点测试预先告知；headless不能证明时pending，不算通过 |

Carver第二轮指出的两项关联问题也已修订：Runtime重启后仅本地可立即停止提交，DS旧队列在pauseAck前可能继续，必须如实记录，不能承诺远端瞬时停止；operation abortCause同时支持auth_revoked与run_paused，各自使用相应屏障确认。最终复核确认该范围的时序与状态描述一致。

本轮保留此前RC-01..04的事务outbox、离线撤销、永久Forget优先于restore/备份等方案；不以本轮文档复审替代未来故障注入或既有独立审查原文。

## 4. 剩余实施与验收顺序

权威明细见development6和acceptance9，以下仅导航，不另造第二套门槛。

| 工作包 | 目标 | 出门重点 |
|---|---|---|
| T01 / AC01 | R1前端与真实Chrome补验 | 原修复合同/失败回归/真实双容器及独立复审；不得把后端通过升级整体通过 |
| T02 / AC02 | R2真实原始证据采集 | 入口、路由、ID、故障、日志/图片字节与采集事实绑定 |
| T03 / AC03 | R3共享validator与反假绿 | 必需规则/负例完整执行，从原始事实重算，不信报告布尔值 |
| T04 / AC04 | R4冻结快照，PX-6人审 | 源码/产物/报告同快照、工作树变化使签署失效，真实人工体验 |
| T05 / AC05 | RKM-0机器合同与原型冻结 | D01..09、事务/迁移、错误/并发、API diff、fixture/gold、交互原型逐项审查 |
| T06 / AC06 | RKM-1真实DS受控协议spike | 版本/接口/鉴权锁定，真实授权/暂停屏障及过滤/删除/恢复，无私读内部workspace |
| T07 / AC07 | RKM-2持久知识库与真实问答 | 24真实source至少20全构建，三workspace，重启稳定ID，24问题及跨来源完整性/证据门槛 |
| T08 / AC08 | RKM-3主动开启对话记忆 | 只接收同意后完整turn；事务outbox、崩溃重放不丢不重，关闭立即抑制后续 |
| T09 / AC09 | RKM-4可逆维护与用量 | 20摘要/20建议、质量>=0.9、10应用/恢复全过、10冲突全拒绝；pause/撤销/Forget及后台不抢焦点 |
| T10 / AC10 | RKM-5全量真实验收与人审 | 重新执行阶段必需断言、双容器/四视口、原始证据、费用诚实、人工签署；不扩大完成声明 |

D01领域合同、D02 Runtime API、D03 DS observed/proposed协议、D04持久化事务迁移、D05验收数据模型、D06规则/负例、D07可交互新增组件、D08真实语料/gold、D09实际命令与证据索引均仍是T05待交付，不以本文的名称清单代替实现。

## 5. 本轮实际检查与未执行事项

- 最终Draw.io八页，104个vertex（72业务节点）、56条边；页面/ID/连线/边界由静态检查复核，图纸结构未新增分页。
- 最终技术预览headless检查72个业务节点与XML文本对应，errors=[]；八张1680桌面文档截图，390宽下page scrollWidth=375且图纸可横向滚动。主代理检查第5/7页文字与布局。这不是产品UI/真实扩展截图，也不是原生Draw.io引擎渲染证明。
- 最终截图位于[本轮图纸预览证据](documentation/2026-09-10-staged-plan-final/diagram-page-7.png)，同目录diagram-page-1.png至diagram-page-8.png。
- 本轮Chrome仅用独立headless profile，结束后Browser.close；进程查询未发现rkm-plan-final-*残留。没有抢占用户焦点。
- 原始第二轮外部审查文件保持SHA-256：61b367e27206d982f76e0c68a03c213d8c2af79031129af57b825f668db9e766。
- 产品目录tracked diff基线：fbbf267e375c70fe7aecd8e16c2bba1b481af61400bbd3ea3dcadb9f435106df。该指纹只证明已有tracked diff未被本轮改变，不代表工作树干净或生产行为通过。
- 未运行产品build/pytest/E2E/生产validator、未调用真实模型、未迁移数据、未修改data_service、未提交或推送Git。既有脏工作树未清理。

## 6. 复审后输入绑定

以下SHA-256由主代理在两位审查者最终返回后对交接输入计算，用于下一位审查者核对。**不是审查者签名，也不声称绑定每一轮阅读的逐字快照。**包内其余文档以AUDIT_MANIFEST绑定；本记录不自引用自己的hash。

| 原始路径 | SHA-256 |
|---|---|
| `docs/active/project/01-prd.md` | `eee9927c505d13bcd69252d4a5d76fa66aa476ff607052a83c7211ec7d4d76ea` |
| `docs/active/project/02-architecture.md` | `7f40e3de8e46da1d95a7be273ae692ce540d911e24fd4ccf826a9bc784a45651` |
| `docs/active/project/design/v2-real-knowledge-maintenance-architecture.md` | `8d11d852e5c98167896878ec9462e49c0d1194bc873ca9a2891fec5f52fd6e72` |
| `docs/active/project/design/v2-real-knowledge-maintenance-contracts.md` | `ef824a5723c365650a98e044d18f1629e6c799bf2062980e528e8168719323d6` |
| `docs/active/project/design/v2-real-knowledge-maintenance-development-plan.md` | `579f3ec2c9faba38a928af88ff3804aac7c5b269b5eae0d77c9b3d7b5a990db2` |
| `docs/active/project/design/v2-real-knowledge-maintenance-acceptance-plan.md` | `572450cd80da36f8a6c83522afb48c327852047d908b7502c8140f1d2091a956` |
| `docs/active/project/design/v2-real-knowledge-maintenance-risk-adr.md` | `e1f53f8eafd8d00d9e31f71e3607a0752fddd9e56608c4be2c2179b9aeef4701` |
| `docs/active/project/stage-gates/v2-real-knowledge-maintenance.md` | `4520f5a6eb14ac74770b0ac264c5aab75aacc66fcc8aaa8b6fc8d54e84aab4a1` |
| `docs/active/project/design/v2-px-5-repair-execution-contract.md` | `852d9fd41283d7e4c754544933bb2c0fcbb7198df865e14010d3b19ad38642a0` |

## 7. ClaudeCode CLI待审查结论

请独立判断，不沿用上述“限定零发现”作为你的结论：

1. T01..10是否仍存在未来依赖阻塞当前阶段，D01..09是否足以明确后续交付而没有冒充已交付。
2. ConsentDecisionSlot、多scope拒绝、撤销ack、run pauseAck与重启对账能否由实际双仓公开API和持久化事务实现；不能实现时回到T05，不自动绕过。
3. PRD17.3、架构21.3、contracts3、验收8/9及图04/05/07对授权、状态、任务槽、恢复、Forget优先级是否一致。
4. 必需分母、跨来源必要结论、背景焦点和真实模型/截图规则是否仍允许假绿或规格缩水。
5. 现有Runtime Mock与DS候选能力是否被错误标为“已实现”；旧PX阻塞是否在所有新阶段保持。
6. 三条DS技术路线仍见risk-adr：首选受控公共HTTP适配；若spike不能闭环权限/删除/一致性，应向人类提交修改DS公共协议或缩减范围的代价，不擅自换路线。

提交材料为固定审计目录中的18个载荷加AUDIT_MANIFEST，共19文件、平铺。未附源码/真实数据/原生产品截图或旧审计全文，不能以包内文档独立证明这些事实；ClaudeCode CLI在本地应按原路径只读核实。旧外部审查及后端限定审查仍保留原位，未被删除。

## 8. 停止原因

本轮停在文档交接和待外部复审。用户尚未批准实际代码开发；原PX门禁、D01..09冻结及真实DS验证未通过，不能自动进入产品实现或宣称阶段完成。

