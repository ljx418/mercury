# V2-RKM 第二轮独立复审的文档处置记录

日期：2026-09-10。执行者：主代理。范围：文档/图纸/审计包修订，不进入产品代码、可执行validator、数据迁移或模型调用。

## 1. 审查输入与边界

已重新读取根README及project README，两处均登记独立审查文件：

`docs/active/project/evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-2026-09-10.md`

实测302行、28,066字节，原始SHA-256=`61b367e27206d982f76e0c68a03c213d8c2af79031129af57b825f668db9e766`。该文件原文保留；本文是处置，不修改审查者结论及旧包hash。

其结论是文档方向可继续审查，S-1..S-16需补强；不是产品通过。本文“设计已补充”仅表示规范和验收义务已落盘，机器Schema/fixture、DS协议spike和产品E2E仍未实现。RKM-0..5 NOT_IMPLEMENTED，PX-5 REOPENED、PX-6 BLOCKED保持。

## 2. 逐项处置

设计文档前缀均为 `docs/active/project/design/v2-real-knowledge-maintenance-`。

| 问题 | 处置及权威位置 | 后续必须验证 |
|---|---|---|
| S-1 新路由无凭据 | contracts3.3冻结未配置/缺失/错误/失效token及Origin的403；已认证但功能不可用503，认证不依赖文件开关 | S01-A矩阵真实HTTP、零正文外发；RKM-0机器合同，RKM-1/2验证 |
| S-2 UsageLedger漏记 | acceptance6.2用独立dispatch/transport事实对账E15，一次尝试一ID；审计不可用不发新请求，崩溃未知不伪成功 | 漏记/重复/绕过/合并重试/unknown假成功负例 |
| S-3 截图复用 | acceptance6.3绑定本run捕获请求/返回字节、动作/导航/容器与源码 | 旧PNG改名、新run套旧捕获、文档图冒充产品皆拒绝；新捕获同hash可合法通过 |
| S-4 gold审签 | acceptance6.4冻结goldManifest字段、独立审查者、signoffHash输入及执行前冻结 | 未审签、后改gold、同生成者审签、自引用hash负例；hash不自证身份 |
| S-5 前端造边 | acceptance6.4采用AST边界+运行期服务图与展示语义集合对照 | 改名/动态生成假边仍拒绝；合法布局不误判 |
| S-6 撤销时点 | acceptance6.5冻结四种revocationTimePoint、具名屏障及已发送未返回的接收端证明 | 每个时点独立spike，日志绑定代际、hook与transport；不得sleep猜测 |
| S-7 宿主/聊天保护 | acceptance6.5同时对照原始bytes/mtime/标识/写入事件，聊天比对目标消息集合 | 改写回填mtime、删除还原、备份覆盖原件/新revision负例 |
| S-8 两阶段证据隔离 | acceptance6.3冻结PX/RKM runs/spikes/fixtures/documentation路径及真实路径边界 | 禁止目录链接、借旧run填新分母；参考语料与操作证据分开 |
| S-9 aborting | contracts2/3.4增RKM内部aborting/aborted与ack转移 | ack缺失不结束；中止不得成功；重授权新operation；不引入旧build取消 |
| S-10 共享支持字段 | contracts3.4使用SharedSupportVerification的item/revision/provenance before/after，外发仍归authorizationContext | A/B贡献重算、无剩余支持删除、跨workspace支持拒绝 |
| S-11 DS认证矩阵 | contracts3.3明确X-API-Key、强制服务鉴权、固定loopback、禁止redirect/代理与转发浏览器token | 匿名/dev bypass与错key真拒绝、无密钥不得发送正文；不能只看配置 |
| S-12 三同意对比 | 图04第二行分别显示文件/云/会话，汇入授权上下文；MD说明不互相代替 | 八页结构/文字/连线检查；原生图纸仍需人审 |
| S-13 独立审查轮换 | development5要求T04/T10不同审查session，非实施者/生成者；人类可同一用户 | 审查记录绑定snapshot和真实session；无合格审查者保持pending |
| S-14 spike边界 | development5保留真实DS公共HTTP服务级删除/过滤/重启，不要求Navia产品UI完整S09 | 专用namespace+公共样本，不迁移旧Mock/私人workspace；protocol-only不能升级UI E2E |
| S-15 S↔E | acceptance7反向表与gap中心表同步，architecture5回链，补E19/E20观察责任 | 14场景逐项集合一致，不仅文本含编号 |
| S-16 T02误读 | development开头及T02明确属于原PX-5；T04必须先于T05实施 | 阶段顺序/门禁不允许分叉旁路；不改变旧任务范围 |

## 3. 有理由的调整与原审查引用纠正

- 不采用“历史PNG hash一律禁用”：相同静态页面可以产生相同真实图片。采用本次捕获因果链，历史hash作为复核信号而非唯一决定。
- 不采用仅识别mockGraphNodes/seedGraph变量名：易通过改名绕过，也可能误拒合法fixture。采用实际数据边界与运行期集合对照。
- 不将S-14降低到capability枚举：能力自报不能证明删除/撤销成立，保留隔离真实DS协议测试，明确不替代Navia UI E2E。
- 不新增混淆权限的sharing.outbound；将共享知识贡献与云处理授权拆成两种权威对象。
- 原审查3.1将“POST默认关闭revision1”概括为三类同意共同流程，实际contracts3.1仅用于MemoryConsent和MaintenancePolicy；PermissionRoot沿原R1合同，CloudConsent仍需显式scope/provider/purpose授权，不由另外两类自动授予。
- 原审查4.1的T00分叉图不能作为实施顺序：主PRD、stage gate及开发计划一直要求原PX先完成再实施RKM。本轮明确线性前置，仍允许当前纯文档准备。
- 原审查5.2把documentation截图路径当S13现有产品证据描述；该目录实际只存图纸预览。现已在验收6.3明确禁止计入产品场景。

## 4. 验证等级与交接

本轮只核查文档一致性、README链接、S项映射、Draw.io结构/预览及审计包完整性。不运行旧PX生成器/validator，不复用历史测试计数，不把规范反例写成已执行成功。新增工具/Schema/OpenAPI/Gold真实语料签署与DS行为仍由RKM-0/1后续交付。

修订后完整性结果以更新的 `external-audit-package/AUDIT_MANIFEST.md` 为准；原审查内19项hash绑定修订前输入，不能要求原文hash随本轮变更。新包包含原审查与本处置，未纳入材料明确列为外部不可独立复核。

当前结论：S-1..S-16均已有明确设计处置及后续验证义务，可提交其他Agent复审；本文不是新的独立审查意见，不能声明这些fixture已通过或自动放行RKM-0。停止原因：文档阶段边界，尚无实际代码批准及原PX前置验收。

## 5. S-1..S-16修订时的静态检查（2026-09-10，早于本文件第6节）

- README与project README的审查路径均存在；原审查仍302行/28,066字节，SHA-256与第1节一致。
- ElementTree重算新Draw.io：8页、104 vertex、56条边；ID唯一、边引用有效、vertex在1600×1000范围内。图04由6条边调整为7条，独立同意汇入上下文；不是将旧55边结果挪作新通过。
- 正则提取处置表得到S-1..S-16恰好16项，无重复遗漏；展开E编号范围后，gap中心表与acceptance7的14个S->E集合逐项相等。
- Windows Chrome Headless加载本地HTML，不加载扩展/Runtime。72个业务节点与当前Draw.io文字一致，文本容器溢出0；桌面1680×1100捕获八页，390px文档视口允许图纸容器滚动，未观察页面级横向溢出。截图另存`documentation/2026-09-10/diagram-page-1.png`至`diagram-page-8.png`，不覆盖9月9日证据。主代理查看第4页，三类同意并列、连线与文本可读。
- 这是HTML技术SVG投影检查，不是原生Draw.io渲染验收，也不是产品E2E。测试浏览器已发送Browser.close并查询确认本次独立profile没有残留Chrome实例；没有打开可见窗口。
- 新RKM Markdown相对文件链接可解析，`git diff --check -- README.md docs/active/project`通过。未运行生产构建/测试或旧validator/生成器；没有提交、推送或修改data_service。
- apps/services tracked diff的修订前后SHA-256均为`fbbf267e375c70fe7aecd8e16c2bba1b481af61400bbd3ea3dcadb9f435106df`，只作为本轮防误改检查，不代替完整未跟踪文件字节审计。

没有新独立Agent对本轮变更作出通过签署，仍需用户转交复审。实际S01..14、机器fixture与DS spike不在上述“通过”范围。

## 6. 后续风险再核查（2026-09-10，本次最新修订）

用户要求保持文档阶段，评估能否完整支撑本阶段及出门。主代理重新阅读PRD17.3、实体架构、合同/开发/验收/风险/门禁及原审查，并只读检查E07现有SQLiteSessionStore。不能接受“所有先前风险已完全验证、全阶段必然出门”的结论；除原S项的未执行义务外，又发现四处需要实现者猜测的行为，处置如下。

| 发现 | 已落盘设计 | PRD/实体/阶段/验收关联 | 仍待验证 |
|---|---|---|---|
| RC-01 维护状态缺明确成功终态；默认关闭/建议/重启日程含混 | contracts3.5：queued/running/paused/completed/degraded/failed与pending建议分离；关闭不新生成；单活动run、持久时区、错过不补跑、重启暂停 | REQ11；E12/E14/E16；T05/T09；S11、RC-01a/b；图05/07 | 状态机Schema、调度唯一键、任务原始结果、故障与真实交互 |
| RC-02 完成turn后普通回调可能丢任务或提取启用前消息 | contracts3.6：E07完成消息+内部outbox同事务，E13消费/E12唯一键登记后ack；sequence/epoch以服务端为准，只取开启后开始且完成turn | REQ10；E07/E12/E13；T05/T08；S10、RC-02a/b；图05/07 | 现有Chat事务API兼容性、迁移方案、三个崩溃点、重放及撤销 |
| RC-03 功能/DS不可用可能锁死撤销入口 | contracts3.3/3.7：已认证本地控制面仍读/关闭/撤销，DS ack前显示pending；无凭据拒绝，E12写失败不能假成功；CloudConsent明确创建/重授权流程 | REQ01/08；E05/E07/E12；T05/T07..09；S01/S08、RC-03；图04 | 真实HTTP/持久ack与恢复先对账，不能仅凭矩阵PASS |
| RC-04 restore/备份可能带回被Forget的派生内容 | contracts3.8：tombstone优先，旧restore拒绝；摘要/建议/恢复快照进入级联，共享贡献重算；备份缺删除账本拒绝开放 | REQ09/11；E12/E17/E18；T05/T07/T09；S09/S11、RC-04；图05/07 | 服务公开API及备份原始材料的清理/重启/不复活，宿主与聊天保护 |

### 6.1 对需求与架构的影响

保持Route A、E01..20、P0..P7、14个PRD需求与原PX先出门顺序。没有新增Docker/消息服务/独立知识框架，没有扩大默认资料读取、自动永久删除或费用硬限制。新增内部SQLite outbox是E07现有持久层的目标修改，不是已实现事实；如必须改公开Chat合同，T05返回合同审查。状态细化、错过不补跑与关闭期不回填为保守产品决策，须用户/独立Agent审核，不把本次自检当独立批准。

详见risk-adr的RC-01..04决策表与DS-1/2/3取舍：现行公共HTTP适配保持目标但依赖真实服务验证；Navia接管知识生命周期会大改职责和迁移；仅管理/建议属于减范围。后两者均未选择，只有真实阻塞及用户批准后才能重规划。提供方留存已出站资料、模型质量和旧PX真实Chrome风险不能靠文档承诺消失。

### 6.2 本次实际检查及边界

- 初次调用`python`不可用，没有算成功；改用`python3`标准库ElementTree完成XML/实体映射检查。图纸仍8页/104 vertex/56边，ID/边引用/1600×1000边界有效；与修订前比较除value外完全一致，只改10个业务节点，未减少分页/实体/连线。
- 当前Draw.io SHA-256：`123468d5d0b3098f675475a020de05bc1b58804fe5d3e4462fb79002516fad32`。14组S->E集合与gap逐项相等，验收8新增6行断言各有操作、阈值、证据与适用阶段。
- Windows Chrome Headless独立profile `rkm-risk-review-tKBpPo`，本地HTML技术预览，72个节点与XML文字相等，文本高度溢出0。1680×1100捕获8页；390px下页面无横向溢出，图纸自身可滚动。主代理查看04/05页截图，未发现遮挡；截图存`documentation/2026-09-10-risk-closure/diagram-page-1.png`至`diagram-page-8.png`，没有覆盖早轮截图。
- 已发送Browser.close并核查无该profile测试Chrome残留。不是产品测试，没有加载扩展/Runtime，不是Draw.io原生渲染通过证明；最后用户打开的图纸窗口留待人审。
- RKM八份Markdown相对文件链接均存在（未验证页内锚点）；`git diff --check -- README.md docs/active/project`通过；原独立审查SHA-256仍为第1节值。审计包需在上述源文件定稿后全部重新复制及重算，以本轮AUDIT_MANIFEST为准。
- apps/services tracked diff前后hash仍为`fbbf267e375c70fe7aecd8e16c2bba1b481af61400bbd3ea3dcadb9f435106df`。没有修改产品代码/测试/构建，没有新增可执行validator、运行产品验收、迁移、模型请求、Git提交或push；此hash不覆盖所有未跟踪文件字节。

当前处置等级：四项已形成具体文档方案，尚待独立复审及对应机器/真实验证。完整自动化开发准备度仍为有条件，不声明Fatal 0/Major 0或全部实现就绪。PX-5 FAIL、PX-6 BLOCKED、RKM-0..5 NOT_IMPLEMENTED不变。

停止原因：本次仅执行用户批准的风险闭环文档修订；尚未获实际开发批准，机器合同与真实DS/模型/Chrome出门依赖未完成，不能自动跨入实施或宣称验收通过。
