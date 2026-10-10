# Navia V3 Chat + Know 风险与 ADR

状态：`DOCUMENT CANDIDATE`

## ADR-C1 手动 Runtime 生命周期

决定：用桌面图标作为启动权威；扩展不自动拉起 Runtime、不绑定浏览器生命周期。  
原因：降低隐式系统行为、权限和资源不可控风险。  
代价：用户每天首次使用前可能多一次显式启动。  
补偿：设置页提供清晰状态、可信点击启动桥和手动步骤；支持用户配置可见的空闲退出策略。

## ADR-C2 Chat/Know 双域

决定：V3 一级产品域仅 Chat/Know；Settings 辅助；Agent 延至 V5+。  
原因：当前 Agent 仅占位，Know 又存在 Mock/候选边界；继续并列会制造规格完成假象。  
代价：旧导航与部分历史文档需要迁移。

## ADR-C3 视频归入 Chat

决定：B站通过 `MediaPortalAdapter` 成为 Chat 的上下文来源，不建立独立顶层产品。  
原因：用户目标是理解当前内容并提取知识，网页和视频应共享证据、草稿和保存链。  
代价：既有 Media Workspace 需要重映射为 Chat 的扩展工作区。

## ADR-C4 V3 最小知识能力

决定：V3 实现真实本地 CRUD、标签、排序、归档和人工 aging；语义 Query、Graph、自动维护、记忆与 Durable Forget 进入 V4。  
原因：当前这些能力没有形成真实产品闭环，不能继续作为人工验收前提。  
代价：Know V3 是明确的管理基线，不是完整外脑。

## ADR-C5 一次配置与短时会话

决定：持久保存非秘密配对句柄和授权状态；Runtime 每次启动建立短时会话。  
原因：满足一次配置，同时避免长期管理密钥和 Cookie 真值进入扩展存储。  
待 spike：启动桥采用显式协议处理器还是薄 Native Messaging 控制桥。两者都不得自动启动完整 Runtime。

## ADR-C6 原 V3 计划增量继承

决定：保留 `V3-0..V3-7` 全部技术计划、合同、样本、失败事实和验收编号；新增目标采用 `V3-0X`、`V3-1.4`、`V3-4.1` 以及对 V3-5..7 的追加分母。  
原因：原计划已经对 Cookie、媒体获取、ASR、视觉、TaskStore、人工验收和防假绿完成高成本冻结，重做会增加架构漂移和证据失配。  
约束：新增能力只能引用或投影原权威数据，不得复制媒体事实模型、替换 12 页样本或改写 H01-H10。

## 主要风险

| 风险 | 严重度 | 闭环 |
|---|---|---|
| 启动桥被误做后台自启动 | Major | 合同禁止无可信点击启动；真实进程审计 |
| Know 继续读取 Mock | Fatal | production adapter 必须标识，Mock 构建不得进入候选 |
| 历史 V2/V3 文档冲突 | Major | 主文档顶部权威指针；审计只读保留历史 |
| 草稿自动落库 | Major | Draft/Item 不同 schema，写入需 confirmation receipt |
| 媒体管线与 Chat 重复状态机 | Major | 统一 ContextEnvelope 和 route owner |
| Agent 范围回流 | Major | V5+ 边界，V3 验收 registry 不含 Agent requirement |
