# V2-RKM 文档与分阶段开发门禁

日期：2026-09-09。当前阶段：DOC-Closure文档修订。用户批准文档落盘，不构成T01..10代码、迁移、云调用或永久删除批准。

2026-09-10修订：第二轮独立审查S-1..S-16逐项文档处置见[修订记录](../evidence/v2_real_knowledge_maintenance/rkm-doc-review-remediation-2026-09-10.md)。文档设计已补强不等于机器合同冻结或用例通过；另行批准并完成原PX前置后，RKM-0须将每项转可执行合同/负例并接受独立复审。当前保持RKM-0..5 NOT_IMPLEMENTED。

## 当前事实

本轮独立审查发现IR-01..03已提出文档修订：当前授权决定槽、维护run独立暂停屏障、失效任务释放槽。T05必须冻结字段/规则/负例，T06先验证DS协议，T07/T09再验产品；不能将本轮自检或独立文档复审升级为RKM-0/1实际通过。详细工作包development6、验收执行卡acceptance9是实施计划，不是执行记录。

本日风险再核查补充RC-01..04，见合同3.5..3.8与验收8。第二轮独立复审见[round2审查](../evidence/v2_real_knowledge_maintenance/rkm-doc-readiness-review-round2-2026-09-10.md)，其G-1..G-7处置由本轮DOC-Closure落盘；原审查原文不改写。文档可继续细化D01..09，不表示T05/RKM-0已启动。真实DS/模型/Chrome风险不能用文档消除，备选路线见risk-adr的DS-1..3，未经用户选择不换架构或减目标。

- V2-7只保留planning-aligned local knowledge acceptance历史结论。
- R1后端限定修复通过；R1前端/真实Chrome待复验。PX-5 FAIL / REOPENED；PX-6 BLOCKED_BY_PX5_MAJOR。
- RKM生产实体、真实Adapter、持久知识、对话记忆、维护和新验收工具未开发。data_service已有能力不等于Navia集成成功。

## 顺序与出门

| Gate | 进入条件 | 出门证据 | 当前状态 |
|---|---|---|---|
| DOC-Closure | 当前用户文档批准 | 同前缀文档/八页图/追踪表、39项顶层断言、G-1..G-7权威落盘、静态审计与独立意见 | 本轮修订；只允许文档出门，不改变实施状态 |
| PX修复前置 | 另行批准实际开发，子阶段预审计通过 | R1->R2->R3->R4->PX-6原门槛及人工签署 | BLOCKED，不能由新文档放行 |
| RKM-0 / T05 | T01..04/PX-6通过、用户批准新增实现、T05预审计无Fatal/Major | 字段级设计转机器合同、原型增量、39项注册表/正负fixture、API diff/风险审计 | NOT_IMPLEMENTED；当前不得称已启动 |
| RKM-1 | RKM-0无Fatal/Major | 真实HTTP/API/auth/幂等/删除/模型能力spike，固定双仓commit | NOT_IMPLEMENTED |
| RKM-2 | RKM-1通过 | 持久保存/重启/真实问答/graph/trace与S01..09；真实服务模式重新验证双容器认证 | NOT_IMPLEMENTED |
| RKM-3 | RKM-2通过 | 指定会话同意、提取、出处、关闭及重复事件S10 | NOT_IMPLEMENTED |
| RKM-4 | RKM-3通过 | 可逆自动维护、质量、恢复及统计S11/S12 | NOT_IMPLEMENTED |
| RKM-5 | 前述全部通过 | S01..14全量、双仓快照、中文HTML、独立复审、用户签署 | NOT_IMPLEMENTED |

唯一顺序为T01 -> T02 -> T03 -> T04/PX-6 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10。每阶段先单独落盘开发/验收/审计，再实现；完成后E2E+PRD检视+独立复审。现有Major不得跳过；新Major/致命风险/疑似假绿停下找用户；普通测试失败回到本阶段计划修复，不降门槛。DOC-Closure期间细化D01..09要求不等于进入T05。

表内S编号仅为最终目标关联；阶段实际义务以验收计划第5节逐阶段适用矩阵为准。原PX不前移RKM功能；RKM-1仅作DS协议spike，不以接口证据冒充完整UI/持久化/记忆/维护通过。撤销以DS屏障ack为完成点，未确认保持revoking。MemoryConsent/Policy首次显式创建默认关闭；CloudConsent按显式scope/provider/purpose确认创建，未授权就是拒绝，不能混同三类授权。来源过滤在DS检索与发送前执行。

## 当前允许与禁止声明

允许：产品方向和文档设计可供审查；本机双服务、无费用硬上限、指定对话记忆、可逆维护边界已记录。

禁止：PX-5/PX-6通过、RKM实现、真实RAG ready、自动永久遗忘、全功能外脑、媒体理解或V3完成。模型配置存在不等于可达，原型不等于产品，Schema不等于semantic/E2E。

机器合同、服务spike及产品体验证据尚缺，因此当前不能声称“全部自动化开发输入已经完备”。这些缺口分别是T05/T06的明确交付，不隐瞒为剩余Minor。PRD必需DS能力缺失只能归属公共API/Adapter修复或prd_blocker，不允许“可降级通过”。

文档集入口：[架构](../design/v2-real-knowledge-maintenance-architecture.md)、[开发](../design/v2-real-knowledge-maintenance-development-plan.md)、[验收](../design/v2-real-knowledge-maintenance-acceptance-plan.md)、[合同](../design/v2-real-knowledge-maintenance-contracts.md)、[风险](../design/v2-real-knowledge-maintenance-risk-adr.md)、[图纸索引](../design/v2-real-knowledge-maintenance-gap.md)、[审计](../design/v2-real-knowledge-maintenance-readiness-audit.md)。
