# 外部独立文档审查报告：Stage B route 2 deterministic brief composer

审查人：独立外部文档审查者（只读）
审查日期：2026-10-14
审查范围：`docs/active/project/external-audit-package/`（12 份 staged 文件 + AUDIT_MANIFEST.md）
授权依据：`01-audit-request.md`（决策 = DOCUMENT CONDITIONAL GO only；禁止批准实施、B-5、Stage B/C/D、最终 V3）

---

## 0. 上下文与基线校验（事实层）

### 0.1 载荷完整性

| 文件 | 清单声明 SHA-256 | 本次独立重算 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `c7100c2e463f6549fd5407df02e7df1db3d560fc6b73c273d4c2744e11d88f31` | 同左 | ✅ |
| `02-prd.md` | `811fcc13a2f6210b787a136a10f6215403236cb38e6cbf42256f5fcc24e38548` | 同左 | ✅ |
| `03-v3-5.10-plan.md` | `f99f4ed4dc6d6c5785b255115d1fc28b05a490245327f7d9e0792beb86b6c5ac` | 同左 | ✅ |
| `04-stage-b-plan.md` | `25f23383c138e358954c534e3c9bc7cd5c4498b853bcf822bb14468a475a212b` | 同左 | ✅ |
| `05-v2-contract.md` | `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8` | 同左 | ✅ |
| `06-v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | 同左 | ✅ |
| `07-b5-risk-stop.md` | `1b2e1e87e1d34823f01ae1c332fa6af6c92151dc2d20dbfd0790b6eb2155113d` | 同左 | ✅ |
| `08-route-2-replan.md` | `73fded78dce57dadcfd44d0cddfb6f3c9d0f76d8e138784d0164214a68fd072a` | 同左 | ✅ |
| `09-v2.1-addendum.md` | `501fa0214c7ae2f642e77737e50db20eec55c61c04658082f5f6921ec2c4eaae` | 同左 | ✅ |
| `10-v2.1.schema.json` | `39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231` | 同左 | ✅ |
| `11-preimplementation-audit.md` | `edd7577b8a9279160c1b3a771c9e8c0e9f2f62b2c9e8a17589ed7c13ddcbf091` | 同左 | ✅ |
| `12-six-video-registry.json` | `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` | 同左 | ✅ |

工具：`hashlib`（Python 标准库）。
结论：12/12 staged 文件 SHA-256 与 `AUDIT_MANIFEST.md` 完全一致。**载荷未被篡改。**

### 0.2 JSON Schema Draft 2020-12 meta 有效性

工具：`jsonschema.Draft202012Validator.check_schema`（Python `jsonschema==4.23.0` 标准库依赖）。

| Schema | `$schema` | `schemaVersion` const | 顶层 required | meta 校验 |
|---|---|---|---|---|
| `06-v2.schema.json` | `https://json-schema.org/draft/2020-12/schema` | `v3-media-grounded-comprehension/v2` | `schemaVersion, binding, brief, claims, chapters, regions, quality, receipt` | ✅ PASS |
| `10-v2.1.schema.json` | `https://json-schema.org/draft/2020-12/schema` | `v3-media-grounded-comprehension/v2.1` | `schemaVersion, binding, brief, claims, chapters, regions, quality, receipt` | ✅ PASS |

V2.1 的 `Brief` 在 `additionalProperties: false` 约束下，额外通过 `allOf` 强约束 `origin` 与 `sourceClaimIds` 互斥语义：
- `origin=provider` ⇒ `sourceClaimIds.maxItems=0`
- `origin=deterministic_claim_composer` ⇒ `sourceClaimIds.minItems=2, maxItems=3`

结论：**两个 schema 都是合法 Draft 2020-12 meta-schema；V2.1 的 brief.origin/sourceClaimIds 互斥语义在 JSON Schema 层即被强制。**

---

## 1. 八个问题逐项审查（依据给到段落/字段）

### Q1. replan 是否保留 PRD"基于证据的全片理解"目标，没有回到转写拼接？

**结论：保留。无 Fatal / Major。**

- `02-prd.md` §18.2（行 2281-2302）"权威范围与出门体验"明确 Side Panel + Media Workspace 全片路径；BRIEF 对应"一句话结论"。
- `04-stage-b-plan.md` 第 13-22 行：BRIEF = 20-100 Unicode 字符 + 2-8 直接证据 claim + 全片 opening/middle/ending 章节。
- `05-v2-contract.md` 第 38-46 行：brief.text 受 V3510B_BRIEF_LENGTH_INVALID / V3510B_BRIEF_RAW_PREFIX 双校验，evidence IDs 必须触及每个 substantive 区域。
- `08-route-2-replan.md` 第 31-44 行：composer 只组合**已通过 V2 全验证**的 provider claims；每一句话仍带直接 evidence IDs 与 region 标签。
- `09-v2.1-addendum.md` 第 36-50 行：选定子集仍受 20-100 字符、原始转写 excerpt 校验、全 substantive region 覆盖约束。

**Minor（m1-可读性）**：BRIEF 由 2-3 个 claim 文本以 `；` 拼接而成，可读性弱于 provider 合成的全片概括。`11-preimplementation-audit.md` 第 26-28 行（"M-1 user-visible fluency"）已自我承认并保留 UI 明示 origin + ≤3 claims 的缓解。本审查接受该限制。

---

### Q2. 本地合成是否只对两个命名 brief 失败触发，其余 claim/chapter/evidence/authority 错误保持 fail-closed？

**结论：是。无 Fatal / Major。**

依据：

1. `08-route-2-replan.md` 第 30-31 行（白名单）：composer 仅在 `V3510B_BRIEF_LENGTH_INVALID` 或 `V3510B_BRIEF_RAW_PREFIX` 之后进入。
2. `09-v2.1-addendum.md` 第 30-34 行：composer "不能恢复 provider response shape、claim、chapter、evidence、authority、coverage 或 conflict errors"。
3. `09-v2.1-addendum.md` 第 59-67 行新增 V3510B21-N01..N08 八条负向义务：
   - N01：单 claim 不能作为 composed brief
   - N02：缺失 substantive region 子集不能恢复
   - N03：原始转写 claim 文本不能恢复
   - N04：超过 100 字符不能截断
   - **N05：非 brief 的 provider 失败不能进入合成**（关键）
   - N06：陈旧 revision/catalog/authority 不能 commit
   - N07：provider-origin 输出不能伪装本地合成
   - N08：V2.1 失败不能改动既有 V2/V2.1 字节
4. `05-v2-contract.md` 第 88-104 行：除 BRIEF 之外的 6 类 `rejected/limited` 失败码主导即阻止发布。

**Minor（m2-隐式门禁）**：`08-route-2-replan.md` 第 49 行提到"existing provider repair attempt"，但该术语未在父文档定义。其隐含语义由 `07-b5-risk-stop.md` 第 16-20 行（"第二次尝试已含一次 provider-side full-contract regeneration"）支撑，且 composer 仅在 repair 之后才进入，建议在实现时把 repair attempt 的定义固化为代码 contract，避免后续扩展时误读。

---

### Q3. V2 不可变与 V2.1 共存/读取优先级是否清晰无歧义？

**结论：是。无 Fatal / Major。**

依据：

1. `09-v2.1-addendum.md` 第 9-16 行：V2 immutable 且保持可读；V2.1 是 route-2 授权后的唯一新写入格式；读路径优先 V2.1，回退 V2，**不得跨文件合并字段或迁移/删除旧证据**。
2. `08-route-2-replan.md` 第 53-58 行：V2.1 路径 = `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`；读取优先级 `V2.1 > V2 > V1`。
3. `06-v2.schema.json` 与 `10-v2.1.schema.json`：`schemaVersion` 分别为 `const "v3-media-grounded-comprehension/v2"` 与 `const "v3-media-grounded-comprehension/v2.1"`，两 `$id` 不同，无路径冲突。
4. `05-v2-contract.md` 第 8-22 行：V2 仍用 temp + atomic replace；V2.1 失败不能覆盖 V1 路径 `synthesis/<taskId>/revision-<revision>.json`。

未观察到 V2 历史读路径被改写或被 V2.1 替换的情形；新写入仅落在 V2.1 独立目录。共存的字段命名空间互不重叠（V2.1 仅新增 `brief.origin` 与 `brief.sourceClaimIds` 两个字段）。

---

### Q4. V2.1 是否充分披露结果 provenance，防止"provider brief 与 deterministic 合成 brief 混淆"？

**结论：是。无 Fatal / Major。**

依据：

1. `10-v2.1.schema.json` Brief 的 `allOf` 分支：
   - `origin=provider` ⇒ `sourceClaimIds` 必须为空数组。
   - `origin=deterministic_claim_composer` ⇒ `sourceClaimIds` 必须含 2-3 个 `claim_*[a-f0-9]{16}`。
   - `additionalProperties: false` 禁止额外字段。
2. `09-v2.1-addendum.md` 第 52-56 行：UI 可渲染 `由模型直接生成` / `由已核验证据组合`；该渲染仅是显示，**不得篡改 quality.status**。
3. `09-v2.1-addendum.md` 第 65-66 行：N07 明令 "provider-origin 输出不能伪装成本地合成"。
4. `10-v2.1.schema.json` 的 `Receipt.outboundDerivedTextSha256` 仍记录 `const 0` 的 raw 类上传计数（rawVideo/Audio/Frame/Cookie/ApiKey/LocalPath 各 0），provenance 强度足以在反查时区分两类。

注：provenance 的最强保证来自 JSON Schema `allOf` + `const 0` 上传计数器 + N07 负向义务三层叠加，符合 "provided evidence-to-policy strong enough to prevent confusion" 的要求。

---

### Q5. 算法能否被确定性地实现，且不引入语义发明、阈值降低、截断或填充？

**结论：能。无 Fatal / Major。**

依据：

1. `08-route-2-replan.md` 第 31-44 行：明令"deterministic selection: maximize required-region coverage, then minimize character count, then use original claim index order"；明令"no padding, truncation, local paraphrase, chunk-summary promotion or threshold reduction"。
2. `09-v2.1-addendum.md` 第 36-50 行：判定函数完全确定性：先 2 claim 组合、然后 3 claim 组合；filter 维度（长度、region、evidence ID、raw excerpt）显式列出；ranking 与 tie-break 显式列出；"No stochastic choice, truncation, padding, synonym replacement or inference is permitted"。
3. 算法输入是已通过 V2 claim schema 校验的 claim 集合 + 已通过 chapter schema 校验的 chapter 集合；输出是 `text + evidenceIds + regions + origin + sourceClaimIds`。**无新语义生产路径**。
4. 算法不会触发 schema 级词汇表 schemaVersion 字段的修改（`schemaVersion` 仍是 `v2.1`，不是 `v2`）。

**Minor（m3-隐式阈值）**：addendum 第 43 行 "join normalized claim texts with `；` and retain only 20-100 character results" 隐含一个事实：当 provider claim 平均长度 ≥ 35 字符时，2-3 claim 拼接通常 > 100 字符，composer 必须返回原始 brief 失败。建议实现时把"无有效子集 ⇒ 保持原失败码"路径单独打日志而非 silently fail，以避免排障混淆。**这不是 schema 缺陷，是实现建议。**

---

### Q6. 隐私/上传计数与 commit 屏障是否保留？

**结论：保留。无 Fatal / Major。**

依据：

1. `06-v2.schema.json` 与 `10-v2.1.schema.json` 的 `Receipt.required` 完全相同，包含 6 个 `const 0` 计数：`rawVideoUploadCount` / `rawAudioUploadCount` / `frameByteUploadCount` / `cookieUploadCount` / `apiKeyDisclosureCount` / `localPathUploadCount`。两个 schema 在隐私计数层完全等价。
2. `08-route-2-replan.md` 第 62-66 行：composer 只接收"provider candidate + 已有 in-memory derived evidence catalog"，**不发网络请求，不写中间文件**；raw 类上传计数仍为 0。
3. `05-v2-contract.md` 第 107-113 行：沿用既有 per-task derived-text 同意；撤销或陈旧 authority 在 commit 前拒绝写入。
4. `09-v2.1-addendum.md` 第 16 行 + N06 + N08：失败 V2.1 写入保留 V2/V2.1 既有字节；陈旧 revision/catalog/authority 不能 commit。

注：`schemaVersion=v2.1` 在 commit 前由 validator 全套检查，且 Receipt 字段是强制 required，无可选绕过路径。

---

### Q7. 负向义务与六视频真实分母能否足以拒绝 false green？

**结论：在文档层面足够。实施验证仍待 B-5。**

依据：

1. **六视频固定分母**（`12-six-video-registry.json` 全部字段 + `04-stage-b-plan.md` 第 73-87 行）：
   - 6 个固定 BVID：`BV1pohR6rEEh`、`BV1hMpE6FEXG`、`BV1VHHe6kEH3`、`BV1SDHy6aEiB`、`BV1vSHD6tEsM`、`BV1FCps68EGf`
   - `allowedFinalDispositions = ["complete", "limited", "blocked", "failed"]`
   - `positiveDisposition = "complete"`（只有 complete 算正向）
   - `maximumBlockedForStageExit = 1`（≥2 blocked 即触发 NO-GO/replan，对应 `04-stage-b-plan.md` 第 79-82 行）
   - `substitutionAllowed = false`
   - `crossRunArtifactReuseAllowed = false`
   - `freshIsolationRequired = ["runtime", "database", "chromeProfile", "task"]`
   - `chromeRequiredFlags = ["--mute-audio"]`
2. **负向义务**：
   - V3510B 既有 16 类 failure codes（`06-v2.schema.json` FailureCode 枚举 + `05-v2-contract.md` 第 82-101 行）
   - V3510B21 新增 8 条负向义务（N01..N08，见 addendum 第 60-67 行）
3. **host-model review + 独立实施出门审计**：父计划第 90 行与 B-6/B-7 子阶段要求"独立机器 + 独立 review + 独立 audit"三层。
4. **`11-preimplementation-audit.md` 第 29-31 行（M-2）**：自我承认"该 replan 仅由 1 个分母视频激发"。文档层面已明示。

**Minor（m4-单视频动机）**：与 M-2 重复登记。本审查未升级为 Major，因为：
- 真实分母未缩；
- 路径 6/6 fresh run 仍为 B-5 出门硬条件；
- host semantic review + B-7 独立 audit 是另一道闸门。

**Minor（m5-失败处置的 silent 风险）**：`07-b5-risk-stop.md` 第 36-37 行只记录 6 个失败 artifact 哈希，未明示 B-5 真实跑是否会以某种"重跑同一台机器 / 同一个 profile"再次触发该失败。建议实施前增加"失败重试须重新初始化 freshIsolationRequired 中所有四项"的实现级断言。

---

### Q8. 实施前是否还存在 Fatal 或 Major 级歧义？

**结论：未发现 Fatal 或 Major 级歧义。**

依据：本审查对每份 staged 文件做了字段级一致性核查；除上列 m1-m5 五条 Minor 外，未观察到下列风险征兆：
   - 未发现 schemaVersion 混淆（两 schema const 互斥）
   - 未发现 cookie/api-key/raw-media 上传计数被绕过（Receipt const 0 + composer 不发网络）
   - 未发现 V1/V2 路径被迁移/删除（两 addendum 行文与 V2 contract 第 16-19 行一致）
   - 未发现 B-5 之后的 stage 自动放行（PRD §18.9 与 addendum 第 86-90 行均要求用户显式授权 `Stage B route 2 implementation`）
   - 未发现 Stage C/D / 最终 V3 自动通过（父计划与 addendum 都把范围限定在 Stage B BRIEF 恢复）

**本审查未将下列文档内矛盾上升为 Major**：
- 03 plan 第 7 行声明"Stage B-D implementation remains NO-GO until the preceding stage exits" → 与 addendum 第 86-90 行一致；属文档自身一致性。
- 02 PRD §18.9 第 22 行仍记 V3-2-4 处于 `IMPLEMENTATION CANDIDATE / ACCEPTANCE FAIL / REPLAN REQUIRED` → 与 addendum 第 87 行"B-5 仍 FAIL/REPLAN"一致；属真实状态自洽。

---

## 2. Findings 总览（按 Fatal / Major / Minor 排序）

| # | Severity | 标题 | 依据（文件:行 / 字段） |
|---|---|---|---|
| — | — | **Fatal 0** | — |
| — | — | **Major 0** | — |
| m1 | Minor | BRIEF 由 2-3 个 claim 拼接，可读性弱于 provider 全片概括 | `08-route-2-replan.md:31-44`、`09-v2.1-addendum.md:36-50`、`11-preimplementation-audit.md:26-28` |
| m2 | Minor | "existing provider repair attempt" 未在父合同明确定义 | `08-route-2-replan.md:49` vs `07-b5-risk-stop.md:16-20` |
| m3 | Minor | 无有效子集时 composer 静默回退到原失败码，建议加实现级日志 | `09-v2.1-addendum.md:43-47` |
| m4 | Minor | replan 仅由 1 个分母视频激发（项目自审 M-2 重复登记） | `11-preimplementation-audit.md:29-31` |
| m5 | Minor | B-5 失败重试须显式重新初始化 `freshIsolationRequired` 四项 | `12-six-video-registry.json` `freshIsolationRequired` + `07-b5-risk-stop.md:26-36` |

---

## 3. 与项目自身结论的对照

| 项目内部声明 | 本审查对照结果 |
|---|---|
| `01-audit-request.md` Candidate: "Fatal 0 / Major 0 / Minor 2, DOCUMENT CONDITIONAL GO only" | 本审查：Fatal 0 / Major 0 / Minor 5（含项目自承认的 2 条） |
| `11-preimplementation-audit.md`: Fatal 0 / Major 0 / Minor 2 | 本审查：Fatal 0 / Major 0 / Minor 5（本审查把 m1 与 m4 拆得更细，并新增 m2/m3/m5 三条实现层建议） |
| 范围限定：B-5 FAIL/REPLAN；B-6/B-7、Stage C/D、最终 V3 仍 NO-GO | 本审查：完全认可；放行范围不得超过文档与 schema 候选准备 |

**Minor 数量差异说明**：本审查把 `11-preimplementation-audit.md` 的 "M-1 fluency" 与 "M-2 real-provider generalization" 拆细为 5 条独立 Minor（保留项目原 2 条，新增 3 条实现层建议），便于后续独立复审逐项验证。

---

## 4. 最终决策

```
DOCUMENT CONDITIONAL GO
```

放行范围（仅以下行为被允许，且不得扩大）：

1. 继续 route 2 的 schema 候选与 fixture 编写（基于 10-v2.1.schema.json）。
2. 进行独立的 V2/V2.1 文档复审（即本审查的产出）。
3. 等待用户**显式**批准 `Stage B route 2 deterministic brief composer implementation`，未获批前**不得进入实施**。

不放行：

- 任何 V2.1 schema 字段扩展、增加可选字段、放宽 `const 0` 上传计数器。
- 任何 V2 / V1 路径的迁移、改写或删除。
- B-5 实施、B-6 host semantic review、B-7 独立 audit、Stage C/D、最终 V3、V3-2/V3-5 后阶段、V4 知识能力、跨平台扩展、自动化维护/Durable Forget。
- 把 `provider-origin` 标注的 brief 伪装成 `deterministic_claim_composer`，反之亦然。
- 把"reject 任一 ≤100 字符的 claim 子集"在 6 视频失败后降低阈值、截断或填充通过。

---

## 5. 验证建议（仅供后续独立复审参考，不属本次放行）

1. 用 `hashlib` 与 `jsonschema.Draft202012Validator` 已确认 12/12 staged 文件 SHA-256 与两 schema meta 均合法。
2. 后续独立复审可使用 `Draft202012Validator(schema).is_valid(positive_instance)` 与 `is_valid(negative_instance)` 验证 V2.1 的 8 条负向义务（N01..N08）是否在 schema 层即被强制——已观察到 `allOf` 强制 origin/sourceClaimIds 互斥、`const 0` 强制上传计数、`additionalProperties: false` 禁止扩展字段。
3. 后续实施前需先冻结 "existing provider repair attempt" 的 contract 定义（m2）。
4. B-5 真实跑前需写 explicit assertion：每次失败 retry 必须重建 `freshIsolationRequired` 中所有四项（m5）。
5. composer 无有效子集时建议加日志埋点（m3）。

---

## 6. 审查约束自检

- ✅ 本审查仅读取 `docs/active/project/external-audit-package/`，未触动任何文件。
- ✅ 本审查未运行任何产品代码、浏览器、Runtime、真实 provider。
- ✅ 本审查未把文档通过扩大为实施、B-5、Stage B/C/D 或 V3 通过。
- ✅ 本审查结论与 `01-audit-request.md` "Decision requested" 范围一致：仅判断"文档是否足以支持用户**再**批准 route 2 实施"，**不批准**实施本身。