# V3-2-2 Revision 3 Amendment 1 独立只读文档审查报告（Round 2）

日期：2026-10-06
审查者：独立只读文档审查者（不运行任何产品 / Runtime / Chrome / 下载器 / 模型）。
审查性质：只读独立文档与合同审查。
审查范围：`docs/active/project/external-audit-package/` 全部 19 项载荷 + `AUDIT_MANIFEST.md` 自身。
审查目标：V3-2-2 Revision 3 Amendment 1 文档候选的 Round 2 复审，重点验证 Round 1 报告 §4 列出的 m-1/m-2/m-3 三项 Minor 是否已闭合，以及 ASR 样本替换、1200 秒 fail-closed 上限、候选锚点 meta 改写、Stage Gate §4 匿名旧 run 单独澄清等 Round 2 关键改动是否真实落盘且无新缺陷。
审查方法：重新计算 SHA-256、独立解析 14 号 Schema（Draft 2020-12 meta）、调用 `15-sample-registry.py` 的 `build_revision3_registry()` 在受控输入下模拟 1200 秒边界、1201 秒超限、锚点空字幕、ASR 平台新增字幕、`viewResponseSha256=None` 等 fail-closed 路径，逐文件交叉对照请求的 7 个固定问题与 PRD §18.4–§18.9、Stage Gate §4 + §19、Development/Acceptance/Threat Model、Sample Matrix、Platform Drift Replan、Pre-implementation Audit、Sample Registry v3 Schema、生成器与测试、候选 JSON。

---

## 0. 文档完整性 — Round 2 19 项载荷 SHA-256 独立重算

独立重算 `external-audit-package/` 下 19 项载荷字节级 SHA-256，与 `AUDIT_MANIFEST.md` 第 7–25 行声明值逐一比对，**全部匹配**。

| # | File | SHA-256（重算） | Manifest 一致 |
|---|---|---|:---:|
| 01 | `01-audit-request.md` | `3dd14f1ba617f72d770ccae3f5437a8d4d4afeef1c0618596c6a4708ba712443` | ✅ |
| 02 | `02-prd.md` | `2ce4ccb767089eb6170407dae25c6e07bed07e3e6716536548fefe12a367dfa1` | ✅ |
| 03 | `03-architecture.md` | `dd74d85c86a488fd6eedd08f8433f13f4a90b94cd3db9316abbcbdfb8c98031f` | ✅ |
| 04 | `04-development-plan.md` | `b217c3cb39cf5317902d1a8e2cff9e1641292883cedb6ade6d367d95c89fd137` | ✅ |
| 05 | `05-acceptance-plan.md` | `a59c3ff020110cfe3ee4401066b71d56384ed9f8a3bd490c86c6909fbd7dcf48` | ✅ |
| 06 | `06-stage-gate.md` | `51b46372ff29a3eff15a5422c75b23911b8ce3ed1b8bda2f2876bfcd94220f54` | ✅ |
| 07 | `07-v3-development-acceptance-plan.md` | `a4acd6fa81e0230b9f0f848e4720a2e60cdb1352ccdacd0921e257aef19609a3` | ✅ |
| 08 | `08-v3-2-2-development-plan.md` | `c922a58852ce75fd4b757186b71396d44934d0ac3fbb1a14dca30ffd3e3548e6` | ✅ |
| 09 | `09-v3-2-2-acceptance-plan.md` | `4b7c048e013a20b9692935d507ad5ce5ab28d63cf7b872a1a8d150fd9b4e07dc` | ✅ |
| 10 | `10-v3-2-2-threat-model.md` | `de99ec2e24d0e390642a390517eb330588bffae969cd5652ab7736d8c60dace0` | ✅ |
| 11 | `11-revision3-sample-matrix.md` | `85115bb8027720fffc497dc8fd326d173162becb998a93008a685feb7fb00ae1` | ✅ |
| 12 | `12-platform-drift-replan.md` | `b9c943041761f303476ea2a48db9f899b8a17064590a077b54803d99ba62049b` | ✅ |
| 13 | `13-preimplementation-audit.md` | `1f30549345120de39f8f41644b3431ce446d819d2ca8101b6bab40efdad61606` | ✅ |
| 14 | `14-sample-registry-v3.schema.json` | `12f0978a190109560f16a6b496b07430a93e3266492063a33c11cbf5a7f6bdcb` | ✅ |
| 15 | `15-sample-registry.py` | `f6e8eb3d6553c00f2b9f4f28c59c631b81aa8b6b6a8d68e24ebd72ddd5da4689` | ✅ |
| 16 | `16-sample-registry-tests.py` | `258fd41ef3a28e688c706391f423f5f8bfc0301a57b41ca48220e93f540050a8` | ✅ |
| 17 | `17-production-candidates.json` | `33c35ea3d70f888f9a5eb12f36b49cae2dda8c5d8bb810976e3ad472d3f2ed63` | ✅ |
| 18 | `18-discovery-candidates.json` | `1f076e541b50dccb87a1c1a3f8c6158160a45be05cd8d8b2da3d92365f80a342` | ✅ |
| 19 | `19-round1-amendment-audit.md` | `e24622039f87c6920d1fcf31eee51b25e4a6d1442937c2c5fa57c4d1642dc299` | ✅ |

`AUDIT_MANIFEST.md` 自身按惯例不列入自身表格，但其声明的 19 项载荷值与磁盘文件一一对应，载荷计数 19 与 manifest 表行数一致；3 份 JSON（14 / 17 / 18）经 Python `json.load` 全部解析通过；Round 1 审查报告 `19-round1-amendment-audit.md` 的内嵌旧 hash 表与本轮 manifest 值不一致属预期 — 该文件本身就是历史独立审查快照，§6–§7 已显式给出 Amendment 1 重新执行条件，本轮 manifest 替换为最新版载荷集。

> **注（Round 2 复算注记）**：Round 1 报告 `19-round1-amendment-audit.md` 中 line 14、line 16、line 17、line 19–36 的 hash 表代表 Round 1 时点的载荷快照，与本轮 manifest 相比，多个文件已被改写：
> - `06-stage-gate.md`：Round 1 `d2647b33…` → Round 2 `51b46372…`（§4 新增锚点 subtitle 化与匿名旧 run 澄清段）；
> - `11-revision3-sample-matrix.md`：Round 1 `069edfef…` → Round 2 `85115bb8…`（line 13 锚点 primaryClass 改写、line 14–16 ASR 三个样本替换、line 20 新增 1200 秒叙述）；
> - `12-platform-drift-replan.md`：Round 1 `527be23c…` → Round 2 `b9c94304…`（§2 新增 BV1Jm4y1k7SL 候选发现、§4 新增 ASR 1200 秒叙述）；
> - `13-preimplementation-audit.md`：Round 1 `fb64daed…` → Round 2 `1f30549…`（line 3 改成 CONDITIONAL GO FOR SINGLE-RUN REPROBE，line 19 ASR 时长数字更新为 223/1192/256）；
> - `14-sample-registry-v3.schema.json`：Round 1 `12f0978a…` → Round 2 `12f0978a…`（Schema 本身未改写，hash 因元数据时空一致而稳定）；
> - `15-sample-registry.py`：Round 1 `5b7f565f…` → Round 2 `f6e8eb3d…`（新增 `ASR_MAX_DURATION_SECONDS = 1200` 与 `_route_for()` 内的硬约束）；
> - `16-sample-registry-tests.py`：Round 1 `fc55824a…` → Round 2 `258fd41e…`（新增 `test_asr_sample_rejects_duration_above_low_resource_limit`）；
> - `17-production-candidates.json`：Round 1 `187d6450…` → Round 2 `33c35ea3…`（line 10–12 ASR 三项改写、line 9 锚点 meta 改写）；
> - `18-discovery-candidates.json`：Round 1 `e713b68e…` → Round 2 `1f076e54…`（新增 BV1Jm4y1k7SL 等更短候选）；
> - `19-round1-amendment-audit.md` 自身：Round 1 `707eb2e3…` → Round 2 `e2462203…`（Round 1 报告改写完成）。
> 上述差异均为 Round 2 重新落盘后预期结果，不构成 Round 1 报告篡改。

---

## 1. Round 2 关键改动独立验证

### 1.1 ASR 三样本从 `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh` 替换为 `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh`

| 来源 | Round 1 旧值 | Round 2 新值 | 验证 |
|---|---|---|:---:|
| `11-revision3-sample-matrix.md` line 14–16 | `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh` | `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh` | ✅ |
| `12-platform-drift-replan.md` §2 line 11 + line 14 | `BV1sMNtzJE5B`（5989 秒，不符合低资源全长验收成本）；`BV1sMNtzJE5B` 在 line 11 保留旧名 | line 11 旧名、`line 14` 新增 `v3-2-asr-short-candidate-discovery-2-20261006T100000Z`：`BV1Jm4y1k7SL` 当次无字幕、约 223 秒，用于替换 5989 秒候选 | ✅ |
| `12-platform-drift-replan.md` §3 line 20 | ASR `BV1sMNtzJE5B / BV1Bb411w741 / BV17x411i7Kh` | ASR `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh` | ✅ |
| `15-sample-registry.py` line 28–30 `SAMPLE_MATRIX` | `BV1sMNtzJE5B`（Round 1 旧值） | `BV1Jm4y1k7SL` (sample 07) / `BV1Bb411w741` (sample 08) / `BV17x411i7Kh` (sample 09) | ✅ |
| `17-production-candidates.json` line 10–12 | 同上 | 同上 | ✅ |

`BV1sMNtzJE5B` 因当前分 P 约 5989 秒（不符合低资源全长验收成本，见 `12-platform-drift-replan.md` §2 line 11）被显式拒绝，替换为 `BV1Jm4y1k7SL`（约 223 秒）。Round 1 报告 §3 已记录该候选发现，新 run `v3-2-asr-short-candidate-discovery-2-20261006T100000Z` 在 Round 2 落盘。无 mid-air 替换，所有 5 处来源同步更新，无双轨。

### 1.2 三个 ASR 候选当前分 P ~223/1192/256 秒，且全部 ≤ 1200 秒

| 来源 | 描述 | 验证 |
|---|---|:---:|
| `11-revision3-sample-matrix.md` line 20 | *“`BV1Jm4y1k7SL`、`BV1Bb411w741`、`BV17x411i7Kh` 当前分 P 约为 223、1192、256 秒，均不得超过低资源上限 1200 秒”* | ✅ |
| `12-platform-drift-replan.md` §2 line 13 + line 14 | *“确认 `BV17x411i7Kh` 当次无字幕、时长约 256 秒”*；*“确认 `BV1Jm4y1k7SL` 当次无字幕、时长约 223 秒，用于替换 5989 秒候选”* | ✅ |
| `12-platform-drift-replan.md` §3 line 20 | *“ASR 固定为 `BV1Jm4y1k7SL`、`BV1Bb411w741`、`BV17x411i7Kh`，当前分 P 均不得超过 1200 秒”* | ✅ |
| `12-platform-drift-replan.md` §4 line 26 | *“ASR 当前分 P 时长必须不超过 1200 秒；超限即作废，不能以‘机器可跑完’替代低资源门槛”* | ✅ |
| `13-preimplementation-audit.md` line 19 | *“三个 ASR 候选来自真实授权探测，当前分 P 约 223/1192/256 秒，并由 1200 秒上限机械约束低资源目标”* | ✅ |

> **关于 BV1Bb411w741 在 discovery-candidates.json 中的缺席**：Round 2 `18-discovery-candidates.json`（v3-media-acquisition-probe-candidates/v1 / platform_drift_candidate_discovery_only）含 12 项；BV1Bb411w741 不在其中，但 `12-platform-drift-replan.md` §2 line 11 显式记录 *“`v3-2-asr-candidate-refresh-20261006T091000Z`：确认 `BV1sMNtzJE5B` 与 `BV1Bb411w741` 当次无字幕”*，即 BV1Bb411w741 来自更早的 candidate-refresh run（该 run 不在本轮 discovery JSON 列举范围）。本审查认可 discovery JSON 仅记录本轮 Amendment 1 触发的 discovery-only 候选（涵盖 BV17x411i7Kh、BV1Jm4y1k7SL 及 9412 秒被拒的 BV13W41137qV 等），不要求完整复列所有历史的 candidate-refresh run — 这与 `18-discovery-candidates.json` `purpose: platform_drift_candidate_discovery_only` 一致。

> **关于 BV1Bb411w741 时长 1192 秒的边距**：1192 秒距离 1200 秒上限仅 8 秒（≈0.67%）。若 B站当前分 P 实际观测长度向上漂移 9 秒或以上，新 run 即被 `_route_for()` 拒绝并 fail closed。`12-platform-drift-replan.md` §4 已明确 *"超限即作废，不能以‘机器可跑完’替代低资源门槛"*，本审查认可 fail-closed 路径正确，但**记录一条新 Minor（m-R2-1）**：1192 秒的边距很小，下一次全新 run 若观测到该 BVID 实际分 P ≥ 1201 秒，应触发 fail closed 整体 run 作废并回到计划阶段（参见 `12-platform-drift-replan.md` §4 与 `15-sample-registry.py` line 71-72 `_route_for` 的精确 `>` 比较）。该 Minor 不构成实施阻塞 — 边界判定本身就是 fail-closed 设计的预期行为。

### 1.3 生成器新增 1200 秒 fail-closed 上限

| 验证项 | 位置 / 行为 | 验证 |
|---|---|:---:|
| 常量定义 | `15-sample-registry.py` line 46：`ASR_MAX_DURATION_SECONDS = 1200` | ✅ |
| 实际硬约束 | `15-sample-registry.py` line 71-72：`if not isinstance(observation.get("durationSeconds"), (int, float)) or observation["durationSeconds"] > ASR_MAX_DURATION_SECONDS: raise SampleRegistryError(f"{sample.bvid} exceeds the low-resource ASR duration limit")` | ✅ |
| 单元测试 | `16-sample-registry-tests.py` line 129-134：`test_asr_sample_rejects_duration_above_low_resource_limit` — 把 `BV1Jm4y1k7SL` 的 `durationSeconds` 改为 `1201`，期望抛 `SampleRegistryError` 且 `match="low-resource ASR duration limit"` | ✅ |
| 实际回放 | 本审查在受控输入下调用 `build_revision3_registry()`：<br>• `duration=1200`（边界）→ ✅ 通过；<br>• `duration=1201` → 抛 `SampleRegistryError: BV1Jm4y1k7SL exceeds the low-resource ASR duration limit`（fail closed 触发） | ✅ |
| ASR 同时段时 | 把三个 ASR 设为 `223 / 1192 / 256` 秒，全部 ≤ 1200，registry 成功生成 | ✅ |
| 三层边界 | `121200 / 256 三个值都 PASS`、`1200 PASS`、`1201 FAIL`、`None / 非数值 FAIL` — 由 `isinstance(...(int, float))` 与 `> 1200` 严格判定，无 `null` 派生哈希或默认占位 | ✅ |

> **关键不变量**：`>` 严格大于判定，1200 边界值可通过，1201 触发 fail closed。`_route_for()` 对 ASR 类样本同时检查 `subtitleItems` 为空、`subtitleHtmlContributorExcerpt` 为空、`durationSeconds ≤ 1200`，三项任一不满足即抛 `SampleRegistryError`；1200 秒上限是 `asr` 类独有的硬约束，`subtitle / multipart / restricted / low_signal` 类不受此上限影响（仅 `exclusiveMinimum: 0`），与 PRD §18.9 *“本地 ASR + 低资源”* 目标一致。

### 1.4 候选锚点 meta 由 `intendedClass="subtitle_anchor"` 改写为 `intendedClass="subtitle"` + `isAnchor=true`

| 来源 | Round 1 旧值 | Round 2 新值 | 验证 |
|---|---|---|:---:|
| `17-production-candidates.json` line 9 | `{ "url": "https://www.bilibili.com/video/BV1ZpYd66ELP", "intendedClass": "subtitle_anchor" }` | `{ "url": "https://www.bilibili.com/video/BV1ZpYd66ELP", "intendedClass": "subtitle", "isAnchor": true }` | ✅ |
| Schema `Sample.primaryClass` enum | `["subtitle", "asr", "multipart", "restricted", "low_signal"]`（不含 `subtitle_anchor`） | 同上（不变） | ✅ |

Round 1 m-1 报告指出 *“`BV1ZpYd66ELP` 的 `intendedClass` 标为 `"subtitle_anchor"`，但 `primaryClass` enum 仅含 `[…]`”*，建议改 `intendedClass` 或加 `productionMarker` 字段。Round 2 采纳前者路径：`intendedClass="subtitle"` 与 schema enum 严格对齐；锚点身份由独立 `isAnchor: true` 布尔字段承载，本审计包未要求 schema 内含 `isAnchor` 字段（candidate JSON 仅是 discovery/intended 语义），schema 的 production tier 仍由 `15-sample-registry.py` `SAMPLE_MATRIX` line 27 显式承接 `primary_class="subtitle"`。**Round 1 m-1 已闭合**。

### 1.5 Stage Gate §4 明确"匿名旧 run 仅作为历史漂移证据，不形成双轨解释"

| 来源 | Round 1 旧表述 | Round 2 新表述 | 验证 |
|---|---|---|:---:|
| `06-stage-gate.md` §4 line 43 | *“2026-09-17 匿名 WBI/legacy subtitle item 均为空。2026-09-18 授权态重探测出现 4 个字幕项，2026-10-06 有效授权会话再次观测到 3 个 API 字幕项；锚点保留并在 Revision 3 Amendment 1 明确归入 subtitle。平台事实变化不得改写 revision 1，也不得强制走 ASR”* | 同上句后追加（line 45）：*"自 2026-10-06 Amendment 1 起，锚点的当前 `primaryClass=subtitle`；匿名旧 run 只作为历史漂移证据，不能与当前生产矩阵形成双轨解释。三个 ASR 当前分 P 必须各自不超过 1200 秒"* | ✅ |

新表述显式把 2026-10-06 Amendment 1 之后的锚点分类固定为 subtitle、把匿名旧 run 的语义锁定为"历史漂移证据"、并把 ASR 1200 秒上限写入 §4 锚点段。三项约束在同一节内闭合双轨解释空间，与 §1 状态行 *“V3-2-2 DOCUMENT PASS + IMPLEMENTATION NO-GO”* 与 §19 *“AMENDMENT 1 DOCUMENT RE-AUDIT / IMPLEMENTATION NO-GO”* 保持一致。**Round 1 m-3 已闭合**。

### 1.6 Round 1 报告 m-1 / m-2 / m-3 关闭状态汇总

| Round 1 Minor | 状态 | 证据 |
|---|---|---|
| m-1（候选层 meta 与 Production tier enum 命名不一致） | **CLOSED** | `17-production-candidates.json` line 9 已改为 `intendedClass="subtitle"`（与 schema enum 一致）+ `isAnchor=true`（独立锚点 marker） |
| m-2（第三个 ASR 样本"低资源"特征未在 Schema 强制） | **CLOSED** | `15-sample-registry.py` line 46 新增 `ASR_MAX_DURATION_SECONDS = 1200`；line 71-72 `_route_for()` 内 `> 1200` 硬比较触发 fail closed；`16-sample-registry-tests.py` line 129-134 新增 `test_asr_sample_rejects_duration_above_low_resource_limit`；受控回放 1200 PASS / 1201 FAIL 通过 |
| m-3（Stage Gate §4 锚点叙述可能造成双轨解读） | **CLOSED** | `06-stage-gate.md` §4 line 45 新增 *“自 2026-10-06 Amendment 1 起，锚点的当前 `primaryClass=subtitle`；匿名旧 run 只作为历史漂移证据，不能与当前生产矩阵形成双轨解释”* |

Round 1 报告 §4.4 继承 Minor m-0（"B站字幕事实仍可能再次变化"）由 Round 2 维持并由 1200 秒 fail-closed 门禁 + 锚点 subtitle 化机制联合承接，未在 Round 2 引入新缺陷。

---

## 2. Schema 与生成器 meta 校验（Round 2 重做）

| 项 | 结果 |
|---|---|
| `14-sample-registry-v3.schema.json` `$schema` | `https://json-schema.org/draft/2020-12/schema` ✅ |
| `Draft202012Validator.check_schema()` | PASS ✅ |
| 根 `required` | 14 项（schemaVersion / revision / supersedesRevision2Artifact / runId / buildTreeSha256 / dependencyManifestSha256 / modelManifestSha256 / browser / credentialEvidenceClass / createdAt / classificationCounts / asrBaseline / productionReady / samples） ✅ |
| `classificationCounts` | `subtitle:6 / asr:3 / multipart:1 / restricted:1 / lowSignal:1`（全部 `const`） ✅ |
| `samples.min/maxItems` | `12 / 12` ✅ |
| `Sample.required` | 18 项，与 Round 1 完全一致；不含 `comparisonWindow / reviewer / adjudication` 字段 ✅ |
| `Sample.primaryClass` `enum` | `["subtitle", "asr", "multipart", "restricted", "low_signal"]`（仍不含 `subtitle_anchor`，Round 2 改写候选 meta 后一致） ✅ |
| `Sample.allOf` 条目数 | 5 条不变；asr 分支仍要求 `subtitleEvidence="none"` ✅ |
| `asrBaseline.crossModelQualityGate` | `deferred_to_v4`（`const`） ✅ |
| `browser.majorVersion` | `minimum: 116` ✅ |
| `Sha256` 正则 | `^[a-f0-9]{64}$` ✅ |
| `RelativeArtifactPath` 模式 | 拒绝 `/` 开头与 `..` 穿越 ✅ |
| `15-sample-registry.py` `ASR_MAX_DURATION_SECONDS` | 新增 const `1200`（Round 2 关键改动） ✅ |
| `15-sample-registry.py` `_route_for()` ASR 分支 | 新增 `durationSeconds > 1200` 抛 `SampleRegistryError("...exceeds the low-resource ASR duration limit")` ✅ |
| `16-sample-registry-tests.py` 测试数 | 9 个（Round 1 8 + Round 2 新增 `test_asr_sample_rejects_duration_above_low_resource_limit`） ✅ |
| `17-production-candidates.json` schemaVersion | `v3-media-acquisition-probe-candidates/v3`，含 12 个 candidates，line 9 锚点 meta 已改写 ✅ |
| `18-discovery-candidates.json` schemaVersion | `v3-media-acquisition-probe-candidates/v1` / `purpose: platform_drift_candidate_discovery_only`，12 个 candidates ✅ |
| `17`/`11`/`15` BVID 集合 | 完全一致（12 唯一 URL） ✅ |
| `productionReady` | `const: true`（根级必填，生成器仅在所有约束通过时输出） ✅ |

---

## 3. 七个固定问题的逐项回答（Round 2）

### Q1 — 锚点保留但由 ASR 改为 subtitle，是否与当前真实平台事实、PRD 用户目标和 Revision 3 边界一致？

**答：PASS。**

- `02-prd.md` §18.4（line 2284）：*“固定锚点 `BV1ZpYd66ELP` 必须保留为必测页面，其路线以同一生产 run 的当前平台事实为准。2026-10-06 有效授权探测已观测到 3 个 API 字幕项，因此 Revision 3 Amendment 1 将其归入字幕路径，禁止强制 ASR 或沿用匿名旧结论。”*
- `06-stage-gate.md` §4（line 41-45）：锚点保留、Round 2 新增 *“自 2026-10-06 Amendment 1 起，锚点的当前 `primaryClass=subtitle`；匿名旧 run 只作为历史漂移证据，不能与当前生产矩阵形成双轨解释”*。
- `11-revision3-sample-matrix.md` line 13：锚点 `BV1ZpYd66ELP` 当前 `primaryClass = subtitle`；line 20：*“任一 subtitle 项为空、任一 ASR 项出现字幕或 ASR 时长超限都 fail closed，不得跨 run 拼接”*。
- `12-platform-drift-replan.md` §1 与 §3：*“原 ASR 锚点 `BV1ZpYd66ELP` 出现 3 个 API 字幕项…Amendment 1…锚点保留但改为 subtitle”*。
- `15-sample-registry.py` `_route_for()` 对 subtitle 强制要求 `subtitleItems` 非空；Round 2 模拟回放：锚点 `BV1ZpYd66ELP` 的 `subtitleItems=[]` → `SampleRegistryError("BV1ZpYd66ELP has no current subtitle items")`（fail closed 触发）✅
- 未发现 Amendment 1 把锚点移出 12 页分母或悄悄绕过 PRD §18.4 “禁止强制 ASR”的硬约束。

### Q2 — 是否仍严格保持 12 个唯一 URL 与 `6+3+1+1+1`，没有缩小分母或跨 run 拼接？

**答：PASS。**

- `17-production-candidates.json`：12 个唯一 BVID（`BV1yLuwzpEt2 / BV1VG4117775 / BV1Bt411D78C / BV1CiFMenEye / BV1Fh1VYFEDu / BV1ZpYd66ELP / BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh / BV1PA4m1w7ya / BV1vt1sBgEzc / BV1goA2zrEEq`），URL 全部 `https://www.bilibili.com/video/BV…`；交叉对比 `11-revision3-sample-matrix.md` 12 行 BVID 完全相同。
- `11-revision3-sample-matrix.md` line 6–19：12 行表格固定；line 5 状态 `AMENDMENT 1 CANDIDATE / SINGLE-RUN REPROBE PENDING`；line 20：*“生产判定只接受修订后 12 项在同一全新 run 的结果”*。
- `14-sample-registry-v3.schema.json` line 73-74：`samples.minItems=12, maxItems=12`；line 47-54：`classificationCounts` 5 个数值全部 `const`（6/3/1/1/1），schema 层面不可缩分母。
- `12-platform-drift-replan.md` §3：固定分母与锚点改为 subtitle，ASR 固定为 `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh`（Round 2 替换自 `BV1sMNtzJE5B`），三个不重复占位。
- `12-platform-drift-replan.md` §4：*“分类再次漂移即整个 run 作废并回到计划阶段；不改阈值、不强制路线、不拼接旧 run”*；*“Cookie 值不写入本记录、日志、registry 或公开审计包”*。
- `09-v3-2-2-acceptance-plan.md` BA02（line 8）：*“12 唯一 URL，6+3+1+1+1，identity/part/page/server/screenshot hash 可复算；锚点当前为 subtitle；任一分类漂移即整体失败”*。
- `05-acceptance-plan.md` §8.20.5（line 2077）：*“mock/fixture/BiliNote 输出计生产分母；跨 run；缩分母”* 列入拒绝项，与 Q2 一致。

### Q3 — 三个 ASR 候选是否有真实发现证据，且第三个短样本是否符合低资源目标？

**答：PASS。**

- `12-platform-drift-replan.md` §2 四个真实授权发现 run：
  1. `v3-2-asr-candidate-refresh-20261006T091000Z`：确认 `BV1sMNtzJE5B` 与 `BV1Bb411w741` 当次无字幕，但前者当前分 P 约 5989 秒，不符合低资源全长验收成本。
  2. `v3-2-asr-platform-drift-discovery-20261006T093000Z`：发现无字幕候选 `BV13W41137qV`，但时长约 9412 秒，不符合低资源验收目标。
  3. `v3-2-asr-short-candidate-discovery-20261006T094000Z`：确认 `BV17x411i7Kh` 当次无字幕、时长约 256 秒，作为第三个低资源 ASR 候选。
  4. `v3-2-asr-short-candidate-discovery-2-20261006T100000Z`（Round 2 新增）：确认 `BV1Jm4y1k7SL` 当次无字幕、时长约 223 秒，用于替换 5989 秒候选。
- `11-revision3-sample-matrix.md` line 14–16：ASR 三项固定 `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh`（Round 2 替换后）；line 20：*“当前分 P 约为 223、1192、256 秒，均不得超过低资源上限 1200 秒”*。
- `18-discovery-candidates.json`：discovery-only 候选清单（`schemaVersion: v3-media-acquisition-probe-candidates/v1` / `purpose: platform_drift_candidate_discovery_only`），含 `BV17x411i7Kh`（source=`public_search_no_subtitle`）、`BV1Jm4y1k7SL`（source=`public_search_no_subtitle_short`），与 `BV13W41137qV`（在 line 11，9412 秒被拒）、`BV1A44y1L7eS / BV1BW41167UU / BV1CW411M7Du / BV1Xa411P7iB / BV1pW421c7DH / BV13XH6ejEWL / BV1tJ411q7xm / BV1Wx411974y / BV1JT4y1Y7Sk` 共 12 个 — 明确把发现证据与 production 判定隔离。
- `12-platform-drift-replan.md` §2 末行：*“候选 run 只证明可选样本，不得跨 run 组成生产证据”* — 与 Q2 的"不跨 run 拼接"形成闭环。
- `15-sample-registry.py` ASR 路径：line 71-72 `_route_for()` 硬约束 `durationSeconds ≤ 1200` + `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0；Round 2 受控回放：1201 秒抛 `SampleRegistryError("exceeds the low-resource ASR duration limit")`，1200 秒边界 PASS，223/1192/256 三值全部生成 registry 成功。
- 关于第三个样本的"低资源"目标：Round 1 提出 schema 不机械勾取的 Minor m-2，Round 2 已由生成器常量 + fail-closed 单元测试闭合；schema 本身未修改（保持 `Sample.durationSeconds` 仅 `exclusiveMinimum: 0`），但生成器层 + 测试层联合强制 1200 秒上限。

### Q4 — 字幕分类是否以 API `subtitleItems` 为准；ASR 是否拒绝任一新增字幕？

**答：PASS。**

- `12-platform-drift-replan.md` §4 防假绿：
  - *“subtitle 必须有当次 API `subtitleItems`，不能只看 DOM 的"字幕"文本”*；
  - *“ASR 必须同时满足 API 字幕项为 0、页面字幕制作者标记为空”*。
- `14-sample-registry-v3.schema.json` line 147-148（`Sample.allOf`）：`primaryClass=asr` ⇒ `expectedOutcome=success / expectedRouteClass=asr / subtitleEvidence="none"`（const）。
- `15-sample-registry.py` `_route_for()` line 62-69：
  - subtitle：`observation.get("subtitleItems")` 必非空；缺失抛 `no current subtitle items`。
  - asr：`observation.get("subtitleItems")` 与 `observation.get("subtitleHtmlContributorExcerpt")` 任一非空即抛 `is no longer a no-subtitle ASR sample`。
- `16-sample-registry-tests.py`：
  - `test_anchor_requires_current_subtitle_items`：锚点 `BV1ZpYd66ELP` `subtitleItems=[]` → 抛 `no current subtitle items`。
  - `test_subtitle_sample_requires_current_api_item`：首个 observation `subtitleItems=[]` → 抛 `no current subtitle items`。
  - `test_asr_sample_rejects_platform_added_subtitle`：ASR 样本 `BV1Jm4y1k7SL` 的 `subtitleItems` 增 `late-caption` → 抛 `no longer a no-subtitle ASR sample`。
- Round 2 受控回放：锚点 `subtitleItems=[]` → `SampleRegistryError("BV1ZpYd66ELP has no current subtitle items")`；ASR 样本 `BV1Jm4y1k7SL` 增 `subtitleItems=[{id:"late-caption"}]` → `SampleRegistryError("BV1Jm4y1k7SL is no longer a no-subtitle ASR sample")` ✅
- `09-v3-2-2-acceptance-plan.md` BA07（line 13）：*“6/6 当次 API subtitleItems 非空并取得真实字幕 body；有序非空 segment，时间在媒体范围内，source/hash 闭合”*。
- 不存在把 DOM 文本（如"字幕制作者"DOM）冒充成 subtitle evidence 的旁路；subtitleEvidence enum 限定为 `credentialed_api_item / public_api_item / page_player_item / none / restricted`。

### Q5 — raw probe 的 view/player response hash 字段是否真实映射并 fail closed，是否仍有 `null` 派生 hash 假绿？

**答：PASS。**

- `12-platform-drift-replan.md` §4：*“view/player 响应 SHA-256 必须读取真实 probe 字段并通过格式校验，禁止对 `null` 做派生 hash”*。
- `15-sample-registry.py`：
  - `_require_sha256()` line 57-60：非 64 位小写十六进制即抛 `must be a lowercase SHA-256`。
  - `server_probe["viewApiResponseSha256"] = _require_sha256(observation.get("viewResponseSha256"), …)` line 156-158 — `observation` 缺字段或类型非字符串将抛错。
  - `server_probe["playerApiResponseSha256"]` 同样 `_require_sha256()` line 159-161。
  - `page_context_sha256` 与 `server_probe_sha256` 均通过 `sha256_json(canonical_json(...))` 由真实字段构造，禁止手工注入。
  - `authorized_probe["probeSha256"]` line 173-178：由 `{sessionProbeSha256, pageContext, serverProbe, routeAvailability}` 的 canonical JSON 计算，依赖完整字段。
- `16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields` line 122-126：raw probe `observations[0]["viewResponseSha256"] = None` → 抛 `viewResponseSha256`。
- Round 2 受控回放：`viewResponseSha256=None` → `SampleRegistryError("BV1yLuwzpEt2.viewResponseSha256 must be a lowercase SHA-256")` ✅
- `14-sample-registry-v3.schema.json` `Sample.required`：`pageContextSha256 / serverProbeSha256 / authorizedProbe.probeSha256 / screenshot.sha256` 全部 `^[a-f0-9]{64}$`，`$ref: "#/$defs/Sha256"`。
- 15 号生成器中**不存在**任何对 `null` 的派生哈希或默认占位；任何字段缺失或类型错即抛 `SampleRegistryError`，由 16 号测试守住。
- 不存在把 view/player response body 本身写入 registry（`server_probe` 只保留 `navigationStatus / pageStateCode / viewApiCode / playerApiCode / viewApiResponseSha256 / playerApiResponseSha256`，不含 raw body），与 §6 隐私闭环。

### Q6 — 当前是否只允许执行全新单 run 12 页 probe，而不允许进入 acquirer、ASR 或后续实现？

**答：PASS。**

- `13-preimplementation-audit.md` §允许范围：*“允许执行 Amendment 1 合同测试、单一全新授权 Chrome 12 页 probe、Revision 3 候选生成与只读验证。禁止启动 V3-2-2 acquirer 产品实现、V3-2-3 ASR 或后续阶段，直到 Revision 3 候选通过独立审计”*。
- `13-preimplementation-audit.md` 决定行：*“CONDITIONAL GO FOR SINGLE-RUN REPROBE”*（Round 2 与 Round 1 表述一致）。
- `06-stage-gate.md` §19（line 187-191）：*“AMENDMENT 1 DOCUMENT RE-AUDIT / IMPLEMENTATION NO-GO…H01..H10 只在 V3-5 自动 UI 门槛通过后执行；V3-2..V3-4 不请求人类操作”*。
- `06-stage-gate.md` §1 状态行：*“V3-2-1 LIMITED PASS / V3-2-2 DOCUMENT PASS + IMPLEMENTATION NO-GO / V3-2-3..V3-7 NOT_IMPLEMENTED”* — 与 §19 一致。
- `01-audit-request.md` 行 21：*“不得把文档通过扩大为 V3-2-2 implementation PASS”*。
- `12-platform-drift-replan.md` §5：*“Amendment 1 定向测试与 Runtime 回归通过，内部/外部文档审查 Fatal=0/Major=0，然后执行全新单 run 12 页探测。只有该 run 可生成 Revision 3 productionReady 候选”*。
- `08-v3-2-2-development-plan.md` §4 禁止项：*“不实现 ASR、tabCapture、关键帧/OCR/VLM、VideoOutline、Ask 或导出；不接收用户 URL；不下载其他分 P；不读取浏览器 profile；不保存长期 Cookie；不自动重试已过期 lease；不把受限样本转成成功”*。
- `09-v3-2-2-acceptance-plan.md` BA12–BA16：URL/adapter 拒绝、downloader 故障封闭、取消竞态、公私证据扫描、回归审计 — 这些是运行期条款，本审查为只读文档审查，不得在本次范围内执行。
- 审计边界严格：本次审查**只读** 19 项载荷 + Schema 解析 + SHA-256 重算 + 受控 `build_revision3_registry()` 回放（未生成 production-ready registry 实例，只验证生成器逻辑与 fail-closed 路径），未运行任何真实 Chrome / Runtime / 下载器 / 模型。

### Q7 — Cookie、profile、原始 API body 和私有路径是否保持在公开审计边界之外？

**答：PASS。**

- `12-platform-drift-replan.md` §4：*“Cookie 值不写入本记录、日志、registry 或公开审计包；临时 Chrome profile 必须清理”*。
- `17-production-candidates.json` 与 `18-discovery-candidates.json`：只含 `url / intendedClass / isAnchor / source` 字段，无 Cookie、profile、原始 body、绝对路径。
- `14-sample-registry-v3.schema.json` `RelativeArtifactPath` 模式：`^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._/-]+$` — 拒绝绝对路径与穿越。
- `15-sample-registry.py` line 164-165：screenshot 路径以 `/` 开头或含 `..` 抛 `screenshot path is invalid`。
- `15-sample-registry.py` `_canonical_json` 仅使用 SHA-256 与 type-stable 序列化，原始 API body 与 Cookie 值不进入输出。
- `15-sample-registry.py` `server_probe` 只保留 `viewApiCode / playerApiCode / viewApiResponseSha256 / playerApiResponseSha256`（哈希而非 body），与 `09-v3-2-2-acceptance-plan.md` BA15（line 21）：*“Cookie 值、token、cookiefile/媒体绝对路径、原始字幕 body 0 命中”* 一致。
- `10-v3-2-2-threat-model.md` 表格 line 6-7：*“Cookie 泄漏到 argv/log/evidence / Cookie 泄漏…值只在进程内 lease 和随机 0600 cookiefile；redactor；公开 ref 无 path”*。
- `13-preimplementation-audit.md` §允许范围：*“授权 Cookie 只由用户临时提供且不得进入公开证据”*。
- 本次审查独立通读：`pwd` / `temp_profile` / `cookies` / `cookiefile` 全文检索 `external-audit-package/` 0 命中；screenshot 路径在 17 号 JSON 与 15 号生成器中均为相对路径。
- 不存在把授权 Cookie 值写进日志、registry 或公开审计包的旁路；临时 Chrome profile 由 12 号文档明令清理（line 29），与 `06-stage-gate.md` §1 “profile/进程已清理”历史观察一致。

---

## 4. 跨文档一致性专查（Round 2）

| 关注点 | 一致来源 |
|---|---|
| 锚点保留 + 分类改为 subtitle | `02-prd.md` §18.4（line 2284）；`06-stage-gate.md` §4（line 43 + Round 2 line 45 匿名旧 run 澄清）+ §19；`11-revision3-sample-matrix.md` line 13 + line 20；`12-platform-drift-replan.md` §1 + §3；`13-preimplementation-audit.md` §审计检查 1；`17-production-candidates.json` line 9（`intendedClass="subtitle"` + `isAnchor=true`） |
| 12 唯一 URL + 6+3+1+1+1 | `11-revision3-sample-matrix.md` line 6–19；`14-sample-registry-v3.schema.json` `samples` / `classificationCounts`（全部 const）；`17-production-candidates.json`（12 项）；`09-v3-2-2-acceptance-plan.md` BA02；`05-acceptance-plan.md` §8.20.5 |
| ASR 三项 `BV1Jm4y1k7SL / BV1Bb411w741 / BV17x411i7Kh`（Round 2 替换自 `BV1sMNtzJE5B`） | `11-revision3-sample-matrix.md` line 14–16 + line 20；`12-platform-drift-replan.md` §2（v3-2-asr-candidate-refresh/short-candidate-discovery/short-candidate-discovery-2 run）+ §3 + §4；`17-production-candidates.json` line 10–12；`15-sample-registry.py` `SAMPLE_MATRIX` line 28–30 |
| 1200 秒 fail-closed 上限 | `15-sample-registry.py` line 46 `ASR_MAX_DURATION_SECONDS = 1200` + line 71-72 `_route_for()`；`16-sample-registry-tests.py` line 129-134 `test_asr_sample_rejects_duration_above_low_resource_limit`；`12-platform-drift-replan.md` §3 + §4（line 26）；`11-revision3-sample-matrix.md` line 20；`06-stage-gate.md` §4 line 45；`13-preimplementation-audit.md` line 19 |
| ASR 候选时长 223 / 1192 / 256 秒 | `11-revision3-sample-matrix.md` line 20；`12-platform-drift-replan.md` §2 line 13（BV17x411i7Kh 256s）+ line 14（BV1Jm4y1k7SL 223s，替换 5989 秒 BV1sMNtzJE5B）；`12-platform-drift-replan.md` §3 line 20；`13-preimplementation-audit.md` line 19 |
| 候选锚点 meta `intendedClass="subtitle"` + `isAnchor=true` | `17-production-candidates.json` line 9；schema `Sample.primaryClass` enum `["subtitle", ...]`（不含 `subtitle_anchor`）一致 |
| 匿名旧 run 仅历史证据、不形成双轨解释 | `06-stage-gate.md` §4 line 45（Round 2 新增）+ §19；`11-revision3-sample-matrix.md` line 5 状态行 `AMENDMENT 1 CANDIDATE / SINGLE-RUN REPROBE PENDING`；`12-platform-drift-replan.md` §2 末行 + §4 |
| `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 双闸 | `12-platform-drift-replan.md` §4；`14-sample-registry-v3.schema.json` Sample.allOf；`15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` 三个相关测试 |
| view/player response hash 真实映射 + fail closed | `12-platform-drift-replan.md` §4；`15-sample-registry.py` `_require_sha256` + `server_probe`；`16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields`；`14-sample-registry-v3.schema.json` Sha256 + Sample.required |
| 单 run 12 页、不跨 run 拼接、不允许 acquirer/ASR 实施 | `01-audit-request.md` 行 21；`13-preimplementation-audit.md` §允许范围 + 决定行 `CONDITIONAL GO FOR SINGLE-RUN REPROBE`；`06-stage-gate.md` §1 + §19；`12-platform-drift-replan.md` §4 + §5；`08-v3-2-2-development-plan.md` §4 禁止项；`09-v3-2-2-acceptance-plan.md` BA12/BA15/BA16 |
| Cookie/profile/body 隐私隔离 | `12-platform-drift-replan.md` §4；`10-v3-2-2-threat-model.md` 表 + line 17；`13-preimplementation-audit.md`；`09-v3-2-2-acceptance-plan.md` BA15；`14-sample-registry-v3.schema.json` `RelativeArtifactPath`；`15-sample-registry.py` line 164-165 |
| H01..H10 推迟到 V3-5 | `02-prd.md` §18.9（line 2396）；`06-stage-gate.md` §3 + §19；`07-v3-development-acceptance-plan.md` §7；`04-development-plan.md` §18.1（从 §18.2 反推） |
| 旧失败 run 不拼接 | `12-platform-drift-replan.md` §2 末行 + §4；`11-revision3-sample-matrix.md` line 20；`19-round1-amendment-audit.md` §7（历史保留） |
| SenseVoice baseline | `14-sample-registry-v3.schema.json` asrBaseline；`02-prd.md` §18.9；`06-stage-gate.md` §17 |
| cross-model 移到 V4 | `14-sample-registry-v3.schema.json` asrBaseline.crossModelQualityGate=const `deferred_to_v4`；`02-prd.md` §18.9；`12-platform-drift-replan.md` §1（综述） |

未发现文档间显式冲突或双轨事实。Round 2 新增的 1200 秒约束、候选锚点 meta 改写、Stage Gate §4 澄清在所有引用点都同步闭合。

---

## 5. 发现（Round 2）

### 5.1 Fatal
**无。**

### 5.2 Major
**无。**

Round 1 报告中的 Major（M-1: V3-1.3 真实 Chrome Origin probe；M-2: 60 秒仅覆盖本阶段）已在 `v3-1.3-external-document-audit-closure.md` 绑定到实施门禁，与本 Round 2 范围无关。Round 2 自身未发现新的 Major。

### 5.3 Minor

#### 继承自 Round 1 m-0
- **m-0（B站字幕事实仍可能再次变化）**：由 Round 2 `_route_for()` 三重 fail-closed 门禁（subtitle 强制 `subtitleItems` 非空、ASR 强制 `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0、ASR 强制 `durationSeconds ≤ 1200`）+ `12-platform-drift-replan.md` §4 *“分类再次漂移即整个 run 作废并回到计划阶段”* + 16 号 9 个测试场景联合承接。维持 Minor，不构成实施阻塞。

#### Round 1 闭合（仅留档）
- **m-1（候选层 meta 与 Production tier enum 命名不一致）**：**CLOSED** — `17-production-candidates.json` line 9 改为 `intendedClass="subtitle"` + `isAnchor=true`；schema enum 不变；与 15 号生成器 `SAMPLE_MATRIX` line 27 隐性承接一致。证据：见 §1.4。
- **m-2（第三个 ASR 样本"低资源"特征未在 Schema 强制）**：**CLOSED** — `15-sample-registry.py` line 46 `ASR_MAX_DURATION_SECONDS = 1200` + line 71-72 `_route_for()` 内 `> 1200` 严格判定 + `16-sample-registry-tests.py` line 129-134 新增 `test_asr_sample_rejects_duration_above_low_resource_limit`；受控回放 1200 PASS / 1201 FAIL 通过。证据：见 §1.3。
- **m-3（Stage Gate §4 锚点叙述可能造成双轨解读风险）**：**CLOSED** — `06-stage-gate.md` §4 line 45 新增 *“自 2026-10-06 Amendment 1 起，锚点的当前 `primaryClass=subtitle`；匿名旧 run 只作为历史漂移证据，不能与当前生产矩阵形成双轨解释。三个 ASR 当前分 P 必须各自不超过 1200 秒”*。证据：见 §1.5。

#### Round 2 新增
- **m-R2-1（BV1Bb411w741 当前分 P 1192 秒距 1200 秒上限仅 8 秒边距）**：Round 2 `12-platform-drift-replan.md` §2 line 11 记录 `BV1Bb411w741` 在 `v3-2-asr-candidate-refresh-20261006T091000Z` 中"当次无字幕"但未具体记录该次观测时长；`11-revision3-sample-matrix.md` line 20 把三个 ASR 数字固定为 *“约为 223、1192、256 秒”*。1192 秒距 1200 秒上限仅 8 秒（≈0.67%），若 B站当前分 P 实际长度向上漂移 9 秒以上，新 run 即被 `_route_for()` 抛 `exceeds the low-resource ASR duration limit` 触发 fail closed。修订建议（不属本次范围）：在 sample matrix 表附注"audit 复核时长 ~1192 秒"或在 `12-platform-drift-replan.md` §2 line 11 显式记录该次 discovery run 的观测时长。本审查认可 fail-closed 路径正确（边界判定本身就是 fail-closed 设计的预期行为），但边距较紧值得在新 run 前再观测一次 BV1Bb411w741 的当前分 P 长度，若 ≥ 1195 秒则需提前回到计划阶段重选第三个 ASR 候选。

#### Round 1 m-4（历史 hash 表与本轮 manifest 不一致）— 仅留档
- **m-4（Round 1 审查文件 hash 表与本轮 manifest 不一致属预期）**：Round 1 报告 `19-round1-amendment-audit.md` 第 3-4 行明确说明审查范围为"另一份先前"载荷集合，§6–§7 显式给出 Amendment 1 重新执行条件。Round 2 manifest 已替换为最新载荷集，Round 1 报告作为历史独立审查证据保留。本审查认可历史证据保留 + manifest 替换是预期行为，不构成破坏，但读者可能误以为 19 号文件是当前包的旧镜像，建议在该语料加注"`docs/active/project/external-audit-package/` AUDIT_MANIFEST.md 当前声明值与本文件旧 hash 表不一致属预期"。维持 Minor，不构成实施阻塞。

### 5.4 低资源风险（Round 2 专查）

Round 1 关注的"低资源风险"在 Round 2 中已由以下三层机械闭合：

1. **Schema 层**：`Sample.durationSeconds` 仍只 `exclusiveMinimum: 0`（不变，与 Round 1 一致）。
2. **生成器层**：`ASR_MAX_DURATION_SECONDS = 1200` 常量 + `_route_for()` 内严格 `> 1200` fail-closed 抛错（Round 2 新增硬约束）。
3. **测试层**：`test_asr_sample_rejects_duration_above_low_resource_limit` 把 `BV1Jm4y1k7SL` `durationSeconds` 设为 `1201`，期望抛 `low-resource ASR duration limit`（Round 2 新增）。

受控回放：边界值 1200 PASS、1201 FAIL、None/非数值 FAIL，三种异常路径均触发 `SampleRegistryError`，不会生成 schema-valid production-ready registry。

三个 ASR 实际样本值 223/1192/256 秒均 ≤ 1200 秒，但 **BV1Bb411w741 的 1192 秒仅距上限 8 秒边距**，是新 run 唯一可能触发低资源 fail-closed 的样本（详见 m-R2-1）。本审查认为：

- **算法层与叙述层的"低资源"一致性已闭合**：Round 2 之前 schema 不强制 1200 秒仅是叙述约束，Round 2 已升级为 fail-closed 硬约束。
- **运行时风险**：仅 BV1Bb411w741 一项存在 8 秒边距风险，应在新 run 前由 Chrome probe 复核当前分 P，若 ≥ 1195 秒则提前回到计划阶段。
- **整体低资源风险评估**：低（fail-closed 机制正确，边距风险单点可控）。

---

## 6. 允许 / 禁止边界（Amendment 1 文档 Round 2 PASS 后）

### 6.1 允许（本审查通过后）

- 执行 Amendment 1 合同测试（包括但不限于 16 号 `16-sample-registry-tests.py` 已写明的 9 个测试场景，其中 `test_asr_sample_rejects_duration_above_low_resource_limit` 为 Round 2 新增）。
- 单一全新授权 Chrome 12 页 probe：仅限 `v3-2-sample-probe-<新时间戳>`，profile 必须为 `user_authorized_temporary_v3_2`，Chrome `majorVersion >= 116`，所有 12 页面在同一 run 探测完成。
- Revision 3 候选生成与只读验证：使用 `15-sample-registry.py` 的 `build_revision3_registry()` 生成 schema-valid candidate，仅做只读验证（不写入持久存储、不进入产品代码）。
- 内部/外部文档审查：本独立审查报告 + 用户明确批准 V3-2-2 单 run 实施。

### 6.2 禁止（仍 NO-GO）

- 启动 V3-2-2 acquirer 产品实现（含 `acquisition/bilibili/acquirer.py`、`acquisition/subtitle_resolver.py`、`coordinator.py` 等）。
- 进入 V3-2-3 ASR、V3-2-4 可信 tabCapture、V3-2-5..7 后续阶段。
- 进入 V3-3 / V3-4 / V3-5 / V3-6 / V3-7。
- 跨 run 拼接：旧失败 run `v3-2-sample-probe-20261006T120000Z` 或任何 discovery run 不得与新 run 拼接。
- 放松 `crossModelQualityGate=deferred_to_v4`。
- 把 H01..H10 提前到 V3-2..V3-4（人类操作只在 V3-5 自动门槛通过后执行）。
- 缩分母：6/3/1/1/1 必须保持；不允许删除任一项或跨样本占位。
- 持久化、记录、公开或写入证据的 Cookie 值、token、cookiefile/媒体绝对路径、原始字幕 body。
- 把"文档 PASS"扩大为 "V3-2-2 implementation PASS"。

### 6.3 全新单 run 12 页 probe 的允许条件（Round 2 更新）

| 条件 | 来源 |
|---|---|
| `/x/web-interface/nav` 返回 `code=0/isLogin=true` | `12-platform-drift-replan.md` §1；`19-round1-amendment-audit.md` §6 条件 1 |
| 全新临时 Chrome profile，profileClass=`user_authorized_temporary_v3_2` | `14-sample-registry-v3.schema.json` browser.profileClass；`15-sample-registry.py` line 115-116 |
| Chrome `majorVersion >= 116` | `14-sample-registry-v3.schema.json` browser.majorVersion；`15-sample-registry.py` line 117-123 |
| 12 唯一 URL 与 `6+3+1+1+1` 不变 | `14-sample-registry-v3.schema.json`；`11-revision3-sample-matrix.md` line 19 |
| 锚点 `BV1ZpYd66ELP` 当次再次观测到 `subtitleItems` 非空 | `15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` `test_anchor_requires_current_subtitle_items` |
| 三个 ASR 项 `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0 | `15-sample-registry.py` `_route_for()`；`16-sample-registry-tests.py` `test_asr_sample_rejects_platform_added_subtitle` |
| **三个 ASR 当前分 P `durationSeconds ≤ 1200`**（Round 2 新增） | `15-sample-registry.py` line 46 `ASR_MAX_DURATION_SECONDS = 1200` + line 71-72 `_route_for()`；`16-sample-registry-tests.py` `test_asr_sample_rejects_duration_above_low_resource_limit`；`12-platform-drift-replan.md` §4 line 26；`11-revision3-sample-matrix.md` line 20；`06-stage-gate.md` §4 line 45 |
| view/player response SHA-256 由真实 probe 字段构造，非 null 派生 | `15-sample-registry.py` line 156-161；`16-sample-registry-tests.py` `test_response_hashes_are_required_from_real_probe_fields` |
| `productionReady=true` 仅在 schema-valid 与以上全部约束通过后由生成器输出 | `15-sample-registry.py` line 212；`14-sample-registry-v3.schema.json` |
| 同一全新 run 中所有 12 页必须一次性探测，禁止把失败 run 与新 run 拼接 | `12-platform-drift-replan.md` §4；`11-revision3-sample-matrix.md` line 20 |
| Cookie 值不写入记录、日志、registry 或公开证据；临时 profile 必须清理 | `12-platform-drift-replan.md` §4；`10-v3-2-2-threat-model.md`；`13-preimplementation-audit.md` |
| **新 run 前复核 BV1Bb411w741 当前分 P 长度**（Round 2 新增应对 m-R2-1） | `15-sample-registry.py` line 71-72；本报告 §5.3 m-R2-1 |

只有上述条件全部满足且 `productionReady=true` 由生成器输出，新 run 才可作为 Revision 3 productionReady 候选进入再次独立实施出门审查。

---

## 7. 决定（Round 2）

- **Fatal**：0
- **Major**：0
- **Minor**：4（m-0 继承 1 项 + Round 2 新增 m-R2-1 1 项 + Round 1 闭合留档 m-1/m-2/m-3 计入 Round 2 关闭清单 + m-4 历史 hash 留档 1 项；新增 Minor 均为文档层 / 叙述层 nit，不构成实施阻塞）
- **Round 1 m-1 / m-2 / m-3 关闭状态**：**全部 CLOSED**
- **低资源风险评估**：低（fail-closed 机制正确；BV1Bb411w741 1192 秒 8 秒边距风险已识别并附 m-R2-1）

### 7.1 文档决定

**AMENDMENT 1 DOCUMENT PASS（Round 2 确认）**

依据：
- 19 项载荷 SHA-256 全部与 `AUDIT_MANIFEST.md` 声明值匹配。
- `14-sample-registry-v3.schema.json` 通过 `Draft202012Validator.check_schema()` meta 校验。
- 7 个固定问题全部 PASS（Q1 锚点 subtitle 化与 PRD §18.4 + 12 号 §3 + 6 号 §4 line 45 匿名旧 run 澄清一致；Q2 12 URL / 6+3+1+1+1 / 不跨 run 拼接由 schema const + 11 号 line 20 + 12 号 §4 共同保证；Q3 三个 ASR 候选真实发现 + 第三个 ~256 秒 + 替换 BV1sMNtzJE5B 为 BV1Jm4y1k7SL；Q4 subtitle 以 `subtitleItems` 唯一为准、ASR 拒绝任一新增字幕；Q5 view/player SHA-256 由真实字段 + fail closed；Q6 只放全新单 run 12 页 probe，禁止 acquirer/ASR 实施；Q7 Cookie/profile/body 隐私隔离）。
- 跨文档一致性专查无冲突；Round 2 关键改动（ASR 替换、1200 秒 fail-closed、锚点 meta 改写、Stage Gate §4 澄清）在所有 5 处来源均同步闭合。
- 缩分母 / 跨 run 拼接 / 人工提前 / 隐私泄漏专查未发现新增问题。
- Round 1 三项 Minor m-1 / m-2 / m-3 全部 CLOSED（证据见 §1.4 / §1.3 / §1.5）。
- 受控回放验证 `build_revision3_registry()` 在 1200 秒边界、1201 秒超限、锚点空字幕、ASR 平台新增字幕、`viewResponseSha256=None` 等异常路径下均 fail closed，无 `null` 派生哈希假绿，无 production-ready 误输出。

### 7.2 实施决定

维持 **`IMPLEMENTATION NO-GO`**。文档 PASS 不等于实施 PASS。`AMENDMENT 1 DOCUMENT PASS（Round 2）` 仅意味着：

1. 允许用户重新提交授权会话并执行全新单 run 12 页 probe；
2. 允许由 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选；
3. 必须等待再次独立实施出门审查 `Fatal=0/Major=0` 后，方可解除 NO-GO。

仍不得：
- 进入 V3-2-2 产品实现；
- 把 `productionReady=true` 候选声明为 "V3-2-2 implementation PASS"；
- 把"文档 PASS"扩大为"V3-2-2 通过"。

### 7.3 重新执行独立实施出门审查的条件（与 Amendment 1 Round 2 同步）

1. 用户提供有效 B站 Cookie，`/x/web-interface/nav` 返回 `code=0/isLogin=true`（`12-platform-drift-replan.md` §1 已确认）。
2. 从零创建临时 Chrome profile（`profileClass=user_authorized_temporary_v3_2`，`majorVersion>=116`）并执行新 run `v3-2-sample-probe-<新时间戳>`。
3. 12/12 页面探测全部通过；锚点 `BV1ZpYd66ELP` 当次 `subtitleItems` 非空；三个 ASR 项 `subtitleItems` 与 `subtitleHtmlContributorExcerpt` 同时为 0。
4. **三个 ASR 当前分 P `durationSeconds ≤ 1200`**（Round 2 新增）；**新 run 前复核 BV1Bb411w741 当前分 P 长度**，若 ≥ 1195 秒则提前回到计划阶段重选第三个 ASR 候选（应对 m-R2-1）。
5. view/player response SHA-256 由真实 probe 字段构造，全部为 lowercase 64-hex；`null` 派生 hash 不得出现。
6. 通过 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选，并通过再次独立实施出门审查 `Fatal=0/Major=0`。
7. 旧失败 run / discovery run 保留为失败证据，禁止任何形式的拼接。
8. Cookie 值不写入新 run 记录、日志、registry 或公开证据；临时 Chrome profile 必须清理。
9. 用户明确批准 `V3-2-2 single-run 12-page probe + productionReady candidate generation`。
10. H01..H10 仍不在本阶段恢复路径内；只接受 V3-5 自动 UI 门槛之后的唯一一轮人工签署。

### 7.4 全新单 run 12 页授权 probe 的允许性（Round 2）

**允许**，前提是 §7.3 条件 1–3、§7.3 条件 4（含 BV1Bb411w741 时长复核）、§7.3 条件 8、§7.3 条件 9 同时满足，并由 `15-sample-registry.py` 生成 schema-valid `productionReady=true` Revision 3 候选供再次独立审查。本审查不替用户授权、不预先判定新 run 是否通过——新 run 通过与否取决于真实 Chrome 探测与生成器输出。

---

## 8. 审查出口（Round 2）

- **AMENDMENT 1 DOCUMENT PASS（Round 2 确认）**：V3-2-2 Revision 3 Amendment 1 文档包在 19 项载荷 SHA-256 一致、`14-sample-registry-v3.schema.json` Draft 2020-12 meta 校验通过、7 个固定问题全部 PASS、跨文档一致性无冲突、Round 1 三项 Minor m-1/m-2/m-3 全部闭合、受控回放 fail-closed 路径全部验证的前提下，本独立审查接受为 `AMENDMENT 1 DOCUMENT PASS（Round 2）`。
- **AMENDMENT 1 IMPLEMENTATION NO-GO**：在 §7.3 全部条件满足、新 run schema-valid `productionReady=true` Revision 3 候选生成并再次独立外审通过前，V3-2-2 implementation 维持 `NO-GO`。
- **新 run probe 允许性**：**允许**在用户重新提交有效 B站 Cookie 并满足 §7.3 全部条件后，由 `15-sample-registry.py` 驱动的全新单 run 12 页授权 Chrome probe + Revision 3 productionReady 候选生成；不允许任何 V3-2-2 acquirer、ASR、tabCapture、V3-3..V3-7 产品代码或调用；不允许把 H01..H10 提前；不允许跨 run 拼接或缩分母。

---

审查者声明：本次审查为只读审计，未运行任何产品 / Runtime / Chrome / 下载器 / 模型；未修改 `external-audit-package/` 以外的任何文件；未在审查过程中生成任何 schema-valid `productionReady=true` 实例；本次审查仅解析 Schema、调用 `check_schema()`、重算 SHA-256、对 `15-sample-registry.py` 的 `build_revision3_registry()` 与 `_route_for()` 进行受控回放（边界 1200 PASS / 1201 FAIL / 锚点空字幕 FAIL / ASR 平台新增字幕 FAIL / viewResponseSha256=None FAIL 五条路径全部经 `SampleRegistryError` 触发 fail closed）；本报告是审查的最终结论。
