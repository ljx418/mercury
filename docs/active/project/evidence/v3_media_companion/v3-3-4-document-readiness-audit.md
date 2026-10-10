# V3-3 / V3-4 实施级文档内部准备度审计

日期：2026-10-06。范围：V3-3 画面证据与 V3-4 TaskStore/Outline 文档、机器合同、fixture 和合同测试。未运行产品 OCR、VLM、SQLite migration 或真实 12 页任务。

## 0. 决定

`DOCUMENT PACKAGE READY FOR EXTERNAL AUDIT / IMPLEMENTATION NO-GO`。

文档自身：Fatal=0，Major=0，Minor=2。

继承实施阻塞：V3-3 Major=3；V3-4 Major=2。继承项不会因文档质量通过而关闭。

## 1. 审计输入

- PRD §18.2、§18.4、§18.9。
- 架构 §22、V3 总开发/验收计划和 stage gate。
- V3-3 development/acceptance/threat/preimplementation 四件套。
- V3-4 development/acceptance/threat/preimplementation 四件套。
- `v3_media_vision_evidence_v1.schema.json`。
- `v3_media_outline_taskstore_v1.schema.json`。
- `v3-media-vision-outline-positive.json`。
- `test_v3_media_pipeline_contracts.py`。

## 2. 一致性结果

| 检查 | 结果 |
|---|---|
| V3-3 `-0..-7` 子阶段 | 8/8，连续，无缺号 |
| V3-3 A01..A16 | 16/16，连续，无 N/A |
| V3-4 `-0..-7` 子阶段 | 8/8，连续，无缺号 |
| V3-4 V401..V418 | 18/18，连续，无 N/A |
| Vision Schema Draft 2020-12 meta | PASS |
| Outline/TaskStore Schema Draft 2020-12 meta | PASS |
| Positive fixture 双实例 | PASS |
| 定向合同/负例 | 24 passed |
| Runtime 全量回归 | 376 passed in 43.89s |
| `git diff --check` | PASS |
| 人工验收边界 | H01..H10 仍只在 V3-5 |
| V4 边界 | `knowledgeImportStatus=deferred_to_v4` 为 const |

全量回归第一次从错误 import root 调用导致 35 个 collection `ModuleNotFoundError`；使用仓库要求的 `PYTHONPATH=.`、工作目录 `services/local-runtime` 重跑后为 376 passed。该调用错误不计产品失败，也未被删除或改写成首次成功。

## 3. 架构风险闭环

### V3-3

- 数据流固定为 task media -> local frame extraction -> local OCR -> governed selected-frame VLM -> typed evidence。
- 24/12/8 和 1280 px 是 Schema 常量；raw video upload 固定 false。
- consent、outbound barrier、provider/model/hash/usage、终态 cleanup 都进入机器合同。
- OCR/VLM/transcript 不可互相冒充；无视觉 evidence 的视觉结论被列为 Major。

### V3-4

- 复用本地 SQLite，不引入第二数据库服务。
- aggregate、event、outbox 和 outline publish 同事务；expectedRevision CAS 防旧写覆盖。
- Timeline/Mindmap 是 `VideoOutline` 的纯投影，不二次调用模型造事实。
- direct/reload/Back/reopen 从 Runtime store 重读；V4 知识导入硬编码 deferred。

## 4. 继承实施阻塞

1. V3-2 尚未通过，V3-3 无合法 sealed 输入。
2. VLM provider/model/credential/capability probe 未冻结。
3. RapidOCR engine/model/license/hash/offline probe 未冻结。
4. V3-4 必须等待 V3-3 真实 evidence PASS。
5. V3-4 外部文档审查尚未完成；其合成 Provider 若使用云端还需独立授权。

## 5. Minor

- M-1：V3-3 的 10 个应成功视觉样本只能从未来 V3-2 sealed registry 派生，当前文档只冻结选择规则，未冻结具体 URL 清单。
- M-2：V3-4 Outline 合成 Provider 尚未选择；文档已规定其冻结点和授权边界，但外审应确认不能以 fixture 代替。

## 6. 防假绿审计

以下均不能升级为实现通过：24 个合同测试、376 个历史/回归测试、Schema-valid fixture、静态原型、BiliNote 结果、既有网页 Mindmap、V2 Store。只有按各阶段真实分母生成的单 run 证据和独立实施审查才可改变阶段状态。

## 7. 外审要求

外部 reviewer 应重点判断：

1. 24/12/8 预算是否足够具体且不会偷偷缩小 PRD 10/8 页面分母。
2. consent/revoke/outbound barrier 是否能阻止授权前和撤销后上传。
3. Vision Schema 是否仍允许 transcript/OCR 冒充 vision evidence。
4. SQLite 事务/恢复设计是否会重复 Provider side effect 或覆盖新 revision。
5. Timeline/Mindmap 是否真正只从一个 outline 派生。
6. Major/Minor 是否诚实，是否存在用合同通过提前放行实现的假绿。

外审 Fatal=0/Major=0 只能确认文档方向；实施仍受前序、Provider、授权和用户批准约束。
