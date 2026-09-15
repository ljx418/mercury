# T01 R1 前端与真实 Chrome 开发计划

日期：2026-09-10  
状态：实施前冻结候选。当前仅放行 T01，不运行旧 PX-5 报告生成器/validator，不进入 T02。

## 1. 输入与范围

权威输入为总 PRD、V2-PX Stage Gate、`v2-px-5-repair-execution-contract.md`、R1 后端闭环审计和 V2-RKM AC01。当前主仓库 HEAD 为 `ae28b627eb0aba91ff0e9f950066a688d8d13d13`；产品 tracked diff hash 为 `fbbf267e375c70fe7aecd8e16c2bba1b481af61400bd3ea3dcadb9f435106df`。主工作树已有用户和前序代理变更，不回退、不清理、不把生成目录变化归入 T01。

允许修改：E03 Side Panel、E04 Workspace、E05 `runtimeClient.ts`、E06 认证/状态/权限/Forget 组件及直接测试；R1 后端仅在真实前端暴露新的合同缺陷时回到单独审计。`entrypoints/sidepanel/main.tsx` 只允许修改 Knowledge view 的状态、回调和清理路径，不改 `chatViewReducer`、Chat/Agent/Debug/Settings 业务或 provider 草稿。禁止真实 data_service、RKM、自动文件扫描、凭据持久化和 T02 原始证据生成器实现。

## 2. 实施顺序

1. 在隔离快照逐文件运行全部 Vitest，定位当前全量测试无结果挂起；修复测试清理、未终止句柄或真实产品生命周期问题，不允许排除测试文件。
2. 在 `runtimeClient.ts` 导出 `RuntimeRequestErrorKind = "transport" | "authentication" | "api" | "stale"` 和 `RuntimeRequestError extends Error`，只读字段固定为 `kind/httpStatus?/code?/reason?/requestId?`。`runtimeJson` 为每次请求生成 `req_<uuid>` 并放入 `X-Request-ID`；Runtime envelope `request_id` 优先回填同一字段。401/403在读取响应 envelope 后抛 authentication；其他非2xx或`ok=false`抛api；fetch拒绝/连接失败抛transport；凭据代际变化或其触发的AbortError抛stale。所有知识API继续从同一集中入口抛错，调用方不重新猜错误码。
3. 当前页面凭据 session 固定为模块私有 `{ token: string, generation: number, controllers: Map<number, AbortController> }`；generation 从0开始，每次set/clear（包括替换为同值）先增加、再abort并清空旧controllers。每个受认证Knowledge请求捕获generation，响应解析前后均复核；不一致只抛stale，调用方忽略该错误且不写UI。普通transport仍展示offline。导出`setLocalRuntimeToken`、`clearLocalRuntimeSession`、`getLocalRuntimeSessionSnapshot`和`subscribeLocalRuntimeSession`，但绝不导出token值。
4. `LocalRuntimeAccess` 状态固定为 `connecting | connected | authentication_required | offline`；初次无token显示authentication_required。401/403文案“会话认证失效，请重新输入 Runtime 令牌”；transport文案“Runtime 当前不可达”；connected文案“本页面会话已认证”。组件订阅当前Document的session变更，不依赖一次性`hasLocalRuntimeToken`快照。Side Panel和Workspace分别编译/加载自己的module实例，真实E2E还需证明两次输入及单容器断开。
5. Side Panel 与 Workspace 在 disconnect、认证失效和 scope 变化时，清空本容器 source 正文、Ask、Graph、Trace、Permission scan/selection、Forget result，并使旧异步结果失效；另一容器不受影响。
6. `PermissionRootManager` 只允许一个active root工作流；开始扫描另一root、授权新root、撤销active root或认证变化时统一清空`scan/selected/imported/importKey/activeRootId`。onRevoke改为返回Promise，成功后再reset；busy期间禁止其他root操作。路径trim后必须以`/`开头，Windows路径不翻译并显示“请输入 Runtime POSIX 绝对路径”；Runtime仍是最终权限权威。
7. Forget成功判定固定为：`operation.status === "succeeded"`，四个absence字段均为严格boolean且均为true。只有该判定成立才关闭Trace、导航Library并刷新；degraded/failed、字段缺失、非boolean或任一false均留在对话框并显示“遗忘未完成”，不调用navigate。重复有效请求仍展示Runtime重新验证结果。
8. Workspace只在公共页面壳层挂载一个`LocalRuntimeAccess`，authority error和正常route复用同一实例。稳定定位符固定为`local-runtime-access`、`local-runtime-token-input`、`local-runtime-connect`、`local-runtime-disconnect`、`local-runtime-status`、`local-runtime-error`。
9. 新增专用 T01 Headless Chrome runner。使用真实仓库文档副本、真实 Runtime HTTP 与fresh unpacked extension，通过真实 DOM 输入两次 token；旧 PX-5 runner、生成器和 validator不得调用。

## 3. 隔离与交付

主工作树只承载人工可见源码修改。隔离快照固定从当前HEAD创建detached worktree，再按`input/snapshot-input-manifest.json`列出的相对路径、mode和raw SHA-256覆盖主工作树当前源码及未跟踪源码。明确排除`chrome-mv3-unpacked/**`、`.wxt/**`、`node_modules/**`、浏览器profile和历史证据输出；现有deleted chunks不是输入。隔离目录执行`pnpm install --frozen-lockfile`，先测源码，再运行`pnpm build:e2e`从零生成完整`chrome-mv3-unpacked`供Chrome加载。创建无GPG的本地commit：`audit(t01): freeze r1 frontend chrome candidate <runId>`；不修改主index/HEAD、不push。

证据目录固定为`runs/<runId>/{input,logs,raw,screenshots,screenshot-metadata,private}`；private不进入外部包。`cleanup-manifest.json`列Runtime/HTTP/Chrome PID、临时目录和凭据hash，结束逐项确认已清理。A01先对`find`枚举的每个测试文件逐个运行并生成状态表，再运行全量；构建输出与Vitest输入隔离，禁止把chunks删除解释为测试通过或失败原因。

阶段交付必须包含：changed-files、contract-changes、测试命令/exit/log/hash、真实文件来源、Chrome raw run、PRD review、architecture review、independent audit 和 handoff。T01 通过只允许进入 T02，不允许声明 PX-5/PX-6/RKM 完成。
