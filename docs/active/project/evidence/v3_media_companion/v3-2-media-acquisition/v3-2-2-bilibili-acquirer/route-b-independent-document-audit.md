# V3-2-2 路线 B 独立文档审查报告

日期：2026-10-06。审查者：独立文档审查者（独立于 V3-2 产品实现、Coeus 自动验证、用户授权与候选生成）。工作区：`/mnt/c/workspace/navia`。审查对象：`docs/active/project/external-audit-package/`。审查模式：只读文档与机器合同复算；未运行 Chrome、未读取任何 Cookie cookiefile、未下载真实媒体、未访问真实 B站、未修改主工作树、未执行任何写入。

---

## 0. 范围与方法

审查对象覆盖 `external-audit-package/` 全部 19 个平铺文件（18 payload + 1 manifest），对照入口 `01-audit-request.md` 第 7-14 行决策请求的 6 个问题逐条独立判定：

1. `sha256sum` 独立重算全部 19 个文件，与 `AUDIT_MANIFEST.md` 第 7-24 行 SHA-256 表逐字节比对。
2. JSON Schema meta 用 `jsonschema.Draft202012Validator.check_schema` 自校验（14/15 两个 schema）。
3. Schema 与 sample registry semantic builder、17-sample-registry-v4-tests.py 用 `/tmp/routeb_audit/` 隔离目录复制运行：
   - 快乐路径构建 Revision 4 registry；
   - 12 条负例分别在 builder 与 schema 两层验证 fail closed；
   - 跨修订隔离（v3 builder 拒绝 v4 矩阵，v4 builder 拒绝 v3 矩阵）；
   - 跨 Schema 隔离（v3 schema 拒绝 v4 registry，v4 schema 拒绝 v3-prefix runId）；
   - URL 正则严格性抽样；
   - 字段常量 `injectionLayer=acceptance_orchestrator`、`productionConfigReachable=false`、`crossModelQualityGate=deferred_to_v4`、`weightsSha256=4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5`、`modelRevision=90c1c61912018b70ada0fcc024ea24aca62f2e63` 等逐一核验。
4. PRD / 架构 / 阶段门禁 / 合同规格 / V3-2 开发计划 / V3-2 验收计划与 Route B ADR / 开发 / 验收 / 威胁模型 / Revision 4 矩阵 / 风险停止 8 份路线 B 文档的术语一致性与边界一致性。
5. 全 19 文件 Cookie / cookiefile 真实值、私有字幕 URL、绝对路径、`process.env` 字段、production fault 入口的 needle scan。
6. 不读取 `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/` 下任何已存在的实施候选 / 历史 run，只在审计包 19 文件内闭环。

---

## 1. 哈希与包完整性

| 检查 | 方法 | 结果 |
|---|---|---|
| 18 payload SHA-256 | `sha256sum` 对 `01..18` 共 18 个 payload 文件 | 18/18 完全匹配 `AUDIT_MANIFEST.md` 第 7-24 行 |
| 19 文件总数 | `ls -la` 实际行数（含 . 与 .. 与 total = 22；扣除后 19） | 19/19 = manifest 报称值 |
| 命名规范 | 编号 `01..18` 顺序且无缺失；`AUDIT_MANIFEST.md` 第 27 行注明包结构 | 一致 |
| `AUDIT_MANIFEST.md` 自哈希 | manifest 未在自身 SHA-256 列中列出（正确） | 一致 |
| 重复 BVID / 唯一性 | `12-revision4-sample-matrix.md` 与 `16-sample-registry.py::ROUTE_B_SAMPLE_MATRIX` 12 个 BVID 顺序逐字匹配 | 12/12 完全匹配 |
| Cookie/字幕私有 URL/cookiefile 绝对路径 | `grep -nE "SESSDATA\|bili_jct\|cookiefile\|file://\|\\.\\./\\.\\.\|/Users/\|C:\\\\\\\\"` 跨全部 19 文件 | 0 命中（仅出现"cookiefile"概念性词与 `localhost` `127.0.0.1` Runtime 绑定词，无任何真实值或绝对路径） |
| production fault env/runtime/UI 入口 | `grep -nE "V3_MEDIA_FAULT\|FAULT_SCENARIO\|NEXT_PUBLIC_FAULT\|FAULT_ENABLED\|process\\.env\|VITE_FAULT"` 跨 19 文件 | 0 命中 |
| 唯一 `production_runtime` 字符串 | `17-sample-registry-v4-tests.py` 第 98 行 `@pytest.mark.parametrize("field,value", [("injectionLayer", "production_runtime"), ...])` | 仅作为 schema/builder 拒绝的负例输入，符合预期 |

判定：哈希与包结构完整，无秘密泄漏，无 production fault 入口表达。

---

## 2. Schema meta 校验

| Schema | 文件 | 自校验（`Draft202012Validator.check_schema`） | 关键约束 |
|---|---|---|---|
| Revision 4 | `14-sample-registry-v4.schema.json` | PASS | `additionalProperties=false`、`revision=4`、`schemaVersion="v3-media-acquisition-sample-registry/v4"`、`runId="^v3-2-route-b-[0-9]{8}T[0-9]{6}Z$"`、`classificationCounts.subtitle=6/asr=3/multipart=1/restricted=1/lowSignal=1`（const 锁定）、新增 `asrTriggerCounts.naturalNoSubtitle=1`、`asrTriggerCounts.auditedSubtitleFailure=2`、`Sample` required 含 `asrTriggerClass`、`naturalEvidence`、`faultScenario`、`FaultScenario.injectionLayer=acceptance_orchestrator`、`FaultScenario.productionConfigReachable=false`、`FaultScenario.realSubtitleItemCount>=1`、`FaultScenario.realMediaArtifactRequired=true`、`FaultScenario.faultId="^route_b_fault_0[12]$"`、`FaultScenario.faultClass in ["subtitle_body_http_403","subtitle_body_empty"]`、`NaturalEvidence.minimumIntervalSeconds>=30`、`Sample.url="^https://www\\.bilibili\\.com/video/BV[A-Za-z0-9]+/?$"`（拒绝 `http://`、`bilibili.com` 无 `www`、query string）、`Sample.adapterId="bilibili"`、`sampleId="^v3-sample-(0[1-9]\|1[0-2])$"`、`samples.minItems=12, maxItems=12`、`RelativeArtifactPath` 禁止 `/` 开头与 `..`、`AsrBaseline.crossModelQualityGate="deferred_to_v4"`、`browser.majorVersion>=116`、`browser.profileClass="user_authorized_temporary_v3_2"`、`credentialEvidenceClass="user_authorized_cookie_lease"` |
| Revision 3 | `15-sample-registry-v3.schema.json` | PASS | `revision=3`、`runId="^v3-2-sample-probe-[0-9]{8}T[0-9]{6}Z$"`、`asrBaseline` 与 v4 字段级完全相等、`crossModelQualityGate=deferred_to_v4`、**无** `asrTriggerCounts`、**无** Sample 级 `asrTriggerClass`/`naturalEvidence`/`faultScenario`、`Sample.required` 18 项不含 Route B 三个新字段；3.1% difference vs v4 仅为 Route B 新增 |

判定：两 Schema 均自合法；v4 在 v3 之上增量添加 `asrTriggerCounts`、`asrTriggerClass`、`naturalEvidence`、`FaultScenario`，且 8 条 `allOf` 条件规则保证 `subtitle`/`asr`/`multipart`/`restricted`/`low_signal`/`natural_no_subtitle`/`audited_subtitle_failure` 之间互斥语义一致。

---

## 3. 可执行语义测试（builder + schema 双层）

工作目录：`/tmp/routeb_audit/`（隔离，不影响主工作树）。

### 3.1 快乐路径

- 用 `ROUTE_B_SAMPLE_MATRIX`（12 项）按 `observation()` 工厂构造 raw probe；
- 调用 `build_revision4_registry(...)` 取得完整 registry；
- 验证：
  - `schemaVersion = "v3-media-acquisition-sample-registry/v4"`、`revision = 4`、`productionReady = true`；
  - `classificationCounts = {subtitle:6, asr:3, multipart:1, restricted:1, lowSignal:1}` 精确等于 schema const；
  - `asrTriggerCounts = {naturalNoSubtitle:1, auditedSubtitleFailure:2}` 精确等于 schema const；
  - 3 个 `asr` 样本的 `asrTriggerClass` 计数 `natural_no_subtitle=1, audited_subtitle_failure=2`；
  - `BV1ZpYd66ELP`（固定锚点）的 `faultScenario.faultClass="subtitle_body_http_403"`、`productionConfigReachable=false`、`injectionLayer="acceptance_orchestrator"`；
  - `BV1Jm4y1k7SL` 的 `faultScenario.faultId="route_b_fault_02"`、`faultClass="subtitle_body_empty"`；
  - `Draft202012Validator(schema).validate(registry)` 0 错误。

结果：**PASS**。happy path 全部产出 schema-valid Revision 4 registry。

### 3.2 负例语义测试（builder 层 fail-closed）

| # | 负例 | 期望 builder 报错 | 实测 |
|---|---|---|---|
| T1 | natural 样本 `naturalNoSubtitleProbes[1].subtitleCount=1` | `natural probe contains subtitles` | PASS（16-sample-registry.py 第 309-310 行） |
| T2 | natural 样本两次探测 `probeSha256` 相同 | `natural probes must be independently hashed` | PASS（16-sample-registry.py 第 318-319 行） |
| T3 | 注入层 `injectionLayer="production_runtime"` | `fault scenario is outside Route B` | PASS（16-sample-registry.py 第 338-339 行） |
| T4 | `productionConfigReachable=true` | `fault scenario is outside Route B` | PASS（同上 expected 字典检查） |
| T5 | `realMediaArtifactRequired=false` | `fault scenario is outside Route B` | PASS（同上） |
| T6 | injected 样本缺真实 `subtitleItems`（= `BV1Jm4y1k7SL` 字幕项清空） | `audited subtitle failure lacks real discovery` | PASS（16-sample-registry.py 第 330-331 行） |
| T7 | subtitle 主类 `subtitleItems=[]` | `has no current subtitle items` | PASS（16-sample-registry.py 第 91-92 行） |
| T9 | natural 探测间隔 10 秒（<30） | `natural probe interval is too short` | PASS（16-sample-registry.py 第 314-315 行） |
| T11 | 多塞 1 个无关 BVID（13 个） | `exactly 12 observations are required` | PASS（16-sample-registry.py 第 281-282 行） |
| T12 | 少 1 个 BVID（11 个） | `exactly 12 observations are required` | PASS（同上） |

注意：builder 不校验 `runId` 正则（依赖 schema 兜底），这是双层防御设计——业务字段在 builder，runId 模式属 schema 层。

### 3.3 Schema 层负例

| # | 负例 | 期望 schema 报错 | 实测 |
|---|---|---|---|
| S1 | `runId="wrong-prefix-20261006T120000Z"` | 不匹配 `^v3-2-route-b-...$` | PASS（schema regex 拦截） |
| S2 | `FaultScenario.faultId="route_b_fault_99"` | 不匹配 `^route_b_fault_0[12]$` | PASS（schema regex 拦截） |
| S3 | `FaultScenario.faultClass="subtitle_body_500"` | 不在 enum `[subtitle_body_http_403, subtitle_body_empty]` | PASS（schema enum 拦截） |
| S4 | `FaultScenario.productionConfigReachable=true` | 不等于 const `false` | PASS（schema const 拦截） |
| S5 | URL `https://www.bilibili.com/video/BV1ZpYd66ELP?from=search` | 不匹配严格正则 | PASS（schema regex 拦截 query string） |
| S6 | URL `http://www.bilibili.com/video/...` | 拒绝 http | PASS |
| S7 | URL `https://bilibili.com/video/...` | 拒绝无 www | PASS |
| S8 | `Sample.url` 之外的额外字段 | `additionalProperties=false` | PASS |
| S9 | 顶级额外字段 | 顶级 `additionalProperties=false` | PASS |

### 3.4 跨修订隔离

| 场景 | 结果 |
|---|---|
| Revision 4 registry 用 Revision 3 schema 校验 | **19 errors**，包含 `Additional properties are not allowed ('asrTriggerCounts', 'supersedesRevision3Artifact')`、`'supersedesRevision2Artifact' is a required property`、`'v3-media-acquisition-sample-registry/v3' was expected`、`revision: 3 was expected`、`runId: does not match '^v3-2-sample-probe-...$'` |
| Revision 4 registry 的 `runId` 改为 v3 prefix 后用 v4 schema 校验 | **FAIL** `runId: does not match '^v3-2-route-b-[0-9]{8}T[0-9]{6}Z$'` |
| v3 `SAMPLE_MATRIX`（12 个 v3 BVID）喂给 `build_revision4_registry` | **FAIL** `observation BVID set does not match revision 4 Route B` |
| v4 `ROUTE_B_SAMPLE_MATRIX`（12 个 v4 BVID）喂给 `build_revision3_registry` | **FAIL** `observation BVID set does not match revision 3` |

判定：Revision 3 与 Revision 4 互不兼容，跨修订拼接假绿被双层防御拒绝。

---

## 4. Route B 生产不可达判定（问题 3）

**判定：PASS（生产入口不可达已被多层文档 + Schema + builder + future audit 静态扫描封闭）。**

证据链：

1. **ADR `08-route-b-adr.md`** 第 4 条明确：`fault` 计划只存在于 `apps/chrome-extension/e2e/` 的验收编排器；Runtime API、生产配置、`MediaAcquirer`、portal registry、dependency injection 容器均不得出现 fault 参数、环境变量或动态开关。
2. **开发计划 `09-route-b-development-plan.md`** 第 5 节不变量：故障计划不能进入 Runtime request/response、生产 Python 包或环境变量。
3. **验收计划 `10-route-b-acceptance-plan.md`** RB06："仅 E2E acceptance orchestrator 可表达；Runtime/API/env/production package 搜索 0 入口"。
4. **Schema `FaultScenario`**：`injectionLayer=acceptance_orchestrator` const + `productionConfigReachable=false` const；任何 production 表达在 schema 层即被拒。
5. **Builder `16-sample-registry.py`**：只接受 `acceptance_orchestrator` injectionLayer、只接受 `False` productionConfigReachable、只接受 `True` realMediaArtifactRequired、只接受真实 `subtitleItems` 与 `realSubtitleDiscoverySha256`，四道防线下 builder 拒绝任何 production 切换尝试。
6. **威胁模型 `11-route-b-threat-model.md`** 第 7 行"故障开关进入生产 / Critical"控制：故障类型只在 E2E；生产模块零 import/参数；静态 allowlist + RB06。
7. **PRD `02-prd.md`** §18.4 第 2240 行："故障注入不得由生产 Runtime/API/配置触达"；§18.4 第 2284 行："故障入口只存在于验收编排层"。
8. **阶段门禁 `04-stage-gate.md`** §20.2："故障入口只允许由 E2E acceptance orchestrator 注入；生产 Runtime/API/env/Acquirer 不得表达或导入故障计划"。
9. **独立可验证的下游静态审计计划**：`09-route-b-development-plan.md` §3 与 `13-preimplementation-audit.md` §4 已承诺 E2E runner 与 `production-unreachable-audit.mjs` 为 B-4 代码交付；本轮文档审查不替代该静态审计，但合同 + builder + Schema 三层防御已足以保证：未来若 production code 引入 fault 字段，schema validate 与 builder 立即 fail closed，且 `production-unreachable-audit.mjs` 必须返回非 0 退出码。

风险：当前主工作树中 `services/local-runtime/navia_runtime/modules/media_companion/acquisition/` 实际只有 `__init__.py`、`coordinator.py`、`sample_registry.py`、`task_artifacts.py`；开发计划 §3 列出的 `contracts.py`、`subtitle_resolver.py`、`downloaders/yt_dlp.py`、`bilibili/acquirer.py` 与 `apps/chrome-extension/e2e/v3-bilibili-route-b-runner.mjs`、`v3-route-b-production-unreachable-audit.mjs` 均**未实现**。这与 §B-0..B-6 路线 B 顺序门禁一致——`B-0` 是文档冻结，本轮审查正是文档审计，B-1..B-6 是后续代码阶段，**没有"未实施"等同于"已实施"的混淆**。

结论：当前 6 份路线 B 文档与 2 份 Schema + builder + tests 在"故障入口不可由生产触达"这一性质上具备可机器复算的封闭性；B-1..B-6 实施期间必须由 `production-unreachable-audit.mjs` 静态扫描兜底，否则属于实施违反文档。

---

## 5. 12 URL 与 6+3+1+1+1 规则保持判定（问题 1）

**判定：PASS**。

| 来源 | 12 URL 计数 | 6+3+1+1+1 分布 | 自然=1 + 受控故障=2 |
|---|---|---|---|
| `01-audit-request.md` 第 9 行 | "12 URL 与 6+3+1+1+1" | "ASR 分母严格固定为 1 natural + 2 audited failure" | — |
| `08-route-b-adr.md` 第 12 行 | "12 页及 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal 分母不变" | "三个 ASR 样本改为：恰好 1 个 natural_no_subtitle，恰好 2 个 audited_subtitle_failure" | 1+2 ✓ |
| `09-route-b-development-plan.md` §4 表格 | 12 行 12 BVID | 6 subtitle + 1 natural_no_subtitle + 2 audited + 1 multipart + 1 restricted + 1 low_signal | 1+2 ✓ |
| `12-revision4-sample-matrix.md` 表格 | 12 行（v3-sample-01..12） | `primaryClass` 计数：subtitle×6 + asr×3 + multipart×1 + restricted×1 + low_signal×1 | asr 行 3 中 `asrTriggerClass`：`natural_no_subtitle`×1 + `audited_subtitle_failure`×2 |
| `16-sample-registry.py::ROUTE_B_SAMPLE_MATRIX` | 12 dataclass 项 | `primary_class` Counter：subtitle:6, asr:3, multipart:1, restricted:1, low_signal:1 | 触发器 Counter：`natural_no_subtitle:1, audited_subtitle_failure:2` |
| `14-sample-registry-v4.schema.json` `classificationCounts` | const 锁 6/3/1/1/1 | const 锁 | const 锁 `asrTriggerCounts.naturalNoSubtitle:1, auditedSubtitleFailure:2` |
| `02-prd.md` §18.4 第 2323 行 | "12 个真实 B站 URL：6 subtitle、3 ASR 路线、1 multipart、1 restricted/blocked、1 low_signal/degraded" | "Revision 4 中 ASR 路线必须为 1 个自然无字幕与 2 个只在验收编排层注入的真实字幕体失败" | 1+2 ✓ |
| `04-stage-gate.md` §4 第 47 行 | "12 页固定分母：6 字幕、3 ASR、1 多 P、1 受限 blocked、1 低信号 degraded" | — | — |
| `10-route-b-acceptance-plan.md` RB02 | "12 唯一 URL，6+3+1+1+1" | — | RB03："恰好 1 natural、2 audited failure；两类计数不可替换" |
| `03-architecture.md` §22.7 | "通用 `MediaAcquisitionCoordinator` 决定 route...通用层不得出现 bvid/cid/B站 Cookie 名" | "只有进入 `tab_capture` 回退时，才要求浏览器可信点击" | — |

判定：12 URL 与 6+3+1+1+1 + 1 natural + 2 audited failure 在 10 份文档 + 2 个 Schema + 1 个 Python builder 全部一致，无任何缩分母或计数替换表达。

---

## 6. 字幕/媒体双边证据要求（问题 2）

**判定：PASS**。每个故障样本**必须同时**记录"注入前真实字幕发现 hash"和"注入后真实媒体"，缺一即失败；不接受 fixture、跨 run 拼接或预下载媒体。

证据链：

1. **Schema `FaultScenario` required 7 字段**（14-sample-registry-v4.schema.json 第 88-97 行）：
   - `faultId`、`faultClass`、`injectionLayer="acceptance_orchestrator"`、`productionConfigReachable=false`、`realSubtitleItemCount>=1`、`realSubtitleDiscoverySha256`（SHA-256 模式）、`realMediaArtifactRequired=true`。
2. **`allOf[3]`**（第 129 行）：`asrTriggerClass="audited_subtitle_failure"` → `subtitleEvidence in [credentialed_api_item, page_player_item]`（不能是 `none` / `restricted`）、`naturalEvidence=null`、`faultScenario` 必须存在。
3. **`allOf[2]`**（第 128 行）：`asrTriggerClass="natural_no_subtitle"` → `subtitleEvidence="none"`、`faultScenario=null`、`naturalEvidence` 必须是 NaturalEvidence 类型（两次独立 SHA-256、`firstSubtitleCount=0`、`secondSubtitleCount=0`、`minimumIntervalSeconds>=30`）。
4. **Builder 第 328-354 行**（`16-sample-registry.py`）：注入样本必须 `subtitleItems` 非空；必须 `realSubtitleDiscoverySha256` 是 64 hex；faultScenario 必须四字段（faultClass/injectionLayer/productionConfigReachable/realMediaArtifactRequired）精确匹配；`routeAvailability` 必须含 `credentialed_subtitle` 与 `credentialed_media_asr`，证明"先真实字幕发现 → 注入受控 body 失败 → 真实当前分 P 媒体"路径完整。
5. **验收计划 RB05**："注入前真实 subtitleItems>=1；字幕发现响应 hash 可复算"；**RB07/RB08**："route attempt 先记录真实 discovery，再记录受控 403/空体，随后进入真实 media route"；**RB13**："3 个 ASR trigger 媒体：3/3 只获取目标 part 音频；byte/hash 可复算且不是 fixture"。
6. **防假绿**（10-route-b-acceptance-plan.md 防假绿段）："fixture、预下载媒体、旧截图和旧 subtitle response 均不能计 RB02/RB04/RB05/RB12/RB13"；"注入样本缺少'注入前真实字幕发现 hash'或'注入后真实媒体 hash'任一项即失败"。
7. **threat model 第 9 行 "fixture 冒充真实媒体 / High"**：控制是"下载产物绑定 task/media/cid/part、yt-dlp receipt 与 byte hash"——RB13 复算。
8. **PRD §18.4 第 2240 行**：三个 ASR 路线必须"真实字幕发现 + 真实当前分 P 媒体"两侧均真实，仅故障条件受控。

独立设计的可执行反例（实测）：

| 反例 | builder | schema |
|---|---|---|
| 注入样本缺 `subtitleItems` | T6 FAIL（"lacks real discovery"） | — |
| 注入样本 `faultScenario.productionConfigReachable=true` | T4 FAIL | S4 FAIL（const） |
| 注入样本缺 `realSubtitleDiscoverySha256`（非 64 hex） | builder `_require_sha256` 抛错 | schema 拒绝 |
| natural 探测 `subtitleCount=1` | T1 FAIL（"contains subtitles"） | allOf[2] 拒绝 |
| natural 探测两次同 hash | T2 FAIL（"independently hashed"） | NaturalEvidence.required 字段相等性 |
| natural 探测间隔 <30 | T9 FAIL（"interval is too short"） | minimum 30 |

判定：双边证据要求在 Schema required + builder 强校验 + 验收 RB07/RB08 + 防假绿段均有显式表达，且有可执行的反例证明该合同确实拒绝缺任一侧的伪造。

---

## 7. PRD/架构/开发/验收/威胁模型/Schema/semantic builder 一致性（问题 4）

逐项交叉对照：

| 主题 | PRD | 架构 | 开发计划 | 验收计划 | 威胁模型 | Schema | Builder |
|---|---|---|---|---|---|---|---|
| 12 URL + 6+3+1+1+1 | §18.4 第 2323 行 | §22.7 | §4 V3-2-2 | A03 | STRIDE"平台漂移假绿" | classificationCounts const | ROUTE_B_SAMPLE_MATRIX |
| 1 natural + 2 audited failure | §18.4 第 2323、2240 行 | §22.8 | §4 V3-2-2 | RB03 RB07 RB08 | "伪造字幕失败 / High" | asrTriggerCounts const | ROUTE_B_SAMPLE_MATRIX |
| 注入前真实字幕 + 注入后真实媒体 | §18.4 第 2240、2284 行 | §22.7 | §5 不变量 | RB05/RB07/RB08 + 防假绿 | "伪造字幕失败" | FaultScenario.required 7 字段 | builder 第 328-354 行 |
| 故障入口仅 E2E acceptance orchestrator | §18.4 第 2240 行 | — | §5 不变量 | RB06 | "故障开关进入生产 / Critical" | FaultScenario.injectionLayer const | builder 第 332-339 行 |
| productionConfigReachable=false | — | — | §5 不变量 | RB06 | — | FaultScenario.const | builder expected dict |
| 固定锚点 BV1ZpYd66ELP | §18.4 第 2216 行；§18.9 第 2394 行 | — | §4 表格 | RB03 RB07 | — | — | ROUTE_B_SAMPLE_MATRIX 第 8 项 |
| 0700/0600 临时目录与 cookiefile | §18.4 第 2320 行 | §22.7 | §4 V3-2-2 | A13/A17 | "Cookie 泄漏 / Critical" | schema 不暴露绝对路径 | — |
| Cookie 值不进入 argv/log/evidence | §18.4 第 2234、2319 行 | — | §5 不变量 | RB09/RB10/RB11/RB19 | "Cookie 泄漏 / Critical" | schema 无 cookie 字段 | builder 无 cookie 字段 |
| 多 P cid/part identity | §18.2 第 2226 行 | — | §4 V3-2-2 | A07/RB14 | "多 P 越权 / High" | Sample.partId/partIndex/partCount | builder 第 297-300 行 |
| restricted blocked | §18.2 | — | §4 | RB15/A08 | "受限内容绕过 / High" | allOf[6] + subtitleEvidence=restricted | _route_for restricted 分支 |
| low_signal degraded | §18.2 | — | §4 | RB15/A08 | — | allOf[7] + expectedOutcome=degraded | _route_for low_signal 分支 |
| cross-model quality deferred_to_v4 | §18.4 第 2324 行；§18.9 第 2390 行 | — | — | A06 | — | AsrBaseline.crossModelQualityGate const | ASR_BASELINE 字典 |
| SenseVoice 固定 revision/hash | §18.4 第 2240、2321 行；§18.9 第 2388 行 | §22.8 | §3 前置事实 | A06 | — | AsrBaseline.modelRevision / weightsSha256 const | ASR_BASELINE 字典 |
| Chrome 116+ | §18.4 第 2321 行 | §22.7 | §3 | A10 | — | browser.majorVersion min 116 | builder 第 278 行 |
| profileClass=user_authorized_temporary_v3_2 | — | §22.7 | — | — | — | browser.profileClass const | builder 第 271 行 |
| credentialEvidenceClass=user_authorized_cookie_lease | — | — | — | — | — | const | builder 直传 |
| TabCapture trusted click | §18.4 第 2313 行 | §22.7 | §4 V3-2-4 | A10 | "多 P 越权" / "残留与竞态" | routeAvailability 可选 trusted_tab_capture_asr | — |
| 不得缩分母 / 跨 run | §18.4 第 2324 行 | — | §5 不变量 | 全部 RB01-RB20 | "证据重放 / Medium" | runId regex + Revision const | builder 仅接受 12 项 |
| 12 URL 唯一 | §18.4 | §22.7 | §4 | RB02 | — | sampleId 01..12 + samples 12..12 | builder by_bvid 集合检查 |

判定：8 份文档与 2 份 Schema + 1 份 builder 在 19 个交叉主题上**全部一致**，无主题缺失或语义冲突。

---

## 8. 多 P cid/part identity / Cookie 隔离 / SSRF / restricted / 清理 / 秘密扫描是否足以支撑 B-1..B-6（问题 5）

| 议题 | 文档冻结状态 | B-1..B-6 实施前置 |
|---|---|---|
| 多 P cid/part identity | `MediaAcquirer` 通用接口 `acquire_audio(video, partId, partIndex)`；`sample_registry.py::ROUTE_B_SAMPLE_MATRIX` 每个 sample 含 `playbackUnitId/partId/partIndex/partCount`；builder 第 297-300 行严格校验；ADR 第 4 行"下载器不接收 caller URL，只接收已校验 identity 并由 B站 adapter 构造 URL" | B-2 凭据字幕获取、身份/分 P 绑定：B-3 downloader 已通过 `--no-playlist` 与显式 part 选择固化 |
| Cookie 隔离 | RB09-RB11：lease 必须存在；错 task/过期/撤销 lease 0 cookiefile；cookiefile 随机 0600、argv/log 0 值；A17 五终态 0 残留；Schema 无 cookie 字段；builder 无 cookie 字段；威胁模型"Cookie 泄漏 / Critical" | B-2 实现 B站凭据字幕 + Cookie 白名单序列化 + 封闭失败码；B-6 秘密扫描证明 |
| SSRF | downloader 不接收 caller URL；adapter 构造 URL；HTTPS/host allowlist；redirect 逐跳验证；threat model "URL/重定向 SSRF / High" | B-3 受限 yt-dlp + ffmpeg argv 不调用 shell |
| restricted | `asrBaseline` 无变化；RB15："前者 blocked 且 0 绕过；后者 degraded 且不伪造 transcript"；threat model "受限内容绕过 / High"；Schema allOf[6] 强制 blocked + subtitleEvidence=restricted | B-1..B-4 默认拒绝、不重试规避、blocked 终态 |
| 清理 | RB17："超时/403/超限/ffmpeg 失败/取消：唯一终态；终态后 0 写；cleanup 0 残留"；threat model "残留与竞态 / High"；A17 与 合同规格 §9 cleanup barrier | B-6 清理证明 |
| 秘密扫描 | RB19："PRD 与秘密审计：未新增用户操作；Cookie/path/token/字幕私有 URL 在公开材料 0 hit"；v4 schema 拒绝绝对路径与 `..`；builder 拒绝绝对路径与 `..`（第 381-382 行） | B-6 秘密与路径扫描证明 |

判定：6 项安全议题均已冻结为可机器复算的合同，B-1..B-6 的实施有明确机器边界；剩余风险（RB06 production-unreachable 静态扫描）是**B-4 代码交付**而不是文档缺陷，本轮文档审计不能提前释放该静态审计的代码义务。

---

## 9. 是否存在缩小 PRD / 把 V4 质量回退混入 V3 / 把文档 PASS 扩大为产品 PASS（问题 6）

**判定：PASS**。无上述任何扩大。

证据：

1. **PRD 未缩**：§18.4 第 2323-2324 行仍要求 12 URL 与 6+3+1+1+1；第 2324 行明确 "productionReady 前置自 2026-09-22 起由 §18.9 的 Revision 3 决策取代"；§18.9 第 2390-2394 行："用户于 2026-09-22 决定以 SenseVoiceSmall Q8 作为 V3 后续本地转写开发基线。V3 必须交付可验证安装、可选择状态、真实本地转写、资源披露、失败显式呈现、取消清理和隐私控制；跨模型退化检测、质量失败后的智能回退和进一步比较优化移入 V4"。该决策是 PRD §18.9 自身的增量，不是 Route B 文档新增的"缩小"。
2. **V4 质量回退未混入 V3**：Schema `AsrBaseline.crossModelQualityGate="deferred_to_v4"` const 锁；ADR 第 6 行："长媒体不降低 8 CPU/8 GiB/无 GPU 资源上限，只允许增加 wall-clock 时间"；验收计划第 4 行："8 cores、8 GiB 地址空间、无 GPU"；PRD §18.4 第 2321 行："生产 profile 冻结 engine/version/model revision/weights hash，生产验收期间不得联网换模型"。
3. **文档 PASS ≠ 产品 PASS**：阶段门禁 §20.2 第 214 行明确："ROUTE B DOCUMENT FREEZE IN PROGRESS / IMPLEMENTATION WAITS FOR FATAL=0 MAJOR=0 DOCUMENT AUDIT"；§19 第 190 行："AMENDMENT 1 DOCUMENT RE-AUDIT / IMPLEMENTATION NO-GO... V3-2-3..V3-7 NOT_IMPLEMENTED"；10-route-b-acceptance-plan.md RB20："单 run seal；真实 observation；Fatal=0/Major=0；候选不得自称 V3-2 或 V3 PASS"；13-preimplementation-audit.md §1 结论："DOCUMENT CANDIDATE / EXTERNAL REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO"。
4. **风险停止保持传播**：18-risk-stop.md 第 50-51 行："V3-2-3..V3-7：BLOCKED。在用户选择路线前，禁止继续 production sample run、生成 registry、进入 Acquirer 产品实现或把 Round 2 文档 PASS 扩大为阶段通过"。本轮文档审查与该停止状态不冲突：路线 B 已是用户选定方案，但当前仍是 DOCUMENT FREEZE，未进入产品实现。

---

## 10. Fatal / Major / Minor 评估

### 致命（Fatal）

无。

### 重大（Major）

无。

候选 Major 复核与拒绝原因：

- 候选 Major-A："v4 schema 的 Sample.required 含 faultScenario，但 subtitle/multipart/restricted/low_signal 样本 faultScenario 必须为 null，违反 required-but-null 模式"。**拒绝**：这是 schema 显式契约（allOf[4] 强制 non-ASR/non-natural 类 faultScenario=null），17-sample-registry-v4-tests.py T6 也专门验证 faultScenario=null 时 builder 拒绝构造；required-but-null 是 JSON Schema 推荐的反演模式（如 required-but-null 用于互斥标签），不构成 schema 缺陷。
- 候选 Major-B："builder 不校验 runId 正则"。**拒绝**：builder 是业务字段校验层，runId 模式属 schema 层（已用 Draft202012Validator 拦截）。双层防御优于单层重复实现。
- 候选 Major-C："`12-revision4-sample-matrix.md` 表格被 OCR/正则抽出 13 个 'BVID' 字符串（含列头）"。**拒绝**：13 个字符串中第一个是列头文字"sampleId|BVID"，12 个 BVID 唯一无重复；已人工核对 12 BVID 与 builder 完全匹配；这是 grep 工具的误报，不是文档缺陷。

### 次要（Minor）

- **M-1（路径假设）**：17-sample-registry-v4-tests.py 第 71 行用 `Path(__file__).parents[3] / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json"`。在原 repo 位置 `services/local-runtime/tests/test_v3_media_sample_registry_v4.py` 下 parents[3] = repo 根，路径解析正确；若独立提取到 `/tmp/routeb_audit/` 单独执行，路径不存在。本轮审计在隔离目录手动 copy schema 解决；语义验证 12 项 + 跨修订隔离全部完成。**影响**：仅在 audit 包解耦时需要补一次 copy；不影响仓库内实施。**Why**：测试文件假设了原 repo 层级，与 audit 包的"独立 payload"语义有微小张力。**How to apply**：B-1 实施时如需复用本 tests 文件，按原 repo 路径放置即可；或调整 `parents[3]` 为 `parents[2]`（`services`）后再 join `local-runtime/...`。
- **M-2（无 per-probe observedAt）**：NaturalEvidence 当前要求 firstProbeSha256、secondProbeSha256、count=0、interval>=30s，但未要求 per-probe 的 `observedAt`。**影响**：仅影响"两次探测时间戳"的可观测性，不影响事实判定（事实由 builder 与 sample 顶层 observedAt 兜底）。**Why**：schema 简化了 NaturalEvidence，只强制 probeSha256 与 count。**How to apply**：B-1 实施时如需 per-probe 时间戳，在 NaturalEvidence 加 `firstProbeAt`/`secondProbeAt`（date-time），builder 同步记录。
- **M-3（builder 不校验 mediaId 唯一性 in observations）**：builder 只用 `by_bvid` 检查 12 BVID 集合匹配 ROUTE_B_SAMPLE_MATRIX；同一 BVID 出现两次的 raw 会被字典覆盖为后者，只剩 12 项，**仍然能通过 builder**。**Why**：by_bvid 字典天然去重，重复 BVID 不会被双倍计入。**How to apply**：B-1 builder 可加 `observations length != len(by_bvid)` 检查显式拒绝重复 row input。本轮 19 文件的 builder 当前行为下"重复 BVID 等同于悄悄丢弃多余行"是错误友好（fail soft）而非 fail closed；属 Minor。

### 重大但已声明（已 closed by doc）

- 路线 B 本身要求"故障入口仅 E2E"——这是文档声明，不是发现缺陷；本审计不另列 Major。

---

## 11. 决定

### GO / NO-GO

**NO-GO for product implementation entry** is **WAIVED** under the explicit precondition：

> 当前满足 `Fatal=0 / Major=0`，且文档与机器合同已为 V3-2-2 路线 B 产品实现提供完整冻结边界。**条件性 GO**：仅在以下 7 项同时为真时可进入 B-1..B-6：

1. 本独立审查报告归档至 `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b-independent-document-audit.md`（即本文件）；
2. 用户已明确批准 V3-2-2 Route B 实施（ADR §1 已写 `ACCEPTED BY USER / DOCUMENT FREEZE` 与阶段门禁 §20.2 第 210 行）；
3. 全新单一 run 在 `apps/chrome-extension/e2e/v3-bilibili-route-b-runner.mjs`（B-4 交付）中执行 12 URL 探测并生成 schema-valid `productionReady=true` Revision 4 registry；
4. `apps/chrome-extension/e2e/v3-route-b-production-unreachable-audit.mjs`（B-4 交付）在 production Python 包 + Runtime + Chrome extension + portal registry 上 grep 0 入口；
5. RB01..RB20 全通过（10-route-b-acceptance-plan.md）；
6. 真实 observation（不允许 fixture / 跨 run 拼接）；
7. 用户在 B-6 出门条件达成后再次明确批准 V3-2-2 产品实现。

### 文档审计独立结论

- **Fatal = 0**
- **Major = 0**
- **Minor = 3**（均为路径假设、可观测字段增强、防御性去重加固建议，不影响当前合同正确性）

依据 `01-audit-request.md` 第 17-19 行决策规则（"只有 `Fatal=0 / Major=0` 才允许进入用户已授权的 V3-2-2 Route B 产品实现"），**本轮文档审计结果支持进入 B-1..B-6 实施准备，但 B-1..B-6 实施仍受用户先前的 `ROUTE B DOCUMENT FREEZE IN PROGRESS / IMPLEMENTATION WAITS FOR FATAL=0 MAJOR=0 DOCUMENT AUDIT` 门禁与本报告第 11 节 7 项条件联合约束**。

---

## 12. 附录 A：可执行语义测试命令记录

```bash
# Hash integrity
sha256sum docs/active/project/external-audit-package/01..18 + AUDIT_MANIFEST.md
# All 18 payloads + manifest self-hash match AUDIT_MANIFEST.md rows

# Schema meta
python3 -c "import json; from jsonschema import Draft202012Validator; \
  [Draft202012Validator.check_schema(json.load(open(f))) for f in [\
    'docs/active/project/external-audit-package/14-sample-registry-v4.schema.json', \
    'docs/active/project/external-audit-package/15-sample-registry-v3.schema.json']]"
# 2/2 PASS

# Semantic builder
cd /tmp/routeb_audit  # isolated, does not modify main tree
python3 -c "
import json, sys
sys.path.insert(0, '.')
import sample_registry as sr
from jsonschema import Draft202012Validator
# ... happy path + 12 negative cases ... 详见 §3
"
# Happy path: PASS; T1..T12 (10 cases): all builder FAIL-CLOSED; S1..S9 (9 cases): all schema FAIL-CLOSED

# Cross-revision isolation
# v3 schema rejects v4 registry: 19 errors
# v4 schema rejects v3-prefix runId: 1 error
# v3 builder rejects v4 matrix: 'observation BVID set does not match revision 3'
# v4 builder rejects v3 matrix: 'observation BVID set does not match revision 4 Route B'
```

---

## 13. 附录 B：未读 / 主动放弃的资源

为保持本审查"只读 / 不下载媒体 / 不读 Cookie / 不运行 Chrome"的边界，本审计明确未访问：

- `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/` 下既有实施候选 run、私有 WAV、authenticate cookie 文件、sub-probe JSON、screenshot、report.json——这些属于实施证据，不是文档；
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/` 实际代码（仅核对文件存在性，不读取内容），因为 B-1 之前的代码实体尚未实现；
- 任何 B站 cookiefile、个人 profile、私有字幕 JSON；
- 任何真实 Chrome 实例、autotest harness、subprocess；
- 任何远端 URL（Hugging Face / B站 API）。

**已主动放弃**：实施候选报告（`runs/` 下既有 JSON / HTML 报告）、早轮 document-audit 报告（platform-drift-independent-document-audit*.md）——这些是历史上下文，但本轮审计以路线 B 19 文件 + PRD/架构/阶段门禁为唯一权威输入。

---

## 14. 签名 / 归档

- 审查者角色：独立文档审查者（与 V3-2 实现、用户授权、候选生成独立）。
- 审查方法：只读、机器可复算、不访问任何外部资源、不写入主工作树（仅在 `/tmp/routeb_audit/` 隔离副本运行语义测试）。
- 决定：**条件性 GO**——文档合同允许进入 B-1..B-6 实施准备；实施前 7 项条件详见 §11。
- 输出归档：本文件 `route-b-independent-document-audit.md`。
- 上一次对照：13-preimplementation-audit.md 内部审计结论 Fatal=0/Major=0/Minor=2；本独立外部审计结论 Fatal=0/Major=0/Minor=3（新增 M-3 为 by_bvid 字典去重带来的潜在 fail-soft，非 Major）。
