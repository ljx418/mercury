# R1 后端限定修复审计与交接

日期：2026-09-09。结论：**R1后端限定修复通过本次独立代码复审**。R1整体仍未验收，PX-5 FAIL / REOPENED，PX-6 BLOCKED。

用户选择仅后端风险闭环。本次不修改前端，不打开浏览器，不运行旧报告生成器/旧生产validator，不提交或推送主工作树，不进入R2-R4。原 `r1-independent-audit-2026-09-09.md` 与 `r1-implementation-risk-stop-2026-09-09.md` 均保留，本文记录后续处置而非撤改历史。

## F-1 至 F-10 处置

| 项目 | 修改及验证 | 本范围结论 |
| --- | --- | --- |
| F-1 | root锁内比较捕获epoch后才读幂等缓存；缓存命中、提交窗口撤销、close并发回归 | 关闭 |
| F-2/F-4 | HTTP/Adapter共享精确ForgetInput校验，空/错/缺/非对象/额外字段400，不修改正文或operation；合法文本才创建确认记录 | 关闭 |
| F-3 | StringIO逐行处理，12条后停止构造；200行、5MiB短行、CRLF空白行与真实文档引用检查 | 关闭 |
| F-5 | 四面实际查询，残留degraded，错误/坏结构failed；Graph成功空图ready，Ask/Trace lookupOutcome区分无来源/已遗忘和不可读取 | 关闭 |
| F-6 | 通用单条/批次及缓存前拒绝保留字段/key；一次性非序列化ticket绑定已验证批次，保持root->Adapter锁序与原子回滚 | 关闭 |
| F-7 | granted/revoked列表均保留，符合原合同，不过滤撤销历史 | 无需代码修复 |
| F-8 | 保持同步operation时间策略，补createdAt<=updatedAt断言 | 无需代码修复 |
| F-9/F-10 | 空确认成功断言改为合法确认后测试幂等，并新增独立负例矩阵 | 已补齐本范围回归 |

确认记录中的requestedByUser仅表示收到明确用户式请求，不证明真实DOM可信点击。票据是进程内API误用防线，不是恶意同进程代码的沙箱。

## 独立复审过程

审查者Hume（01a084b4-b9c5-7963-857d-645093e879e0），与实施代理分离、只读审查。

1. 方案审查：新增Fatal 0 / Major 0，只批准后端修复，记录见 `r1-backend-preimplementation-review.md`。
2. 首轮实现复审：F-1/F-2/F-3/F-4/F-6关闭，F-5仍有Graph失败状态配空数组假绿。独立87项测试通过不能覆盖该反例。
3. Graph约束收紧后发现正常空图也被历史degraded语义阻断；改为成功空图ready。随后独立复审发现Ask超时及Trace权限阻断的空结果仍会假绿。
4. 增加lookupOutcome规范字段及对应正负Schema/测试，拒绝missing/unknown/unavailable。最终审查原文结论：“本次限定范围未发现新增Fatal/Major；F-1～F-6后端修复可判定关闭。”
5. 最终独立执行：103 passed / 17 warnings，另10项Ask/Trace组合故障注入均拒绝假绿。审查者没有独立重跑全量Runtime或监听服务HTTP验收，没有执行Chrome。

## 实际测试及证据等级

- 修复前新增回归：53 failed，`r1-backend-before.log`。含真实缺陷和当时尚不存在的专用入口/合同，不能声称53项均是独立产品缺陷。
- 首次实现后：74 passed / 1 failed，`r1-backend-after-initial.log`；失败来自测试将合同根additionalProperties错误套到$defs，已修正测试构造。
- 扩充票据/并发后：87 passed，`r1-backend-after.log`；早期全量223 passed，`r1-backend-full-suite.log`。
- Graph收紧中间态：223 passed / 4 failed，`r1-backend-full-suite-final.log`；正常空图修复后227 passed，`r1-backend-full-suite-verified.log`。文件名中的final不代表最终有效结果。
- **最终全量：239 passed / 55 warnings**，`r1-backend-full-suite-closure.log`。warnings为现有multipart/httpx弃用提示，未借机升级依赖。
- **最终独立监听服务HTTP测试：1 passed**，`r1-backend-http-closure.log`。真实导入仓库PRD/架构副本、比对正文原始字节/hash/行号、撤销后拒绝扫描导入、保留旧来源、遗忘后四面重读。每个请求记录实际状态及response hash，无token日志；Runtime子进程已退出。
- 两份Schema元校验通过，OpenAPI YAML可解析且Forget requestBody必填；git diff --check通过。

这些是服务/API测试与隔离故障测试。HTTP日志的响应hash不是完整生产原始证据包；没有保存全部响应字节，也不能用于替代R2采集或G1-G7验收。MockKnowledgeServiceAdapter没有变成真实data_service/RAG。

## 合同与改动路径

- `services/local-runtime/navia_runtime/modules/memory/guards.py`：共享异常、Forget输入校验、保留字段防线、12条常量。
- 同模块 `permissions.py`：捕获epoch复核、有界引用、票据注册/消费/清理。
- 同模块 `runtime/__init__.py`：受控提交、批次原子性、四面查询、lookupOutcome。
- `services/local-runtime/navia_runtime/app.py`：HTTP使用共享校验；URL/envelope保持。
- 测试：新增 `test_v2_r1_backend_repair.py`、`test_v2_r1_backend_http.py`；修改 `test_v2_local_permissions.py` 的旧错误断言和故障注入位置。
- `contracts/v2_local_permission.schema.json`：ForgetInput、LookupOutcome及Ask/Trace缺席观察定义；`contracts/v2_knowledge_api.openapi.yaml`：输入/状态/结果依据说明。历史合同bundle未重建。

本次关键源码、合同及最终日志raw-byte SHA-256见 `r1-backend-repair-result.json`。HEAD不能代表含未跟踪文件的当前实现；该清单不是R4冻结Git源码快照。

## PRD 检视与剩余工作

用户主动授权、无默认读取、撤销阻止新读取/提交、已导入快照保留、Forget明确确认及四面实查，在本后端范围有对应代码和正负验证。未扩展文件类型、持久权限、自动维护或V3。

仍需另行计划：前端认证错误/凭据清理/状态展示/Forget失败展示、真实宿主侧栏与Workspace E2E、R2原始事件采集、R3共享生产校验、R4隔离Git快照和最终人工验收。现有前端可能未适配后端degraded/failed结果，未在本轮修改或验证。

## 停止原因

用户授权的“仅后端风险闭环”已完成并通过限定独立复审。按范围要求停止，不自动继续前端、Chrome或R2。R1整体/PX-5/PX-6保持未通过，原PX-5五组证据问题仍需后续修复和重验。
