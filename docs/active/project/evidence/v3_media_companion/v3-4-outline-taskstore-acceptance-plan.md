# V3-4 MediaTaskStore、VideoOutline 与三视图验收计划

日期：2026-10-08。状态：`V2 CONTRACT FROZEN / IMPLEMENTATION NO-GO PENDING EXPLICIT AUTHORIZATION`。

## 1. 固定分母 V401..V418

| ID | 场景与操作 | 必须结果 | 证据 |
|---|---|---|---|
| V401 | 在旧数据库运行迁移 | 旧表字节/行数不变，新表版本正确 | before/after DB manifest |
| V402 | 创建 task 并按正常流程迁移状态 | 只允许闭集 transition，sequence 连续 | state/event log |
| V403 | 提交 aggregate+event+outbox | 同事务全有或全无 | fault-injection DB queries |
| V404 | 用旧 expectedRevision 写入 | 返回 conflict，当前 revision 不变 | CAS negative |
| V405 | 同 idempotency key 重试 | 返回原结果，0 重复 event/outbox | retry receipt |
| V406 | Runtime 在每个写入点崩溃重启 | 不丢已提交、不出现半提交、不自动重复副作用 | crash matrix |
| V407 | 处理中取消 | barrier 后不发布 outline/projection，终态 cancelled | cancel timeline |
| V408 | 旧 revision 晚到 | 不覆盖新 revision | race negative |
| V409 | 在一个新 V3-4 run 处理冻结 12 页 | 12 个 envelope 均 Schema/semantic-valid；样本 01..10=`ready` 且发布三视图，样本 11=`blocked` 且零投影，样本 12=`degraded` 且仅从真实低信号证据发布三视图 | candidate manifests、terminal matrix |
| V410 | 注入无证据章节 | validator 拒绝 `OUTLINE_EVIDENCE_REQUIRED` | negative fixture |
| V411 | 注入跨 task 或未知 evidenceId | validator 拒绝，0 publish；成功回执固定 unresolved/cross-task count=0、projection closure=true | negative fixture、transaction receipt |
| V412 | 校验章节时间 | start<end、范围内、有序；违规拒绝 | timeline verifier |
| V413 | 派生 Timeline | sequence 连续，outlineId 一致，evidence 闭合 | projection receipt |
| V414 | 派生 Mindmap | 唯一根、节点对应 section、outlineId/taskId 一致 | projection receipt |
| V415 | 同一 outline 重复派生 | canonical bytes/hash 完全一致 | deterministic diff |
| V416 | direct/reload/Back/reopen 与 Runtime 重启 | 从 store 恢复同 task/revision，不用前端缓存 | API/Chrome observation |
| V417 | 检查 V4 边界和公开包 | knowledgeImportStatus=`deferred_to_v4`；0 secret/path/private DB | schema/scan |
| V418 | 全量回归与独立审计 | Runtime/Extension/V3-1..3 通过；Fatal=0/Major=0 | logs、audit |

任何项目不得 N/A；12 页必须来自同一全新 V3-4 run。V3-2/V3-3 seal 只作 qualification binding，不能提供正文，也不能与旧 private artifact 拼接。受限页必须保留为 `blocked`，不得伪造大纲；低信号页必须保留为 `degraded`，不得从分母删除。

## 2. 状态恢复操作步骤

1. 为当前页面创建 task，记录 taskId/revision。
2. 在 acquisition、transcription、vision、synthesis 和 transaction commit 临界点分别终止 Runtime。
3. 使用同一数据库和 artifact root 重启。
4. 读取 task、events、outbox、outline/projections。
5. 对账 revision、唯一终态、重复数、未决 side effect 和 artifact hash。
6. UI 路由重新打开时必须从 API 返回同一权威值。

## 3. 三视图一致性

- Outline 是唯一语义权威。
- Timeline 不得出现 Outline 中不存在的 section、时间或事实。
- Mindmap 不得调用模型二次总结；根/节点只映射 Outline。
- 任一 evidenceId 必须属于 `evidenceCatalog` 且 taskId 相同。
- `TransactionReceipt` 必须机器声明 unresolved evidence=0、cross-task evidence=0、全部 projection evidence closure=true；任一字段缺失或非零均不得发布。
- 三视图显示文本可以做纯呈现转义，但 canonical content 不得被 renderer 改写。
- Outline 生成采用本地确定性抽取，相同 evidence canonical bytes 必须生成相同 outline bytes/hash；不得新增云端 transcript/OCR 文本上传。

## 4. 数据库与隐私

- public evidence 不包含 SQLite 数据库、WAL/SHM、绝对路径、Provider credential、Cookie 或原始私有帧。
- private DB snapshot 只用于隔离审计，manifest 记录 hash 和文件模式。
- task 删除/导出清理由 V3-5 最终冻结；本阶段不得声称 Durable Forget 或 V4 知识删除已实现。

## 5. PRD 检视与出门

每个子阶段检查没有提前承诺 Ask、seek、完整 UI、知识导入或 V4。V401..V418 全部 PASS、12 页单 run（10 ready + 1 degraded + 1 blocked）、独立审查 Fatal=0/Major=0 后，V3-4 才可取得限定 PASS并进入 V3-5 详细实施前规划。人工内容验收仍只在 V3-5。
