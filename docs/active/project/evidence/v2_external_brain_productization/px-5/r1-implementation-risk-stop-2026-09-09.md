# R1 实现审计与风险暂停

日期：2026-09-09。状态：R1 IMPLEMENTATION INCOMPLETE / STOPPED FOR MAJOR REVIEW。
PX-5 仍 FAIL / REOPENED；PX-6 仍 BLOCKED。本文不是产品验收报告。

## 已执行工作

- R0 的两名独立只读审查者完成方案审查，放行范围仅为 R1 权限实现。详见 `r0-independent-review.md`。
- 新增 PermissionService：默认关闭、精确扩展 Origin 与 bearer 认证、显式路径授权、扫描、文件选择导入、撤销、批次回滚和幂等缓存。
- Adapter 接收真实文件内容快照及行级引用；修复规范化时丢失 lineStart/lineEnd 的问题。
- 前端已接入会话认证组件、权限列表/扫描/导入接口和文件快照展示；仅通过类型检查，尚未完成浏览器和交互验收。
- 没有运行旧的失效报告生成器，没有把合同夹具升级为产品证据，没有提交主工作树或启动 R2。

## 实际检查结果

`PYTHONPATH=services/local-runtime pytest -q services/local-runtime/tests/test_v2_local_permissions.py services/local-runtime/tests/test_v2_memory_knowledge_api.py`：22 passed，6 warnings。包含仓库真实 PRD/架构文件的临时副本导入、内容 hash、行引用、授权撤销、并发导入及回滚测试。它们是 API/服务测试，不是 Chrome E2E。

`npm run typecheck`（apps/chrome-extension）：exit 0。

`git diff --check`：exit 0。

首次权限测试为 15 passed / 3 failed，原因是 Adapter 丢失行号；修复后上述 22 项通过。不能隐藏首次失败，也不能将其后的通过解释为无风险。

## 新发现的 Major

独立审查者 Huygens（01a0846e-7b27-78e1-ba25-00165a4359e2）静态审计提出三项 Major。主代理随后在隔离临时目录以 200 行小型诊断文本、MockKnowledgeServiceAdapter 和确定性屏障复现；不使用私人文件，不进行内存耗尽测试。

| ID | 确证问题 | 实际复现结果 | 修复与验收要求 |
| --- | --- | --- | --- |
| R1-M1 | `_verify_path` 释放锁后发生 revoke，缓存重放分支取得锁后未再检查 epoch/state | `permission_state=revoked`，但 `idempotentReplay=true` | 在缓存读取/重放的锁内执行 `_active(root, epoch)`；增加已导入缓存命中路径的撤销屏障测试，必须 403 且不返回来源正文 |
| R1-M2 | Forget 接受空对象，补造 confirmationText 和 requestedByUser，并删除实际正文 | `{}` 导致 `status=forgotten`、`has_snapshot=false`、记录 `requestedByUser=true, confirmationText=forget` | API 与 Adapter 在状态修改前验证显式确认；空值/缺失/错误确认拒绝，四面数据与正文保持；真实 UI 确认成功，不伪造用户意图 |
| R1-M3 | 列表推导构造所有非空行 EvidenceRef 后才切片 | 200 行构造 200 个 EvidenceRef，最终 Adapter 返回 12 个 | 流式或有界迭代，在约定条数达到后停止构造；明确生成与 Adapter 保留上限，验证构造次数有界，保留完整正文 |

诊断命令首次使用 `python` 时 exit 127（环境无此别名）；改用 `python3` 后 exit 0 并得到上述三项结果。诊断观察不是成功验收证据。

## 下一步修复计划（待用户确认）

1. 增加三项确定性失败回归，覆盖撤销缓存命中窗口、空/无效 Forget 确认和大量短行的引用构造次数。
2. 在 PermissionService、Adapter/API 边界作最小修复，不改变授权范围、不增加自动扫描/持久权限或 RAG。
3. 重新执行权限/API 全量相关回归，并请独立审查者复审，Major 未清零不得声明 R1 后端通过。
4. 完成前端交互/认证失效清理/错误恢复测试、真实 Chrome 双容器认证及文件操作 E2E，再进行 R1 PRD 检视。当前前端仅编译检查，不声称安全或交互闭环。
5. R1 验收通过后才制定并审查 R2/R3 的新证据 Schema、profile 和标签页聚焦复用分支，随后进入原始采集、共享校验与 R4 隔离快照验收。

## 停止原因

发现并复现了三项新增重大权限/删除/资源风险，触发用户“出现较大偏差或虚假验收风险即停下确认”的要求。当前保留未完成修改，不发布、不提交、不启动相关服务，不将现有 22 项测试通过升级为 R1/PX-5 通过。等待用户确认上述限定修复范围。
