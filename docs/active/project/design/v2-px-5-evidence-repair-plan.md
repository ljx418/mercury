# PX-5 证据 Major 限定修复开发与验收计划

日期：2026-09-09。状态：**历史修复计划，已被 T01..T04 分阶段证据链取代，不得作为当前执行入口。**其中关于原始事实、禁止默认补值、隔离 run 和人工声明边界的原则继续有效；当前状态与下一步只以 stage gate、T03 独立出门审查和 `evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/` 为准。

权威输入：总 PRD 的 V2-PX 章节、现有 PX-5 验收计划、PX-0.2 冻结规则、`evidence/v2_external_brain_productization/px-5/resumption-evidence-audit-2026-09-09.md`。

## 范围与执行顺序

1. 修复证据采集：`chrome-v2-px-workspace-router.mjs`。每次动作分配 observation ID，采集 DOM event.isTrusted、触发元素、实际 prior route、消息 requestId/result、各容器可见 ID、Runtime 请求/响应原始字节、捕获时间与同次截图。普通网页 launcher 到侧栏再主动保存为必测路径。evaluate 并发保留为技术测试，不计用户入口。
2. 修复生成器：`generate-v2-external-brain-productization-report.mjs`。逐条原始记录转换；禁止默认 corpus[0]、默认 observed ID、默认 before/after、默认 true/0、自动补恢复事件或复制合同结果。必需观察缺失则生成 blocked 诊断，退出非0。生成器不能覆盖已有人类签署或原始日志。
3. 修复生产校验：`validate-v2-external-brain-production-evidence.mjs` 复用 `validate-v2-external-brain-productization-report.mjs` 的 semanticRulePass / architectureScan 核心，以受控 artifact reader 适配生产数据，保留合同测试隔离。禁止另写降低规则要求的扫描器。逐字段重算 summary、G1-G7、图片配对、ID/时间因果链。
4. 独立采集命令结果和源码基线。每条命令记录真实 command、exitCode/signal、stdout/stderr artifact、结构化检查结果。架构扫描遵守当前 PRD：生产从冻结 Git commit 读取 blob。当前未提交工作树必须先明确验收快照策略；无用户提交授权时不能自动提交或谎称 HEAD 已包含新增文件。如果选择工作树快照，必须先返回文档/合同门禁修订并独立复审，不能在实现中静默改变规则。
5. 原始证据重新采集到新的 run 目录，不覆盖当前失败包或 V2-7 历史证据。真实 source 字节只证明内容真实，mock adapter、注入故障、真实服务必须明确标记，不能互相代替。组件级侧栏页面检查不能计作宿主页产品侧栏入口。
6. 重新执行各阶段相关 E2E、PRD 检视、架构检视和独立防假绿审计；只有机器 Major 全部闭环后恢复 PX-5，之后才进入 PX-6 人工产品体验。HTML 和 Drawio 根据最终验证结果更新。

生产功能保持现有阶段范围。若重新采集发现实际保存、权限、遗忘功能不符合 PRD，先落盘问题与最小修复计划、完成实现前审计，再修改所属产品实体；不扩展到 V3 或自动知识维护。

## 验收标准

| 范围 | 正向标准 | 必须拒绝的负向输入 |
|---|---|---|
| G1 入口 | 三入口各至少2次实际点击，view_source至少3次trace-ready；事件、消息、Runtime及截图同次关联 | evaluate 冒充可信点击；缺 event；requestId错误；重用无关图片 |
| G2 路由 | 五route各direct/reload/Back/reopen；观察记录包含真实path、稳定ID和Runtime重读 | metadata/source与实际页面不符；手工补恢复模式；旧缓存冒充重读 |
| G3 生命周期 | Permission至少3、Forget至少3，保存前后及四面实际查询、同源四次重开；tab reuse无ingest | 改source/workspace；before未采集；撤销后无scan证据；计数凭空为0 |
| G4 架构 | 三根目录完整文件集合、冻结源码字节、mode、算法及allowlist可重算；两类扫描实际执行 | 改源码加入违规调用且同步hash、报告仍0；遗漏路径；commit不含文件；替换算法 |
| G5 状态 | 每次截图对应实际状态响应或transport失败；四故障分开标识 | 全报告hash当response；生成时状态当截图时状态；离线填权威ID |
| G6 UX | 宿主Side Panel360/420、Workspace768/1280的图片/DOM/axe/键盘结果关联；含弹窗抽屉关键态 | 固定0遮挡；独立标签页冒充宿主页侧栏；媒体query代替动画行为；常数键盘计数 |
| G7 证据 | 实际命令结果、规则执行及正负回归完整；记录确切validator实现hash | 复制fixture结果；命令失败但passed；summary伪造；报告缺日志；同一HTML自行宣布PASS |

报告、截图metadata和execution必须从同一run的事实产生，不能跨run拼接。故障注入只证明受控分支，不证明自然发生过该故障。
有限完成声明沿用 PRD；生产Report只有机器门禁与人工签署均通过才可为true。

## 实现前审计与风险闭环

- 已确认：Route A 与P0-P7不需重画；当前问题集中于采集、生成与校验可信性。
- 未关闭：M1-M5，不能写 Fatal/Major 0。当前计划是可供确认的修复范围，不是已通过的实现前审计。
- 待冻结：生产源码基线如何包含当前未提交新增文件；优先遵守已冻结Git blob合同。这个决定必须在G4实现前落盘。
- 待核查：现有合同能否承载逐事件与逐截图观察。如果需要新增公共字段，先修订合同、负例及门禁，不能由生成器私加。
- 验收工具修复必须增加独立生产读取路径负例；旧109个合同用例通过只证明合同路径回归。
- 附带检查：上轮安装axe造成的lockfile范围变化、测试浏览器生命周期清理。只处理本任务产生的改动，不清理用户工作树。

停止与升级：用户确认风险处置后可开始上述限定闭环；若源码基线、合同变更或产品偏差出现新的重大风险，按原规则再次停下并提供具体证据。所有验收证据通过前，PX-6保持阻塞。
