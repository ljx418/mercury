# T01 R1 前端与真实 Chrome 实施前审计

日期：2026-09-10  
状态：GO。第二次独立只读复审结论为 Fatal 0 / Major 0 / Minor 2，仅放行 T01（E03..E06）。

## 输入检查

- DOC-Closure ClaudeCode CLI 只读复审：Fatal 0 / Major 0 / Minor 0，允许进入 T01。
- 用户已明确批准实际开发，并预授权按 T01..T10 顺序推进；PX-6/T10 人工签署和新增高风险仍需停下。
- R1 后端限定闭环当前复跑：104 passed / 17 warnings；类型检查 exit 0；T01 相关 6 个前端文件 37 tests passed。
- 前端全量 Vitest 在 90 秒内无用例结果并被终止，当前不得标记前端测试通过；开发计划第一项必须先定位并闭环。
- 主工作树包含前序未提交和未跟踪实现，不能用 HEAD 表示当前源码，也不能清理或重置用户改动。

## 风险与处置

| 风险 | 严重度 | 实施前决定 |
|---|---|---|
| 全量 Vitest 挂起 | Major | 进入产品行为修改前先逐文件二分，修复后全量退出 0；禁止跳过 |
| 403 与 transport 合并 | Major | 通过类型化错误与 UI 状态分开，增加正负测试 |
| 断开后晚到结果恢复敏感内容 | Major | generation + abort + reducer 清理，单元与真实 HTTP 延迟 E2E |
| 两容器凭据串用或持久化 | Major | 每 Document 内存 session，真实 DOM 两次输入，storage/URL/log 扫描 |
| Forget 假绿 | Major | operation 状态和四面布尔共同决定；坏 shape/异常负例 |
| 脏工作树污染证据 | Major | 隔离 worktree、输入 manifest、本地验收 commit；主 index/HEAD 不变 |
| 旧报告链覆盖失败证据 | Fatal | T01 明确禁跑旧 PX-5 generator/validator |

## 第一次独立审查意见闭环

| ID | 决定 |
|---|---|
| M-1 | 使用导出class `RuntimeRequestError`和四类kind；runtimeJson集中生成/传递requestId并分类抛错，调用方不猜码 |
| M-2 | 前端只接受`/`开头POSIX路径并即时提示，不翻译Windows路径；Runtime继续作最终拒绝权威 |
| M-3 | succeeded加四个严格true是唯一成功式；坏shape/残留/failed/degraded不导航 |
| M-4 | generation为单调number；runtimeClient集中管理AbortController；代际变化只产生stale且禁止写UI |
| M-5 | UI固定单active-root；换root/授权/撤销/认证变化清空scan、selection、imported和key；不支持并行root操作 |
| M-6 | 认证UI固定connecting/connected/authentication_required/offline四态及两套准确文案 |
| M-7 | Workspace公共壳层单挂载认证组件，不保留分支双实例 |
| M-8 | 六个稳定testid已冻结，A03只用这些定位真实输入/断开/状态 |
| M-9 | 隔离worktree从HEAD加source manifest overlay；不复制既有build输出，fresh build重新生成chunks |

sidepanel只改Knowledge状态子集；token扫描面、截图时点、后端用例名、evidence目录、逐文件Vitest表和cleanup manifest均已加入开发/验收计划。合同第3/4/5项由撤销cache-hit、提交窗口撤销和批次原子性测试逐名证明；第6/7/8项由真实UTF-8快照、伪workspace/路径和Schema测试逐名证明。

## 当前门禁

第一次独立审查原文保存在`preimplementation-independent-review.md`，不得覆盖；第二次复审保存在`preimplementation-independent-review-round2.md`。

第二次复审确认：

- M-1..M-9 均已在开发计划和验收计划中形成无歧义决定；
- T01-A01..A10 不允许 N/A 或缩小分母；
- 隔离快照、源文件 overlay、fresh build 和证据目录规则可执行；
- 仅余截图等待 React 提交和 lockfile 同源声明两项 Minor，必须在 T01 执行中一并关闭；
- 不授权 T02、旧 PX-5 报告链、PX-6、RKM 或 Chat/Agent/Debug/Settings 业务修改。

因此允许开始 T01 产品代码修改。T01 结束后仍须完成真实数据、真实 HTTP、真实 Chrome 双容器验收和 PRD 规格检视，不能把 T01 GO 或 T01 通过升级为 PX-5/PX-6/RKM 通过。
