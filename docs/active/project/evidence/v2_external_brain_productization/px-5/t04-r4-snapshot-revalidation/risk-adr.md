# T04 R4 风险与架构决定

日期：2026-09-14  
状态：`ACCEPTED DOCUMENT DECISIONS / IMPLEMENTATION PENDING`

## ADR-1：采用双泳道，不用单次旧输入重放冒充全量复验

决定：R4-P 证明 T03 的确定性，R4-E 从同一隔离快照重新执行真实 Chrome 和完整生产候选。两者不能拼接。

放弃：只重放 T02.5。该方案不能证明当前可物化快照仍能运行真实产品路径。

## ADR-2：隔离 acceptance commit，不直接运行脏主工作树

决定：从 T02.5 product base 创建 detached worktree，只引入已登记 T03/T04 依赖闭包，创建 local-only commit。主 HEAD/index 不变，不 push。

风险：T03 工具当前并非全部存在于 `430cdd...`。若不建立新 acceptance commit，R4 无法证明实现来源，也无法由外部审查者重建。

## ADR-3：实现依赖闭包由 import graph 与声明 artifact 共同决定

决定：解析相对 ESM import；额外登记 schema/spec/fixture/lockfile/runner/toolchain。只复制顶层四个 CLI 被明确禁止。

放弃：按文件名通配 `v2Px*.mjs`。通配既可能漏掉非同名依赖，也会悄悄带入未审计文件。

## ADR-4：固定极小归一化白名单

决定：R4-P 十项产物 byte-equal；InvocationRecord 只删除 `/recordedAt` 后比较。任何新差异先视为确定性缺陷。

放弃：忽略所有时间、ID、路径。宽归一化会让错误 run、错误 candidate 或环境漂移假绿。

## ADR-5：R4-E 是最终 R4 candidate 的唯一事实来源

决定：R4-P 仅证明 replay；R4-E 的新 raw、DerivedFacts、Validation、Report、Package 形成最终 candidate。ExitManifest 可引用 R4-P comparison，但不得借用它补 R4-E 分母。

## ADR-6：T04 不拥有 Human Review

决定：T04 所有合同只允许 pending/false/unsigned。PX-6 用独立签署记录引用 T04 ExitManifest hash。

放弃：T04 自动把机器成功提升为 G7/final。该方案直接重现历史假绿。

## ADR-7：产品缺陷不在 T04 工具提交中顺手修复

决定：真实 Chrome、Axe、Runtime 或 UX 失败若需要改 P0-P6，T04 立即 FAIL/REPLAN，单独建立修复阶段、开发计划、验收计划和用户授权，再从新快照完整重跑。

## ADR-8：不修改 package scripts 注册 T04

决定：acceptance commit 的 `apps/chrome-extension/package.json` 与 `pnpm-lock.yaml` 保持 T02.5 product base 原始字节；T03/T04 CLI 由 orchestrator 使用冻结 direct Node argv 调用。T03 当前主工作树新增的 package script aliases 不复制到快照。

理由：`package.json` 同时是产品构建输入。仅为便利新增命令别名会破坏产品基线字节不变的判定，并使 R4-E 是“同一产品实现”的声明产生歧义。

## 2. 风险登记

| 风险 | 严重度 | 防线 | 触发后的动作 |
|---|---|---|---|
| 主工作树脏状态渗入快照 | Major | detached commit、source/index hash、undeclared read trap | 作废 run，重建快照 |
| T03 transitive dependency 漏收 | Major | import graph missingEdges=0、实际模块加载、负例 N-001 | 回 T04-0 |
| T02.5 product commit 与 T04 product bytes 漂移 | Major | product path byte-equality | 停止，不允许比较 |
| package script alias 造成构建输入漂移 | Major | package/lock 取 base commit；direct Node argv | 回 T04-1 重建快照 |
| R4-P 重放但未实际执行进程 | Major | 新 InvocationRecord + PID/command/log hash + N-011 | 作废 replay |
| R4-E 复用旧 raw/截图 | Fatal | inode/path/hash/runId/root 隔离和 N-013 | 作废整个 T04 run |
| normalization 白名单扩大 | Major | exact `[/recordedAt]` Schema const | 回合同阶段 |
| 新 raw 动态 ID 导致与 baseline 不同 | 非问题 | R4-E 只做正式语义重算，不做 byte compare | 保留差异索引 |
| Chrome/npm/Python 环境无法重建 | Major | environment manifest、lockfile、版本检查 | T04 ENV FAIL；不得用主环境补跑 |
| 浮动 Python requirements 或错误使用 npm ci | Major | Python wheelhouse hash lock；pnpm frozen lock | 回 T04-0 重建环境合同 |
| ExitManifest 与 public archive hash 自引用 | Fatal | payload-only archive 排除 ExitManifest，归档先生成 | 作废 manifest/archive |
| private 路径/token 进入 public tar | Fatal | allowlist packaging + byte scan + N-018 | 销毁 public tar，重建 |
| 同模型 session 冒充组织独立 | Major for final | 独立 session/prompt hash明示局限；PX-6 真实人类签署 | 不宣称组织独立 |
| Drawio/中文 HTML 与机器结果不同步 | Major | ExitManifest 绑定 hash、文本状态断言 | 重新生成文档产物 |
| Axe 已知 4.45:1 选择器在更广路径暴露 | Major if observed | R4-E 覆盖全页面真实 Axe，不降阈值 | 停止并单独规划 CSS 修复 |

## 3. Reviewer 独立性

T04 文档审查、实现 session、实现出门审查必须记录不同的 request/prompt artifact hash。该差异只证明输入工件不同，不证明组织独立。最终 PX-6 必须由真实人类执行体验清单并签署；任何模型审查都不能替代。

## 4. 出门回退

- T04 文档审查 Fatal/Major：继续文档修订，不实现。
- T04-0..7 任一 Major：停止在当前子阶段，禁止跳到 PX-6。
- R4-E 产品 Major：回独立产品修复计划；修复后新 commit、新 raw、新 R4 全量 run。
- T04 LIMITED PASS 后 Human Review 未完成：PX-5 final 仍未通过，PX-6 保持待实施。
