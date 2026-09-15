# PX-5 修复执行合同

日期：2026-09-09。用户已批准本轮计划；本文件是实现前冻结规格，不表示实现或验收通过。

R1后端限定修复增量：以 `v2-px-r1-backend-repair-plan.md` 和 `v2-px-r1-backend-repair-acceptance.md` 冻结F-1..F-6处置。Forget精确确认与四面实查、12条有界引用、专用授权批次票据补充本合同；前端/Chrome及R2-R4仍未放行。

## 子阶段与门禁

R0：本文、权限Schema、原始观察合同和权威文档同步；分别做合同一致性与负向证据审查。
R1：Runtime权限执行及前端操作，完成真实文件/API/浏览器验收与PRD检视。
R2：真实宿主侧栏采集及新run原始证据，完成路径/身份/状态复核。
R3：共享语义校验与纯报告生成，完成合同回归及生产字节变异负例。
R4：隔离Git快照全量复验、中文HTML/Drawio、独立复审；之后才进入PX-6人工签署。
每一步的通过范围单独记录；未取得证据不得宣称完成。新增Major按用户停止规则处理。

2026-09-11 执行状态：T01 与 T02 已分别限定 PASS；T02 独立审查仅允许 T03 实施前规划。首个 T02 sealed raw 不满足 production-positive 的完整 G1/G2/G6 与 12-source corpus 分母，因此按路线 A 返回 R2 重采。

2026-09-12 最新状态：T02.1 重采关闭了输入数量、12-source corpus、invalid recovery、Axe/Keyboard 等缺口，但 T03 实施期逐条复核发现三条 durable Forget 链的 12 次重开均没有 `SOURCE_NOT_FOUND` 和 Source Library recovery，只观察到 Runtime 对同一 source 返回 `status=forgotten`。T02.1 raw/schema/collection 限定结论保留，其作为 T03 production-positive base 的资格撤回；T03 停止，T04/PX-6/RKM 继续阻塞。推荐进入 T02.2 产品恢复语义修复、采集器强断言和全新 R2 重采；详见 `evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/t03-implementation-risk-stop-durable-forget-2026-09-12.md`。

## 权限与文件接口（v1）

所有接口沿用Runtime现有 `ok/data/error/request_id` envelope，而非旧OpenAPI草案的camelCase envelope。错误用现有 `REQUEST_INVALID`(400)、`TOOL_PERMISSION_DENIED`(403)、`CONTEXT_TOO_LARGE`(413)、`SCHEMA_VALIDATION_FAILED`(422)、`INVALID_TRANSITION`(409)，并在details.reason给出闭合原因：invalid_request、missing_permission、revoked_permission、workspace_mismatch、path_not_allowed、file_changed、unsupported_file、unsupported_platform、limit_exceeded、idempotency_conflict。错误不能返回原始路径。

- POST `/v1/knowledge/permissions`：`workspaceId/displayName/path/scope(single_file|directory)`全部必填；path是用户明确输入的Runtime绝对路径。只校验文件类型与元数据，授权不读取正文。返回permissionRoot及operation。
- GET `/v1/knowledge/permissions?workspaceId=...`：返回Runtime本次生命周期内该workspace的全部granted/revoked记录；无path，仅redactedPath。浏览器刷新通过此接口恢复。
- DELETE `/v1/knowledge/permissions/{id}`：保留现有地址；幂等撤销。结果仍为permissionRoot及operation，确认后禁止该root的新读取/新提交。
- POST `/v1/knowledge/permissions/{id}/scan`：body=`{workspaceId}`。用户主动扫描；返回 `scanId/permissionRootId/workspaceId/files[]`，files为 `fileId/displayName/sizeBytes/sha256`。fileId是opaque映射，不是可任意替换的路径。无自动导入。
- POST `/v1/knowledge/permissions/{id}/imports`：body=`{workspaceId,scanId,fileIds}`，Idempotency-Key必填8..160字符；fileIds必须非空且唯一。返回sources、operations、idempotentReplay。只接受该授权扫描产生的fileId，重新读文件并重算SHA-256，变化则409。
- 原有POST `/v1/knowledge/sources`继续接收网页/手写note/markdown内容，但拒绝 `authorized_local_document/pdf` 和file URL本地访问伪装；本地文件必须走受控imports。客户端提交的文本永远不能触发Runtime按URL读取文件。

Runtime实现放在memory模块的PermissionService，由app路由调用；MockKnowledgeServiceAdapter仅接收授权完成后的来源快照。前端只经runtimeClient调用，权限管理组件增加路径输入、列表、扫描、选择、导入、撤销；不访问文件系统。

## 文件及并发语义

### R0独立审查补充决定

1. 本地文件功能默认关闭。只有Runtime操作者配置 `NAVIA_LOCAL_FILES_TOKEN`（至少32字符随机bearer token）及 `NAVIA_LOCAL_FILES_EXTENSION_ID`（确切Navia扩展ID）才开启。不得通过API获取token。扩展的权限页提供password输入，token仅保存在当前页面内存；共享runtimeClient通过Authorization header携带，禁止URL/localStorage/日志/截图记录token。无Origin的本地CLI调用也必须携带token；extension Origin必须精确匹配配置ID，其他Origin即使持token也拒绝。缺配置/缺token/错token均403，常量时间比较。默认未启用时原网页伴读接口不变。
2. 本地文件功能启用后，`/v1/knowledge/*`除无内容的status/workspaces外全部要求此认证，避免导入后通过source/query/graph/trace读取本地正文的绕过。status只增加脱敏的显式配置提示，不返回token/path；权限页可在sources认证失败时打开并输入token，浏览器重载需重新输入。此为本轮新增临时会话凭据语义，覆盖旧ADR的“不新增凭据”限制；无持久凭据存储。
3. grant时逐分量相对父fd打开并保存每个祖先及root的 `st_dev/st_ino`，最终root另保留fd。每次操作开始重验当前路径全链身份；替换普通root/祖先也403。目录内部只以root fd相对打开，绝不把绝对路径传入dir_fd；scan保存每个文件inode身份和hash，import重新验证。授权与目录枚举次数/正文读取次数均可在测试中实际观测，grant不得触发枚举或read。
4. 每次 `open/read/listdir` 与granted/epoch检查处于root锁的同一临界区；正文按64KiB块读取。revoke获得同锁更新epoch；正在执行的单次系统调用先完成再返回revoke，之后不得启动新调用。提交也在root锁内重查epoch。测试在检查与IO边界设置屏障并统计实际IO调用，不能只断言没有source。
5. 外部Idempotency-Key作用域是permissionRootId+workspaceId；规范请求为scanId和排序去重前验证唯一的fileIds。import读完后持root提交锁再次查缓存，防止并发cache miss重复提交。adapter内部key使用独立命名空间 `local-import:<permissionRootId>:<sha256(key)>:<fileId>`；不会与原sources客户端key共享。Adapter增加批次原子入口，sources/operations/workspaces/idempotency在同一adapter锁内共同提交，异常恢复提交前状态；所有公开读写使用该锁，读者不能看到部分批次。锁顺序固定root->adapter，禁止反向获取。
6. 本地source保存不可变UTF-8正文快照及raw-byte SHA-256/byteLength，并由Runtime按实际行号生成非空EvidenceRef；不能使用通用fallback代替文件内容。导入后source detail返回快照，后续原文件变更不影响既有快照；Forget禁止查询快照，数据的释放由Adapter完成。仍是本地mock知识处理，不宣称语义RAG能力。
7. grant仅接受Runtime已经存在的workspace，避免客户端伪造workspace自动获得新文件能力。scan/import的workspace必须与grant严格相同。权限API输出用新Schema，旧没有path的grant请求明确400，相关旧测试必须更新为真实显式路径而不能继续假授权。
8. Side Panel与Workspace各挂载同一个LocalRuntimeAccess会话认证组件，但各自独立内存token；不通过URL或Chrome消息传递凭据。用户在每个容器分别输入并点击连接，客户端以权限列表请求确认认证，不自动保存或导入。组件位于依赖内容API的loading/error分支之外，403显示“需要连接本地文件会话”，不冒充Runtime offline。任一容器重载/关闭会丢失自己的token，另一个容器不受影响；离线不清除当前页面token，但后端重启更换token后403要求重新输入。必须在本地文件开启状态通过真实UI输入两次token，再完成侧栏保存->Workspace查看来源；禁止测试器直接注入客户端token当用户路径。

- 仅UTF-8 .md/.txt，单文件5MiB，扫描最多256个常规文件和256个子目录、深度16，单次导入20MiB。达到上限明确失败，不返回貌似完整的截断成功。
- 只接受POSIX绝对Runtime路径，不自动翻译Windows路径；POSIX dir_fd/O_NOFOLLOW不支持的平台fail closed。逐路径分量拒绝符号链接，拒绝..、NUL与非普通文件，打开后fstat确认类型。目录授权不允许遍历到root外。
- 授权绑定workspace和Runtime会话；使用随机opaque ID。Runtime重启权限失效，要求重新授权；不承诺旧operation/source持久恢复。
- root内元数据保留epoch与锁。scan/import开始及每次文件读取前检查granted；IO后提交前再次检查epoch。revoke取得同一提交锁标记revoked并增加epoch；旧任务不能提交，已经提交的来源保留。单次导入先读取、验证全批，再持锁提交，预检查失败不写source。
- 导入幂等缓存绑定root、workspace、scanId和fileIds的规范化请求；相同key不同请求409。同请求重放仍先检查授权，撤销后403。禁止用旧key重新创建被遗忘source。
- 绝对路径只在Runtime内存中保存；响应和公开日志脱敏。显式本地授权不增加自动扫描或默认文件访问。
- 撤销后，Library/Ask/Graph/Trace仍可读取已导入来源；Forget仍需用户确认并重新查询四面，而不是信任verification布尔值。

## 原始证据合同（v2）

每个run独立存储run-manifest、append-only事件序列及原始artifact。`v2_px_raw_run.schema.json` 的权威版本为 `v2-px-raw-run/v2`；run-manifest绑定snapshotCommit、构建文件索引hash、collector实现hash、raw schema原始字节hash、adapterMode、session segments以及命令实测exitCode/signal。`seal.contentSha256` 对删除顶层 `seal` 后按 UTF-8、对象键 Unicode code point 升序、数组保持原序、无多余空白和无尾随换行生成的 canonical JSON 原始字节计算；`eventCount/artifactCount` 必须与数组长度相等。validator实现hash属于封存后的productionValidation，不写回sealed raw run，避免自引用和事后修改原始证据。
事件字段：`runId/scenarioId/eventId/sequence/observedAt/monotonicMs/segmentId/contextId/navigationId/actionId/kind/payload/artifactRefs`。`navigationId/actionId` 不适用时显式为null。kind闭合为navigation_start、fault_start、fault_end、dom_action、background_request、background_response、runtime_request、runtime_response、transport_failure、route_observation、container_observation、screenshot、command_result。
dom_action来自真实event.isTrusted与触发元素；技术evaluate事件不得冒充DOM手势。requestId来自实际消息或网络，不由生成器补写。逐容器ID按observed/not_applicable/unavailable记录。
R2 transport采集范围固定为`/v1/knowledge/*`；V1 health/settings/sidecar不进入V2原始因果链，由同run的T01回归命令结果独立覆盖。runtime_response artifact为浏览器网络层读取的解压后entity body原始字节，不二次JSON序列化；保留content-type与哈希。每个Background request必须恰好对应一个Background response；范围内每个Runtime request必须恰好对应一个Runtime response或transport_failure，缺失或重复终态均阻止封存。无响应只记录transport_failure，不能制造responseFingerprint。
screenshot关联实际imagePath、metadata、route、ID、状态观察及capture时间；每个captured状态引用原始eventId。授权请求含私有路径时仅存受限本地artifact，公开报告不复制原文；校验必须在本机读取该原始artifact，外部包只能声明未提供私有字节的复核边界。
命令成功必须来自实际退出码，检查指标来自结构化输出。原始run缺少必需事件时生成blocked报告；生成器不能补成功值。

## 快照与验证

### 原始证据审查补充决定

1. 单一run内允许多个明确session segment。每个segment记录runtimeSessionId（采集器创建并绑定启动PID/start time）、browserContextId、开始/结束sequence、adapterMode及faultInjection；fault开始/解除均是原始事件。Runtime重启必须新segment，旧permission/source不存在可以返回恢复错误，不能引用旧segment的authority。不同run禁止合并通过指标。
2. 所有原始事件增加segmentId、contextId、navigationId和actionId（不适用为null）。runner在实际导航启动前产生navigationId并记录navigation_start；点击由浏览器trusted事件产生actionId。消息/请求继承当前因果上下文，request响应引用request eventId。采集器统一在接收时编号sequence与monotonicMs，sourceObservedAt仅为辅助时间，不用于跨进程排序。并发无唯一对应时标记无法关联，不能按最近时间猜测。
3. 每次导航使此前navigation的authority失效；每次影响source的save/revoke/forget使该source此前authority失效。route/container/screenshot引用的响应必须位于本次navigation开始之后，且不早于最近mutation的完成。offline引用本次transport失败；同source旧成功响应不能用来填本次离线状态。retry是独立action并引用retryOf；Background回复必须同时匹配requestId和request eventId。
4. G1需要真实DOM动作->message request/response->新窗口导航->Runtime权威->捕获；G2需要对应导航开始->该导航Runtime请求/响应->route observation；G3需要变更请求/响应->四面重新读取->恢复链；G5需fault区间内状态response或transport failure；G6截图和DOM/axe/keyboard必须属于同segment/context/navigation。G4/G7命令由runner进程采集，不伪装成浏览器事件。
5. 兼容方案固定为新增 `v2-px-production-package/v1` envelope，旧Report v12等九份冻结合同仅保留contract回归，旧生产包已撤回。新envelope引用sealedRawRun、derivedFacts、productionValidation、contractRegression、humanReview及renderedReport；derivedFacts复用旧ScenarioResult/Execution/Screenshot的事实结构，并另有provenanceByScenario映射到原始eventId。旧root的SemanticResult不得作为生产结果类型。缺原始数据输出独立 `v2-px-collection-diagnostic/v1`，含missingObservations和passed=false，不强行满足完整成功Report。
6. 原始映射固定：EntryAction只来自dom_action及被关联message；BackgroundResult只来自对应response；ObservedIds只来自container/route/Runtime实际字段；Status来自对应HTTP body或transport失败；before/after来自真实四面查询；截图path/dimensions来自PNG及捕获事件；TestCommand来自外层command_result；summary由这些记录重算。sourceSampleId由import响应和预登记内容hash建立映射，不能以位置或corpus[0]推断。
7. 三种profile固定：contract_fixture仍完整运行既有63规则/109负例；production_candidate运行全部适用机器规则及新增原始因果规则，human形状合法但签署待定时输出pending；production_final在相同机器结果基础上再验证human签署和artifact hash。production不能把human pending当自动通过。规则结果枚举passed/failed/pending/not_applicable；缺执行记录一律failed，not_applicable必须来自冻结profile表而非输入报告。
8. 旧registry的human相关规则 `PX_RULE_FINAL_GATE_OR_HUMAN_REVIEW_FAILED`、`PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID` 在candidate为pending（仅human文档合法且unsigned），final必须passed；`PX_RULE_HUMAN_REVIEW_SHAPE_INVALID`始终执行。`PX_RULE_SEMANTIC_POSITIVE_BASE_INVALID`由本次真实contractRegression结果证明，不能复制fixture对象。Schema/SemanticResult shape规则对生产结果采用新envelope定义，旧结果shape仅用于contractRegression。其余规则的算法必须保留并接入新reader；任何不适用项必须在R3实现前profile表逐条登记并复审，不能临时跳过。
9. 无环封存顺序固定：snapshot commit -> build index -> raw run/artifact index封存 -> derivedFacts -> productionValidation（绑定raw/derived/validator实现hash）-> report HTML -> exit manifest（绑定前述全部文件hash）-> human签署exit manifest -> final disposition。validator自身退出码由父进程写独立invocation record，不能回写sealed raw。HTML重渲染重建exit manifest并使旧human签署失效；raw/facts变化必须新run；validator变化可对原sealed run生成新validation版本，但必须重建下游报告/签署，禁止覆盖旧版本。

### R2 采集标识与脱敏决定

1. `runtimeSessionId` 由collector在每次启动真实 Runtime 子进程后生成 `rts_<uuid>`，并与PID、可执行命令hash及startup时间共同记录；它不是Runtime API返回值。`browserContextId`在Playwright BrowserContext创建时生成 `bcx_<uuid>`；`contextId`在host page、原生Side Panel、Workspace、background/service-worker、Runtime transport或command collector注册时生成 `ctx_<surface>_<uuid>`。禁止读取Playwright私有 `_guid` 作为权威。
2. `priorPath`是dom_action发生前该页面最近一次已观察到的location URL；没有前序导航时为null。`navigationId`只有首个navigation_start之前的background/command/transport准备事件可为null；用户动作及其后续链必须非null。Runtime `/v1/knowledge/*` 请求的requestId必须来自实际`X-Request-ID`且非null；无业务authority的health探活可为null。
3. `segments[].faultInjections`为`{faultType,startSequence,endSequence}`对象数组，按startSequence升序且区间不得交叠；每个fault_end必须关闭同segment内尚未结束的同类型fault_start。受控adapter/data_service/source故障可以在同一Runtime segment中注入，但必须记录区间；只有真实Runtime进程重启才新建segment。
4. 公开事件不得保存Runtime token、Authorization header或用户授权绝对路径。请求体含授权路径时只保存`private_local_only` artifact；公开事件只保留hash、长度和`[private-local-path]`。公开扫描同时检查随机token原文、Bearer形态、当前用户home、三个授权root原文和private索引路径；项目PRD中作为公开规格文本出现的示例路径不等同用户授权路径。
5. raw run先在内存/临时事件日志中完成，artifact逐文件原子落盘并生成index；最终一次写`raw-run.json.tmp`，fsync/close/rename为`raw-run.json`。seal采用上文canonical JSON规则。封存后collector以只读方式重开并复算；任何内容变化必须新runId，不允许原位追加。

独立目录以主仓库HEAD作为参考，覆盖本阶段源码/测试/合同及必要依赖，创建本地验收commit，主仓库index/HEAD不变且不push。所有产品构建和G4扫描读取该快照；源码变更必须新建快照并重跑受影响测试。扫描完整三个冻结根目录及其mode/blob；构建依赖索引覆盖额外Runtime/Shared Client/ContentBridge实体。
生产与合同共享semanticRulePass和architectureScan，reader区分真实Git/artifact与contract virtual bytes。旧109负例保持回归，新生产负例测试原始字节变异、缺事件、错误ID、错误hash、假成功命令。Gate规则引用固定registry，结果绑定本次实际执行集合。
Report生产语义结果与contract regression分栏。未通过机器审计或未签署human review时passed=false；没有数据不能填0。

## R1 正负验收矩阵

真实文件用仓库PRD/架构/验收MD复制到独立测试目录，记录原始字节hash。测试授权后无自动source，scan后无自动source，显式import成功，三组撤销后scan/import403且旧source四面可读。
负例必须覆盖：无授权、跨workspace、..、symlink及root替换、unsupported/invalid UTF-8/oversize、scan后内容变化、不同请求重用key、revoke与in-flight import竞争、新Runtime权限缺失、伪造fileId和直接sources绕过。
