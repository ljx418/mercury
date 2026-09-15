# V2-RKM 第二轮独立复审处置记录

日期：2026-09-10  
范围：仅文档与 Draw.io 修订；未修改产品代码、机器 Schema、Runtime、data_service 或迁移。  
当前阶段：`DOC-Closure`。这不是 T05/RKM-0，也不构成任何代码批准。

## 1. 权威关系

本文件处置并纠正以下只读审查记录中的发现和结论，不改写其原文：

- `rkm-doc-readiness-review-2026-09-10.md`，SHA-256 `61b367e27206d982f76e0c68a03c213d8c2af79031129af57b825f668db9e766`。
- `rkm-doc-readiness-review-round2-2026-09-10.md`，修订前后保持同一文件；其原始审查结论作为历史证据保留。

若历史审查与当前 active PRD、Stage Gate、同前缀设计文档及本处置记录冲突，以当前 active 权威文档为准。历史 round2 中以下两项明确被 supersede，不得继续用于门禁判断：

1. 将 RC-01..04 按四项计数并得到 36 条。正确封闭集合为 14+16+6+3=39 条，RC 必须展开为 RC-01a、RC-01b、RC-02a、RC-02b、RC-03、RC-04。
2. “可批准 RKM-0 阶段文档进入 D01..09 冻结工作包”。当前只能在 `DOC-Closure` 细化 D01..D09 的需求；这些可执行产物由 T05 交付，不能作为 T05 启动前置，也不能据此称 RKM-0 已开始。

## 2. 阶段与分母闭环

- `DOC-Closure` 不占用 T 编号；唯一实施编号是 T01..T10。
- 唯一实施顺序：`T01 -> T02 -> T03 -> T04/PX-6 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10`。
- T05 开始前同时要求：T01..T04/PX-6 通过、用户明确批准代码、T05 实施前审计 Fatal=0/Major=0。
- D01..D09 是 T05 的出门交付，当前只冻结其内容要求。
- 顶层必需断言显式封闭为 39 条：S01..S14、S-01..S-16、RC 六条、IR 三条。子断言不改变顶层分母；failed、pending、deferred 均阻止通过。

## 3. G-1..G-7 重大问题处置

| 问题 | 当前决定 | 落盘位置 |
|---|---|---|
| G-1 Chat 兼容判定不明确 | 最终 assistant message 与 memory outbox 必须由现有 SQLiteSessionStore 同一事务提交；rollback、错误语义和 A/C/D 公共合同保持不变，否则返回合同门禁 | contracts 3.6、development D04、risk ADR |
| G-2 DS 缺能力时可能缩小 PRD | 能力处置只允许 observed_supported、requires_ds_public_api、requires_navia_adapter、not_observed、prd_blocker；PRD 必需项缺失即阻塞，不存在降级通过子集 | contracts 4、acceptance 9.2、stage gate、图 08 |
| G-3 Usage 唯一但可能错桶 | 增加 eventKind，并冻结四项一一映射；provider_request 始终进入 model_request，父任务与模型发送是两条不同事件并以稳定 ID 关联 | contracts 2/3.10、acceptance 6.2、图 07/08 |
| G-4 BarrierAck 字段分裂 | 冻结公共字段与两个互斥分支；authorization_revoke 与 maintenance_pause 的专属字段不同；scopeKey 使用 RFC 8785 规范数组字节的 SHA-256，禁止分隔符拼接和类型替代 | contracts 3.2/3.9、图 04 |
| G-5 暂停 UI 混淆 | local_blocked_remote_pending 与 remote_acknowledged 分开；前者显示服务端待确认且禁止 resume | contracts 3.9、development D07、图 04 |
| G-6 时区来源冲突 | 新 Policy 默认 timeZone=null/timeZoneConfirmed=false/trigger=manual；daily 前由 Policy 所有者显式确认 IANA 时区，禁止从部署机推导 | contracts 2/3.1/3.5、图 08 |
| G-7 gold 审批人不明确 | authorId != reviewerId；至少一名独立审查者绑定 session/hash/decision；变更新版本并重跑受影响题目；不擅自增加双审硬门槛 | acceptance 6.4、development D08、risk ADR、图 08 |

## 4. 交叉文档修正

- RKM-2/T07 统一验收 S01..S09，真实服务模式必须重新验证双容器认证，不能从 S02 开始漏掉 S01。
- Draw.io 第 8 页的 D 产物只引用 D01..D09：DS 风险映射 D02/D03/D09，模型/Usage/时区映射 D03/D05，验收可信性映射 D05/D06/D08/D09。
- 图中 E02 与 E04 状态拆为“E02 需复验 / E04 需修改”。
- Draw.io 明示 IANA 时区所有者确认、gold 作者不得自审、39 条分母和 DS 无降级通过。
- XML 与离线 HTML 投影使用同一 72 个业务节点文本；HTML 是技术投影，不是产品证据。

## 5. 本轮静态验证

已执行且仅代表文档结构：

- Draw.io XML 可解析，8 页、104 个 vertex、56 条 edge；逐页 ID 唯一，边引用存在，图元均在 1600x1000 页面内。
- Draw.io 与 HTML 技术投影的 72 个业务节点文本逐字一致。
- Windows Chrome Headless 使用独立临时profile加载本地技术预览，生成并人工检查 `documentation/2026-09-10-doc-closure-final/diagram-all-pages.png`（1680x10000）；八页均可见，关键文字未被节点截断。测试后无本轮Chrome进程，临时profile已删除。该截图不是产品或diagrams.net原生渲染证据。
- PRD 需求 RKM-REQ-01..14、实体 E01..E20、实施任务 T01..T10、验收卡 AC01..AC10、T05 产物 D01..D09 均可枚举。
- active 文档相对 Markdown 链接存在；`git diff --check` 通过。
- 两份既有独立审查文件未改写。
- `apps/`、`services/` 的 tracked diff SHA-256 保持 `fbbf267e375c70fe7aecd8e16c2bba1b481af61400bbd3ea3dcadb9f435106df`；这只是防误改检查，不是产品验收。

未执行 npm、pytest、Runtime、data_service、模型、迁移、生产 validator 或产品 E2E。文档中的 API、Schema、fixture 和命令仍是 T05/T06 的未来交付，不能被本轮自然语言审计写成已实现。

## 6. 独立复审状态

本轮由三名未参与编辑的只读审查者分别检查阶段/分母、G-1..G-7 协议、Draw.io/计划/验收一致性。各审查者只读、未运行产品测试、未参与修订：

| 审查范围 | 首轮发现 | 修订后复核 |
|---|---|---|
| 阶段、历史审计权威、39项分母 | 2 Fatal / 1 Major / 0 Minor | 0 / 0 / 0；确认历史错误已supersede、active无T00、T05三前置一致 |
| G-1..G-7协议与证据 | 0 Fatal / 3 Major / 0 Minor；首次复核另发现2 Major | 0 / 0 / 0；确认Policy时区、BarrierAck判别联合及无碰撞scopeKey、Usage sourceEventId与K/M/T/P对账闭合 |
| Draw.io、计划、验收交叉一致性 | 0 Fatal / 2 Major / 2 Minor | 0 / 0 / 0；确认S01..09、D01..09映射、状态及72节点投影一致 |

这些数字是各审查者在限定范围内的迭代结果，不相加为项目缺陷总数，也不证明产品实现通过。外部 ClaudeCode CLI 仍需对重建后的平铺包独立审查。

## 7. 当前门禁与停止原因

三组复核均无新增 Fatal/Major，且静态检查重新通过，因此当前可标记 `DOC-Closure candidate PASS, pending external ClaudeCode CLI review`。该结论表示文档已足以指导下一实际阶段 T01 的开发前计划、审计和验收设计；不表示 T01 已获代码批准或已开始。即使外部文档审查通过，也只允许等待用户另行批准 T01；不得据此进入 T05、运行RKM产品开发或宣称完整外脑已实现。

停止原因：当前任务是文档修订；用户尚未批准代码，PX-5/PX-6 前置仍未完成，T05/RKM-0 机器合同也未实现。
