# R1 后端限定风险闭环计划

日期：2026-09-09。用户已批准；范围仅后端，不包含前端/Chrome/R2-R4/PX-6。

输入：`evidence/v2_external_brain_productization/px-5/r1-independent-audit-2026-09-09.md` 与 `v2-px-5-repair-execution-contract.md`。保留原独立审查，本文对最小修复建议作明确选择，不追改原记录。

## 实施顺序

1. 合同、本文及单独验收计划冻结，独立方案审查后新增失败回归。
2. F-1 缓存重放：在root锁内对捕获epoch检查后才读缓存；提交同样检查。撤销先完成则403/revoked_permission，不返回缓存正文。不是改成比较root.epoch与自己。
3. F-2/F-4/F-5：共享输入校验要求对象且仅含confirmationText，精确字符串forget；HTTP与Adapter修改前校验，400/REQUEST_INVALID/invalid_request。确认记录只表示显式请求，不证明可信点击。四面实际重读；全部缺席succeeded，残留degraded，异常/坏结构failed。失败不复活正文。重复有效请求重新验证。保留202 envelope和现有verification布尔值，false表示未证明缺席；operation.error使用现有FORGET_VERIFICATION_FAILED。不增加requestedByUser入参或verificationStatus。
4. F-3：生成与Adapter保留上限统一12，按行迭代并立即停止引用构造，完整正文保留；不全量splitlines再截断。
5. F-6：save_source/save_batch在幂等缓存前拒绝本地类型、file URL、contentSnapshot、permissionRootId、保留key。PermissionService发行一次性opaque非序列化ticket；服务私有registry绑定root、epoch、workspace和已验证批次的深拷贝。Adapter一次性绑定该服务的消费入口，commit_authorized_batch只接受ticket。消费先从registry移除，再持root锁验epoch/候选workspace/root/key，之后持Adapter锁原子提交；票据失败不重用，正常API重试重新读验并发行票据。锁顺序root->Adapter；registry短锁释放后才等root，不反向持锁。无授权的通用Python入口拒绝；不声称隔离恶意同进程任意代码。
6. 本轮修复前失败记录、修复后测试、真实隔离HTTP检查及独立代码复审落盘；不运行旧生产报告链。

## 合同增量及兼容

新增共享后端校验模块承载PermissionFailure、12条引用常量及Forget输入校验，避免Runtime/Permission循环导入。PermissionFailure仍从permissions可导入，兼容原调用。原V2合同的ForgetRequest是结果审计对象，不把它当HTTP输入。

新增Forget输入schema定义及OpenAPI requestBody/400/404说明；输出继续复用ForgetVerification和KnowledgeOperation。既有合法`{confirmationText: "forget"}`不变，空/错误调用明确拒绝。本地快照只由专用提交入口接受。历史冻结bundle不重写。

F-9空确认成功断言改为合法确认完成之后再测幂等，另加空确认拒绝测试。F-10逐项补矩阵。
F-7权限列表保留revoked是原合同规定，不过滤。F-8保留当前时间戳策略，要求createdAt<=updatedAt。

实现复审补充：Graph仅status=ready且workspace匹配、nodes/edges结构完整时能证明缺席。failed/degraded/缺失/非法状态均使验证failed，不能用空数组掩盖读取失败；此项属于F-5原范围未闭合的反例。Mock Adapter成功读取的空图返回ready及空nodes/edges，不再以degraded表示“无来源”；空数据不是读取失败。该现有枚举语义校正在OpenAPI同步，不新增状态或改前端。

F-5后续反例闭环：Ask/Trace增加机器字段lookupOutcome，闭合集合found/empty/forgotten/unavailable。它从Adapter实际来源查询分支产生，不接收客户端输入。Ask仅empty+degraded+空answer/refs可证明无来源；Trace仅forgotten+blocked+空entries可证明遗忘。found代表仍可读取；unavailable、缺失或未知值导致验证failed。degradedReason只是展示文本，不参与缺席判定；不能将超时或权限阻断的空结果算作缺席。新增字段为向后兼容响应增量，权威正向观察结构见权限Schema的AskAbsenceObservation/TraceAbsenceObservation，不修改旧证据bundle或前端。

## 出门限制

独立方案审查只放行后端修复；独立实现复审按F-1..F-6分别关闭。新重大风险需停下确认。即使本限定范围通过，R1整体、PX-5和PX-6均不能通过；前端认证与Chrome交互另行计划。不开启真实data_service/RAG/自动文件访问，不提交主工作树。
