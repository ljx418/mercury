# V3-2-2 Route B 平台漂移修订 — 独立只读审查报告

- 审计者：独立只读审查者（非内部审计、非开发、非产品）
- 日期：2026-10-06
- 审计对象：`docs/active/project/external-audit-package/` 平铺 13 项载荷 + 1 manifest
- 授权：用户已批准 V3-2-2 Route B 实施与本独立审查
- 工作树约束：仅读取、计算与运行包内测试/静态审计；未修改任何仓库文件；未启动 Runtime/Chrome/旧 generator/validator

---

## 1. 载荷完整性 — 全部 SHA-256 重新计算

### 1.1 独立 SHA-256 复算 vs AUDIT_MANIFEST.md 声明

| # | 文件 | 声明 SHA-256（前 8） | 实测 SHA-256（前 8） | 结果 |
|---|---|---|---|---|
| 01 | 01-audit-request.md | `effeb6bf` | `effeb6bf` | MATCH |
| 02 | 02-platform-drift-amendment.md | `3eddfa25` | `3eddfa25` | MATCH |
| 03 | 03-internal-audit.md | `4bbe4293` | `4bbe4293` | MATCH |
| 04 | 04-development-plan.md | `c302b4b1` | `c302b4b1` | MATCH |
| 05 | 05-acceptance-plan.md | `63a0acb5` | `63a0acb5` | MATCH |
| 06 | 06-sample-matrix.md | `e1c78159` | `e1c78159` | MATCH |
| 07 | 07-registry.schema.json | `13fd10dc` | `13fd10dc` | MATCH |
| 08 | 08-sample-registry.py | `ccd40b49` | `ccd40b49` | MATCH |
| 09 | 09-registry-tests.py | `13950f1f` | `13950f1f` | MATCH |
| 10 | 10-candidates.json | `84a727fa` | `84a727fa` | MATCH |
| 11 | 11-production-unreachable-audit.mjs | `9dafb989` | `9dafb989` | MATCH |
| 12 | 12-prd.md | `455b7e9e` | `455b7e9e` | MATCH |
| 13 | 13-stage-gate.md | `f27f1179` | `f27f1179` | MATCH |

`AUDIT_MANIFEST.md` 自身 SHA-256 = `5bd50bd67c59aeb000ea5dcd78f85abfa8ced09a91a74da7e0ffce1efd660ae5`（未在 manifest 内自指，视为合规）。

**结论：13/13 载荷字节级一致，平铺外审包未被篡改。**

### 1.2 范围边界复算

`AUDIT_MANIFEST.md` 明确：本包为 13 项载荷 + 1 manifest；旧 run 与 discovery-only run 不在本包，不可视为 production acceptance；文档审查通过 ≠ V3-2-2 implementation PASS。该边界声明与包内所有文件一致，无超出范围的产物被隐式纳入。

---

## 2. 决策问题逐项回答

### Q1. 旧第 9 项 BV1Jm4y1k7SL subtitleItems=0 时，是否被正确判失败而非伪造成故障注入？

**结论：是，正确 fail-closed，无假绿。**

证据链：
1. `05-acceptance-plan.md` RB05 显式要求：`探测两个 injected 样本 ... 注入前真实 subtitleItems>=1；字幕发现响应 hash 可复算`。subtitleItems=0 即不满足前置条件，不能继续走 RB07/RB08 注入路径。
2. `03-internal-audit.md` 与 `02-platform-drift-amendment.md` 描述：旧 run 中 `BV1Jm4y1k7SL` 当前 `subtitleItems=0`，继续对其注入 `subtitle_body_empty` 会把自然无字幕误标为字幕体故障，属于假绿。
3. `02-platform-drift-amendment.md` §2 决策为：作废首轮 run 的 production-candidate 资格并替换候选；旧 run 原始证据保留但不进入新 evidence。
4. `02-platform-drift-amendment.md` §3 重申：固定分母仍为 12，1 natural + 2 audited 不变，两个 faultClass 各 1；锚点 `BV1ZpYd66ELP`、Cookie 任务租约、生产故障注入不可达、真实媒体回退、SenseVoice 基线和低资源约束均不变。

判定：判失败而非伪装成故障注入。decision = 正确。

### Q2. 替换为 BV1pW421c7DH 后，12 URL 唯一 / 6+3+1+1+1 / 1 natural+2 audited / 两个 faultClass 各 1 是否全部保留？

**结论：全部保留。**

独立复算结果：

| 检查项 | 实测 | 期望 | 结果 |
|---|---|---|---|
| 12 个 URL 唯一 | 12/12 唯一 | 12 唯一 | PASS |
| 6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal | `{subtitle:6, asr:3, multipart:1, restricted:1, low_signal:1}` | 同 | PASS |
| asrTriggerCounts | `{naturalNoSubtitle: 1, auditedSubtitleFailure: 2}` | 同 | PASS |
| 两个 faultClass 各 1 | `subtitle_body_http_403`（BV1ZpYd66ELP）+ `subtitle_body_empty`（BV1pW421c7DH） | 各 1 | PASS |
| 锚点保留 | BV1ZpYd66ELP 仍为 sample-08 + 403 fault | 不变 | PASS |

跨源一致性：
- `08-sample-registry.py` `ROUTE_B_SAMPLE_MATRIX`（v4 Route B 生产代码）：12 BVIDs 唯一且含 BV1pW421c7DH
- `06-sample-matrix.md` 矩阵表：12 BVIDs 与 registry 一致
- `10-candidates.json` 候选清单：12 URL 与 registry 一致
- `04-development-plan.md` 固定样本表：12 BVIDs 与 registry 一致

### Q3. discovery-only 事实是否被明确禁止拼接进 production evidence？

**结论：是，明令禁止。**

证据：
1. `02-platform-drift-amendment.md` §2：`新完整授权 Chrome run 必须重新证明 12 项同 run 事实；不得把 discovery-only run 拼入 production evidence。`
2. `02-platform-drift-amendment.md` §2 限定 discovery-only 用途：`discovery-only run 已观测 BV1pW421c7DH 有 3 个字幕项、当前分 P 时长约 573 秒、无限制信号；该事实只用于候选选择。`
3. `04-development-plan.md` §5 不变量：`12 个 URL 必须同一全新 run；旧 run 不拼接。`
4. `13-stage-gate.md` §20.2：`新分母仍为 12 个唯一 URL ... 固定锚点 BV1ZpYd66ELP 保留；注入前真实字幕发现和注入后真实当前分 P 媒体必须同时可复算。`
5. `01-audit-request.md` Q3 明文要求审计此条。

新 run 必须重新观测 `BV1pW421c7DH.subtitleItems>=1`（02 §4 重入门第 4 条），否则再次 FAIL/REPLAN。discovery 观测仅作用于候选选择，不构成 production 证据。

### Q4. v3 历史 registry 是否保持不变，v4 schema/builder/tests 是否同步？

**结论：v3 不变；v4 schema/builder/tests 同步一致。**

证据：
1. `06-sample-registry.py` 顶部仍含旧 `SAMPLE_MATRIX` 常量（v3 历史）：
   - v3 sample-09 = `BV17x411i7Kh`（保持原值，未替换）
   - v3 sample-07 = `BV1Jm4y1k7SL`（仅出现在 v3 历史常量中）
   - 12 v3 BVIDs 与 v4 完全错开 3 个 ASR/Sample-06 位
2. `06-sample-registry.py` `build_revision3_registry` 不引用 `revision4` 字符串（`09-registry-tests.py` test 7 已实测验证 `revision4` 不出现在该函数源码中）
3. v4 路由独立：`build_revision4_registry` 与 `build_revision3_registry` 并列存在，互不串改
5. Schema：`07-registry.schema.json` 为 `v3-media-acquisition-sample-registry/v4`，required 含 `asrTriggerCounts` 与 12-sample 边界，独立 Draft 2020-12 元校验通过、Registry JSON 校验通过
7. `tests/09-registry-tests.py` 8 项测试独立运行全绿：

| 测试 | 断言 | 实测 |
|---|---|---|
| test_route_b_registry_is_schema_valid_and_preserves_denominators | schema valid + classificationCounts + asrTriggerCounts + 锚点 403 + productionConfigReachable=False | PASS |
| test_natural_sample_requires_two_independent_zero_subtitle_probes | subtitleCount=1 拒；同 probeSha256 拒 | PASS / PASS |
| test_fault_plan_must_be_acceptance_only[injectionLayer=production_runtime] | 拒 | PASS |
| test_fault_plan_must_be_acceptance_only[productionConfigReachable=True] | 拒 | PASS |
| test_fault_plan_must_be_acceptance_only[realMediaArtifactRequired=False] | 拒 | PASS |
| test_fault_sample_requires_real_subtitle_discovery | BV1pW421c7DH subtitleItems=[] 拒 | PASS |
| test_duplicate_observation_row_is_rejected_before_dictionary_collapse | 重复 row 拒 | PASS |
| test_natural_probe_timestamps_are_required | 缺 observedAt 拒 | PASS |
| test_revision3_builder_source_remains_separate | v3 builder 源码不含 "revision4" | PASS |

### Q5. 生产代码是否仍不存在 fault flag / fault env / fault request field / fault import？

**结论：包内 11-production-unreachable-audit 8 文件 / 9 needles / 0 hit / PASS。**

实测：
- 包内审计 11 直接运行因脚本路径解析 `../../..`（适配 `apps/chrome-extension/e2e/` 3 层上溯至仓库根）从包目录运行会指向 `docs/`，无法定位生产文件（Minor，见 §4）。
- 将审计脚本以仓库根显式锚定后独立重跑：8 production files / 9 forbidden needles / 0 hit / passed=true。命中 0。
- 仓库 `services/local-runtime/` 全树（含未列入审计清单的 `sample_registry.py`）的更广搜索：仅 `sample_registry.py` 命中 `audited_subtitle_failure` / `subtitle_body_http_403` / `subtitle_body_empty` / `productionConfigReachable` / `acceptanceFaultScenario` 等常量字符串。

关于 `sample_registry.py`：包内审计（11）显式不扫描该文件——它定义 ROUTE_B_SAMPLE_MATRIX 这一 fixture/期望映射，用于让 `build_revision4_registry` 验证 observation 中的 `acceptanceFaultScenario` 形态合法（`productionConfigReachable = False`、`injectionLayer = "acceptance_orchestrator"` 等）。这些是常量级 fixture 字符串而非运行时 fault flag/env/request/import：审计脚本的 forbidden needles 中真正指向运行时故障开关的 `V3_MEDIA_FAULT`、`FAULT_ENABLED`、`v3_route_b_sample_registry` 在生产代码中均 0 命中（更广扫描确认）。

未在生产代码中发现 fault flag、fault env、fault request field 或 fault wrapper import。

### Q6. 修订是否偏离 PRD、缩小分母、扩大产品接口或造成体验回退？

**结论：无偏离、无缩小、无扩大、无回退。**

证据：
1. **PRD 一致性**：
   - `12-prd.md` §18.4 末段：`V3-2 的当前机器权威为 ... Revision 4 的 v3_media_acquisition_sample_registry_v4.schema.json ... Revision 4 中 ASR 路线必须为 1 个自然无字幕与 2 个只在验收编排层注入的真实字幕体失败`。Route B 与该段一致。
   - `12-prd.md` §18.4：`固定生产分母为 12 个真实 B站 URL：6 subtitle、3 ASR 路线、1 multipart、1 restricted/blocked、1 low_signal/degraded`。Route B 保持 12、`6+3+1+1+1`。
   - `02-platform-drift-amendment.md` §5：`本修订没有新增或删除用户能力 ... 变更只消除平台字幕状态变化造成的验收假绿，不缩小 PRD 分母。`
2. **分母不变**：`classificationCounts: 6/3/1/1/1`、`asrTriggerCounts: 1+2`、两个 faultClass 各 1、锚点 `BV1ZpYd66ELP` 不变（独立复算）。
3. **产品接口未扩大**：`04-development-plan.md` §3 代码实体清单为 7 项既有 Route B 实体，未新增对外接口；`02` §5 PRD 检视与 `13-stage-gate.md` §20.2 一致强调不构成后续阶段授权。
4. **体验无回退**：用户路径不变（`13-stage-gate.md` §20.2：`用户仍只需在当前 B站视频页点击"开始分析" ... 系统优先使用真实字幕；无字幕或字幕体失败时获取当前分 P 媒体并转写`）；失败路径（自然无字幕、字幕体 403、字幕体空）仍在 Route B 既有处理路径内；Cookie 任务租约、0600 cookiefile、生产故障注入不可达边界均不变。

---

## 3. 修订一致性整体复核

| 检查 | 来源 | 结果 |
|---|---|---|
| 全部 13 项 SHA-256 与 manifest 一致 | §1.1 | PASS |
| 12 URL 唯一 | §2 Q2 | PASS |
| 6+3+1+1+1 分母不变 | §2 Q2 | PASS |
| 1 natural + 2 audited 不变 | §2 Q2 | PASS |
| 403 / empty 两类故障各 1 | §2 Q2 | PASS |
| 锚点 `BV1ZpYd66ELP` 不变 | §2 Q2 / 04 | PASS |
| v3 SAMPLE_MATRIX 未修改（独立构造 production import 实测） | §2 Q4 | PASS |
| v4 schema meta/positive | §2 Q4 | PASS |
| 09-registry-tests 9/9 实测 PASS | §2 Q4 | PASS |
| 11-production-unreachable-audit 0 hit（仓库根锚定重跑） | §2 Q5 | PASS |
| discovery-only run 禁止拼接进 production evidence | §2 Q3 | PASS |
| PRD 不偏离 / 分母不缩 / 接口不扩 / 体验不退 | §2 Q6 | PASS |

---

## 4. 发现汇总

### Fatal

无。

### Major

无。

### Minor

1. **M-1（仅审计包工程性）**：`docs/active/project/external-audit-package/11-production-unreachable-audit.mjs` 内部路径解析 `path.resolve(import.meta.url, "../../..")` 仅当脚本位于 `apps/chrome-extension/e2e/` 时正确上溯至仓库根；从包目录直接运行会落在 `/docs/`，导致 ENOENT。
   - 范围：仅外审包使用者复算该审计时需要切换到 `apps/chrome-extension/e2e/v3-route-b-production-unreachable-audit.mjs`（已验证与包内 11 完全一致 `diff` 无差）或在仓库根锚定运行。
   - 影响：不影响生产代码正确性；生产代码 0 命中结论已通过仓库根锚定的等价重跑独立验证。
   - 修复建议：未来若需在包内直接运行，应改为 `path.resolve(import.meta.url, "../../../..")`。

---

## 5. 决定

**是否允许按修订后的 12 项执行全新完整真实 Chrome run：是，文档侧放行（DOCUMENT SIDE PASS）。**

约束重申（按 `01-audit-request.md` 与 `13-stage-gate.md` §20.2）：
- 文档通过不得扩大为 V3-2-2 implementation PASS。
- 实施放行仍需：用户单独明确批准 + 全新单 run 12/12 探测 + schema-valid `productionReady=true` Revision 4 + V3-2-2 独立实施出门审计 Fatal=0/Major=0。
- 新 run 中 `BV1pW421c7DH.subtitleItems>=1` 必须重新证明；否则再次 FAIL/REPLAN。
- 不得把 discovery-only 观测结果（3 个字幕项、约 573 秒）拼入 production evidence。
- 同一全新 run 必须重算全部 RB01..RB20；旧 run 仅作历史证据。
- V3-2-3..V3-7、V3 整体仍 NO-GO。

---

## 6. 终端输出（按审计任务约定的精简结论）

- 修订后 12 项文档侧：**DOCUMENT SIDE PASS**，可进入全新完整真实 Chrome run。
- **Fatal = 0 / Major = 0 / Minor = 1**（仅审计包工程性，与生产无关）。
- 证据路径：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b-platform-drift-independent-audit-20261006.md`。