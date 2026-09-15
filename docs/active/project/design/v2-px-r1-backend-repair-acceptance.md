# R1 后端限定修复验收

日期：2026-09-09。执行结果：后端限定范围通过独立复审，详见 `../evidence/v2_external_brain_productization/px-5/r1-backend-closure-audit-2026-09-09.md`。本计划本身不是测试证据，不放行R1整体。

| 项目 | 必须验证 |
| --- | --- |
| F-1 | 已缓存导入在verify后revoke，返回403/revoked_permission且无响应正文；首次提交前撤销同样拒绝；保留既有来源 |
| F-2/F-4 | HTTP及Adapter对缺失、空、错误文本、非字符串、非对象、额外字段拒绝400；正文、四面、operation数量不变；正确确认成功 |
| F-5 | 实际调用Library/指定source的Ask/Graph/Trace；逐面注入残留、Graph边、异常、坏结构不全绿；失败不恢复正文；重复Forget重查 |
| F-3 | 200行及5MiB大量短行构造引用<=12；真实文件快照hash、行号正确；空白行不消耗引用数量 |
| F-6 | 通用单条/批次入口及cache-hit前拒绝保留字段和key；专用入口伪造/重用/跨workspace/root/失效epoch票据拒绝；合法批次、故障回滚、重试、并发幂等保留 |
| F-9/F-10 | 旧错误断言修正且增加独立负例，不能删除用例降低门槛 |

先执行新回归对旧实现的失败检查并保存真实stdout/exit，再修复。相关测试使用真实PRD/架构文件的临时副本；短行等合成文本明确是边界夹具。独立HTTP验收以随机端口、临时数据目录和临时凭据运行Runtime子进程，通过requests执行健康/授权/扫描/导入/内容比对/撤销/遗忘/四面重查，结束清理服务与临时文件；不记录令牌或私人路径。

命令基线：`PYTHONPATH=services/local-runtime pytest -q services/local-runtime/tests/test_v2_local_permissions.py services/local-runtime/tests/test_v2_memory_knowledge_api.py services/local-runtime/tests/test_v2_r1_backend_repair.py`；随后运行整个`services/local-runtime/tests`。新Schema元校验、HTTP输入正负校验和现有Forget输出定义验证必须执行。

评审交付：修复前后日志、F-1..F-6处置表、PRD覆盖、独立方案/代码审查、未覆盖范围。失败命令与阻塞如实记录；测试数量不能代替需求覆盖。任何通过仅称R1后端限定修复，不得将Mock知识处理或HTTP验收称为真实Chrome/RAG验收。
