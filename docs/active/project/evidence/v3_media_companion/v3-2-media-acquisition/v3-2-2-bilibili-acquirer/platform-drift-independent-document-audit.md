# V3-2-2 Revision 3 Amendment 1 独立只读文档审查报告

日期：2026-10-06
审查者：独立只读文档审查者（不运行任何产品 / Runtime / Chrome / 下载器 / 模型）。
审查性质：只读独立文档与合同审查。
审查范围：`docs/active/project/external-audit-package/` 全部 19 项载荷，外加同目录 `AUDIT_MANIFEST.md` 自身。
审查目标：V3-2-2 Revision 3 Amendment 1 文档候选（含平台漂移重规划、sample matrix、合同、Schema 与生成器）。
审查方法：重新计算 SHA-256、独立解析 14 号 Schema（Draft 2020-12 meta）、逐文件交叉对照请求的 7 个固定问题与 PRD §18.4–§18.9、Stage Gate §19、Development/Acceptance/Threat Model、Sample Matrix、Platform Drift Replan、Pre-implementation Audit、Sample Registry v3 Schema、生成器与测试、候选 JSON、历史独立审查，并显式核对 Cookie/profile/原始 body 是否进入公开载荷。

---

## 0. 文档完整性 — 19 项载荷 SHA-256 独立重算

独立重算 `external-audit-package/` 下 19 项载荷字节级 SHA-256，与 `AUDIT_MANIFEST.md` 第 7–25 行声明值逐一比对，**全部匹配**。下表为本次独立计算结果（与 manifest 完全一致）：

| # | File | SHA-256 (重算) | Manifest 一致 |
|---|---|---|:---:|
| 01 | `01-audit-request.md` | `3dd14f1ba617f72d770ccae3f5437a8d4d4afeef1c0618596c6a4708ba712443` | ✅ |
| 02 | `02-prd.md` | `2ce4ccb767089eb6170407dae25c6e07bed07e3e6716536548fefe12a367dfa1` | ✅ |
| 03 | `03-architecture.md` | `dd74d85c86a488fd6eedd08f8433f13f4a90b94cd3db9316abbcbdfb8c98031f` | ✅ |
| 04 | `04-development-plan.md` | `b217c3cb39cf5317902d1a8e2cff9e1641292883cedb6ade6d367d95c89fd137` | ✅ |
| 05 | `05-acceptance-plan.md` | `a59c3ff020110cfe3ee4401066b71d56384ed9f8a3bd490c86c6909fbd7dcf48` | ✅ |
| 06 | `06-stage-gate.md` | `d2647b33ba1a42453309ce9292537737fa5963a4aff6124184ad5e66d7a0b517` | ✅ |
| 07 | `07-v3-development-acceptance-plan.md` | `e0dd7e2de0d5f49f71dd40d478182fdba9f6b1ad5ecc2ebacb8bbf941a58f8c0` | ✅ |
| 08 | `08-v3-2-2-development-plan.md` | `c922a58852ce75fd4b757186b71396d44934d0ac3fbb1a14dca30ffd3e3548e6` | ✅ |
| 09 | `09-v3-2-2-acceptance-plan.md` | `4b7c048e013a20b9692935d507ad5ce5ab28d63cf7b872a1a8d150fd9b4e07dc` | ✅ |
| 10 | `10-v3-2-2-threat-model.md` | `de99ec2e24d0e390642a390517eb330588bffae969cd5652ab7736d8c60dace0` | ✅ |
| 11 | `11-revision3-sample-matrix.md` | `069edfef205280d77d09367d865e4104e071bbf8793423b6f6f30364c4c63a3c` | ✅ |
| 12 | `12-platform-drift-replan.md` | `527be23c4e4c0623c58b4d06642ca71958b51cfbeb634d24a10aec4c572dea7e` | ✅ |
| 13 | `13-preimplementation-audit.md` | `fb64daed1955ca00d4e8bd8692b66c91fbaebe65f43e6c3c31cca58c0736f7c5` | ✅ |
| 14 | `14-sample-registry-v3.schema.json` | `12f0978a190109560f16a6b496b07430a93e3266492063a33c11cbf5a7f6bdcb` | ✅ |
| 15 | `15-sample-registry.py` | `5b7f565f432343eeff8dd137a708eaa6c3fc4c867dc3c670c400d23249d9f605` | ✅ |
| 16 | `16-sample-registry-tests.py` | `fc55824a0a27b731e5d64a50a9a47112081a82b848d0b97164f96c2f3095dba8` | ✅ |
| 17 | `17-production-candidates.json` | `187d645060896c31862ab911d53a2887a3f2a81203ab656f1df963d7be184382` | ✅ |
| 18 | `18-discovery-candidates.json` | `e713b68e383736f3880aabedf258437116d4fda06de2e45b0cc0b3236ccaff5f` | ✅ |
| 19 | `19-previous-independent-audit.md` | `707eb2e37e75def8f822377ae1ab5de72bffec3c792fcf108f0ede8b6090e1d7` | ✅ |

`AUDIT_MANIFEST.md` 自身按惯例不列入自身表格，但其声明的 19 项载荷值与磁盘文件一一对应，载荷计数 19 与 manifest 表行数一致；3 份 JSON（14/17/18）经 Python `json.load` 全部解析通过。

---

## 1. Schema 与生成器 meta 校验

| 项 | 结果 |
|---|---|
| `14-sample-registry-v3.schema.json` `$schema` | `https://json-schema.org/draft/2020-12/schema` ✅ |
| `Draft202012Validator.check_schema()` | PASS ✅ |
| 根 `required` | `schemaVersion / revision / supersedesRevision2Artifact / runId / buildTreeSha256 / dependencyManifestSha256 / modelManifestSha256 / browser / credentialEvidenceClass / createdAt / classificationCounts / asrBaseline / productionReady / samples`（14 项） ✅ |
| `classificationCounts` | `subtitle:6 / asr:3 / multipart:1 / restricted:1 / lowSignal:1`（全部 `const`） ✅ |
| `samples.min/maxItems` | `12 / 12` ✅ |
| `Sample.required` | 18 项，含 `sampleId / url / adapterId / mediaId / playbackUnitId / partId / partIndex / partCount / durationSeconds / primaryClass / expectedOutcome / expectedRouteClass / subtitleEvidence / observedAt / pageContextSha256 / serverProbeSha256 / authorizedProbe / screenshot`；**不含** `comparisonWindow / reviewer / adjudication` 字段 ✅ |
| `Sample.primaryClass` `enum` | `["subtitle", "asr", "multipart", "restricted", "low_signal"]`（不含 `subtitle_anchor`） ✅ |
| `Sample.allOf` 条目数 | 5 条：`subtitle→success+subtitle`、`asr→success+asr+subtitleEvidence=none`、`multipart→success+partCount>=2+subtitle\|asr`、`restricted→blocked+restricted`、`low_signal→degraded` ✅ |
| `asrBaseline.crossModelQualityGate` | `deferred_to_v4`（`const`） ✅ |
| `browser.majorVersion` | `minimum: 116` ✅ |
| `Sha256` 正则 | `^[a-f0-9]{64}$` ✅ |
| `RelativeArtifactPath` 模式 | 拒绝 `/` 开头与 `..` 穿越 ✅ |
| `15-sample-registry.py` | `_require_sha256()` 强制 64 位小写十六进制；`viewResponseSha256=None` 由 `_require_sha256` raise；`subtitleItems` 与 `subtitleHtmlContributorExcerpt` 任一非空即拒绝 asr；`_route_for()` 对 subtitle 要求 `subtitleItems` 非空，对 asr 同时拒绝 items 与 contributor，对 restricted 要求 `{"充必备", "即可观看"}` 触发，对 low_signal 直接 `degraded/none/[degraded]`。 |
| `16-sample-registry-tests.py` | 9 个测试覆盖：registry schema-valid+denominator、过期会话拒绝、缺失/多余 observation 拒绝、锚点 required current subtitle items、subtitle 样本要求 current API item、ASR 拒绝平台新增字幕、`viewResponseSha256=None` 拒绝、profile class 必须 `user_authorized_temporary_v3_2`。 |
| `productionReady` | `const: true`（根级必填，但生成器仅在所有约束通过时输出；当前 19 项载荷中不包含 production registry 实测件，符合"先文档后运行"顺序） ✅ |
| `17-production-candidates.json` 与 `11-revision3-sample-matrix.md` BVID 集合 | 完全一致（12 唯一 URL），class 集合一致（6+3+1+1+1） ✅ |
| `17-production-candidates.json` 中 BV1ZpYd66ELP 的 `intendedClass` | `"subtitle_anchor"`（候选层 meta），与 `11-revision3-sample-matrix.md` `primaryClass="subtitle"` 不冲突——前者是 discovery/intended，后者是 production registry；schema primaryClass enum 不接受 `subtitle_anchor`，因此 production 构造时必须映射为 `subtitle` ⚠ Minor（见 §4） |

---

## 2. 七个固定问题的逐项回答

### Q1 — 锚点保留但由 ASR 改为 subtitle，是否与当前真实平台事实、PRD 用户目标和 Revision 3 边界一致？

**答：PASS。**

- `02-prd.md` §18.4（line 2284）：*“固定锚点 `BV1ZpYd66ELP` 必须保留为必测页面，其路线以同一生产 run 的当前平台事实为准。2026-10-06 有效授权探测已观测到 3 个 API 字幕项，因此 Revision 3 Amendment 1 将其归入字幕路径，禁止强制 ASR 或沿用匿名旧结论。”*
- `02-prd.md` §18.9（line 2394）：Revision 3 保留 12 个唯一 URL 与 `6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal`，与锚点 subtitle 化后 count 完全一致：6+3+1+1+1 未缩分母。
- `06-stage-gate.md` §4（line 41–44）：锚点 `BV1ZpYd66ELP` 在 2026-09-17 匿名态观测为 `subtitleItems=0`、2026-09-18 授权态出现 4 项、2026-10-06 再次观测到 3 项；§19 明确 Amendment 1 决定。
- `11-revision3-sample-matrix.md` line 13：锚点 `BV1ZpYd66ELP` 当前 `primaryClass = subtitle`；line 20：*“任一 subtitle 项为空或任一 ASR 项出现字幕都 fail closed，不得跨 run 拼接”*——这与 Q4 的 fail-closed 闭环一致。
- `12-platform-drift-replan.md` §1 与 §3：*“原 ASR 锚点 `BV1ZpYd66ELP` 出现 3 个 API 字幕项…Amendment 1…锚点保留但改为 subtitle”*——锚点 URL 保留、分类改为 subtitle 是真实平台事实驱动，且 Revision 3 schema 没有任何 `subtitle_anchor` 之外的特例。
- 15 号生成器的 `_route_for()` 对 subtitle 强制要求 `subtitleItems` 非空，因此下一次全新 run 若再次观察到 `BV1ZpYd66ELP` 的 API 字幕项为空，仍会以 `SampleRegistryError("no current subtitle items")` fail closed，不会因锚点保留而放行假绿。
- 未发现 Amendment 1 把锚点移出 12 页分母或悄悄绕过 PRD §18.4 “禁止强制 ASR”的硬约束。

### Q2 — 是否仍严格保持 12 个唯一 URL 与 `6+3+1+1+1`，没有缩小分母或跨 run 拼接？

**答：PASS。**

- `17-production-candidates.json`：12 个唯一 BVID（`BV1yLuwzpEt2 / BV1VG4117775 / BV1Bt411D78C / BV1CiFMenEye / BV1Fh1VYFEDu / BV1ZpYd66ELP / BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh / BV1PA4m1w7ya / BV1vt1sBgEzc / BV1goA2zrEEq`），URL 全部 `https://www.bilibili.com/video/BV…`；交叉对比 `11-revision3-sample-matrix.md` 12 行 BVID 完全相同。
- `11-revision3-sample-matrix.md` line 6–19：12 行表格固定；line 5 状态 `AMENDMENT 1 CANDIDATE / SINGLE-RUN REPROBE PENDING`；line 20：*“生产判定只接受修订后 12 项在同一全新 run 的结果”*。
- `14-sample-registry-v3.schema.json` line 73–74：`samples.minItems=12, maxItems=12`；line 47–54：`classificationCounts` 5 个数值全部 `const`（6/3/1/1/1），schema 层面不可缩分母。
- `12-platform-drift-replan.md` §3：固定分母与锚点改为 subtitle，ASR 固定为 `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh`，三个不重复占位。
- `12-platform-drift-replan.md` §4：*“分类再次漂移即整个 run 作废并回到计划阶段；不改阈值、不强制路线、不拼接旧 run”*；*“Cookie 值不写入本记录、日志、registry 或公开审计包”*。
- `09-v3-2-2-acceptance-plan.md` BA02（line 8）：*“12 唯一 URL，6+3+1+1+1，identity/part/page/server/screenshot hash 可复算；锚点当前为 subtitle；任一分类漂移即整体失败”*。
- `05-acceptance-plan.md` §8.20.5（line 2077）：*“mock/fixture/BiliNote 输出计生产分母；跨 run；缩分母”* 列入拒绝项，与 Q2 一致。
- 19 号 `19-previous-independent-audit.md` 旧结论：*“Document PASS / Implementation NO-GO”*；本审计包现用 Amendment 1 替换原文，旧 run 不参与新 run，分母无变化。

### Q3 — 三个 ASR 候选是否有真实发现证据，且第三个短样本是否符合低资源目标？

**答：PASS。**

- `12-platform-drift-replan.md` §2 三段候选发现：
  1. `v3-2-asr-candidate-refresh-20261006T091000Z`：确认 `BV1sMNtzJE5B` 与 `BV1Bb411w741` 当次无字幕。
  2. `v3-2-asr-platform-drift-discovery-20261006T093000Z`：发现 `BV13W41137qV` 时长约 9412 秒，**不符合低资源验收目标**——被显式拒绝作为第三个候选。
  3. `v3-2-asr-short-candidate-discovery-20261006T094000Z`：确认 `BV17x411i7Kh` 当次无字幕、时长约 256 秒，作为第三个低资源 ASR 候选。
- `11-revision3-sample-matrix.md` line 14–16：ASR 三项固定 `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh`。
- `18-discovery-candidates.json`：discovery-only 候选清单（`schemaVersion: v3-media-acquisition-probe-candidates/v1` / `purpose: platform_drift_candidate_discovery_only`），含 `BV17x411i7Kh`（source=`public_search_no_subtitle`），与 `BV13W41137qV`（在清单 line 11）、`BV1A44y1L7eS / BV1BW41167UU / BV1CW411M7Du / BV1Xa411P7iB / BV1pW421c7DH / BV13XH6ejEWL` 等短候选共 8 个——明确把发现证据与 production 判定隔离。
- `12-platform-drift-replan.md` §2 末行：*“候选 run 只证明可选样本，不得跨 run 组成生产证据”*——与 Q2 的"不跨 run 拼接"形成闭环。
- `14-sample-registry-v3.schema.json` 与 `15-sample-registry.py` 对 ASR 项的约束：subtitleEvidence 必为 `"none"`（const）+ `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 任一非空即拒绝（`_route_for()`），由此下一个全新 12 页 run 必须再次确认 `BV17x411i7Kh` 当次仍为 0 subtitle items 才能维持 ASR 路径。
- 关于第三个样本的“低资源”目标：Schema 的 `durationSeconds` 仅约束 `exclusiveMinimum: 0`，没有强制上限；256 秒的"低资源"特征仅由 `12-platform-drift-replan.md` 与 `11-revision3-sample-matrix.md` 叙述约束，schema 不机械勾取；**这意味着运行可能会卡 256 秒的上限，这是一处 Minor 风险**——新 run 若发现 `BV17x411i7Kh` 时长实际为 800 秒，仍能通过 schema，但不符合低资源叙述。修订建议（不属本次范围）：要么在 schema 增加 ASR 时长上限 const，要么在 sample matrix 表格附注"audit 复核时长 ~256 秒"。

### Q4 — 字幕分类是否以 API `subtitleItems` 为准；ASR 是否拒绝任一新增字幕？

**答：PASS。**

- `12-platform-drift-replan.md` §4 防假绿：
  - *“subtitle 必须有当次 API `subtitleItems`，不能只看 DOM 的"字幕"文本”*。
  - *“ASR 必须同时满足 API 字幕项为 0、页面字幕制作者标记为空”*。
- `14-sample-registry-v3.schema.json` line 147–148（`Sample.allOf`）：`primaryClass=asr` ⇒ `expectedOutcome=success / expectedRouteClass=asr / subtitleEvidence="none"`（const）。
- `15-sample-registry.py` `_route_for()` line 62–69：
  - subtitle：`observation.get("subtitleItems")` 必非空；缺失抛 `no current subtitle items`。
  - asr：`observation.get("subtitleItems")` 与 `observation.get("subtitleHtmlContributorExcerpt")` 任一非空即抛 `is no longer a no-subtitle ASR sample`。
- `16-sample-registry-tests.py`：
  - `test_anchor_requires_current_subtitle_items`：锚点 `BV1ZpYd66ELP` `subtitleItems=[]` → 抛 `no current subtitle items`。
  - `test_subtitle_sample_requires_current_api_item`：首个 observation `subtitleItems=[]` → 抛 `no current subtitle items`。
  - `test_asr_sample_rejects_platform_added_subtitle`：ASR 样本 `BV1sMNtzJE5B` 的 `subtitleItems` 增 `late-caption` → 抛 `no longer a no-subtitle ASR sample`。
- `09-v3-2-2-acceptance-plan.md` BA07（line 13）：*“6/6 当次 API subtitleItems 非空并取得真实字幕 body；有序非空 segment，时间在媒体范围内，source/hash 闭合”*——与 schema + sample generator 一致。
- 不存在把 DOM 文本（如"字幕制作者"DOM）冒充成 subtitle evidence 的旁路；subtitleEvidence enum 限定为 `credentialed_api_item / public_api_item / page_player_item / none / restricted`。

### Q5 — raw probe 的 view/player response hash 字段是否真实映射并 fail closed，是否仍有 `null` 派生 hash 假绿？

**答：PASS。**

- `12-platform-drift-replan.md` §4：*“view/player 响应 SHA-256 必须读取真实 probe 字段并通过格式校验，禁止对 `null` 做派生 hash”*。
- `15-sample-registry.py`：
  - `_require_sha256()` line 55–58：非 64 位小写十六进制即抛 `must be a lowercase SHA-256`。
  - `server_probe["viewApiResponseSha256"] = _require_sha256(observation.get("viewResponseSha256"), …)` line 152–154——`observation` 缺字段或类型非字符串将抛错。
  - `server_probe["playerApiResponseSha256"]` 同样 `_require_sha256()` line 157。
  - `page_context_sha256` 与 `server_probe_sha256` 均通过 `sha256_json(canonical_json(...))` 由真实字段构造，禁止手工注入。
  - `authorized_probe["probeSha256"]` line 169–174：由 `{sessionProbeSha256, pageContext, serverProbe, routeAvailability}` 的 canonical JSON 计算，依赖完整字段。
- `16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields` line 122–126：raw probe `observations[0]["viewResponseSha256"] = None` → 抛 `viewResponseSha256`。
- `14-sample-registry-v3.schema.json` `Sample.required`：`pageContextSha256 / serverProbeSha256 / authorizedProbe.probeSha256 / screenshot.sha256` 全部 `#[0-9a-f]{64}`，`$ref: "#/$defs/Sha256"`。
- 15 号生成器中**不存在**任何对 `null` 的派生哈希或默认占位；任何字段缺失或类型错即抛 `SampleRegistryError`，由 16 号测试守住。
- 不存在把 view/player response body 本身写入 registry（`server_probe` 只保留 `navigationStatus / pageStateCode / viewApiCode / playerApiCode / viewApiResponseSha256 / playerApiResponseSha256`，不含 raw body），与 §6 隐私闭环。

### Q6 — 当前是否只允许执行全新单 run 12 页 probe，而不允许进入 acquirer、ASR 或后续实现？

**答：PASS。**

- `13-preimplementation-audit.md` §允许范围：*“允许执行 Amendment 1 合同测试、单一全新授权 Chrome 12 页 probe、Revision 3 候选生成与只读验证。禁止启动 V3-2-2 acquirer 产品实现、V3-2-3 ASR 或后续阶段，直到 Revision 3 候选通过独立审计”*。
- `06-stage-gate.md` §19（line 187–189）：*“AMENDMENT 1 DOCUMENT RE-AUDIT / IMPLEMENTATION NO-GO…H01..H10 只在 V3-5 自动 UI 门槛通过后执行；V3-2..V3-4 不请求人类操作”*。
- `06-stage-gate.md` §1 状态行：*“V3-2-1 LIMITED PASS / V3-2-2 DOCUMENT PASS + IMPLEMENTATION NO-GO / V3-2-3..V3-7 NOT_IMPLEMENTED”*——与 §19 一致。
- `01-audit-request.md` 行 21：*“不得把文档通过扩大为 V3-2-2 implementation PASS”*——明确拒绝实施放行。
- `12-platform-drift-replan.md` §5：*“Amendment 1 定向测试与 Runtime 回归通过，内部/外部文档审查 Fatal=0/Major=0，然后执行全新单 run 12 页探测。只有该 run 可生成 Revision 3 productionReady 候选”*。
- `08-v3-2-2-development-plan.md` §4 禁止项：*“不实现 ASR、tabCapture、关键帧/OCR/VLM、VideoOutline、Ask 或导出；不接收用户 URL；不下载其他分 P；不读取浏览器 profile；不保存长期 Cookie；不自动重试已过期 lease；不把受限样本转成成功”*——与 §6 的实施边界一致。
- `09-v3-2-2-acceptance-plan.md` BA12–BA16：URL/adapter 拒绝、downloader 故障封闭、取消竞态、公私证据扫描、回归审计——这些是运行期条款，本审查为只读文档审查，不得在本次范围内执行。
- 审计边界严格：本次审查**只读** 19 项载荷 + Schema 解析 + SHA-256 重算 + 单元测试模拟运行（15/16 号脚本未实际生成 registry 实例，只验证生成器逻辑），未运行任何真实 Chrome / Runtime / 下载器 / 模型。

### Q7 — Cookie、profile、原始 API body 和私有路径是否保持在公开审计边界之外？

**答：PASS。**

- `12-platform-drift-replan.md` §4：*“Cookie 值不写入本记录、日志、registry 或公开审计包；临时 Chrome profile 必须清理”*。
- `17-production-candidates.json` 与 `18-discovery-candidates.json`：只含 `url / intendedClass / source` 字段，无 Cookie、profile、原始 body、绝对路径。
- `14-sample-registry-v3.schema.json` `RelativeArtifactPath` 模式：`^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._/-]+$`——拒绝绝对路径与穿越。
- `15-sample-registry.py` line 160–161：screenshot 路径以 `/` 开头或含 `..` 抛 `screenshot path is invalid`。
- `15-sample-registry.py` line 47–48：`_canonical_json` 仅使用 SHA-256 与 type-stable 序列化，原始 API body 与 Cookie 值不进入输出。
- `15-sample-registry.py` `server_probe` 只保留 `viewApiCode / playerApiCode / viewApiResponseSha256 / playerApiResponseSha256`（哈希而非 body），与 `09-v3-2-2-acceptance-plan.md` BA15（line 21）：*“Cookie 值、token、cookiefile/媒体绝对路径、原始字幕 body 0 命中”* 一致。
- `10-v3-2-2-threat-model.md` 表格 line 6–7：*“Cookie 泄漏到 argv/log/evidence / Cookie 泄漏…值只在进程内 lease 和随机 0600 cookiefile；redactor；公开 ref 无 path”*——威胁模型与控制条目把 Cookie 隔离在进程内 lease + 私有 cookiefile，公开 ref 仅含相对路径。
- `13-preimplementation-audit.md` §允许范围：*“授权 Cookie 只由用户临时提供且不得进入公开证据”*。
- 本次审查独立通读：`scripts/` `pwd` / `temp_profile` / `cookies` 全文检索 19 项载荷 0 命中（`/mnt/c/workspace/navia/docs/active/project/external-audit-package`）；screenshot 路径在 17 号 JSON 与 15 号生成器中均为相对路径。
- 不存在把授权 Cookie 值写进日志、registry 或公开审计包的旁路；临时 Chrome profile 由 12 号文档明令清理（line 27），与 `06-stage-gate.md` §1 “profile/进程已清理”历史观察一致。

---

## 3. 跨文档一致性专查

| 关注点 | 一致来源 |
|---|---|
| 锚点保留 + 分类改为 subtitle | `02-prd.md` §18.4（line 2284）；`06-stage-gate.md` §4 + §19；`11-revision3-sample-matrix.md` line 13 + line 20；`12-platform-drift-replan.md` §1 + §3；`13-preimplementation-audit.md` §审计检查 1 |
| 12 唯一 URL + 6+3+1+1+1 | `11-revision3-sample-matrix.md` line 6–19；`14-sample-registry-v3.schema.json` `samples` / `classificationCounts`（全部 const）；`17-production-candidates.json`（12 项）；`09-v3-2-2-acceptance-plan.md` BA02；`05-acceptance-plan.md` §8.20.5 |
| ASR 三项 `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh` | `11-revision3-sample-matrix.md` line 14–16；`12-platform-drift-replan.md` §2（v3-2-asr-candidate-refresh/short-candidate-discovery run）；`17-production-candidates.json` line 11–13；`15-sample-registry.py` `SAMPLE_MATRIX` line 28–30 |
| 256 秒 vs 9412 秒 | `12-platform-drift-replan.md` §2（line 12 + line 13）；`18-discovery-candidates.json` line 11（BV13W41137qV 不进 production） |
| `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 双闸 | `12-platform-drift-replan.md` §4；`14-sample-registry-v3.schema.json` Sample.allOf；`15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` 三个相关测试 |
| view/player response hash 真实映射 + fail closed | `12-platform-drift-replan.md` §4；`15-sample-registry.py` `_require_sha256` + `server_probe`；`16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields`；`14-sample-registry-v3.schema.json` Sha256 + Sample.required |
| 单 run 12 页、不跨 run 拼接、不允许 acquirer/ASR 实施 | `01-audit-request.md` 行 21；`13-preimplementation-audit.md` §允许范围；`06-stage-gate.md` §1 + §19；`12-platform-drift-replan.md` §4 + §5；`08-v3-2-2-development-plan.md` §4 禁止项；`09-v3-2-2-acceptance-plan.md` BA12/BA15/BA16 |
| Cookie/profile/body 隐私隔离 | `12-platform-drift-replan.md` §4；`10-v3-2-2-threat-model.md` 表 + line 17；`13-preimplementation-audit.md`；`09-v3-2-2-acceptance-plan.md` BA15；`14-sample-registry-v3.schema.json` `RelativeArtifactPath`；`15-sample-registry.py` line 160–161 |
| H01..H10 推迟到 V3-5 | `02-prd.md` §18.9（line 2396）；`06-stage-gate.md` §3 + §19；`07-v3-development-acceptance-plan.md` §7；`04-development-plan.md` §18.1（从 §18.2 反推） |
| 旧失败 run 不拼接 | `12-platform-drift-replan.md` §2 末行 + §4；`11-revision3-sample-matrix.md` line 20；`19-previous-independent-audit.md` §7（历史保留） |
| SenseVoice baseline | `14-sample-registry-v3.schema.json` asrBaseline；`02-prd.md` §18.9；`06-stage-gate.md` §17 |
| cross-model 移到 V4 | `14-sample-registry-v3.schema.json` asrBaseline.crossModelQualityGate=const `deferred_to_v4`；`02-prd.md` §18.9；`12-platform-drift-replan.md` §1（综述） |

未发现文档间显式冲突或双轨事实。

---

## 4. 发现

### 4.1 Fatal
无。

### 4.2 Major
无。

### 4.3 Minor

- **m-1（候选层 meta 与 Production tier enum 命名不一致）**：`17-production-candidates.json` line 9 把 `BV1ZpYd66ELP` 的 `intendedClass` 标为 `"subtitle_anchor"`，但 `14-sample-registry-v3.schema.json` 的 `primaryClass` enum 仅含 `["asr","low_signal","multipart","restricted","subtitle"]`；候选层 meta 与 production tier 之间没有显式映射表，由 `11-revision3-sample-matrix.md` line 13 与 `15-sample-registry.py` `SAMPLE_MATRIX` line 27 的 `primary_class="subtitle"` 隐性承接。修订建议（不属本次范围）：在 17 号 JSON 增加 `productionMarker: "subtitle"` 字段，或在生成器注释中明确"candidate `subtitle_anchor` ⇒ schema `subtitle`"。本审查认可 11 号 matrix 与 15 号生成器已正确承接，未发现 production 假绿风险。
- **m-2（第三个 ASR 样本"低资源"特征未在 Schema 强制）**：`12-platform-drift-replan.md` §2 + `11-revision3-sample-matrix.md` line 16 叙述 `BV17x411i7Kh` 时长约 256 秒以满足低资源验收目标，但 `14-sample-registry-v3.schema.json` 的 `Sample.durationSeconds` 仅 `exclusiveMinimum: 0`，没有 ASR 类上限 const。修订建议（不属本次范围）：在 Sample.allOf 中对 `primaryClass=asr` 增加 `durationSeconds` 的最大值约束；或在 sample matrix 表附 audit-only 复核规则。下一次全新 run 若观测到 `BV17x411i7Kh` 时长实际为 800 秒，仍能通过 schema，但与叙述"低资源"目标不符，需要在审计回读 raw probe 字段时人工复核。
- **m-3（首次载入时的旧"anonymous ASR 路径"叙述与 Amendment 1 锚点分类可能造成双轨解读风险）**：`06-stage-gate.md` §4（line 41–44）的锚点叙述仍以 2026-09-17 匿名态"subtitleItems=0"为主叙述，Amendment 1 改写出现在 §19；旧 run 与新 run 在同节并列且没有显式版本边界。修订建议（不属本次范围）：在 §4 锚点段尾加注"2026-10-06 Amendment 1 起锚点 primaryClass 归 subtitle，详见 §19"；本审查认可 §19 的状态语句与 §1 状态行已明确覆盖。
- **m-4（旧独立审查文件 hash 与当前 manifest 不一致属预期，但应在文档中标注）**：`19-previous-independent-audit.md` 的旧 hash 表（如 line 13 的 `01-audit-request.md = d49d40d7…`）与 `AUDIT_MANIFEST.md` 当前声明值（`3dd14f1b…`）不一致——这是因为 Amendment 1 改写了 audit request 与多个载荷。但 `19-previous-independent-audit.md` 第 3–4 行明确说明审查范围为"另一份先前"载荷集合，且 §6–§7 显式给出 Amendment 1 重新执行条件。本审查认可历史证据保留 + manifest 替换是预期行为，不构成破坏，但读者可能误以为 19 号文件是当前包的旧镜像，建议在该语料加注"`docs/active/project/external-audit-package/` AUDIT_MANIFEST.md 当前声明值与本文件旧 hash 表不一致属预期"。

### 4.4 既有 Minor（继承自 `13-preimplementation-audit.md`）

- **m-0（字幕平台事实可能再次变化）**：`13-preimplementation-audit.md` §审计结论 line 9：*“Minor：1（B站字幕事实仍可能再次变化，已由同一 run fail-closed 门禁承接）”*。本审查认可该 Minor 由 15 号生成器的 `_route_for()` + 16 号三个字幕相关测试 + 12 号文档 §4 "分类再次漂移即整个 run 作废并回到计划阶段" 联合承接，未发现新增缺陷。

---

## 5. 允许 / 禁止边界（Amendment 1 文档 PASS 后）

### 5.1 允许（本审查通过后）

- 执行 Amendment 1 合同测试（包括但不限于 16 号 `16-sample-registry-tests.py` 已写明的 9 个测试场景）。
- 单一全新授权 Chrome 12 页 probe：仅限 `v3-2-sample-probe-<新时间戳>`，profile 必须为 `user_authorized_temporary_v3_2`，Chrome `majorVersion >= 116`，所有 12 页面在同一 run 探测完成。
- Revision 3 候选生成与只读验证：使用 `15-sample-registry.py` 的 `build_revision3_registry()` 生成 schema-valid candidate，仅做只读验证（不写入持久存储、不进入产品代码）。
- 内部/外部文档审查：本独立审查报告 + 用户明确批准 V3-2-2 单 run 实施。

### 5.2 禁止（仍 NO-GO）

- 启动 V3-2-2 acquirer 产品实现（含 `acquisition/bilibili/acquirer.py`、`acquisition/subtitle_resolver.py`、`coordinator.py` 等）。
- 进入 V3-2-3 ASR、V3-2-4 可信 tabCapture、V3-2-5..7 后续阶段。
- 进入 V3-3 / V3-4 / V3-5 / V3-6 / V3-7。
- 跨 run 拼接：旧失败 run `v3-2-sample-probe-20261006T120000Z` 或任何 discovery run 不得与新 run 拼接。
- 放松 `crossModelQualityGate=deferred_to_v4`。
- 把 H01..H10 提前到 V3-2..V3-4（人类操作只在 V3-5 自动门槛通过后执行）。
- 缩分母：6/3/1/1/1 必须保持；不允许删除任一项或跨样本占位。
- 持久化、记录、公开或写入证据的 Cookie 值、token、cookiefile/媒体绝对路径、原始字幕 body。
- 把"文档 PASS"扩大为 "V3-2-2 implementation PASS"。

### 5.3 全新单 run 12 页 probe 的允许条件

| 条件 | 来源 |
|---|---|
| `/x/web-interface/nav` 返回 `code=0/isLogin=true` | `12-platform-drift-replan.md` §1；`19-previous-independent-audit.md` §6 条件 1 |
| 全新临时 Chrome profile，profileClass=`user_authorized_temporary_v3_2` | `14-sample-registry-v3.schema.json` browser.profileClass；`15-sample-registry.py` line 110–112 |
| Chrome `majorVersion >= 116` | `14-sample-registry-v3.schema.json` browser.majorVersion；`15-sample-registry.py` line 113–119 |
| 12 唯一 URL 与 `6+3+1+1+1` 不变 | `14-sample-registry-v3.schema.json`；`11-revision3-sample-matrix.md` line 19 |
| 锚点 `BV1ZpYd66ELP` 当次再次观测到 `subtitleItems` 非空 | `15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` `test_anchor_requires_current_subtitle_items` |
| 三个 ASR 项 `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0 | `15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` `test_asr_sample_rejects_platform_added_subtitle` |
| view/player response SHA-256 由真实 probe 字段构造，非 null 派生 | `15-sample-registry.py` line 152–157；`16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields` |
| `productionReady=true` 仅在 schema-valid 与以上全部约束通过后由生成器输出 | `15-sample-registry.py` line 208；`14-sample-registry-v3.schema.json` |
| 同一全新 run 中所有 12 页必须一次性探测，禁止把失败 run 与新 run 拼接 | `12-platform-drift-replan.md` §4；`11-revision3-sample-matrix.md` line 20 |
| Cookie 值不写入记录、日志、registry 或公开证据；临时 profile 必须清理 | `12-platform-drift-replan.md` §4；`10-v3-2-2-threat-model.md`；`13-preimplementation-audit.md` |

只有上述条件全部满足且 `productionReady=true` 由生成器输出，新 run 才可作为 Revision 3 productionReady 候选进入再次独立实施出门审查。

---

## 6. 决定

- **Fatal**：0
- **Major**：0
- **Minor**：4（含既有 1 项 + 新增 3 项，新增 Minor 均为文档层 / 叙述层 nit，不构成实施阻塞）

### 6.1 文档决定

**AMENDMENT 1 DOCUMENT PASS**

依据：
- 19 项载荷 SHA-256 全部与 `AUDIT_MANIFEST.md` 声明值匹配。
- `14-sample-registry-v3.schema.json` 通过 `Draft202012Validator.check_schema()` meta 校验。
- 7 个固定问题全部 PASS（Q1 锚点 subtitle 化与 PRD §18.4 + 12 号 §3 一致；Q2 12 URL / 6+3+1+1+1 / 不跨 run 拼接由 schema const + 11 号 line 20 + 12 号 §4 共同保证；Q3 三个 ASR 候选真实发现 + 第三个 ~256 秒；Q4 subtitle 以 `subtitleItems` 唯一为准、ASR 拒绝任一新增字幕；Q5 view/player SHA-256 由真实字段 + fail closed；Q6 只放全新单 run 12 页 probe，禁止 acquirer/ASR 实施；Q7 Cookie/profile/body 隐私隔离）。
- 跨文档一致性专查无冲突。
- 缩分母 / 跨 run 拼接 / 人工提前 / 隐私泄漏专查未发现新增问题。

### 6.2 实施决定

维持 **`IMPLEMENTATION NO-GO`**。文档 PASS 不等于实施 PASS。`AMENDMENT 1 DOCUMENT PASS` 仅意味着：

1. 允许用户重新提交授权会话并执行全新单 run 12 页 probe；
2. 允许由 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选；
3. 必须等待再次独立实施出门审查 `Fatal=0/Major=0` 后，方可解除 NO-GO。

仍不得：
- 进入 V3-2-2 产品实现；
- 把 `productionReady=true` 候选声明为 "V3-2-2 implementation PASS"；
- 把"文档 PASS"扩大为"V3-2-2 通过"。

### 6.3 重新执行独立实施出门审查的条件（与 Amendment 1 同步）

1. 用户提供有效 B站 Cookie，`/x/web-interface/nav` 返回 `code=0/isLogin=true`（`12-platform-drift-replan.md` §1 已确认）。
2. 从零创建临时 Chrome profile（`profileClass=user_authorized_temporary_v3_2`，`majorVersion>=116`）并执行新 run `v3-2-sample-probe-<新时间戳>`。
3. 12/12 页面探测全部通过；锚点 `BV1ZpYd66ELP` 当次 `subtitleItems` 非空；三个 ASR 项 `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0。
4. view/player response SHA-256 由真实 probe 字段构造，全部为 lowercase 64-hex；`null` 派生 hash 不得出现。
5. 通过 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选，并通过再次独立实施出门审查 `Fatal=0/Major=0`。
6. 旧失败 run / discovery run 保留为失败证据，禁止任何形式的拼接。
7. Cookie 值不写入新 run 记录、日志、registry 或公开证据；临时 Chrome profile 必须清理。
8. 用户明确批准 `V3-2-2 single-run 12-page probe + productionReady candidate generation`。
9. H01..H10 仍不在本阶段恢复路径内；只接受 V3-5 自动 UI 门槛之后的唯一一轮人工签署。

### 6.4 全新单 run 12 页授权 probe 的允许性

**允许**，前提是 §6.3 条件 1–3、§6.3 条件 7、§6.3 条件 8 同时满足，并由 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选供再次独立审查。本审查不替用户授权、不预先判定新 run 是否通过——新 run 通过与否取决于真实 Chrome 探测与生成器输出。

---

## 7. 审查出口

- **AMENDMENT 1 DOCUMENT PASS**：V3-2-2 Revision 3 Amendment 1 文档包在 19 项载荷 SHA-256 一致、`14-sample-registry-v3.schema.json` Draft 2020-12 meta 校验通过、7 个固定问题全部 PASS、跨文档一致性无冲突的前提下，本独立审查接受为 `AMENDMENT 1 DOCUMENT PASS`。
- **AMENDMENT 1 IMPLEMENTATION NO-GO**：在 §6.3 全部条件满足、新 run schema-valid `productionReady=true` Revision 3 候选生成并再次独立外审通过前，V3-2-2 implementation 维持 `NO-GO`。
- **新 run probe 允许性**：**允许**在用户重新提交有效 B站 Cookie 后，由 `15-sample-registry.py` 驱动的全新单 run 12 页授权 Chrome probe + Revision 3 productionReady 候选生成；不允许任何 V3-2-2 acquirer、ASR、tabCapture、V3-3..V3-7 产品代码或调用；不允许把 H01..H10 提前；不允许跨 run 拼接或缩分母。

---

审查者声明：本次审查为只读审计，未运行任何产品 / Runtime / Chrome / 下载器 / 模型；未修改 `external-audit-package/` 以外的任何文件；未在审查过程中生成任何 schema-valid `productionReady=true` 实例；本次审查仅解析 Schema、调用 `check_schema()`、重算 SHA-256、运行 16 号单元测试场景的语义回放（生成器路径未实际执行生产实例）；本报告是审查的最终结论。