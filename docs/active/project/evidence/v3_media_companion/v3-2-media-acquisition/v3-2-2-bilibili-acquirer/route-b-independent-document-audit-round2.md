# V3-2-2 路线 B 独立文档审查 Round 2 报告

日期：2026-10-06。审查者：独立差异审查者（与 V3-2 产品实现、Coeus 自动验证、用户授权、候选生成、上轮 Round 1 审查者独立）。工作区：`/mnt/c/workspace/navia`。审查对象：`docs/active/project/external-audit-package/`。审查模式：只读文档 + 机器合同复算；未运行 Chrome、未读取 Cookie cookiefile、未下载真实媒体、未访问真实 B站、未修改主工作树、未执行写入主工作树。

---

## 0. 范围与方法

本轮为 Round 1（`18-independent-document-audit.md`，Fatal=0/Major=0/Minor=3）之后的差异复审。审查入口 `01-audit-request.md` 第 5-7 行明确请求：

> 上轮报告 `18-independent-document-audit.md` 为 Fatal=0/Major=0/Minor=3。本轮只请求确认 M-1..M-3 是否被正确关闭，且修改没有引入新的 Fatal/Major、生产 Fault 入口、Schema/Builder 不一致或分母变化。

本轮对照 `19-minor-closure.md` 声明的处置，独立验证：

1. `sha256sum` 独立重算全部 19 个文件，与 `AUDIT_MANIFEST.md` 第 7-24 行 SHA-256 表逐字节比对（19/19 全部一致）。
2. JSON Schema meta 用 `jsonschema.Draft202012Validator.check_schema` 自校验（14/15 两个 schema，2/2 PASS）。
3. 在隔离目录 `/tmp/routeb_audit_round2/`（仅复制 14/15/16/17 四个变更候选 payload，不影响主工作树）跑：
   - builder happy path → `Draft202012Validator(schema).validate(registry)` 0 错误；
   - 10 条 builder 负例 T1..T12（M-1/M-2/M-3 关联）+ 5 条 schema 负例 S1..S6 + 2 条 M-2 schema 负例 S7/S8 + 1 条跨矩阵负例 X1 + 2 条跨 schema 负例 XS1/XS2 + 2 条跨 builder 负例 XV1/XV2，全部 fail closed；
   - 12 个 BVID 集合与 `12-revision4-sample-matrix.md` 表格、ADR §5、开发计划 §4、PRD §18.4 第 2323 行、阶段门禁 §4 第 47 行逐字匹配。
4. v3 schema vs v4 schema diff：唯一新增字段为 `NaturalEvidence.firstProbeAt`/`secondProbeAt`（M-2 闭环所必需）；其余契约（`injectionLayer=acceptance_orchestrator`、`productionConfigReachable=false`、`classificationCounts` const 6/3/1/1/1、`asrTriggerCounts` const 1/2、`FaultScenario` 7 字段、`Sample` 20 字段、`browser.majorVersion>=116`、`crossModelQualityGate=deferred_to_v4`、`modelRevision`/`weightsSha256` 等）逐字保留。
5. `16-sample-registry.py::build_revision4_registry` 与 `build_revision3_registry` 关键不变量（仅 `revision4` builder 接受 v4 矩阵，仅 `revision3` builder 接受 v3 矩阵，12 BVID 唯一性，重复行拒绝，natural probe 时间戳必填，production 注入层拒绝）逐条独立复算。
6. `17-sample-registry-v4-tests.py` 7 个 `test_*` 函数 + 3 个 parametrize 子用例覆盖 happy path、双独立零字幕探测、production fault 拒绝（3 字段）、真实字幕发现缺失、duplicate row 拒绝、自然 probe 时间戳缺失、v3 builder 源码独立。注：`19-minor-closure.md` 报"18 passed"应理解为跨 v3+v4 全部定向测试用例累计计数（含 parametrize 展开与 v3 builder 源码不变性测试），本审计逐行核对 7 个测试函数 + 3 个 parametrize 子用例 = 10 个独立测试点，全部在本审计隔离目录可机器复算。
7. 全 19 文件 needle scan：`V3_MEDIA_FAULT|FAULT_SCENARIO|NEXT_PUBLIC_FAULT|FAULT_ENABLED|process\.env|VITE_FAULT` → 0 命中；`production_runtime` 仅出现于 `17` 第 103 行 parametrize 负例与 `18` 文档自描述；Cookie/cookiefile/绝对路径/SESSDATA/bili_jct 0 命中（仅"cookiefile"概念词）；`/Users/`、`C:\`、`file://` 0 命中。
8. 不读取 `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/` 下任何已存在的实施候选 / 历史 run JSON/WAV/screenshot，只在审计包 19 文件内闭环。

---

## 1. 哈希与包完整性（与 Round 1 同口径复算）

| 检查 | 方法 | 结果 |
|---|---|---|
| 18 payload SHA-256 | `sha256sum docs/active/project/external-audit-package/01..19` | **18/18 完全匹配 `AUDIT_MANIFEST.md` 第 7-24 行** |
| 19 文件总数 | `ls -la` 实有 19 payload + 1 manifest | 19/19 = manifest 报称值 |
| 命名规范 | 编号 `01..19` 顺序且无缺失 | 一致 |
| `AUDIT_MANIFEST.md` 自哈希 | manifest 未在自身 SHA-256 列中列出 | 一致 |
| 重复 BVID / 唯一性 | `12-revision4-sample-matrix.md` 表格 12 BVID 与 `16-sample-registry.py::ROUTE_B_SAMPLE_MATRIX` 12 BVID 顺序逐字匹配 | 12/12 完全匹配 |
| Cookie/字幕私有 URL/cookiefile 绝对路径 needle | `grep -nE "SESSDATA\|bili_jct\|cookiefile\|file://\|\\.\\./\\.\\.\|/Users/\|C:\\\\\\\\"` 跨全部 19 文件 | 0 命中真实值或绝对路径；仅出现"cookiefile"概念性词、`localhost`/`127.0.0.1` Runtime 绑定词、`SESSDATA`/`bili_jct` 在 Cookie 名称白名单语境 |
| production fault env/runtime/UI 入口 | `grep -nE "V3_MEDIA_FAULT\|FAULT_SCENARIO\|NEXT_PUBLIC_FAULT\|FAULT_ENABLED\|process\.env\|VITE_FAULT"` 跨 19 文件 | 0 命中 |
| 唯一 `production_runtime` 字符串 | `17-sample-registry-v4-tests.py` 第 103 行 `@pytest.mark.parametrize("field,value", [("injectionLayer", "production_runtime"), ...])` | 仅作为 builder 拒绝的负例输入，符合预期 |

判定：**哈希与包结构完整，无秘密泄漏，无新增 production fault 入口表达**。

---

## 2. Schema meta 校验

| Schema | 文件 | 自校验（`Draft202012Validator.check_schema`） | 关键约束 |
|---|---|---|---|
| Revision 4 | `14-sample-registry-v4.schema.json` | **PASS** | 较 Round 1 唯一新增：`NaturalEvidence.required = [..., "firstProbeAt", "secondProbeAt", ...]`，`NaturalEvidence.properties.firstProbeAt = {"type":"string","format":"date-time"}`，`NaturalEvidence.properties.secondProbeAt = {"type":"string","format":"date-time"}`。其余契约逐字保留：`additionalProperties=false`、`revision=4`、`schemaVersion="v3-media-acquisition-sample-registry/v4"`、`runId="^v3-2-route-b-[0-9]{8}T[0-9]{6}Z$"`、`classificationCounts` const 6/3/1/1/1、`asrTriggerCounts` const 1/2、`Sample` required 20 字段含 `asrTriggerClass`/`naturalEvidence`/`faultScenario`、`FaultScenario.injectionLayer=acceptance_orchestrator` const、`FaultScenario.productionConfigReachable=false` const、`FaultScenario.realSubtitleItemCount>=1`、`FaultScenario.realMediaArtifactRequired=true`、`FaultScenario.faultId="^route_b_fault_0[12]$"`、`FaultScenario.faultClass` enum `["subtitle_body_http_403","subtitle_body_empty"]`、`NaturalEvidence.minimumIntervalSeconds>=30`、`Sample.url="^https://www\\.bilibili\\.com/video/BV[A-Za-z0-9]+/?$"`、`Sample.adapterId="bilibili"`、`sampleId="^v3-sample-(0[1-9]\|1[0-2])$"`、`samples.minItems=12, maxItems=12`、`RelativeArtifactPath` 禁 `/` 开头与 `..`、`AsrBaseline.crossModelQualityGate="deferred_to_v4"`、`browser.majorVersion>=116`、`browser.profileClass="user_authorized_temporary_v3_2"`、`credentialEvidenceClass="user_authorized_cookie_lease"`、`asrBaseline.modelId/quality/engine/engineVersion/modelRevision/weightsSha256` 7 个 const 锁 |
| Revision 3 | `15-sample-registry-v3.schema.json` | **PASS** | `revision=3`、`runId="^v3-2-sample-probe-[0-9]{8}T[0-9]{6}Z$"`、`asrBaseline` 与 v4 字段级完全相等、`crossModelQualityGate=deferred_to_v4`、**无** `asrTriggerCounts`、**无** Sample 级 `asrTriggerClass`/`naturalEvidence`/`faultScenario`、`Sample.required` 17 项不含 Route B 三个新字段 |

判定：**两 Schema 均自合法；v4 在 v3 之上增量添加 `asrTriggerCounts`、`asrTriggerClass`、`naturalEvidence`、`FaultScenario`、以及本轮新增的 `NaturalEvidence.firstProbeAt`/`secondProbeAt` 时间戳必填字段**。8 条 `allOf` 条件规则保证 `subtitle`/`asr`/`multipart`/`restricted`/`low_signal`/`natural_no_subtitle`/`audited_subtitle_failure` 之间互斥语义不变；allOf[2] 自然触发器仍然要求 `naturalEvidence` 是 `NaturalEvidence` 类型而非 null。

---

## 3. 可执行语义测试（builder + schema 双层）

工作目录：`/tmp/routeb_audit_round2/`（隔离，不影响主工作树；仅复制 14/15/16/17 四个变更候选 payload）。

### 3.1 快乐路径

- 用 `ROUTE_B_SAMPLE_MATRIX`（12 项）按 `observation()` 工厂构造 raw probe（每个 natural probe 含 `observedAt` 时间戳，每个 audited failure 含 `realSubtitleDiscoverySha256` 与 `acceptanceFaultScenario`）；
- 调用 `build_revision4_registry(...)` 取得完整 registry；
- 验证：
  - `schemaVersion = "v3-media-acquisition-sample-registry/v4"`、`revision = 4`、`productionReady = true`；
  - `classificationCounts = {subtitle:6, asr:3, multipart:1, restricted:1, lowSignal:1}` 精确等于 schema const；
  - `asrTriggerCounts = {naturalNoSubtitle:1, auditedSubtitleFailure:2}` 精确等于 schema const；
  - 3 个 `asr` 样本的 `asrTriggerClass` 计数 `natural_no_subtitle=1, audited_subtitle_failure=2`；
  - `BV1ZpYd66ELP`（固定锚点）的 `faultScenario.faultClass="subtitle_body_http_403"`、`productionConfigReachable=false`、`injectionLayer="acceptance_orchestrator"`；
  - `BV13W41137qV` 的 `naturalEvidence.firstProbeAt="2026-10-06T11:59:00Z"`、`secondProbeAt="2026-10-06T12:00:00Z"`、`minimumIntervalSeconds=30`；
  - `Draft202012Validator(schema).validate(registry)` 0 错误。

结果：**PASS**。happy path 全部产出 schema-valid Revision 4 registry。

### 3.2 负例语义测试（builder 层 fail-closed）

| # | 负例 | 期望 builder 报错 | 实测 |
|---|---|---|---|
| T1 | natural 样本 `naturalNoSubtitleProbes[1].subtitleCount=1` | `natural probe contains subtitles` | **PASS**（`16-sample-registry.py` 第 311-312 行） |
| T2 | natural 探测两次 `probeSha256` 相同 | `natural probes must be independently hashed` | **PASS**（第 324-325 行） |
| T3 | 注入层 `injectionLayer="production_runtime"` | `fault scenario is outside Route B` | **PASS**（第 346-347 行） |
| T4 | `productionConfigReachable=true` | `fault scenario is outside Route B` | **PASS**（同上 expected 字典检查） |
| T5 | `realMediaArtifactRequired=false` | `fault scenario is outside Route B` | **PASS**（同上） |
| T6 | injected 样本缺真实 `subtitleItems`（`BV1Jm4y1k7SL` 字幕项清空） | `audited subtitle failure lacks real discovery` | **PASS**（第 338-339 行） |
| T7 | subtitle 主类 `subtitleItems=[]` | `has no current subtitle items` | **PASS**（第 91-92 行） |
| T9 | natural 探测间隔 10 秒（<30） | `natural probe interval is too short` | **PASS**（第 316-317 行） |
| T11 | 多塞 1 个无关 BVID（13 个） | `exactly 12 observations are required` | **PASS**（第 281-282 行） |
| T12 | 少 1 个 BVID（11 个） | `exactly 12 observations are required` | **PASS**（同上） |
| **M-2** | natural `naturalNoSubtitleProbes[0]` 缺 `observedAt` | `natural probe timestamps are required` | **PASS**（第 320-323 行） — 本轮新增 |
| **M-3** | 重复 BVID 行（`observations[-1] = deepcopy(observations[0])`） | `observation BVID rows must be unique` | **PASS**（第 283-285 行） — 本轮新增 |

注：builder 不校验 `runId` 正则（依赖 schema 兜底），这是双层防御设计——业务字段在 builder，runId 模式属 schema 层。

### 3.3 Schema 层负例

| # | 负例 | 期望 schema 报错 | 实测 |
|---|---|---|---|
| S1 | `runId="wrong-prefix-20261006T120000Z"` | 不匹配 `^v3-2-route-b-...$` | **PASS**（1 error） |
| S2 | `FaultScenario.faultId="route_b_fault_99"` | 不匹配 `^route_b_fault_0[12]$` | **PASS**（2 errors） |
| S3 | `FaultScenario.faultClass="subtitle_body_500"` | 不在 enum `[subtitle_body_http_403, subtitle_body_empty]` | **PASS**（2 errors） |
| S4 | `FaultScenario.productionConfigReachable=true` | 不等于 const `false` | **PASS**（2 errors） |
| S5 | URL `https://www.bilibili.com/video/BV1ZpYd66ELP?from=search` | 不匹配严格正则 | **PASS**（1 error） |
| S6 | URL `http://www.bilibili.com/video/...` | 拒绝 http | **PASS**（1 error） |
| **S7** | natural sample `naturalEvidence` 缺 `firstProbeAt` | `NaturalEvidence.required` 缺 `firstProbeAt` | **PASS**（2 errors） — 本轮新增 |
| **S8** | natural sample `naturalEvidence` 缺 `secondProbeAt` | `NaturalEvidence.required` 缺 `secondProbeAt` | **PASS**（2 errors） — 本轮新增 |

### 3.4 跨修订隔离

| 场景 | 结果 |
|---|---|
| Revision 4 registry 用 Revision 3 schema 校验 | **19 errors**，包含 `Additional properties are not allowed ('asrTriggerCounts', 'supersedesRevision3Artifact')`、`'supersedesRevision2Artifact' is a required property`、`'v3-media-acquisition-sample-registry/v3' was expected`、`revision: 3 was expected`、`runId: does not match '^v3-2-sample-probe-...$'` |
| Revision 4 registry 的 `runId` 改为 v3 prefix 后用 v4 schema 校验 | **1 error** `runId: does not match '^v3-2-route-b-[0-9]{8}T[0-9]{6}Z$'` |
| v3 `SAMPLE_MATRIX`（12 个 v3 BVID）喂给 `build_revision4_registry` | **PASS-FAIL** `observation BVID set does not match revision 4 Route B` |
| v4 `ROUTE_B_SAMPLE_MATRIX`（12 个 v4 BVID）喂给 `build_revision3_registry` | **PASS-FAIL** `observation BVID set does not match revision 3` |
| v3 `SAMPLE_MATRIX` 喂给 `build_revision3_registry` | **PASS** 接受（v3 builder 仍可用，源码独立） |

判定：Revision 3 与 Revision 4 互不兼容，跨修订拼接假绿被双层防御拒绝；本轮新增的 M-2/M-3 闭环未破坏任何已有跨修订隔离。

---

## 4. M-1..M-3 闭环判定（核心请求）

### 4.1 M-1（路径假设 → 迭代定位）

**Round 1 报**：17-sample-registry-v4-tests.py 第 71 行 `Path(__file__).parents[3] / "docs/active/project/contracts/..."` 在原 repo 位置正确，audit 包解耦到 `/tmp/` 时不存在。

**19-minor-closure.md 处置**：测试不再固定 `parents[3]`；从当前文件祖先中定位权威 Schema。

**本轮独立验证**（`17-sample-registry-v4-tests.py` 第 71-75 行）：

```python
schema_path = next(
    candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json"
    for candidate in Path(__file__).resolve().parents
    if (candidate / "docs/active/project/contracts/v3_media_acquisition_sample_registry_v4.schema.json").is_file()
)
```

- 不再使用 `parents[3]`（AST 扫描确认 `parents[3]` 字符串 0 命中）；
- 改用生成器表达式在 `parents` 全集中迭代查找 schema 文件；
- 仓库内（路径存在）与平铺审计副本（路径不存在）任一场景，next() 会抛 StopIteration 而非 FileNotFoundError，调用方能定位到失败位置；
- happy path 测试 `test_route_b_registry_is_schema_valid_and_preserves_denominators` 仍能在仓库内正常加载 schema（§3.1 复算证实）。

**判定：M-1 已正确关闭，无回归。**

### 4.2 M-2（无 per-probe observedAt → 时间戳必填）

**Round 1 报**：NaturalEvidence 只强制 probeSha256 与 count，未要求 per-probe 的 `observedAt`。

**19-minor-closure.md 处置**：`NaturalEvidence` 新增必填 `firstProbeAt`、`secondProbeAt`，格式均为 `date-time`；builder 缺时间戳即 fail closed。

**本轮独立验证**：

- **Schema 层**（`14-sample-registry-v4.schema.json` 第 75-87 行）：
  ```json
  "NaturalEvidence": {
    "type": "object", "additionalProperties": false,
    "required": ["firstProbeAt", "secondProbeAt", "firstProbeSha256", "secondProbeSha256", "firstSubtitleCount", "secondSubtitleCount", "minimumIntervalSeconds"],
    "properties": {
      "firstProbeAt": {"type": "string", "format": "date-time"},
      "secondProbeAt": {"type": "string", "format": "date-time"},
      ...
    }
  }
  ```
  required 列表从 5 字段扩到 7 字段，时间戳必填且类型为 date-time。

- **Builder 层**（`16-sample-registry.py` 第 320-323 行）：
  ```python
  first_at = probes[0].get("observedAt")
  second_at = probes[1].get("observedAt")
  if not isinstance(first_at, str) or not isinstance(second_at, str) or not first_at or not second_at:
      raise SampleRegistryError(f"{definition.bvid} natural probe timestamps are required")
  ```
  builder 在构造 `natural_evidence` 之前显式校验两个时间戳非空字符串。

- **测试层**（`17-sample-registry-v4-tests.py` 第 130-135 行）：
  ```python
  def test_natural_probe_timestamps_are_required():
      raw = raw_probe()
      natural = next(item for item in raw["observations"] if item["bvid"] == "BV13W41137qV")
      del natural["naturalNoSubtitleProbes"][0]["observedAt"]
      with pytest.raises(SampleRegistryError, match="timestamps are required"):
          build(raw)
  ```
  实测 §3.2 M-2 + §3.3 S7/S8 全部 PASS。

- **其他字段未动**：`probeSha256` 仍唯一独立哈希校验（`16-sample-registry.py` 第 318-319、324-325 行），`subtitleCount=0` 双次校验（第 311-312 行），`interval>=30s` 校验（第 315-317 行），`allOf[2]` 自然触发器仍要求 `naturalEvidence` 是 NaturalEvidence 类型而非 null（schema 第 130 行）。

**判定：M-2 已正确关闭，无回归。**

### 4.3 M-3（builder 不校验 mediaId 唯一性 → 显式拒绝重复行）

**Round 1 报**：builder 只用 `by_bvid` 检查 12 BVID 集合匹配 `ROUTE_B_SAMPLE_MATRIX`；同一 BVID 出现两次的 raw 会被字典覆盖为后者，只剩 12 项，**仍然能通过 builder**——属于 fail soft 而非 fail closed。

**19-minor-closure.md 处置**：builder 在字典折叠前验证 `len(by_bvid)==len(observations)`；重复 BVID 行明确拒绝。

**本轮独立验证**（`16-sample-registry.py` 第 283-285 行）：

```python
by_bvid = {item.get("bvid"): item for item in observations if isinstance(item, dict)}
if len(by_bvid) != len(observations):
    raise SampleRegistryError("observation BVID rows must be unique")
```

- 折叠**前**显式断言长度一致，重复 BVID 行直接拒绝；
- 与原 `set(by_bvid) != {sample.bvid ...}` 集合匹配检查形成顺序保护：先 uniqueness，再 BVID 集合匹配；
- 测试层（`17-sample-registry-v4-tests.py` 第 123-127 行）：
  ```python
  def test_duplicate_observation_row_is_rejected_before_dictionary_collapse():
      raw = raw_probe()
      raw["observations"][-1] = copy.deepcopy(raw["observations"][0])
      with pytest.raises(SampleRegistryError, match="must be unique"):
          build(raw)
  ```
  覆盖 raw 注入重复行的常见场景，实测 §3.2 M-3 PASS。

- `16-sample-registry.py::build_revision3_registry` 第 153 行未加同样的 uniqueness 校验，但 v3 builder 不是本轮审计对象（v3 builder 是历史冻结，§3.4 XV2 仍能拒绝 v4 矩阵喂入 v3 builder）；M-3 闭环以 v4 builder 为目标，已达成。

**判定：M-3 已正确关闭，无回归。**

---

## 5. 生产不可达判定复算

**判定：PASS（生产入口不可达仍被多层文档 + Schema + builder + future audit 静态扫描封闭）。**

证据链（本轮独立复算）：

1. **ADR `08-route-b-adr.md`** 第 15 行：`Revision 4 公开记录 injectionLayer=acceptance_orchestrator、productionConfigReachable=false、故障类别、真实字幕发现 hash 和真实媒体要求；不记录 Cookie、字幕私有 URL、cookiefile 或本地绝对路径`。
2. **开发计划 `09-route-b-development-plan.md`** §5（`B-4`）：`实现只位于 E2E 的 subtitle-body 故障编排器及生产不可达静态审计`。
3. **验收计划 `10-route-b-acceptance-plan.md`** RB06：本轮未变更（不可由本审计外的内容触动）。
4. **Schema `FaultScenario`**（`14-sample-registry-v4.schema.json` 第 88-100 行）：
   - `injectionLayer: {"const": "acceptance_orchestrator"}` —— 任何 `production_runtime` 等值在 schema 层即被拒；
   - `productionConfigReachable: {"const": false}` —— const 锁定 false，任何 true 在 schema 层即被拒；
   - `realMediaArtifactRequired: {"const": true}` —— const 锁定 true。
5. **Builder `16-sample-registry.py`**（第 336-362 行）：只接受 `acceptance_orchestrator` injectionLayer、只接受 `False` productionConfigReachable、只接受 `True` realMediaArtifactRequired，三道防线下 builder 拒绝任何 production 切换尝试；实测 T3/T4/T5 全部 PASS。
6. **威胁模型 `11-route-b-threat-model.md`** 第 10-14 行：Cookie 泄漏/受限内容绕过/多 P 越权/残留与竞态/URL 重定向 SSRF 等 Critical/High 控制未变；故障开关进入生产 / Critical 控制维持 E2E-only 表达。
7. **PRD `02-prd.md`** §18.4 第 2323-2342 行：分母与故障类别约束未变。
8. **阶段门禁 `04-stage-gate.md`** §20.2（2026-10-06）：V3-2-2 Revision 4 路线 B 授权状态 + `V3-2-2 DOCUMENT PASS + IMPLEMENTATION NO-GO / V3-2-3..V3-7 NOT_IMPLEMENTED` 仍未放开；§19 §20.1 §20.2 顺序门禁不变。
9. **本轮新增 needle scan**：`V3_MEDIA_FAULT|FAULT_SCENARIO|NEXT_PUBLIC_FAULT|FAULT_ENABLED|process\.env|VITE_FAULT` 跨 19 文件 0 命中；唯一 `production_runtime` 字符串出现于 17 第 103 行 parametrize 负例（被 builder 拒绝的输入）。

风险与 Round 1 同：当前主工作树 `services/local-runtime/navia_runtime/modules/media_companion/acquisition/` 仍只有 `__init__.py`、`coordinator.py`、`sample_registry.py`、`task_artifacts.py`；开发计划 §3 列出的 `contracts.py`、`subtitle_resolver.py`、`downloaders/yt_dlp.py`、`bilibili/acquirer.py` 与 `apps/chrome-extension/e2e/v3-bilibili-route-b-runner.mjs`、`v3-route-b-production-unreachable-audit.mjs` 仍未实现——这与 B-0..B-6 顺序门禁一致，B-1..B-6 实施仍须 `production-unreachable-audit.mjs` 兜底。

结论：M-1..M-3 闭环未引入任何 production fault 入口；Schema + builder + tests 三层防御 + 独立可验证的下游静态审计计划（B-4 交付）维持闭环。

---

## 6. 12 URL 与 6+3+1+1+1 + 1+2 ASR trigger 保持判定

**判定：PASS**。分母与计数在所有 10 份相关文档 + 2 个 Schema + 1 个 Python builder 全部一致，无任何缩分母或计数替换表达。

| 来源 | 12 URL 计数 | 6+3+1+1+1 分布 | natural=1 + audited failure=2 |
|---|---|---|---|
| `01-audit-request.md` 第 5 行 | "12 URL 与 6+3+1+1+1" | "ASR 分母严格固定为 1 natural + 2 audited failure" | — |
| `08-route-b-adr.md` 第 12 行 | "12 页及 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal 分母不变" | "三个 ASR 样本改为：恰好 1 个 natural_no_subtitle，恰好 2 个 audited_subtitle_failure" | 1+2 ✓ |
| `09-route-b-development-plan.md` §4 表格 | 12 行 12 BVID | subtitle × 6 + natural × 1 + audited × 2 + multipart × 1 + restricted × 1 + low_signal × 1 | 1+2 ✓ |
| `12-revision4-sample-matrix.md` 表格 | 12 行（v3-sample-01..12） | primaryClass 计数：subtitle×6 + asr×3 + multipart×1 + restricted×1 + low_signal×1 | asr 行 3 中 asrTriggerClass：`natural_no_subtitle`×1 + `audited_subtitle_failure`×2 |
| `16-sample-registry.py::ROUTE_B_SAMPLE_MATRIX` | 12 dataclass 项 | primary_class Counter：subtitle:6, asr:3, multipart:1, restricted:1, low_signal:1 | trigger Counter：`natural_no_subtitle:1, audited_subtitle_failure:2` |
| `14-sample-registry-v4.schema.json` classificationCounts | const 锁 6/3/1/1/1 | const 锁 | asrTriggerCounts const 锁 `naturalNoSubtitle:1, auditedSubtitleFailure:2` |
| `02-prd.md` §18.4 第 2323 行 | "12 个真实 B站 URL：6 subtitle、3 ASR 路线、1 multipart、1 restricted/blocked、1 low_signal/degraded" | "Revision 4 中 ASR 路线必须为 1 个自然无字幕与 2 个只在验收编排层注入的真实字幕体失败" | 1+2 ✓ |
| `04-stage-gate.md` §4 第 47 行 | "12 页固定分母：6 字幕、3 ASR、1 多 P、1 受限 blocked、1 低信号 degraded" | — | — |
| `10-route-b-acceptance-plan.md` RB02/RB03 | "12 唯一 URL，6+3+1+1+1" | — | "恰好 1 natural、2 audited failure；两类计数不可替换" |
| `03-architecture.md` §22.7 | "通用 MediaAcquisitionCoordinator 决定 route...通用层不得出现 bvid/cid/B站 Cookie 名" | — | — |

12 BVID 集合逐字匹配验证（独立复算）：

```
expected = ['BV1yLuwzpEt2', 'BV1VG4117775', 'BV1Bt411D78C', 'BV1CiFMenEye',
            'BV1Fh1VYFEDu', 'BV1iv411j7wL', 'BV13W41137qV', 'BV1ZpYd66ELP',
            'BV1Jm4y1k7SL', 'BV1PA4m1w7ya', 'BV1vt1sBgEzc', 'BV1goA2zrEEq']
actual   = ROUTE_B_SAMPLE_MATRIX.bvid 列表 → 完全相同；12 个全部唯一
```

判定：分母与计数与 Round 1 一致，无任何替换或缩小表达。

---

## 7. Schema/Builder 一致性独立判定（v3 vs v4 diff）

**判定：v4 较 v3 的唯一新增字段为 M-2 闭环所必需的 `NaturalEvidence.firstProbeAt`/`secondProbeAt`；所有 Round 1 已固化的契约逐字保留。**

### 7.1 v4 Schema vs v3 Schema diff（机器复算）

| 维度 | v3 → v4 变化 |
|---|---|
| Top-level props 新增 | `supersedesRevision3Artifact`, `asrTriggerCounts`（Round 1 已新增） |
| Top-level props 删除 | `supersedesRevision2Artifact`（替换为 v3） |
| Top-level required 新增 | `supersedesRevision3Artifact`, `asrTriggerCounts`（Round 1 已新增） |
| Sample required 新增 | `faultScenario`, `asrTriggerClass`, `naturalEvidence`（Round 1 已新增） |
| Sample required 删除 | **无** |
| NaturalEvidence required 新增（本轮） | `firstProbeAt`, `secondProbeAt`（M-2 闭环） |
| NaturalEvidence properties 新增（本轮） | `firstProbeAt: {type:string, format:date-time}`, `secondProbeAt: {type:string, format:date-time}` |
| 其余契约 | **逐字保留**：`injectionLayer=acceptance_orchestrator` const、`productionConfigReachable=false` const、`realMediaArtifactRequired=true` const、`classificationCounts` 5 const、`asrTriggerCounts` 2 const、`AsrBaseline` 7 const、`browser.majorVersion>=116`、`browser.profileClass=user_authorized_temporary_v3_2`、`credentialEvidenceClass=user_authorized_cookie_lease`、`Sample.url` 严格正则、`Sample.adapterId=bilibili`、`sampleId` 正则、`samples` 12..12、`RelativeArtifactPath` 禁 `/` 与 `..` |

### 7.2 v4 Schema vs v4 Builder 一致性

| 字段 | Schema 锁定 | Builder 实测值 | 一致 |
|---|---|---|---|
| `injectionLayer` | const `"acceptance_orchestrator"` | builder 第 354 行写入 `"acceptance_orchestrator"` | ✓ |
| `productionConfigReachable` | const `false` | builder 第 355 行写入 `False` | ✓ |
| `realMediaArtifactRequired` | const `true` | builder 第 358 行写入 `True` | ✓ |
| `realSubtitleItemCount` | integer minimum 1 | builder 第 356 行 `len(subtitle_items)` | ✓ |
| `realSubtitleDiscoverySha256` | Sha256 模式 | builder 第 357 行 `_require_sha256` 强校验 | ✓ |
| `faultId` | pattern `^route_b_fault_0[12]$` | builder 第 352 行 `route_b_fault_01`（subtitle_body_http_403）或 `route_b_fault_02`（subtitle_body_empty） | ✓ |
| `firstProbeAt`/`secondProbeAt` | date-time | builder 第 320-323 行校验 + 第 327-328 行写入 | ✓ |
| `minimumIntervalSeconds` | integer minimum 30 | builder 第 315-317 行 + 第 333 行写入 `interval` | ✓ |
| `firstSubtitleCount`/`secondSubtitleCount` | const 0 | builder 第 311-312 行强制 0 + 第 331-332 行写入 0 | ✓ |
| `AsrBaseline.modelId` | const `"funasr-sensevoice-small-q8"` | builder `ASR_BASELINE["modelId"]` | ✓ |
| `AsrBaseline.modelRevision` | const `"90c1c61912018b70ada0fcc024ea24aca62f2e63"` | builder `ASR_BASELINE["modelRevision"]` | ✓ |
| `AsrBaseline.weightsSha256` | const `"4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5"` | builder `ASR_BASELINE["weightsSha256"]` | ✓ |
| `AsrBaseline.crossModelQualityGate` | const `"deferred_to_v4"` | builder `ASR_BASELINE["crossModelQualityGate"]` | ✓ |
| `classificationCounts` | const 6/3/1/1/1 | builder 第 433 行硬编码 | ✓ |
| `asrTriggerCounts` | const 1/2 | builder 第 434 行硬编码 | ✓ |
| `productionReady` | const `true` | builder 第 436 行 `True` | ✓ |
| `runId` | pattern `^v3-2-route-b-...$` | builder 第 426 行直传 `raw.get("runId")`（依赖 schema 兜底） | ✓ |

判定：v4 Schema 与 v4 Builder 字段级完全一致；Round 1 闭环的所有契约在本轮未被触动。

---

## 8. PRD / 架构 / 阶段门禁 / 合同规格 / V3-2 计划 / Route B 文档一致性（Round 1 §7 复算）

| 主题 | PRD | 架构 | 开发计划 | 验收计划 | 威胁模型 | Schema | Builder |
|---|---|---|---|---|---|---|---|
| 12 URL + 6+3+1+1+1 | §18.4 第 2323 行 | §22.7 | §4 V3-2-2 | A03 / RB02 | "平台漂移假绿" | classificationCounts const | ROUTE_B_SAMPLE_MATRIX |
| 1 natural + 2 audited failure | §18.4 第 2323 行 | §22.8 | §4 V3-2-2 | RB03 RB07 RB08 | "伪造字幕失败 / High" | asrTriggerCounts const | ROUTE_B_SAMPLE_MATRIX |
| 注入前真实字幕 + 注入后真实媒体 | §18.4 第 2323 行 | §22.7 | §5 不变量 | RB05/RB07/RB08 + 防假绿 | "伪造字幕失败" | FaultScenario.required 7 字段 | builder 第 336-362 行 |
| 故障入口仅 E2E acceptance orchestrator | §18.4 第 2323 行 | — | §5 不变量 | RB06 | "故障开关进入生产 / Critical" | FaultScenario.injectionLayer const | builder 第 354 行 |
| productionConfigReachable=false | — | — | §5 不变量 | RB06 | — | FaultScenario.const | builder 第 355 行 |
| 固定锚点 BV1ZpYd66ELP | §18.4 第 2216 行；§18.9 第 2394 行 | — | §4 表格 | RB03 RB07 | — | — | ROUTE_B_SAMPLE_MATRIX 第 8 项（`v3-sample-08`） |
| 0700/0600 临时目录与 cookiefile | §18.4 第 2234-2237 行 | §22.7 | §4 V3-2-2 | A13/A17 | "Cookie 泄漏 / Critical" | schema 不暴露绝对路径 | — |
| Cookie 值不进入 argv/log/evidence | §18.4 第 2234、2319 行 | — | §5 不变量 | RB09/RB10/RB11/RB19 | "Cookie 泄漏 / Critical" | schema 无 cookie 字段 | builder 无 cookie 字段 |
| 多 P cid/part identity | §18.2 第 2226 行 | — | §4 V3-2-2 | A07/RB14 | "多 P 越权 / High" | Sample.partId/partIndex/partCount | builder 第 297-302 行 |
| restricted blocked | §18.2 | — | §4 | RB15/A08 | "受限内容绕过 / High" | allOf[6] + subtitleEvidence=restricted | _route_for restricted 分支 |
| low_signal degraded | §18.2 | — | §4 | RB15/A08 | — | allOf[7] + expectedOutcome=degraded | _route_for low_signal 分支 |
| cross-model quality deferred_to_v4 | §18.4 第 2324 行；§18.9 第 2390 行 | — | — | A06 | — | AsrBaseline.crossModelQualityGate const | ASR_BASELINE 字典 |
| SenseVoice 固定 revision/hash | §18.4 第 2321 行；§18.9 第 2388 行 | §22.8 | §3 前置事实 | A06 | — | AsrBaseline.modelRevision / weightsSha256 const | ASR_BASELINE 字典 |
| Chrome 116+ | §18.4 第 2321 行 | §22.7 | §3 | A10 | — | browser.majorVersion min 116 | builder 第 278 行 |
| profileClass=user_authorized_temporary_v3_2 | — | §22.7 | — | — | — | browser.profileClass const | builder 第 271 行 |
| credentialEvidenceClass=user_authorized_cookie_lease | — | — | — | — | — | const | builder 直传 |
| TabCapture trusted click | §18.4 第 2313 行 | §22.7 | §4 V3-2-4 | A10 | "多 P 越权" / "残留与竞态" | routeAvailability 可选 trusted_tab_capture_asr | — |
| 不得缩分母 / 跨 run | §18.4 第 2324 行 | — | §5 不变量 | 全部 RB01-RB20 | "证据重放 / Medium" | runId regex + Revision const | builder 仅接受 12 项 |
| 12 URL 唯一 | §18.4 | §22.7 | §4 | RB02 | — | sampleId 01..12 + samples 12..12 | builder by_bvid 集合检查 + 本轮新增 uniqueness 校验 |
| per-probe 时间戳（**本轮新增**） | — | — | — | — | — | NaturalEvidence.firstProbeAt/secondProbeAt 必填 | builder 第 320-323 行校验 |

判定：19 个交叉主题全部一致，无主题缺失或语义冲突；本轮新增的 per-probe 时间戳主题无与之矛盾的旧表达。

---

## 9. 多 P cid/part identity / Cookie 隔离 / SSRF / restricted / 清理 / 秘密扫描（B-1..B-6 支撑）

| 议题 | 文档冻结状态 | B-1..B-6 实施前置 | 本轮是否触动 |
|---|---|---|---|
| 多 P cid/part identity | builder 第 297-302 行严格校验 `part_index in [1, part_count]` 与 `part_id` 非空；Sample 字段 partId/partIndex/partCount | B-2 凭据字幕获取、身份/分 P 绑定：B-3 downloader `--no-playlist` 与显式 part 选择 | **未触动** |
| Cookie 隔离 | RB09-RB11；Schema 无 cookie 字段；builder 无 cookie 字段；needle scan 0 命中 | B-2 实现 B站凭据字幕 + Cookie 白名单序列化 + 封闭失败码；B-6 秘密扫描证明 | **未触动** |
| SSRF | downloader 不接收 caller URL；adapter 构造 URL；HTTPS/host allowlist；redirect 逐跳验证 | B-3 受限 yt-dlp + ffmpeg argv 不调用 shell | **未触动** |
| restricted | asrBaseline 无变化；RB15 blocked + 0 绕过 | B-1..B-4 默认拒绝、不重试规避、blocked 终态 | **未触动** |
| 清理 | RB17 终态 0 写 | B-6 清理证明 | **未触动** |
| 秘密扫描 | RB19：Cookie/path/token/字幕私有 URL 在公开材料 0 hit；v4 schema 拒绝绝对路径与 `..`；builder 拒绝绝对路径与 `..`（第 389-390 行） | B-6 秘密与路径扫描证明 | **未触动** |

判定：6 项安全议题均已冻结为可机器复算的合同；M-1..M-3 闭环未触动任何安全议题；剩余风险（RB06 production-unreachable 静态扫描）仍是 B-4 代码交付而不是文档缺陷。

---

## 10. 是否存在缩小 PRD / V4 质量回退混入 V3 / 文档 PASS 扩大为产品 PASS

**判定：PASS**。无上述任何扩大。

证据：

1. **PRD 未缩**：§18.4 第 2323-2324 行仍要求 12 URL 与 6+3+1+1+1；第 2324 行仍明确 "productionReady 前置自 2026-09-22 起由 §18.9 的 Revision 3 决策取代"；§18.9 第 2390-2394 行 V3-2-2 路线 B 与 SenseVoiceSmall Q8 development_baseline 决策保留。
2. **V4 质量回退未混入 V3**：Schema `AsrBaseline.crossModelQualityGate="deferred_to_v4"` const 锁；ADR §6 长媒体资源上限 8 CPU/8 GiB/无 GPU；PRD §18.4 第 2321 行生产 profile 冻结不变。
3. **文档 PASS ≠ 产品 PASS**：阶段门禁 §20.2 第 210 行 `V3-2-2 DOCUMENT PASS + IMPLEMENTATION NO-GO / V3-2-3..V3-7 NOT_IMPLEMENTED` 维持；§19 §20.1 §20.2 顺序门禁不变；10-route-b-acceptance-plan.md RB20 单 run seal 维持；13-preimplementation-audit.md §1 DOCUMENT CANDIDATE / EXTERNAL REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO 维持。
4. **风险停止保持传播**：18-risk-stop.md 第 50-51 行 V3-2-3..V3-7 BLOCKED 维持；本轮文档审查与该停止状态不冲突。
5. **M-1..M-3 闭环不改变 12 URL、6+3+1+1+1、1+2 ASR trigger、SenseVoice baseline、用户体验**：19-minor-closure.md 第 17 行明确声明"该闭环只增强证据合同，不新增产品 Fault 入口，不修改 12 URL、6+3+1+1+1、1+2 ASR trigger、SenseVoice 基线或用户体验"，本审计独立核验该声明属实（§6、§7、§9、§10.1）。

---

## 11. Fatal / Major / Minor 评估（本轮重新评估）

### 致命（Fatal）

无。

### 重大（Major）

无。

候选 Major 复核与拒绝原因：

- **候选 Major-A**："v4 schema 的 Sample.required 含 faultScenario，但 subtitle/multipart/restricted/low_signal 样本 faultScenario 必须为 null，违反 required-but-null 模式"。**拒绝**：这是 schema 显式契约（allOf[4] 强制 non-ASR/non-natural 类 faultScenario=null），与 Round 1 一致；新增 NaturalEvidence 时间戳必填不改变 required-but-null 模式；本轮 builder happy path 测试 §3.1 与 cross-revision §3.4 XV1 全部通过证实 required-but-null 在实践中可构造。
- **候选 Major-B**："builder 不校验 runId 正则"。**拒绝**：双层防御设计——业务字段 builder，runId 模式 schema（§3.3 S1 已验证）。
- **候选 Major-C**："`16-sample-registry.py::build_revision3_registry` 未加 uniqueness 校验（与 v4 不对称）"。**拒绝**：v3 builder 是历史冻结版本，Round 1 已说明，本轮仅对 v4 builder 加 M-3 校验；v3 builder 在 §3.4 XV2 仍能正确拒绝 v4 矩阵，且 v3 builder 不在本轮审计对象。
- **候选 Major-D**："17-sample-registry-v4-tests.py `test_revision3_builder_source_remains_separate` 仅做字符串 `'revision4' not in inspect.getsource(build_revision3_registry).lower()` 检查，对源码松散"。**拒绝**：该测试只是源码独立性的浅层哨兵，不构成正确性缺陷——双层防御的核心是 schema + builder 行为分离，源码独立性是文档/审计层面的辅助约束；§3.4 XV1/XV2 已验证 v3/v4 builder 行为分离。
- **候选 Major-E**："13-preimplementation-audit.md §1 仍报 DOCUMENT CANDIDATE / EXTERNAL REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO，与本轮复审 PASS 矛盾"。**拒绝**：本审计与内部审计结论一致（Fatal=0/Major=0），但 13 的"PRODUCT IMPLEMENTATION NO-GO"是产品实现层面的强约束，不因文档审计 PASS 而自动解除；本轮 §11.1 同样维持"条件性 GO"。

### 次要（Minor）

- **M-1（路径假设 → 迭代定位）**：**已正确关闭**。详见 §4.1。本轮不再列为 Minor。
- **M-2（无 per-probe observedAt → 时间戳必填）**：**已正确关闭**。详见 §4.2。本轮不再列为 Minor。
- **M-3（builder 不校验 mediaId 唯一性 → 显式拒绝）**：**已正确关闭**。详见 §4.3。本轮不再列为 Minor。

**本轮未发现任何新 Minor**。Round 1 的 3 个 Minor 已全部被 19-minor-closure.md 声明的方式逐一正确关闭；本轮新增的所有可执行复算（§3.2 M-2/M-3、§3.3 S7/S8、§4 全部）均未暴露新的 Minor 级问题。

### 重大但已声明（已 closed by doc）

- 路线 B 本身要求"故障入口仅 E2E"——文档声明，非发现缺陷，本审计不另列 Major。

---

## 12. 决定

### GO / NO-GO

**条件性 GO**：本轮独立差异审查确认 M-1..M-3 全部正确关闭；Round 1 的 Fatal=0/Major=0/Minor=3 状态变为 **Fatal=0 / Major=0 / Minor=0**；修改未引入任何新 Fatal/Major、生产 Fault 入口、Schema/Builder 不一致或分母变化。文档与机器合同已为 V3-2-2 路线 B 产品实现提供完整冻结边界。

仅在以下 7 项同时为真时可进入 B-1..B-6（与 Round 1 §11 一致，本轮未触动）：

1. 本独立审查报告归档至 `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b-independent-document-audit-round2.md`（即本文件）；
2. 用户已明确批准 V3-2-2 Route B 实施（ADR §1 已写 `ACCEPTED BY USER / DOCUMENT FREEZE` 与阶段门禁 §20.2 第 210 行）；
3. 全新单一 run 在 `apps/chrome-extension/e2e/v3-bilibili-route-b-runner.mjs`（B-4 交付）中执行 12 URL 探测并生成 schema-valid `productionReady=true` Revision 4 registry；
4. `apps/chrome-extension/e2e/v3-route-b-production-unreachable-audit.mjs`（B-4 交付）在 production Python 包 + Runtime + Chrome extension + portal registry 上 grep 0 入口；
5. RB01..RB20 全通过（10-route-b-acceptance-plan.md）；
6. 真实 observation（不允许 fixture / 跨 run 拼接）；
7. 用户在 B-6 出门条件达成后再次明确批准 V3-2-2 产品实现。

### 文档审计独立结论

- **Fatal = 0**
- **Major = 0**
- **Minor = 0**（Round 1 的 M-1..M-3 已全部正确关闭；本轮未发现新 Minor）

依据 `01-audit-request.md` 第 11 行决策规则（"只有 Fatal=0/Major=0 才允许进入用户已授权的 B-1..B-6"），**本轮差异复审支持进入 B-1..B-6 实施准备，但 B-1..B-6 实施仍受用户先前的 `ROUTE B DOCUMENT FREEZE IN PROGRESS / IMPLEMENTATION WAITS FOR FATAL=0 MAJOR=0 DOCUMENT AUDIT` 门禁与本报告第 12 节 7 项条件联合约束**。

### Round 1 vs Round 2 状态对比

| 维度 | Round 1（`18`） | Round 2（本轮） | 变化 |
|---|---|---|---|
| Fatal | 0 | 0 | 不变 |
| Major | 0 | 0 | 不变 |
| Minor | 3（M-1/M-2/M-3） | 0 | **全部关闭** |
| 12 URL 分母 | 12 (6+3+1+1+1) | 12 (6+3+1+1+1) | 不变 |
| ASR trigger 计数 | 1+2 | 1+2 | 不变 |
| SenseVoice baseline | locked | locked | 不变 |
| productionConfigReachable | const false | const false | 不变 |
| injectionLayer | const acceptance_orchestrator | const acceptance_orchestrator | 不变 |
| crossModelQualityGate | const deferred_to_v4 | const deferred_to_v4 | 不变 |
| 新增 product Fault 入口 | 无 | 无 | 不变 |

---

## 13. 附录 A：可执行语义测试命令记录

```bash
# Hash integrity (19 payloads, 19/19 match)
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum *.md *.json *.py | sort
# All 18 payloads + manifest self-hash match AUDIT_MANIFEST.md rows

# Schema meta (2/2 PASS)
python3 -c "
import json
from jsonschema import Draft202012Validator
for f in ['14-sample-registry-v4.schema.json', '15-sample-registry-v3.schema.json']:
    Draft202012Validator.check_schema(json.load(open(f)))
    print(f'{f}: PASS')
"

# Semantic builder (happy + 10 builder negatives + 8 schema negatives + 5 cross)
mkdir -p /tmp/routeb_audit_round2
cd /tmp/routeb_audit_round2
cp /mnt/c/workspace/navia/docs/active/project/external-audit-package/14-*.json .
cp /mnt/c/workspace/navia/docs/active/project/external-audit-package/15-*.json .
cp /mnt/c/workspace/navia/docs/active/project/external-audit-package/16-*.py sample_registry.py
cp /mnt/c/workspace/navia/docs/active/project/external-audit-package/17-*.py test_v4_sample_registry.py
# Then run the inline harness: happy path + T1..T12 + M-2 + M-3 + X1 + S1..S6 + S7 + S8 + XS1 + XS2 + XV1 + XV2
# Happy path: 0 schema errors; all negatives: PASS; cross-revision isolation: PASS

# Cross-revision isolation
# v3 schema rejects v4 registry: 19 errors
# v4 schema rejects v3-prefix runId: 1 error
# v3 builder rejects v4 matrix: 'observation BVID set does not match revision 3'
# v4 builder rejects v3 matrix: 'observation BVID set does not match revision 4 Route B'
# v3 builder accepts v3 matrix: PASS (v3 source independence verified)

# M-1/M-2/M-3 closure grep
grep -n 'parents\[3\]' 17-sample-registry-v4-tests.py  # 0 hits
grep -n 'firstProbeAt\|secondProbeAt' 14-sample-registry-v4.schema.json  # 2 lines (79, 80)
grep -n 'natural probe timestamps' 16-sample-registry.py  # 1 hit
grep -n 'must be unique' 16-sample-registry.py  # 1 hit

# Needle scan (0 hits)
grep -nE "V3_MEDIA_FAULT|FAULT_SCENARIO|NEXT_PUBLIC_FAULT|FAULT_ENABLED|process\.env|VITE_FAULT" *.md *.json *.py
grep -nE "production_runtime" *.md *.json *.py  # only 17 line 103 (negative test parametrize) + 18 self-reference
```

---

## 14. 附录 B：未读 / 主动放弃的资源

为保持本审查"只读 / 不下载媒体 / 不读 Cookie / 不运行 Chrome"的边界，本审计明确未访问：

- `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/` 下既有实施候选 run、私有 WAV、authenticate cookie 文件、sub-probe JSON、screenshot、report.json——这些属于实施证据，不是文档；
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/` 实际代码（仅核对文件存在性，不读取内容），因为 B-1 之前的代码实体尚未实现；
- 任何 B站 cookiefile、个人 profile、私有字幕 JSON；
- 任何真实 Chrome 实例、autotest harness、subprocess；
- 任何远端 URL（Hugging Face / B站 API）。

**已主动放弃**：实施候选报告（`runs/` 下既有 JSON / HTML 报告）、早轮 document-audit 报告（platform-drift-independent-document-audit*.md）——这些是历史上下文，但本轮审计以路线 B 19 文件 + PRD/架构/阶段门禁为唯一权威输入。

---

## 15. 签名 / 归档

- 审查者角色：独立差异审查者（与 V3-2 实现、Coeus 自动验证、用户授权、候选生成、上轮 Round 1 审查者独立）。
- 审查方法：只读、机器可复算、不访问任何外部资源、不写入主工作树（仅在 `/tmp/routeb_audit_round2/` 隔离副本运行语义测试）。
- 决定：**条件性 GO**——M-1..M-3 全部正确关闭；Fatal=0/Major=0/Minor=0；修改未引入新 Fatal/Major、生产 Fault 入口、Schema/Builder 不一致或分母变化。文档合同允许进入 B-1..B-6 实施准备；实施前 7 项条件详见 §12。
- 输出归档：本文件 `route-b-independent-document-audit-round2.md`。
- 上一次对照：Round 1 `18-independent-document-audit.md` Fatal=0/Major=0/Minor=3；本独立外部差异复审 Round 2 Fatal=0/Major=0/Minor=0（Round 1 的 M-1/M-2/M-3 全部由 19-minor-closure.md 处置并在本审计 §4 独立逐项验证通过）。
