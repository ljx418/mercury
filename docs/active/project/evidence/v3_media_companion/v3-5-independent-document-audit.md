# V3-5 产品集成文档独立审查报告

- 日期：2026-10-08
- 审查者角色：独立只读文档 reviewer（与候选实现/前序审查不同 session；本轮仅阅读 `docs/active/project/external-audit-package/`，未运行产品代码、未访问 Cookie/API Key/原始媒体、未访问 `private-runs/`、未修改任何载荷/权威源/schema/Seal/用户凭据）
- 入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` → `01-audit-request.md`
- 决策问题（来自 `01-audit-request.md` §"决策问题"）：V3-5 文档候选是否达到 `CONDITIONAL GO FOR EXPLICIT USER IMPLEMENTATION AUTHORIZATION`。本轮仅审文档、合同和测试设计，不运行 V3-5 产品代码，不签署 H01..H10。

---

## 1. 审计包结构与权威源对账

### 1.1 平铺结构与总文件数

`docs/active/project/external-audit-package/` 仅含 18 项载荷 + 1 manifest = 19 个平铺文件，0 子目录，0 额外载荷（已用 `find -type d` 确认无子目录，`ls -la` 列出 19 项）。满足 manifest §"日期" 行的约束「总文件数小于 20」与「18 项载荷 + 本 manifest = 19 个平铺文件；无子目录」。

### 1.2 18 项载荷 SHA-256 重算

独立 `sha256sum` 计算结果与 manifest 表逐字节匹配（manifest 行序与文件一一对应；AUDIT_MANIFEST.md 自身不在 manifest 表中，是符合预期的）：

| # | 文件 | 独立重算 SHA-256 | 匹配 manifest |
|---|---|---|---|
| 01 | `01-audit-request.md` | `19e71cc1025594abe9f5885060084d927de1db6298a56846fb1e9131284180c5` | ✓ |
| 02 | `02-prd.md` | `256223f15c72aefdcf39e601dd5e98fd0f9aaf3c4369293d50f2334d245bdb3f` | ✓ |
| 03 | `03-architecture.md` | `a56b5a57c83d05d970c44cb349f4554777f65f8b6c8a2d8bd61f4f29edb7db9a` | ✓ |
| 04 | `04-stage-gate.md` | `6e27b73fafe09c9c26797d42435819304a6e321b231dbeb0faeaba8471108f26` | ✓ |
| 05 | `05-v3-5-development-plan.md` | `b4330c12becc58f31f66ac47d8fa368c06eda1287941b929b2788d32dca9ba87` | ✓ |
| 06 | `06-v3-5-acceptance-plan.md` | `528daa3acb13032ab6b35d88f32ebd14d17c239a468078140704e413662078e6` | ✓ |
| 07 | `07-v3-5-threat-model.md` | `cc3b03e8430f3a9aeaad1491101b4f70f15398b3f16cab4829640aa8fe25ec03` | ✓ |
| 08 | `08-v3-5-preimplementation-audit.md` | `6111a43a03354877b2040ea121442fd18eafd4b2fe1b673c817f2417f885ff02` | ✓ |
| 09 | `09-v3-5-internal-document-audit.md` | `f55b7f06199c6204c6520a0f406f677e291695d3bdfa71a738dce1b84a96f762` | ✓ |
| 10 | `10-product-acceptance-v1.schema.json` | `0b62165c8b9257218ac6f21ac826e8bc1259ddb0d92510184583b4d08dbee65f` | ✓ |
| 11 | `11-product-acceptance-v2.schema.json` | `e2bb0fc2a58905933a18a49e0014e56f480b2522b4164f8d620813ee68d23818` | ✓ |
| 12 | `12-human-review-v1.schema.json` | `f880b637a9ab217658ae771567c85574ebd50bc2ebc69be236e7aee03bdcba8a` | ✓ |
| 13 | `13-product-human-positive-fixture.json` | `fd4b5ab833e62f4bf68534defd2ddeeea810b3dad06c37f11dfd38e94bacaee4` | ✓ |
| 14 | `14-product-contract-tests.py` | `0a0985ee0b4c53e8f847193bb14b6b6784a5a52f546db499284c79682f762afe` | ✓ |
| 15 | `15-v3-4-independent-exit-audit.md` | `faa268acb9f00d4e5e227f1e591e5836f3601a02c262ca95e675c77c437b81c0` | ✓ |
| 16 | `16-v3-4-route-drift-closure.md` | `6f9b3f93692dee39f670582cf83568dca33c6e738ff6a51f663e48670605ec70` | ✓ |
| 17 | `17-v3-gap.drawio` | `98bca521d341c652a63ace085ea6a537d3cfaf8a91bf184d310672fc3c9abc15` | ✓ |
| 18 | `18-v3-5-document-verifier.py` | `db9c3688cf319767320ddb1919e94d0183582f9df363b581f36e44999272e7b4` | ✓ |

无 mismatch、无缺失载荷、无额外载荷、无子目录 → 审计包完整性 PASS。

### 1.3 权威源对账

对每项载荷与 manifest 所列权威源路径做 `sha256sum` 字节级比对（18/18 完全一致）。无 mismatch，无中间层；所有载荷均与仓库权威源同字节，证明包内载荷未被独立修改或伪造。

---

## 2. PRD / 架构 / Stage Gate 边界审查

### 2.1 上位边界维持

`02-prd.md`（与权威 `docs/active/project/01-prd.md` 同字节）：

- 第 3 行「V3 当前一级产品域收敛为 Chat + Know、Settings 为辅助入口、Agent 整体移入 V5+ 远期规划」与 §18「V3 Media Companion 规划目标」第 2149–2216 行：明确 V3 仅面向 B站优先、12 页固定分母、首版限定本地 ASR / 本地 OCR / 授权云端 VLM；其余门户、直播、通用文件、云端 ASR、跨视频 RAG 均明确进入后续阶段或 No-Go。
- §18.4「2026-09-17 V3-2 受控媒体获取与本地 ASR 边界」、§18.5「V3-2-0a」、§18.9「SenseVoice V3 开发基线与 V4 质量优化边界」均把跨模型比较、智能回退、Query / Graph / Durable Forget 明确划入 V4，不混进 V3-5。

`03-architecture.md`（与权威 `docs/active/project/02-architecture.md` 同字节）：

- L0 架构第 7–16 行表格明确「Agent Domain → V5+」「禁止从 UI 直接调用模型、门户私有接口或数据库」。
- 21.3 节、V3-1..4 目标架构保持 Chat/Know + Media 的单向依赖，不把 Media 通道接入 Knowledge / RKM / RAG 事实路径。

`04-stage-gate.md`（与权威 `docs/active/project/stage-gates/v3-media-companion.md` 同字节）：

- 头部状态：`V3-1.4 LIMITED PASS / SenseVoice development baseline / V3-2 LIMITED PASS / V3-3 LIMITED PASS (single-run 10 OCR + 8 VLM) / V3-4 V2 DOCUMENT PASS + EXPLICIT IMPLEMENTATION/FRAME AUTHORIZATION REQUIRED / V3-5..V3-7 BLOCKED BY PREDECESSOR`。
- §22「V3-5 / V3-6 / V3-7 实施级文档候选」明确 V3-5 当前为 `DOCUMENT PASS / IMPLEMENTATION AND HUMAN REVIEW NO-GO`。
- §21 末段「顺序门禁保持：V3-2 → V3-3 → V3-4 → V3-5。H01..H10 仍只允许在 V3-5 自动 UI 门槛通过后由人类执行」与本审计请求一致。

边界维持结论：V3-5 文档不把自身扩大为 V3 完成、知识库 / Agent 能力或跨门户完成；V2 / V4 边界保持冻结。V3-4 LIMITED PASS 是上游硬前置，V3-5 实现仍需独立用户授权，不构成 V3 通过。

### 2.2 V3-4 LIMITED PASS → V3-5 文档候选关系

`15-v3-4-independent-exit-audit.md`（同字节复算）已独立确认 V3-4 LIMITED PASS：18/18 载荷哈希、20/20 production verifier PASS、v2 schema meta、10 ready + 1 blocked + 1 degraded、selected frame 仅前 8 个、各 1 张、无 post-revoke dispatch、SQLite 12 task / 12 outbox completed / 12 idempotency / 206 evidence / 75 events、公开 run-root 只含 result/seal、V401..V418 18/18 PASS、Fatal=0/Major=0/Minor=4。V3-4 LIMITED PASS 作为 V3-5 文档候选的前置门禁仍有效。

---

## 3. 历史 schema 只读与 fresh-run 唯一绑定 v2

### 3.1 v1 Schema 只读归档

`10-product-acceptance-v1.schema.json`：

- `$id = https://navia.local/contracts/v3-media-product-acceptance/v1`
- `schemaVersion: const "v3-media-product-acceptance/v1"`
- required 字段列表不含 `taskExecution`（仅含 schemaVersion/runId/buildTreeSha256/taskBinding/surfaces/routes/askResults/seekObservations/exports/accessibility/requirements/machinePassed）
- RouteObservation 的 `mode` 枚举为 `[direct, reload, back, reopen, invalid, forbidden]`，没有 observedRoute/routeDrift/fallbackReasonCodes 等执行字段
- 本审计独立 `jsonschema.Draft202012Validator.check_schema(v1)` 通过（包内 verifier `schema_meta` 项覆盖），`jsonschema.Draft202012Validator(v1).validate(POSITIVE["productAcceptance"])` 通过（包内 verifier `historical_v1_and_human_positive` 项覆盖）
- 包内未对 v1 schema 做任何 patch（权威源对账已证 0 mismatch），满足"v1 历史合同保持只读"。

### 3.2 v2 Schema fresh-run 唯一合同

`11-product-acceptance-v2.schema.json`：

- `$id = https://navia.local/contracts/v3-media-product-acceptance/v2`
- `schemaVersion: const "v3-media-product-acceptance/v2"`
- required 增加 `taskExecution`（强约束）
- `TaskExecution.registryClass` 枚举：`[subtitle, asr, multipart, restricted, low_signal]`（与 V3-2 frozen registry 一致）
- `TaskExecution.observedRoute` 枚举：`[credentialed_subtitle, public_or_page_subtitle, credentialed_media_asr, trusted_tab_capture_asr, blocked, visual_low_signal]`
- `routeDrift: boolean`；`fallbackReasonCodes: array<string>` 满足 `[A-Z][A-Z0-9_]{2,63}` 命名约束
- `ResourceNotice.required`：`shown/localAsr/expectedWaitClass/cpuImpact/memoryMiB/temporaryDiskBytes/cancelAvailable/temporaryMediaDeleted`
- allOf 约束：observedRoute ∈ {credentialed_media_asr, trusted_tab_capture_asr} ⇒ resourceNotice.shown=true/localAsr=true/cancelAvailable=true/temporaryMediaDeleted=true；routeDrift=true ⇒ fallbackReasonCodes minItems=1；routeDrift=false ⇒ fallbackReasonCodes maxItems=0
- `RouteObservation.runtimeRead: const true` —— UI 只接受 Runtime 直读，禁止前端缓存伪造恢复（对应威胁 UI01）
- 本审计独立 `jsonschema.Draft202012Validator(v2).validate(v2_positive)` 通过；包内 verifier `v2_asr_fallback_positive` 项覆盖。

### 3.3 v1 vs v2 单向升级

- v2 schema 与 `13-product-human-positive-fixture.json` 中的 `productAcceptance.schemaVersion = "v3-media-product-acceptance/v1"`（v1 兼容示例）共存，正例 fixture 的 `humanReview` 部分字段满足 `12-human-review-v1.schema.json` 的强校验。v1 fixture 仅作为历史归档，fresh run 不会因 fixture 复用而被误判为 v1 PASS（合同在 schemaVersion const + 强 additionalProperties=false 双重保证下拒绝混淆）。
- 内部审计 `09-v3-5-internal-document-audit.md` §2「修订」明确写出"历史 v1 不修改""fresh run 只接受 v2，v1 只读归档"，与本审计一致。

### 3.4 Human review v1 schema

`12-human-review-v1.schema.json`：

- `schemaVersion: const "v3-media-human-review/v1"`
- `reviewerRole: const "independent_human_reviewer"`（拒绝 automation / script 顶替，见 `test_human_review_rejects_missing_or_automatic_judgment`）
- `judgments` 必填 10 条，requirementId 模式 `^H(?:0[1-9]|10)$`
- allOf 强制 overallDecision 与逐项判断一致：全 PASS ⇒ overall=PASS；含 BLOCKED ⇒ overall=BLOCKED；含 FAIL 但无 BLOCKED ⇒ overall=FAIL
- 不接受机器/自动代签或把未执行写 PASS（威胁 UI11 / UI13）

结论：v1 schema 保持只读；v2 schema 是 fresh-run 唯一合同；v1↔v2 不存在双源漂移风险。

---

## 4. v2 Schema 关键字段与语义 verifier 映射

### 4.1 taskExecution 必需

v2 强 required，无 taskExecution 时 `Draft202012Validator(v2).validate(candidate)` 必抛 ValidationError（包内 verifier `route_drift_false` 测试使用 deepcopy 后的 fixture 改写 schemaVersion，未必触发 schema-only rejection；本审计额外观察到 v2 fresh run 若缺 taskExecution 即失败——由 `additionalProperties: false` + required 数组共同保证）。本审计未观察到允许 schemaVersion=v2 但缺 taskExecution 的实例。

### 4.2 routeDrift / fallbackReasonCodes

- schema `allOf`：`routeDrift=true` ⇒ `fallbackReasonCodes.minItems=1`；`routeDrift=false` ⇒ `fallbackReasonCodes.maxItems=0`。该结构性约束在 schema 层即拒绝"声明 drift 但不写 reason"或"无 drift 却写 reason"。
- semantic verifier（`14-product-contract-tests.py::validate_product_v2_semantics` 与 `18-v3-5-document-verifier.py` 中的 `semantic_route_drift_recomputed`）独立按固定映射 `expected_routes` 复算 `routeDrift`，并断言 `bool(fallbackReasonCodes) is drift`，防止 schema 通过但语义造假。

### 4.3 本地 ASR 资源提示与取消 / 临时媒体删除

- schema allOf：observedRoute ∈ {credentialed_media_asr, trusted_tab_capture_asr} ⇒ `resourceNotice.shown=true` / `localAsr=true` / `cancelAvailable=true` / `temporaryMediaDeleted=true`。
- semantic verifier 进一步断言：observedRoute 为本地 ASR 或可信 capture ASR 时，`expectedWaitClass != "none"`、`cpuImpact != "none"`、`memoryMiB > 0`、`temporaryDiskBytes > 0`；其他 observedRoute 必须显示 zero-resource resourceNotice（`temporaryMediaDeleted=True` 仍要求）—— 与威胁 UI19「ASR 资源提示只写文案、未与真实执行绑定」对应。
- 6 项 parametrize 假绿负例（`routeDrift:False` / `fallbackReasonCodes:[]` / `shown:False` / `localAsr:False` / `cancelAvailable:False` / `temporaryMediaDeleted:False`）在 schema 层被拒绝；2 项语义层负例（`memoryMiB:0` / `temporaryDiskBytes:0`）在 schema 层合法但语义 verifier 拒绝。

### 4.4 语义 verifier 固定映射（按 14 与 18 的脚本）

```python
expected_routes = {
  "subtitle":   {"credentialed_subtitle", "public_or_page_subtitle"},
  "asr":        {"credentialed_media_asr", "trusted_tab_capture_asr"},
  "multipart":  {"credentialed_media_asr", "trusted_tab_capture_asr"},
  "restricted": {"blocked"},
  "low_signal": {"visual_low_signal"},
}
drift = execution["observedRoute"] not in expected_routes[execution["registryClass"]]
```

精确符合需求 — subtitle → subtitle route；asr/multipart → media/capture ASR；restricted → blocked；low_signal → visual_low_signal。语义边界清晰、无歧义、可机器复算。

---

## 5. Contract Tests 独立复跑

### 5.1 跑分

执行命令：`/mnt/c/workspace/navia/services/local-runtime/.venv/bin/python -m pytest tests/test_v3_media_product_contracts.py -v`（在仓库根 `services/local-runtime/` 下，对应权威源 `services/local-runtime/tests/test_v3_media_product_contracts.py`，与包内 `14-product-contract-tests.py` 同字节）。

结果：`23 passed in 0.60s`。逐项：

1. `test_product_human_final_schemas_and_positive_fixture` PASS — 三套 schema meta + v1 fixture + human fixture + finalization candidate/disposition 全部 Draft 2020-12 合法
2. `test_product_v2_accepts_observed_asr_fallback_with_resource_notice` PASS — v2 正例 (registryClass=subtitle, observedRoute=credentialed_media_asr, routeDrift=true) 通过 schema + semantic
3. `test_product_v2_rejects_route_drift_false_green` × 8 PASS — 见 §5.2
4. `test_product_v2_accepts_true_subtitle_fast_path_without_resource_cost` PASS — registryClass=subtitle, observedRoute=credentialed_subtitle, routeDrift=false, 零资源提示正例
5. `test_product_rejects_mocked_machine_pass_and_v4_import` PASS
6. `test_product_rejects_false_seek_and_requirement_shrink` PASS
7. `test_human_review_rejects_missing_or_automatic_judgment` PASS
9. `test_human_review_semantics_rejects_false_overall_pass` PASS
10. `test_human_review_schema_enforces_blocked_precedence` PASS
11. `test_final_candidate_cannot_claim_final_pass` PASS
12. `test_final_candidate_rejects_duplicate_or_reclassified_sample` PASS
13. `test_final_candidate_rejects_false_green` × 4 (secretHitCount=1, residualCount=1, sampleCount=11, humanReviewStatus=FAIL) PASS
14. `test_final_disposition_requires_zero_fatal_major_and_exact_claim` PASS

### 5.2 至少 8 类假绿负例覆盖（远超 8 类下限）

`test_product_v2_rejects_route_drift_false_green` 的 8 个 parametrize 案例（前 6 个 schema 拒绝，后 2 个语义拒绝）：
- ① routeDrift=False (drift 状态下撒谎)
- ② fallbackReasonCodes=[] (drift 但无 reason)
- ③ shown=False (本地 ASR 但 hide resource notice)
- ④ localAsr=False (本地 ASR 但撒谎不是本地)
- ⑤ cancelAvailable=False (本地 ASR 但禁取消)
- ⑥ temporaryMediaDeleted=False (本地 ASR 后未清理)
- ⑦ memoryMiB=0 (本地 ASR 但内存为 0，semantic 拒绝)
- ⑧ temporaryDiskBytes=0 (本地 ASR 但临时磁盘为 0，semantic 拒绝)

其他负例：
- `test_product_rejects_mocked_machine_pass_and_v4_import`：`machinePassed=false`、`knowledgeImportStatus=imported`（拒绝 V4 冒充）
- `test_product_rejects_false_seek_and_requirement_shrink`：false seek、delta>5000、pageIdentityMatched=false、超过分P时长、`requirements.pop()`（分母缩减）
- `test_human_review_rejects_missing_or_automatic_judgment`：缺失 judgment / `reviewerRole=automation`
- `test_human_review_semantics_rejects_false_overall_pass`：单 FAIL 仍写 PASS
- `test_human_review_schema_enforces_blocked_precedence`：FAIL+BLOCKED 优先 BLOCKED，且 overallDecision=FAIL 与 schema 不一致
- `test_final_candidate_cannot_claim_final_pass`：candidate 不得 finalPassed=true
- `test_final_candidate_rejects_duplicate_or_reclassified_sample`：sourceIdentity 重复、expectedClass 改写
- `test_final_candidate_rejects_false_green` × 4：secretHitCount/residualCount/sampleCount=11/humanReviewStatus=FAIL
- `test_final_disposition_requires_zero_fatal_major_and_exact_claim`：majorCount=1 或 allowedClaim 改写（如 "V3 complete on every portal"）

合计 ≥ 22 类定向负例，远超 ≥ 8 类要求。包内 `18-v3-5-document-verifier.py` 的 11 项检查（含 6 个 schema 假绿负例 + 1 个正例 + 3 个 schema meta + 1 个 v1/human 正例）也全部 PASS。

### 5.3 `18-v3-5-document-verifier.py` 包内自包含 verifier

执行命令：`/mnt/c/workspace/navia/services/local-runtime/.venv/bin/python docs/active/project/external-audit-package/18-v3-5-document-verifier.py`。

输出（exit code 0）：

```json
{"schemaVersion": "v3-5-document-verification/v1",
 "total": 11, "passed": 11, "failed": [],
 "checks": [
   {"id": "schema_meta", "passed": true},
   {"id": "historical_v1_and_human_positive", "passed": true},
   {"id": "v2_asr_fallback_positive", "passed": true},
   {"id": "route_drift_false", "passed": true},
   {"id": "fallback_reason_missing", "passed": true},
   {"id": "notice_hidden", "passed": true},
   {"id": "local_asr_false", "passed": true},
   {"id": "cancel_missing", "passed": true},
   {"id": "temporary_media_retained", "passed": true},
   {"id": "semantic_route_drift_recomputed", "passed": true},
   {"id": "semantic_nonzero_resources", "passed": true}
 ]}
```

11/11 PASS，与 manifest §"包内复跑" 预期 `11/11` 完全一致。

---

## 6. V3-4 route drift 诚实保留

`16-v3-4-route-drift-closure.md`（与权威源 `docs/active/project/evidence/v3_media_companion/v3-4-production-matrix/v3-4-post-audit-route-drift-closure.md` 同字节）：

- 明确记录：冻结 registry 中 01..06 的 `primaryClass=subtitle`，但 fresh run 实际 `route` 全部为 `credentialed_media_asr`。
- 不撤销 V3-4 LIMITED PASS（V409 固定的是 10 ready + 1 degraded + 1 blocked 与投影闭合，不固定字幕/ASR 路由计数；所有 ready 任务仍由真实本地证据生成）。
- V3-5 作为实施前 Major 风险处理：UI 必须展示 Runtime 实际 route、预计时长/CPU/磁盘影响与取消，不得从 registry class 推导"字幕快路径"。

诚实保留路径：

- `05-v3-5-development-plan.md` §2「前置门禁」末段明确写出"V3-4 fresh run 已观测到 registry 字幕类样本实时回退到 `credentialed_media_asr`。V3-5 只能显示 Runtime 实际 route/event，必须在回退时告知预计等待、CPU/内存/临时磁盘占用和取消方式；禁止从 registry class 推导或承诺字幕快路径"。
- `06-v3-5-acceptance-plan.md` A03「机器合同」明确 v2 fresh run 必须含 `taskExecution`，verifier 按固定映射独立复算 `routeDrift`，并要求 ASR/capture 路由时显示非零资源。
- `07-v3-5-threat-model.md` UI16「registry 字幕分类冒充本次实际字幕 route」控制为"UI 只消费 Runtime route/event；ASR 回退显式显示资源/时延/取消；A03 对账 sealed execution"。
- v2 schema 与 semantic verifier 共同保证 `registryClass` 与 `observedRoute` 分开记录、`routeDrift` 由 verifier 复算、不允许 schema 通过但语义造假。

无伪造路径。route drift 已诚实保留并写进 V3-5 合同、验收与威胁模型。

---

## 7. 8 条 canonical media route / 旧 transcript 迁移 / Knowledge router 隔离

### 7.1 8 条 canonical media route

`10-product-acceptance-v1.schema.json` 与 `11-product-acceptance-v2.schema.json` 的 `RouteObservation.routeId` 枚举均为：

```text
/media/tasks
/media/tasks/:taskId
/media/tasks/:taskId/outline
/media/tasks/:taskId/timeline
/media/tasks/:taskId/mindmap
/media/tasks/:taskId/ask
/media/tasks/:taskId/evidence/:evidenceId
/media/tasks/:taskId/export
```

精确 8 条，与 `05-v3-5-development-plan.md` §3「Media Workspace」表格一致；`06-v3-5-acceptance-plan.md` A07 描述"direct/reload/Back/reopen 8 条 canonical route"，与 schema `mode` 枚举 `[direct, reload, back, reopen, invalid, forbidden]` 兼容；`runtimeRead: const true` 强制每次从 Runtime 重读（威胁 UI01）。可机器校验且与开发计划一致，无遗漏、无重复。

### 7.2 旧 transcript replace 迁移

`05-v3-5-development-plan.md` §3「Media Workspace」末段：「实现使用 `workspace.html#` 后的上述 canonical path。现有 `#/media/transcript/:taskId` 仅作为 V3-2 兼容入口：读取 task 后以 `history.replaceState` 迁移到 `#/media/tasks/:taskId`；不得形成第二套状态权威。Media router 必须先于现有 Knowledge router 分派，且不得改变既有 `#/knowledge/*` 语义」。

`07-v3-5-threat-model.md` UI17「新 media router 破坏既有 Knowledge router」控制为"path prefix 先分派；`#/knowledge/*` 回归；旧 transcript path 仅 replace 迁移"。

`06-v3-5-acceptance-plan.md` A07 明确"8 条 canonical route，并打开旧 `#/media/transcript/:taskId`：8 条均从 Runtime 恢复；旧路径只做 replace 迁移；invalid/forbidden 可回任务库；Knowledge routes 不回归"。

可实现、边界清晰、不形成第二套状态权威。

### 7.3 Knowledge router 隔离

- 新 media router 仅消费 `MediaPortalAdapter` 与 Runtime task/event，路径前缀 `/media/*`；Knowledge router 路径前缀 `/knowledge/*`。
- UI02「Side Panel/Workspace 指向不同 task」控制为"deep link + server identity binding"，强制 Side Panel 与 Workspace 通过 taskId/revision/outlineId 共享同一 Runtime 权威。
- UI10「任务历史泄露跨 workspace 内容」控制为"local authenticated Runtime、task scope、no telemetry"。
- Ask 必须"Provider 只能通过 D Adapter/Governance；B 前端不得直连模型"（开发计划 §4）；视觉问题"至少引用 frame/vision evidence，不能只用 transcript 回答'画面里有什么'"。
- 导出 §6 写明"不导出 Cookie、token、绝对路径、原视频、非证据帧、Provider key 或 SQLite/WAL"；`knowledgeImportStatus=deferred_to_v4` 显式 const。

无实现冲突、无回路、无绕过 Runtime 通道。

---

## 8. A01..A18 自动门槛与 H01..H10 人工门槛

### 8.1 A01..A18 自动门槛（用户操作 + 硬结果）

`06-v3-5-acceptance-plan.md` §1 给出 A01..A18 表格，每条均含"用户操作"与"必须结果"两列，机器可复算：

- A01 在锚点页打开 Side Panel → 标题/作者/分P/时长/adapter 正确，不显示旧 Mock 状态
- A02 查看/变更五项授权 → scope 清晰；授权/撤销持久；0 Cookie 值
- A03 点击开始 → 同 task 真实 V3-2/3/4 pipeline；显示 Runtime 实际 route；字幕转 ASR 时显示等待/CPU/内存/临时磁盘与取消
- A04 capture 等待 → 仅可信点击后启动
- A05 运行中取消 → UI cleaning → 终态；后端 residual=0
- A06 打开 Workspace → taskId/revision/outlineId 与 Side Panel 相同
- A07 direct/reload/Back/reopen 8 条 route + 旧 transcript → 8 条从 Runtime 恢复；旧路径 replace；invalid/forbidden 可回任务库；Knowledge routes 不回归
- A08 三视图同 outline，证据引用闭合
- A09 OCR/VLM/Transcript/Frame 标签分型，不互相冒充，私有帧不进入 public 包
- A10 有证据问题 → answered + 至少一个同 task citation
- A11 无证据问题 → `insufficient_evidence`，不编造
- A12 五类时间入口 → 5/5 located，误差 ≤2 秒
- A13 故障 → fallback/blocked，不计 located
- A14 导出 Markdown ZIP + JSON → member/hash/schema 可复算，V4 deferred
- A15 任务历史与重启 → 同 task/revision 可打开，无跨 task 内容
- A16 Provider/Runtime/网络/磁盘故障 → 唯一终态、可恢复提示、无 secret/path 泄漏
- A17 四视口 + 键盘 → 无根溢出；Axe serious/critical=0
- A18 全量回归 / 秘密扫描 / 独立审计 → 0 mock / 0 secret/path / Fatal=0 / Major=0

§1 末段写明"任一自动门槛失败时，不生成可提交的人类 review bundle"——自动门槛先于人工门槛，无 skip 路径。

### 8.2 H01..H10 人工门槛（仅可见体验）

`06-v3-5-acceptance-plan.md` §2 给出 H01..H10 表格，每条 PASS 标准均为可见行为：

- H01 打开锚点 + Navia → 页面身份/标题/作者/单P/约 792 秒；无公开字幕提示诚实
- H02 五项授权说明并开始 → 理解本地/云端范围、撤销影响、资源消耗；无 Cookie 操作
- H03 主路径 + capture 回退样本 → 路线/进度/等待点击/清理/终态可理解
- H04 大纲 + 时间线抽查 → 结构可读、章节有引用、无明显无证据内容
- H05 OCR/VLM/Transcript 证据 → 类型标签正确、缩略图/文字/时间关系可理解
- H06 Mindmap 操作 → 节点结构与大纲一致、引用可打开
- H07 提问有/无证据两类问题 → 前者有引用，后者诚实拒答
- H08 五次反跳 → 播放器跳到预期附近；机器 receipt `deltaMs<=2000` 且 located 必须页面身份一致；失败不伪成功
- H09 取消 + Provider 故障 → 不抢焦点/无限 loading；状态/恢复动作明确
- H10 导出两种格式 → 文件可打开；界面无"已保存到知识库"/V4 完成声明

§3「人工页面要求」明确：

- 每步基于当次 build 新鲜截图，不得用概念图冒充产品截图。
- 页面不要求人类听写、比较 ASR 模型、粘贴 Cookie、读取日志或判断 hash。
- 页面显示当前 task/run/build/bundle hash，并阻止提交不完整 10 项。
- 导出 submission 后只允许 append 新 revision，不原地篡改签署。

完全符合需求"只要求可见体验，不要求人类提供 Cookie、听写、日志或 hash"。

### 8.3 schema 强约束（自动化不得代签）

`12-human-review-v1.schema.json`：

- `reviewerRole: const "independent_human_reviewer"` — 拒绝 `automation`（由 `test_human_review_rejects_missing_or_automatic_judgment` 覆盖）。
- `judgments` 10 条，强校验 overallDecision ↔ 逐项判断一致性。
- `screenshotRefs: array<string>` 每条至少 1 项且唯一，模式 `^screenshots/[A-Za-z0-9._/-]+\\.png$`。
- `note: maxLength 2000`，限制为可读文本。

机器不得代签、补写或改写人类 H01..H10。

---

## 9. 其他正面 / 风险点

### 9.1 实施前审计（`08-v3-5-preimplementation-audit.md`）自检

结论：`Fatal=0 / Major=1 / Minor=1`。Major：V3-5 本轮恢复文档（product v2、route drift、canonical media router、旧 transcript compatibility）尚未经过新的外部文档审查；逐步截图人工页面必须由当次真实 build 自动生成，当前历史报告不能作为未来产品验收页面。Minor：当前 Workspace 只有 Knowledge router 与旧 transcript 特例；V3-5-0 实现必须新增独立 Media router。

本审计独立确认：实施前审计未越权声明产品 PASS；本审计的 Fatal/Major/Minor 与之独立形成第二视角。

### 9.2 内部审计（`09-v3-5-internal-document-audit.md`）

两轮：Fatal=0 / Major=1 / Minor=1；Fatal=0 / Major=1 / Minor=1。Major（第二轮）：外部独立文档审查尚未完成；Minor：真实截图与人类页面只能在自动门槛 A01..A18 全绿后生成。内部审计与本审计结论方向一致。

### 9.3 V3-4 独立实施出门审计（`15-v3-4-independent-exit-audit.md`）

Fatal=0 / Major=0 / Minor=4（候选方声明 M-1/M-2/M-3 + 评测理解差异）。该审计作为 V3-5 文档候选的前置门禁已独立验证，本审计不再复算 V401..V418（属 V3-4 范围），但同字节复算的 manifest 已证明 V3-4 LIMITED PASS 成立。

### 9.4 隐私与清理边界

本审计仅在 stdout 输出与本落盘报告内引用包内载荷。本审计不访问 Cookie / API Key / 原始媒体 / 私有 run / SQLite。所有 hash 复算、schema 校验、pytest 跑分均在只读模式下完成。未触发任何 `write_*`、commit、云端 dispatch、未启动浏览器、未加载 V3-1..V3-4 实现代码（仅运行 `test_v3_media_product_contracts.py` 与 `18-v3-5-document-verifier.py` 两份纯 Python 脚本）。

---

## 10. 决策结论

**V3-5 文档候选达到 `CONDITIONAL GO FOR EXPLICIT USER IMPLEMENTATION AUTHORIZATION` 的前置文档条件，但不构成任何产品代码 / H01..H10 实施授权。**

具体裁决：

- **Fatal = 0**：审计包完整性、载荷/权威源字节一致、Schema meta、V2/v1 单向升级、固定语义映射、八条 canonical route、旧 transcript replace 迁移、Knowledge router 隔离、A01..A18 / H01..H10 设计、Privacy 边界均无致命缺陷。
- **Major = 0**：实施前审计 §Major 1 已通过 v2 schema + semantic verifier + 8 条 route + route drift 闭环 + canonical media router + replace 迁移 + Knowledge 隔离 + H01..H10 仅可见体验 等机制在本审计范围内独立确认；与 `09-v3-5-internal-document-audit.md` 的"外部独立文档审查尚未完成"在范围上有别（本审计本身即独立文档审查）。
- **Minor = 2**：
  - Mi-1：V3-5 当前文档包未含 v3-5-0 冻结产物（独立 Media router 增量代码文件、原型页与逐步配图增量）；v3-5-0 实现仍需新增独立 Media router 并保持 prefix 分派与 Knowledge 不回归。该缺口与 `08-v3-5-preimplementation-audit.md` Minor M-1 对齐，已在恢复条件中说明。
  - Mi-2：H01..H10 逐步配图人工页面"必须由当次真实 build 自动生成"，当前包内仅有 fixture 级正例（`13-product-human-positive-fixture.json::humanReview` 仅 `screenshots/H01.png..H10.png` 占位）；不能把 fixture 冒充为产品 PASS。

### 10.1 文档候选 vs 实施授权

**文档候选 PASS** 的范围：

- 18 项载荷 + manifest 字节级一致；权威源 0 mismatch；19 平铺文件 / 0 子目录；满足 manifest §约束。
- v1 schema 只读归档；v2 schema 是 fresh-run 唯一合同；v2 含 taskExecution / routeDrift / fallbackReasonCodes / ResourceNotice 全字段与 schema allOf 强约束。
- semantic verifier 固定映射 subtitle→subtitle route；asr/multipart→media/capture ASR；restricted→blocked；low_signal→visual_low_signal；本审计独立复算 6 项 schema 假绿负例 + 2 项语义假绿负例 + 8 个 contract tests + 23 个 contract tests 全部 PASS。
- 8 条 canonical media route、旧 transcript replace 迁移、Knowledge router 隔离均已冻结且无回路。
- A01..A18 含用户操作 + 机器可复算硬结果；H01..H10 仅可见体验，不要求 Cookie/听写/日志/hash；schema 拒绝 automation 代签。
- V3-4 LIMITED PASS 上游门禁成立；V3-5 不扩大为 V3 / V4 / Chat+Know / PX-6 / RKM 通过。

**不构成**：

- V3-5 implementation PASS（须用户另行明确授权后进入 V3-5-0..7）。
- V3 PASS / V4 PASS / Chat+Know PASS / PX-6 PASS / RKM PASS / 完整产品 PASS（每个范围独立审计）。
- H01..H10 PASS（仅在 V3-5 自动门槛 A01..A18 全绿后由人类执行；本审计未签署任何 human judgment，fixture 仅作 v1/h schema 测试样本）。
- 改变 V3-4 LIMITED PASS、V3-2-3 LIMITED PASS、V3-3 LIMITED PASS 等任何历史阶段状态。
- 改变私有 run（`v3-4-outline-production-20261008T104258Z` 等）、SQLite 状态、Seal、旧 run 字节或用户秘密。

### 10.2 允许/禁止

**允许**：

- 用户另行明确授权 `V3-5-0..7 implementation`，并在授权时单独声明 V3-5-0 文档冻结/原型/审计门禁已完成（与 `08-v3-5-preimplementation-audit.md` 恢复条件一致）。
- 继续按既有顺序 V3-2 → V3-3 → V3-4 → V3-5 → V3-6 → V3-7 推进；H01..H10 仅在 V3-5 自动 UI 门槛通过后由人类执行一次。

**禁止**：

- 把本审计结论扩大为 V3 实施授权、H 评审 PASS、V3 PASS 或完整产品 PASS。
- 修改 V3-4 sealed run、历史 schema、产品代码、用户凭据。
- 把当前 fixture / 历史截图认定为未来 fresh build 的人工验收证据。
- 跳过 A01..A18 直接执行 H01..H10；自动门槛先于人工门槛是硬约束。

---

## 11. 留痕

- 本审计仅在 `docs/active/project/external-audit-package/` 与 `services/local-runtime/tests/` 目录内做只读访问；未修改任何文件。
- 仅落盘 1 份报告：`docs/active/project/evidence/v3_media_companion/v3-5-independent-document-audit.md`（本文）。
- 未访问 Cookie / API Key / 原始媒体 / 私有 run / SQLite / 用户 secret。
- 未启动浏览器、未加载 V3-1..V3-4 实现代码、未触发云端 dispatch。
- 所有 hash 复算、Schema 校验、pytest 跑分均在只读模式下完成。
- stdout 输出仅包含：脚本运行结果与本审计报告落盘路径（见文末）。

---

## 12. 计数与下一门禁

- 审计包载荷总数：18 + manifest = 19（< 20 ✓）
- 载荷 SHA-256 匹配：18/18 ✓
- 权威源对账 0 mismatch：18/18 ✓
- `18-v3-5-document-verifier.py`：11/11 PASS ✓
- `test_v3_media_product_contracts.py`：23/23 PASS ✓
- 假绿负例覆盖：≥ 22 类（远超 ≥ 8 类下限）✓
- A01..A18 自动门槛：18 条冻结 ✓
- H01..H10 人工门槛：10 条仅可见体验 ✓
- canonical media route：8 条冻结 ✓
- schema 假绿语义映射：subtitle/asr/multipart/restricted/low_signal 5 类全覆盖 ✓

**结论计数**：Fatal=0 / Major=0 / Minor=2。

**下一门禁**：

- 用户需在外部独立审查通过后另行明确授权 `V3-5-0..7 implementation`（与 `08-v3-5-preimplementation-audit.md` 恢复条件一致）。
- V3-5-0 必须先冻结 Media router 增量 + 真实原型页 + 真实逐步配图增量，并完成独立实施预审计 Fatal=0/Major=0；V3-5-1..5 必须以 A01..A18 自动门槛全绿为前置，V3-5-6 的人类 H01..H10 不得在自动门槛未通过时执行。
- 后续 V3-6 / V3-7 仍按既有顺序门禁推进；H01..H10 不得代签、补写或合并 run。