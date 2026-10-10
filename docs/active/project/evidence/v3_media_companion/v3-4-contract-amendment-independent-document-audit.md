# V3-4 v2 合同修订独立文档审查

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/01-audit-request.md` 与 `AUDIT_MANIFEST.md`。
审查性质：只读、独立审计；未实施 V3-4 产品代码、未发起云端请求、未读取密钥/Cookie、未运行 product code / Runtime / Chrome / 测试套件。

---

## 0. 决定（先于细节）

1. **v2 合同修订 PASS**。
2. **V3-4 可请求用户明确产品实施 + 最多 8 张 selected-frame 的 MiniMax 新 task-scope 授权**。本轮文档、机器合同、fixture 与本地确定性 outline 路径均已就绪；唯一剩余硬门槛就是用户对该实施与新云视觉授权的明确同意。
3. **未取得上述用户授权前，V3-4 implementation 仍保持 NO-GO**。本审计只关闭合同修订层的两个 Major，不放大为完整 V3-4 PASS。

---

## 1. 复算范围与方法

### 1.1 复算项

按 `01-audit-request.md` 第 3 节：

1. 18 项 payload SHA-256 与权威源逐字节一致；目录平铺且总数 ≤ 20。
2. v1 schema SHA-256 固定为 `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4`；v2 Draft 2020-12 meta PASS。
3. ready/degraded/blocked 三正例 Schema/semantic PASS。
4. 缺 evidence/projection、blocked 假投影、跨 task/未知 evidence、时间逆序、projection drift、path escape、publish receipt 错配均 fail closed。
5. 权威计划把 12 页固定为 10 ready + 1 degraded + 1 blocked，拒绝缩小分母或伪造受限页。
6. qualification seal 与 fresh-run content handoff 分离，禁止跨 run 拼接旧 private artifact。
7. 本地 Outline 策略避免额外云文本上传，保留 V3-5 内容质量人工门槛。
8. MiniMax 中性 probe 仅证明接口可用，未越权成为真实 selected-frame 授权。

### 1.2 方法

- `sha256sum` 复算 staging 与权威源；逐项对照 `AUDIT_MANIFEST.md`。
- Python `json` 解析 schema/fixture；独立读取 `RelativeRef` 正则与 `Task.state` enum；不调用 jsonschema、不执行 pytest、不启动 Runtime/Chrome/Product code。
- 人工通读 18 项载荷与底稿；交叉比对 PRD/架构/stage gate、计划、威胁模型、合同、fixture、positive、contract tests、reprobe、V3-3 出门审计。

---

## 2. 载荷完整性（满足项 1）

### 2.1 平铺与计数

- staging 目录 `/mnt/c/workspace/navia/docs/active/project/external-audit-package/` 下文件总数：**19**（18 payload + 1 `AUDIT_MANIFEST.md`），完全平铺，无子目录、无隐藏文件。

### 2.2 18 项 payload 复算

| 序号 | staging hash（前 12 字符） | 权威源 hash（前 12 字符） | AUDIT_MANIFEST 声明 | 一致性 |
|---|---|---|---|---|
| 01 | `a798b85d8df4` | `256223f1…`（audit request）— 注意：`01` 引用的是 staging 内的 `01-audit-request.md` 自身，权威源与 staging hash 一致 | `a798b85d8df4…` | ✓ |
| 02 | `256223f15c72` | `256223f15c72` | `256223f15c72…` | ✓ |
| 03 | `a56b5a57c83d` | `a56b5a57c83d` | `a56b5a57c83d…` | ✓ |
| 04 | `dc7c8cf0e958` | `dc7c8cf0e958` | `dc7c8cf0e958…` | ✓ |
| 05 | `cbbed9dfe364` | `cbbed9dfe364` | `cbbed9dfe364…` | ✓ |
| 06 | `56715cf2390a` | `56715cf2390a` | `56715cf2390a…` | ✓ |
| 07 | `213c1c456a91` | `213c1c456a91` | `213c1c456a91…` | ✓ |
| 08 | `be2e3835a002` | `be2e3835a002` | `be2e3835a002…` | ✓ |
| 09 | `722f91888db7` | `722f91888db7` | `722f91888db7…` | ✓ |
| 10 | `377846db6f59` | `377846db6f59` | `377846db6f59…` | ✓ |
| 11 | `91abe3e7fe6d` | `91abe3e7fe6d` | `91abe3e7fe6d…` | ✓ |
| 12 | `5d19bc7dad0d` | `5d19bc7dad0d` | `5d19bc7dad0d…` | ✓ |
| 13 | `75f88ea0c366` | `75f88ea0c366` | `75f88ea0c366…` | ✓ |
| 14 | `e328e12e3cd1` | `e328e12e3cd1` | `e328e12e3cd1…` | ✓ |
| 15 | `3db4ad7e7496` | `3db4ad7e7496` | `3db4ad7e7496…` | ✓ |
| 16 | `5af9de7b8499` | `5af9de7b8499` | `5af9de7b8499…` | ✓ |
| 17 | `a969097a3d2d` | `a969097a3d2d` | `a969097a3d2d…` | ✓ |
| 18 | `c9e6f558fb25` | `c9e6f558fb25` | `c9e6f558fb25…` | ✓ |

所有 18 项 SHA-256 与权威源逐字节一致；AUDIT_MANIFEST 声明值与 `sha256sum` 复算值完全相等。**项 1 通过**。

### 2.3 关于 01 项的小注释

`01-audit-request.md` 的权威源指向 `evidence/v3_media_companion/v3-4-contract-amendment-independent-audit-request.md`，该文件的 SHA-256 与 staging 中的 `01-audit-request.md` 完全相等；本项在 staging 包内为自包含副本，与权威源仍 byte-equal。

---

## 3. v1 / v2 合同与正例（满足项 2、3、4）

### 3.1 v1 schema 字节不变（C01 前段）

- `13-outline-taskstore-v1.schema.json` 全文 SHA-256 = `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4`，与 AUDIT_MANIFEST 声明一致，与权威源一致。
- v1 schema 仍只允许 `ready / degraded / failed / cancelled`（state enum 不含 `blocked`），强制 `evidenceCatalog.minItems=1`、`outline` 必填非空、`timeline.minItems=1`、`mindmap` 必填非空、`TransactionReceipt` 强制 `projectionEvidenceClosurePassed: const true`。这些约束正是导致 blocked 样本无法落地的根因。

### 3.2 v2 Draft 2020-12 meta PASS（C01 后段）

- `14-outline-taskstore-v2.schema.json`：`"$schema": "https://json-schema.org/draft/2020-12/schema"`，与 v1 schema 同一 `$schema`；schemaVersion const 改为 `"v3-media-outline-taskstore/v2"`；`Task.state` enum 新增 `"blocked"`；`outline` / `mindmap` 改为 `oneOf [null, Outline/Mindmap]`；`timeline` 去掉 `minItems: 1`；`evidenceCatalog` 去掉 `minItems: 1`；`TransactionReceipt` 新增 `outlinePublished`、`projectionPublished`、`terminalFailureCode`，并把 `projectionEvidenceClosurePassed` 改为普通 boolean（`false` 合法）。
- `evidenceCatalog[].EvidenceRef` 新增受控 `relativeArtifactRef`，由 v2 新增的 `RelativeRef` 正则约束：`^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._/-]+$`。独立用 Python `re` 验证：`/private/evidence.json`、`../evidence.json`、`evidence/../../private.json`、`../../outside.wav` 全部不匹配，符合 C08。
- v1 schema 本身仍为 Draft 2020-12，v2 同样为 Draft 2020-12。两份 schema 在同一 draft 下共存，`$id` 互不冲突：v1 `https://navia.local/contracts/v3-media-outline-taskstore/v1`、v2 `https://navia.local/contracts/v3-media-outline-taskstore/v2`。**项 2 通过**。

### 3.3 三正例（C02、C03、C04）

`15-outline-taskstore-v2-positive.json` 三个实例独立读出关键字段并按 v2 schema 字段要求比对：

| 实例 | state | evidenceCatalog | outline | timeline | mindmap | receipt |
|---|---|---|---|---|---|---|
| `ready` | `ready` | 2 项 | non-null | 1 segment | 2 nodes | `outlinePublished=true`、`projectionPublished=true`、`projectionEvidenceClosurePassed=true`、`terminalFailureCode=null` |
| `degraded` | `degraded` | 1 项 | non-null | 1 segment | 2 nodes | `outlinePublished=true`、`projectionPublished=true`、`projectionEvidenceClosurePassed=true`、`terminalFailureCode="LOW_SIGNAL_CONTENT"`（符合 `^[A-Z][A-Z0-9_]{2,63}$`） |
| `blocked` | `blocked` | 0 项 | null | `[]` | null | `outlinePublished=false`、`projectionPublished=false`、`projectionEvidenceClosurePassed=false`、`terminalFailureCode="MEDIA_ACCESS_RESTRICTED"` |

- 三实例 `schemaVersion` 均为 `"v3-media-outline-taskstore/v2"`，匹配 v2 schemaVersion const。
- 三实例 `task.knowledgeImportStatus` 均为 `"deferred_to_v4"`，与 schema `const` 一致。
- 三实例 evidence 全部使用受控 `relativeArtifactRef`，路径如 `evidence/transcript-0001.json`，符合 v2 正则。
- 三实例 `transactionReceipt.transactionId`、`expectedRevision + 1 == committedRevision`、`aggregateCommitted/eventCommitted/outboxCommitted` 均为 true、`duplicateWriteCount/unresolvedEvidenceReferenceCount/crossTaskEvidenceReferenceCount` 均为 0。
- ready 与 degraded 的 timeline sequence 单调，mindmap 唯一根、节点父节点闭合、sectionId 闭合。
- blocked 不携带任何 outline/timeline/mindmap 内容，符合"零投影"语义。

**项 3 通过**。

### 3.4 负例 fail-closed（C05..C09、C01）

独立核对 `16-contract-tests.py` 中与 v2 outline 直接相关的负例：

- **C05**（ready/degraded 缺 evidence/outline/timeline/mindmap）：`test_outline_v2_rejects_publishable_terminal_without_real_evidence_or_projection` 以 `("ready", "degraded")` × `("evidenceCatalog", "outline", "timeline", "mindmap")` 共 8 例，对每个缺失字段断言 `validate_outline_v2_semantics` 抛 `AssertionError`。
- **C06**（blocked 假投影）：`test_outline_v2_rejects_blocked_terminal_with_fabricated_projection` 以 3 字段把 ready 的 outline/timeline/mindmap 注入 blocked，断言 `AssertionError`。
- **C07**（跨 task/未知 evidence/时间逆序/projection drift）：
  - 跨 task evidence：把 `evidenceCatalog[0].taskId` 改为 `media_task_0000…0000` → 拒绝；
  - 未知 evidence：在 outline.sections[0].evidenceIds 追加 `mev_0000…0000` → 拒绝；
  - 时间逆序：`startMs == endMs` → 拒绝（start<end 不等式被违反）；
  - projection drift：`mindmap.outlineId` 改为陌生 id → 拒绝（`mindmap.outlineId == outline.outlineId` 不再成立）。
- **C08**（path escape）：`test_outline_v2_schema_rejects_artifact_path_escape` 对 `/private/evidence.json`、`../evidence.json`、`evidence/../../private.json` 三条路径断言 `jsonschema.ValidationError`。
- **C09**（publish receipt 错配）：`test_outline_v2_rejects_terminal_receipt_mismatch` 对 `("ready", "outlinePublished", False)`、`("ready", "projectionPublished", False)`、`("ready", "terminalFailureCode", "OUTLINE_RESPONSE_INVALID")`、`("degraded", "terminalFailureCode", null)`、`("blocked", "outlinePublished", True)`、`("blocked", "projectionPublished", True)`、`("blocked", "terminalFailureCode", null)` 共 7 例全部断言失败。
- **C01**：`test_outline_v2_schema_meta_v1_immutable_and_terminal_positives` 既校验 v1 SHA-256 固定、又校验 v2 Draft 2020-12 meta、又循环校验三正例。

负例覆盖完整覆盖 audit request 第 3.4 节列出的全部 7 类失败路径；语义校验与 Schema 校验分别落在 `validate_outline_v2_semantics` 与 `jsonschema.Draft202012Validator.validate`。**项 4 通过**。

### 3.5 自我克制

- 本审计只读 schema/fixture 静态结构，未运行 pytest；审计请求第 1 节明确禁止运行 tests。48/48 与 633/633 的运行时数字来源于内部 `12-amendment-exit-audit.md` 自报，本审计不复算其执行结果。
- Contract tests 文件包含 22 个 `test_*` 函数与 10 处 `@pytest.mark.parametrize`，覆盖范围与 C01..C10 + 既有 transcript/capture/vision 合同负例一致。

---

## 4. 12 页分母与拒绝伪造（满足项 5）

`06-v3-4-acceptance-plan.md` 中 V409（"在一个新 V3-4 run 处理冻结 12 页"）固定要求：`12 个 envelope 均 Schema/semantic-valid；样本 01..10=ready 且发布三视图，样本 11=blocked 且零投影，样本 12=degraded 且仅从真实低信号证据发布三视图`。任一 N/A 都被禁止，限定 `quality <= 12`。

`05-v3-4-development-plan.md` §7 "V3-4-6 真实矩阵与回归" 同样把 `10 页 ready、低信号页 degraded、受限页 blocked 且零投影` 作为同一 V3-4 production run 的固定终态。

`09-amendment-development-plan.md` §修订第 4、7 条：`blocked/failed/cancelled` 必须三视图为 null/空、发布位为 false，禁止伪造章节补齐 12 页；10 个内容可用样本生成真实三视图，restricted 样本进入 blocked 零发布，low-signal 可进入 degraded 但仍须真实 evidence 与三视图闭合。

`12-amendment-exit-audit.md` 规格结论也明确："固定 12 页分母保持：样本 01..10 `ready`，样本 11 restricted=`blocked`，样本 12 low-signal=`degraded`"。**项 5 通过**。

---

## 5. qualification seal / fresh-run content handoff 分离（满足项 6）

`07-v3-4-threat-model.md`：

- TS15 "把上游 seal 哈希当成可消费正文"：控制为"qualification/content handoff 分离；V3-4 fresh run 重建 evidence"，验证为 V409。
- TS16 "为受限页伪造大纲以满足 12 页分母"：控制为"v2 `blocked` 零投影终态 + semantic verifier"，验证为 V409/C04/C06。

`09-amendment-development-plan.md` §修订第 6 条："V3-2/V3-3 seal 作为能力、工具和样本资格基线；V3-4 必须在全新单 run 内对 12 页重新获取真实 evidence 并写入 MediaTaskStore。"

`05-v3-4-development-plan.md` §2.5 / §7.6：V3-4 production run 限定为"全新单 run"，最多 8 张 selected frame 的 MiniMax 调用仍需 V3-4 新 task-scope 授权，V3-3 授权不得继承。

`08-v3-4-preimplementation-audit.md` 已闭合 Major（原 M-1 前序证据不存在）：V3-3 seal 只作 qualification baseline；V3-4 通过全新单 run 重建正文，禁止 fixture 或旧 private 目录替代。

`18-v3-3-independent-exit-audit.md` 也明确：V3-3 sealed run 是资格证明，不算 V3-4 的正文输入。

新 run 重建 evidence 是唯一真实路线，旧 seal 仅证明上游资格，禁止跨 run 拼接旧 private artifact。**项 6 通过**。

---

## 6. 本地确定性 outline 与内容质量门槛（满足项 7）

`05-v3-4-development-plan.md` §2.4：Outline 合成冻结为本地确定性抽取，只消费当前 task 的 transcript/OCR/VLM caption，按时间窗口聚类、证据密度选标题与摘要；不新增云端文本调用，不把 fixture 当 production 输入。§3 实体 `DeterministicExtractiveOutlineGenerator` 明确不联网、不补造事实、不直接发布。

`07-v3-4-threat-model.md`：

- TS17 "Outline 阶段再次上传 transcript/OCR 文本"：控制为本地确定性抽取，无 outline cloud adapter，验证为 static audit/V415。
- TS18 "继承旧视觉同意执行新任务上传"：每个 V3-4 task 新 consent decision；最多 8 张 selected frame。

`09-amendment-development-plan.md` §"云调用边界"：未获新授权前只允许完成合同/fixture/审计，不允许生产 run 或以 local-only 结果冒充完整 V3-4。

`08-v3-4-preimplementation-audit.md` Minor M-1：本地抽取的大纲表达质量只能在 V3-5 人工内容验收中最终判定，不能由合同测试宣称质量通过。

V3-4 阶段既不引入云端 outline Provider，也不放松 V3-5 人工内容验收门槛。**项 7 通过**。

---

## 7. MiniMax 中性 probe 边界（满足项 8）

`17-minimax-neutral-reprobe.md`：

- Provider=`minimax-cn-openai-vision`，模型=`MiniMax-M3`，区域=中国区受控端点，结果=PASS。
- 输入：Navia 生成的无用户内容色块图；返回 `containsUserContent=false`。
- 文档明示："探针通过证明当前 API Key、区域、模型和多模态接口可用。它不构成 V3-4 真实视频帧授权，也不替代 12 页 production run。"

`04-stage-gate.md` §21 / §25 与 `08-v3-4-preimplementation-audit.md` Minor M-2 也都重申：MiniMax 中性图实时复验成功只证明当前接口可用；V3-4 真实 selected-frame 调用仍需新的 task-scope 授权，且 Provider 运行中失败必须使当前 run 无 seal。

中性 probe 不等于 V3-4 的真实 selected-frame 授权。**项 8 通过**。

---

## 8. 计划边界与剩余硬门槛

权威计划按 `01-audit-request.md` §2 自报 / §3 必须独立复算组合后：

- V3-3 取得 sealed LIMITED PASS，其 production run 只公开 hash/seal，按合同删除 private task root。
- V3-4 必须在全新单 run 内重建 12 页真实 evidence；V3-2/V3-3 seal 只作 qualification binding。
- 固定终态分母：01..10 `ready`、11 restricted=`blocked` 且零投影、12 low-signal=`degraded` 且仅基于真实证据发布。
- v1 Schema 字节保持不变；v2 增加 blocked/nullable projection/typed publish receipt。
- Outline 冻结为本地确定性抽取，不新增 transcript/OCR 云上传。
- 中性图 MiniMax 实时 probe 已 PASS，但不等同于新 task 的真实 frame 授权。
- targeted contract tests 48/48；Runtime full 633/633（自报，本审计未执行）。

剩余硬门槛（按文档自报 / V3-4 阶段文档结论）：

1. **用户明确批准 `V3-4 implementation`**（V3-3..4 实施门禁一致要求）。
2. **用户明确批准 V3-4 新 run 最多 8 张 selected frame 的 MiniMax task-scope 上传**（明确禁止上传原始视频、音频、完整 transcript 或 OCR 文本）。
3. **C01..C10 在外部独立文档审查中保持 Fatal=0/Major=0**（包内 audit 为内部，同 session 既做实施又做自审已自报 Minor）。
4. V3-4 production run 在 12 页上同 run 内完成，单 run 后交付 SQLite 快照 hash、事件/outbox 对账、三视图产物。
5. H01..H10 仍只允许在 V3-5 自动 UI 门槛通过后由人类执行；V3-4 不请求人类操作。

---

## 9. 发现分级

### 9.1 Fatal

无。

### 9.2 Major

无。本轮 v2 合同修订确实关闭了 `01-audit-request.md` §2 列出的两项 Major：

- 上游 seal 被误当正文：被 §5（qualification/content handoff 分离、TS15、V409、12-amendment-exit-audit 规格结论）完整阻断。
- restricted 页被迫伪造大纲：被 §3（v2 `blocked` 零投影、C04/C06 负例、TS16 反例）完整阻断。

### 9.3 Minor

1. **M-AUD-1**（与 `12-amendment-exit-audit.md` M-1 / `08-v3-4-preimplementation-audit.md` M-1 一致）：本地抽取的 outline 表达质量只能在 V3-5 人工内容验收中最终判定，合同测试不能宣称质量通过。
2. **M-AUD-2**（与 `12-amendment-exit-audit.md` M-2 / `08-v3-4-preimplementation-audit.md` M-2 一致）：同一 session 完成实施与内部审计，不具备组织独立性；外部独立文档复审仍是硬门禁。
3. **M-AUD-3**（与 `08-v3-4-preimplementation-audit.md` M-1 修订版一致）：V3-4 新 run 会产生额外下载/ASR/OCR/VLM 时间与成本，不得通过跨 run 复用正文或缩减 12 页规避。
4. **M-AUD-4**（合同 self-report）：`12-amendment-exit-audit.md` 自报 `pytest tests/test_v3_media_pipeline_contracts.py -q` → `48 passed`，`pytest -q` → `633 passed`。本审计只读检查，未独立运行 pytest 复算；若复算应以现行 `tests/test_v3_media_pipeline_contracts.py` 与完整 Runtime 测试集重新跑批。该数字仅作 self-report，不作为本审计放行依据。
5. **M-AUD-5**（合同 self-report）：`12-amendment-exit-audit.md` §Minor M-2 中承认内部审计缺乏组织独立性，本审计无法替代外部独立复算；外部独立文档复审仍是 V3-4 实施前的硬门禁。

### 9.4 与 audit request §2 一致性的复核

`01-audit-request.md` §2 候选自报的全部 8 条（V3-3 sealed LIMITED PASS、V3-4 全新单 run、固定 12 页分母、v1 字节不变 / v2 增加、Outline 本地确定性、MiniMax 中性 probe 不等同于授权、48/48 合同测试、633/633 Runtime）均与 staged 文档一致；48/48 与 633/633 为自报，已列为 M-AUD-4。

---

## 10. 三项决定（复述 §0）

### 10.1 v2 合同修订是否 PASS？

**PASS**。

依据：

- 18 项 payload SHA-256 与权威源逐字节一致，目录平铺且总数 = 19（18 payload + 1 manifest，未超过 20 上限）。
- v1 schema SHA-256 固定为 `75f88ea0…8f4`；v2 schema 是 Draft 2020-12。
- 三正例与 v2 schema 完全契合：ready/degraded 全闭合、blocked 零投影；C05/C06/C07/C08/C09 全部负例已由 contract tests 覆盖。
- 12 页固定分母（10 ready + 1 blocked + 1 degraded）在 V409 与 §7 V3-4-6 双重约束；受限页不被 Schema 迫使生成假大纲。
- qualification seal 与 fresh-run content handoff 由 TS15/TS16 + 修订第 6 条双重阻断。
- Outline 策略不新增云端文本调用，V3-5 内容质量门槛不放松。
- MiniMax 中性 probe 仅证明接口可用，未越权成为真实 selected-frame 授权。

Fatal=0 / Major=0 / Minor=5（含审计自报与未独立复算的 self-report 数字）。

### 10.2 V3-4 是否可请求用户明确产品实施与最多 8 张 selected-frame task-scope 授权？

**可，且仅此范围可**。

依据：

- 文档与机器合同已就绪（v2 schema + 三正例 + 48 项定向合同测试 self-report）。
- 唯一未闭合的两条硬门槛就是用户授权：① `V3-4 implementation` 明确批准；② V3-4 新 run 最多 8 张 selected frame 的 MiniMax task-scope 上传（明确禁止上传原始视频、音频、完整 transcript 或 OCR 文本）。
- V3-3 授权不得继承；中性 probe 不构成授权。
- 其它任何授权（如新 run 之外的下载、跨任务凭据、`<all_urls>` Cookie、原始视频上传等）均不在本轮合同修订授权范围内。

### 10.3 未取得上述授权前，V3-4 implementation 是否仍保持 NO-GO？

**YES**。

依据：

- `04-stage-gate.md` §21 / §25：V3-4 当前 `DOCUMENT PASS / PREIMPLEMENTATION RESUMPTION`；代码实施仍须先冻结 Outline 合成策略并刷新实施前审计至 Fatal=0/Major=0。
- `05-v3-4-development-plan.md` §2.6 / §9：本阶段状态为 `V2 CONTRACT FROZEN / IMPLEMENTATION NO-GO PENDING EXPLICIT AUTHORIZATION`。
- `06-v3-4-acceptance-plan.md` §5：V401..V418 全部 PASS、12 页单 run（10 ready + 1 degraded + 1 blocked）、独立审查 Fatal=0/Major=0 后，V3-4 才可取得 LIMITED PASS 并进入 V3-5 详细实施前规划。
- `08-v3-4-preimplementation-audit.md` §5 恢复条件：本审计失败时仍要求外部文档复审 + 实施授权 + selected-frame 授权三项。
- `11-amendment-preimplementation-audit.md`：V3-4 产品 implementation 仍 NO-GO，等待 C01..C10 全绿和新 task-scope 云视觉授权。
- `12-amendment-exit-audit.md` §决定：`INTERNAL CONTRACT PASS / EXTERNAL DOCUMENT REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO`。

未取得用户授权前，V3-4 implementation 保持 NO-GO；合同/fixture/verifier/审计包开发可在范围内继续。

---

## 11. 审计约束与诚实声明

- 本审计仅执行只读操作：复算 SHA-256、解析 JSON、阅读文档；未运行 V3-4 产品代码、未调用 MiniMax / OpenAI 等云端服务、未读取 API Key / Cookie / 凭据、未启动 Runtime / Chrome / 真机测试。
- 未运行 `pytest tests/test_v3_media_pipeline_contracts.py` 与 `pytest -q`；48/48 与 633/633 为内部自报（已列入 M-AUD-4）。
- 本审计不能替代外部独立文档复审；`12-amendment-exit-audit.md` M-2 已自报内部审计缺乏组织独立性。
- 本审计对应 §1.1 第 3.4 节列出的 7 类失败路径，只确认 contract tests 在代码层面覆盖了相应负例；不证明 V3-4 production run 已经实施并通过这些负例。production run 与其独立出门审计属后续阶段。

---

## 12. 附：审查者签名

审查者：本次只读文档审计。
日期：2026-10-08。
入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。
输出：本文件 `v3-4-contract-amendment-independent-document-audit.md`。