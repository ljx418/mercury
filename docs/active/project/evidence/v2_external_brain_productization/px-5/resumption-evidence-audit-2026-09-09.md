# PX-5 中断恢复证据复核

日期：2026-09-09。性质：当前代理的只读复核及放行结论纠正，不冒充独立外部审计。

## 当前结论

PX-5：FAIL / REOPENED。PX-6：BLOCKED_BY_PX5_MAJOR。
本轮确认 5 组 Major；未开展全面安全审计，不据此声明其他问题数量为零。
2026-09-08 的 PX-5 自动候选 PASS、Fatal/Major/Minor 0 和 PX-6 机器出门 PASS 均撤回。
Human Review 保持 pending，但人工未签署不是唯一阻塞。不得以人工体验通过覆盖下面的机器证据问题。
PX-1 至 PX-4 的既有记录保留；本轮没有重新认证这些阶段，也不根据本轮问题否定所有已实现功能。

## 复核结果

| 检查 | 实际结果 | 含义 |
|---|---|---|
| 原始 Chrome 检查 | 77 条，文件中失败数 0 | 只证明现有 runner 的断言记录；本轮未重新运行 Chrome |
| 生成场景 | 39 | 场景数量不能替代原始观察的完整性 |
| responseFingerprint 等于整个 raw E2E 文件 hash | 38 / 39 | 不是对应 Runtime response 字节的 hash |
| generated trustedUserGesture=true | 14 次 | 原始报告没有 trustedUserGesture 字段；并发 evaluate 也被标记为用户手势 |
| SemanticResult 与 contract fixture 深比较 | 完全相同 | 不是生产 validator 执行记录 |
| 查看来源消息 ID | src_00000000000000000000009888 | 当前点击对应来源 |
| Report 的一般 direct Source Detail ID | src_00000000000000000000002843 | 生成器使用 corpus[0]，不能证明与捕获页面一致 |

以上通过 JSON 解析、SHA-256 重算和代码定位复核，不依赖 automatedCandidatePassed。

## Major 清单

### M1：操作与 Runtime 观察被生成器补写

`apps/chrome-extension/e2e/generate-v2-external-brain-productization-report.mjs:144` 的 idSet 根据场景定义生成 observed IDs；175-219 行生成手势、时间、prior context、route events、ingest counters，并将 rawReportRef.sha256 用作 Runtime response fingerprint。
`chrome-v2-px-workspace-router.mjs:783` 的并发消息来自 evaluate，生成器193-197行却记为 actor=user / trustedUserGesture=true。
需要从实际 DOM 事件、消息、导航、请求及响应分别采集，再关联；不得用期望值填充观察值。

### M2：来源、截图和宿主路径不一致

生成器62、85-91行以 corpus[0] 填写所有一般 route source；75行复用 Library/Detail 图片用于不同入口，截图并非对应动作即时捕获。
runner402-406行在普通标签页直接打开 sidepanel.html；它可以测试组件，但未完成 PRD 的“普通网页 -> Launcher/Side Panel -> 主动保存当前页 -> 查看来源”路径。
人工检查既有 sidepanel-360.png 可见 Page unknown、保存不可用、Trace ready 与尚未保存并列，不能作为当前页保存成功证据。
必须在真实宿主页面的产品侧栏采集入口、来源及截图；允许保留独立页面检查作为组件测试。

### M3：Permission、Forget 和 UX 通过值缺少原始依据

runner572行把 newScanStopped / retainedImportedSources 写成 true；生成器244-246行把 Forget 四面的 before/after 全写 true；320行把所有 viewport 的溢出、遮挡计数写0。
runner776行键盘计数包含常数 +1；emulateMedia 后媒体查询为 true 不能单独证明实际减少动画。
需要逐面 before/after 请求、撤销后实际 scan 结果、保留来源查询，以及逐视口 DOM/键盘/axe 结果。缺失必须失败或未验证。

### M4：生产校验路径弱于冻结规则

`validate-v2-external-brain-production-evidence.mjs:70-84` 依赖报告生成的手势、恢复模式及生命周期字段；119-124行依赖故障标签与自行填入的测试结果。
86-117行另写简化 AST 扫描，未证明冻结 Git blob 全集、ruleset/allowlist 算法及完整规则覆盖，与 PRD1954行要求不一致。
当前工作树存在新增未提交源码，HEAD SHA 不能独立绑定这些文件。禁止把工作树扫描包装成对应 HEAD 的 Git blob 扫描。
应复用 PX-0.2 的语义规则与扫描算法，并为生产读取路径增加“改原始字节、保持报告全绿”的负向回归。

### M5：报告和出门审计自证通过

生成器307-315行复制合同正例的 SchemaResult / SemanticResult，并硬编码命令 passed/exitCode；324行硬编码 V2 回归24/24。
`px-5/independent-audit.md` 无法凭这些数据声称独立审计且 Major 0。`px-6/final-review.html` 的“机器验收已通过”依赖上述不成立的前置条件。
测试命令的实际退出码、日志及检查结果应由执行器采集；生产与合同回归结果必须分开。报告渲染只能消费验证结果，不能自行宣布通过。

## 原始证据与撤回方式

原始 raw E2E、PNG、report.json、execution-observations 和 metadata 保留，以便复现问题，不能用于出门放行。新状态见 `acceptance-disposition.json`。
旧自动 gate / exit 状态与旧 HTML 已另存 superseded-2026-09-08 文件；当前入口展示撤回信息。旧 evidence-index 中 hash 仅是当时快照，当前索引明确失效。
本轮未运行报告生成器和旧生产 validator，避免重新覆盖为 PASS；未启动浏览器或 Runtime；未修改产品代码、验收实现或公共合同。

## 继续条件与交接

限定修复方案：`docs/active/project/design/v2-px-5-evidence-repair-plan.md`。
修改范围：本审计、修复计划、阶段门禁、Drawio 和已失效的验收展示/状态；合同变化：无。
PRD 对应：V2-PX 产品入口、四域权威、稳定 ID、真实截图、G1-G7、有限声明。
剩余风险：5组 Major 未修复；共享 runner 的问题可能影响早期验收声明，修复后需回归 PX-1 至 PX-4 的相关路径。
停止原因：用户要求遇到重大偏差或虚假验收风险时停止并确认。此处触发该条件，不能顺序进入 PX-6 签署。

## 本轮修改验证

- 解析四份当前处置/机器状态JSON，确认PX-5自动候选为false、PX-6为阻塞、旧索引validForAcceptance=false。
- 两份当前HTML的本地href/src均可解析，均显示FAIL / REOPENED。
- Drawio XML可解析，8页，逐页ID唯一，顶层图元均在1600x900边界内；这不替代目标架构功能验收。
- `git diff --check` 通过。
- 未执行旧生产validator或报告生成器；未新建运行中的浏览器/Runtime实例；本轮没有产品代码修改。
