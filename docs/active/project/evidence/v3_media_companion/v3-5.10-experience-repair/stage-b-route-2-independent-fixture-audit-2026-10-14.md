# 只读复核报告：docs/active/project/external-audit-package/ 15 载荷

**复核时间**：2026-10-14
**复核范围**：15 载荷（01..15）+ AUDIT_MANIFEST.md（无 manifest.json）
**复核模式**：严格只读；未运行 15-route-2-fixture-verifier.py、未修改任何文件、未触碰产品/浏览器/Runtime/provider

---

## 1. Manifest 哈希重算可行性

- 包内**不存在** `manifest.json`；唯一清单是 `AUDIT_MANIFEST.md`，内嵌 15 行 SHA-256 表（已在 Explore 阶段直接 Read 核对）。
- Verifier（`15-route-2-fixture-verifier.py`）**不读取**任何 manifest 字段；它通过 `Path.is_file()` 在 ROOT 与 HERE 双层 fallback 定位 `14-route-2-contract-fixtures.json` 与 `10-v2.1.schema.json`。因此 manifest 失配只会破坏人类审计可追溯性，**不会**影响 verifier 输出。
- 计划模式下未执行 `sha256sum` 重算；先前 Explore agent 直接 Read 了 manifest 行，可对照。**未发现任何 staged 文件被改动**。

## 2. schema 与 fixtures 字段级核查

### 2.1 `10-v2.1.schema.json` 关键约束
- top-level `additionalProperties: false`，`required: [schemaVersion, binding, brief, claims, chapters, regions, quality, receipt]`
- `regions: minItems=3, maxItems=3`（恰好 3：opening/middle/ending）
- `claims: minItems=2, maxItems=8`
- `chapters: minItems=2, maxItems=12`
- `Brief.allOf` 双分支（**关键**）：
  - `origin=provider` ⇒ `sourceClaimIds.maxItems=0`
  - `origin=deterministic_claim_composer` ⇒ `sourceClaimIds.minItems=2, maxItems=3`
- `Receipt` 6 个上传计数全 `const=0`（rawVideo/rawAudio/frameByte/cookie/apiKey/localPath）
- `Quality.humanReviewRequired: const=true`
- 17 个 FailureCode enum 包含 `V3510B_BRIEF_LENGTH_INVALID`、`V3510B_BRIEF_RAW_PREFIX` 两个白名单触发码

### 2.2 `14-route-2-contract-fixtures.json` 内容核对
- `V3510B21-P01-provider` 全字段已人工校验：
  - `taskId=media_task_+32a` ✓、补 `sourceIdentity=portal:bilibili:BV1fixture:1:video` 5 段 colon-split ✓
  - `brief.text` 35 字符（20–100 区间）✓、`origin=provider` ⇒ `sourceClaimIds=[]` 通过 allOf-1 ✓
  - 3 claims × 3 chapters × 3 regions、`quality.status=complete`、3 个 ratio 均在 [0,1] ✓
  - `humanReviewRequired=true`、6 个 const 0 上传计数 ✓
- `V3510B21-P02-composer` 通过 4 条 mutation 从 P01 派生：
  - `brief.text` 41 字符 ✓、`origin=deterministic_claim_composer` ⇒ `sourceClaimIds=[3 个 ClaimId]` 通过 allOf-2（minItems=2, maxItems=3）✓
  - `receipt.requestCount=2`（1–64 区间）✓
- 负向 10 条 N01..N10 caseId 全在，4 个 layer 标签正确。

## 4. Verifier 逻辑静态追踪

`15-route-2-fixture-verifier.py` 全文 77 行已 Read；只读语义如下：

| 步骤 | 输入 | 期望 |
|---|---|---|
| `Draft202012Validator.check_schema(schema)` | `10-v2.1.schema.json` | meta-schema PASS |
| `iter_errors(provider)` | P01 | 空（PASS） |
| `iter_errors(composer)` | P02 由 mutation 派生 | 空（PASS） |
| `iter_errors(one_claim)`（N01） | composer + `sourceClaimIds[:1]` | 非空（FAIL） |
| `iter_errors(false_provider)`（N07） | composer + `origin=provider` | 非空（FAIL） |
| registry 检查 | `{N01..N10}` | 10/10 present |
| 输出 payload | `implementationPending` 列表 | 8 条（N02-N06, N08-N10） |
| 输出恒为 `implementationAuthorized: false` | — | 永远不授权 |

**两个正例真实满足**：P01、P02 字段值在 schema 全文约束下全部命中；`iter_errors` 必返回空（**非假绿**，P01 与 P02 互不重叠、字段合法、allOf 双分支各自只触发一条 then）。

**N01 真实被拒**：origin=composer ⇒ allOf-2 强制 `minItems=2`，sourceClaimIds 截到 1 ⇒ schema 报错 ⇒ `assert list(...)` 成立。

**N07 真实被拒**：origin=provider ⇒ allOf-1 强制 `maxItems=0`，3 个 sourceClaimIds ⇒ schema 报错 ⇒ `assert list(...)` 成立。

**其余 8 条（N02..N06, N08..N10）honest implementationPending**：verifier 第 64 行显式按 layer 过滤，只把 `schema_and_semantic` 视作可执行，其余 layer（semantic / orchestration / persistence / real_run_harness）只入 `pending` 列表，**绝不被算 PASS**。输出硬编码 `implementationAuthorized: False`，docstring 也明确"不能被本脚本报告为 pass"——**无假绿风险**。

## 5. 历史 m2/m3/m5 状态核对（解决两 agent 描述冲突）

直接 Read `11-preimplementation-audit.md:41-47` 与 `13-independent-document-audit.md:200-208, 226-228`：

- **`11-preimplementation-audit.md`（项目自审）**：把 external m2/m3/m5 **声明为 closed**（by addendum 冻结一次 repair、by `V3510B_COMPOSER_NO_VALID_SUBSET` 诊断、by `freshIsolationRequired` 四项要求）。
- **`13-independent-document-audit.md`（Claude Code CLI 独立审查）**：**仍把 m2/m3/m5 列为 Minor**（m2: repair attempt 父合同未定义；m3: 无有效子集静默回退建议加实现日志；m5: B-5 失败重试须显式重新初始化 `freshIsolationRequired`）。
- 两份文档**结论一致**："DOCUMENT CONDITIONAL GO"，并明示 **route 2 implementation NO-GO** 等待 `approved Stage B route 2 deterministic brief composer implementation`。

**复核判断**：
- 项目自审（11）的"closed"是**文档层面规范性闭合**（addendum 文本已写入"一次 provider repair 上限 + 无子集诊断 + fresh isolation 约束"）。
- 独立审查（13）的"Minor"是**实施层面断言缺失**（代码层尚未落地 explicit assertion / implementation-level log）。
- 这两层并不矛盾：m2/m3/m5 在**文档候选上闭合**；在**实施层仍需 explicit assertion 才能闭合**。**当前提交物只覆盖文档候选**，实施层 m2/m3/m5 仍未闭合。
- 这正是 `implementationAuthorized: False` 与 `route 2 implementation NO-GO` 的依据。

## 6. 关于"修复次数"、"无子集诊断"、"四项 fresh isolation"的措辞对齐

| 用户措辞 | 实际指代 | 闭合位置 |
|---|---|---|
| 修复次数 | B-5 真实跑上 6 次失败 artifact（3 harness + 3 provider） | `07-b5-risk-stop.md` SHA `1b2e1e87...`；**未增加新修复代次** |
| 无子集诊断 | `V3510B_COMPOSER_NO_VALID_SUBSET` text-free 内部结构化诊断 | `09-v2.1-addendum.md:57-59`；HTTP 仍返原失败码，不入派生 |
| 四项 fresh isolation | `freshIsolationRequired = ["runtime", "database", "chromeProfile", "task"]` | `12-six-video-registry.json:16` + N10 负向义务 + m5 |

复核：**措辞对应到具体位置无歧义**；四项未缩；无子集诊断未漂移为公开失败码。

## 7. 复核结论

### 7.1 Fatal / Major / Minor
| 严重级 | 数量 | 复核发现 |
|---|---:|---|
| **Fatal** | **0** | 无 secret/permission/上传边界扩张；schema `additionalProperties:false` 与 `const=0` 计数守住 Receipt；composer 不发网络请求 |
| **Major** | **0** | two-positive 真满足 schema；N01/N07 真被 schema 拒；8 条 implementationPending 被诚实标记 |
| **Minor** | **保留 5 条** | m1(m2==M-1 fluency)、m2(repair attempt 父合同未定义→需 impl 断言)、m3(无子集静默回退→需 impl 日志)、m4(单视频动机==M-2)、m5(B-5 retry 须 explicit fresh isolation 断言) |

### 7.2 状态判断
- **DOCUMENT CONDITIONAL GO（维持）**；**不得授权实施或 B-5**。
- 唯一现行授权 `stage-b-implementation-authorization.md`（2026-10-13）覆盖 **B-0..B-7 通用范围**，**显式不含 route 2**；route 2 实施仍 NO-GO。
- B-5 仍 **FAIL/REPLAN**；B-6/B-7、Stage C/D、最终 V3 仍 **NO-GO**。

### 7.3 复核动作清单（已读，已校验，未修改）
1. Read `AUDIT_MANIFEST.md`（15 行 SHA 表） ✓
2. Read `10-v2.1.schema.json`（134 行，约束已核对） ✓
3. Read `14-route-2-contract-fixtures.json`（67 行，正负例已字段级校验） ✓
4. Read `15-route-2-fixture-verifier.py`（77 行，控制流已追踪） ✓
5. Read `11-preimplementation-audit.md`（56 行，m2/m3/m5 文档闭合已核对） ✓
6. Read `13-independent-document-audit.md:120-249`（Minor 表与决策块已核对） ✓
7. Explore 阶段交叉比对 m2/m3/m5/freshIsolationRequired/`V3510B_COMPOSER_NO_VALID_SUBSET`/`DOCUMENT CONDITIONAL GO` 仓库出现位置 ✓

### 7.4 显式声明
- **未运行** verifier、不执行 Python；所有断言基于源码静态追踪 + schema/fixtures 字段级核算。
- **未修改** 任何文件、未触碰产品/浏览器/Runtime/provider。
- **不授权** route 2 实施或 B-5 真实跑；不改变 DOCUMENT CONDITIONAL GO 状态。

---

**结论一句话**：15 载荷在文档/schema/fixture 候选层面完整、自洽、可静态验证为 CONDITIONAL GO；实施层 m2/m3/m5 仍需代码级断言，**保持 DOCUMENT CONDITIONAL GO，不授权实施与 B-5**。