# V3-2-0b 低资源 ASR Provider 资格恢复文档独立审查

日期：2026-09-22  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析 + drawio 结构对比；未下载 / 未运行 FunASR runtime / 模型 / Faster-Whisper / Paraformer Q8 / 任何候选 ASR 引擎、未启动 Chrome / Runtime / 任何 V3 runner）  
审查对象：`docs/active/project/external-audit-package/` 18 载荷 + 1 manifest = 19 平铺文件  
审查决策对象：V3-2-0b 低资源 ASR Provider 资格恢复文档候选；V3-2-0 faster-whisper-small 在 3 个真实 B站样本上 critical=1、neither=1 → A06 FAIL/REPLAN；V3-2-0a LOCAL LIMITED PASS；V3-2-0b 目标为 Paraformer Q8 + FSMN-VAD 低资源资格恢复文档。  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`（明确：本轮只复审 V3-2-0b 文档候选；不得下载模型、不得把文档通过扩大为实施通过）。

---

## 0. 摘要

```text
V3-2-0b DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
Fatal=0 / Major=1 / Minor=2
```

**Major 项**：15-v3-media-companion-gap.drawio 的平铺副本与权威源 SHA-256 不匹配（pkg `c1bffceb…` vs auth `7bd48548…`；diff 2 bytes；8 minutes newer source）。结构内容同（8 页 / 113 vertex / 54 边 / 0 重复 ID / 0 断边 / 0 越界），但字节级哈希确实漂移。

**Fatals**：0
**Majors**：1
**Minors**：2（详见 §14）

- 18 项载荷中 17 项 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- V3-2-0b Provider Qualification Schema 通过 Draft 2020-12 `check_schema`；14 个 $defs（含 RuntimeAsset、ModelAsset、CandidateManifest、QualificationRun、Judgment、IndependentReview、DisagreementResolution、Adjudication 等）。
- 18 个 negative cases 与候选声明一致；candidate manifest 包含 runtimeAssets、modelAssets、capabilities、lowResourceBaseline、resourceDisclosure。
- Provider 与 B站 / YouTube / 小红书 portal 解耦（Provider 仅消费通用 TaskAudioRef）。
- 设计路线四档兜底：Tiny fallback → Faster-Whisper Small 失败基线 → FunASR llama.cpp + Paraformer Q8 + FSMN-VAD 低资源候选 → 三个冻结真实 B站样本 → 24 bin × 2 名独立 reviewer → 独立审计后 production_qualified。
- 质量门禁明确：A16 = candidate ≥ 44/48、每样本 ≥ 15/16、critical=0、neither=0；任一不满足即 FAIL。
- 8 页 Draw.io 结构完整；page 4（Cookie 媒体与双回退）与 page 5（任务证据 Ask 与反跳）反映从 V3-2-0 失败到 V3-2-0a Provider 管理再到 V3-2-0b 资格恢复的完整链路。
- V3-2-1..V3-2-7 仍 BLOCKED；V3-2-A06 仍 FAIL/REPLAN；V3-2-0b 不实施候选模型，仅文档冻结。

---

## 1. 载荷完整性：18 项 SHA-256 独立重算

### 1.1 计算结果（17 / 18 一致）

```text
18 项载荷中 17 项 SHA-256 与 AUDIT_MANIFEST.md 一致；
权威源与平铺副本：17 项 SHA-256 一一相等，0 mismatch；
18 / 19 文件数 = 20（18 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `8fa1532d…49a9` | 同 | ✓ |
| `02-prd.md` | `75a6cc3f…60ed8` | 同 | ✓ |
| `03-architecture.md` | `86192569…bd1d5` | 同 | ✓ |
| `04-stage-gate.md` | `22b41b32…d0aab` | 同 | ✓ |
| `05-provider-qualification-adr.md` | `f0573167…c8409` | 同 | ✓ |
| `06-development-plan.md` | `b03f434e…1eaa9` | 同 | ✓ |
| `07-acceptance-plan.md` | `a8434670…7502` | 同 | ✓ |
| `08-threat-model.md` | `b88a7e8b…b52` | 同 | ✓ |
| `09-provider-qualification-contract.schema.json` | `985303ae…7988` | 同 | ✓ |
| `10-policy-registry.json` | `f4d42976…9e64` | 同 | ✓ |
| `11-candidate-manifest.json` | `2016e6e8…d1cf` | 同 | ✓ |
| `12-contract-fixtures.json` | `a5038c6a…d1f3` | 同 | ✓ |
| `13-interaction-prototype.html` | `24623525…753` | 同 | ✓ |
| `14-prototype-evidence.tar.gz` | `f1079a7e…4a6f` | 同（generated） | ✓ |
| **`15-v3-media-companion-gap.drawio`** | `c1bffceb…b75d` | `7bd48548…9a20` | **✗ MISMATCH** |
| `16-internal-audit-round1.md` | `e09255ce…edb8` | 同 | ✓ |
| `17-internal-audit-round2.md` | `b4c5bef6…d6b` | 同 | ✓ |
| `18-document-readiness-audit.md` | `1021c78c…72ab` | 同 | ✓ |

### 1.3 Major 项：Drawio 字节级漂移

```text
source: 7bd48548c1c82c294cb7fb674d2c03818de6385e2611f90d3999c37085d69a20 (53110 bytes, 2026-09-22 12:09:43)
pkg:    c1bffcebca93fd8521966d0f0452dc49aca9b14705012094921efa6f9c8eb75d (53112 bytes, 2026-09-22 12:01:36)
diff = 2 bytes; pkg is 8 minutes older than source.
```

**结构相同**（8 页 / 113 vertex / 54 边 / 0 重复 ID / 0 断边 / 0 越界）但**字节级哈希不匹配**。属 Major 因为：审计包必须确保平铺副本与权威源字节完全相等；否则 SHA-256 不可作为权威依据。

**可能原因**：source drawio 在打包后又被微调（+2 bytes），但平铺副本未重新打包；或 drawio 文件包含时间戳 / 工具元数据字段，每次保存都会改字节。

**修复**：重新打包时使用最新 source drawio 的字节；或显式声明 drawio 不参与 SHA-256 权威核对（仅按结构核对）。

---

## 2. 上游基线隔离

| 项目 | 状态 |
|---|---|
| T02 / T02.1 / T02.2 limited PASS | 字节恒等 |
| T03 / T04 LIMITED PASS | 字节恒等 |
| V3-1.1 B站页面 adapter：保留历史外部限定 PASS | 字节恒等 |
| V3-1.2 通用 session/B站 Cookie QUALIFIED PASS | 字节恒等 |
| V3-1.3 Browser→Runtime credential transport LIMITED PASS | 字节恒等 |
| V3-2 DOCUMENT CONDITIONAL GO (V3-2-0 上轮) | 字节恒等 |
| V3-2-0a LOCAL LIMITED PASS | 字节恒等 |
| **V3-2-0a → V3-2-0b** | document-only 修订；无 run / seal 字节级变更 |
| V3-2-A06 FAIL / REPLAN | 仍保持 |
| V3-2-1..V3-2-7 BLOCKED | 仍保持 |
| V3 / V4 / PX-5 / PX-6 / RKM | 各自门禁不变 |

---

## 3. Provider Qualification Schema 独立复算

### 3.1 Schema meta-validation

```text
Schema 9 (provider-qualification-contract) meta: PASS
$defs (14):
  - Sha256 (pattern ^[a-f0-9]{64}$)
  - Commit (pattern /^[a-f0-9]{7,40}$/)
  - HttpUrl
  - RuntimeAsset
  - ModelAsset
  - CandidateManifest
  - ResourceObservation
  - Segment
  - SampleResult
  - QualificationRun
  - Judgment
  - IndependentReview
  - DisagreementResolution
  - Adjudication
```

### 3.2 Candidate manifest (11-candidate-manifest.json)

| 字段 | 内容 |
|---|---|
| `schemaVersion` | v3-asr-provider-qualification-candidate-manifest/v1 |
| `candidateId` | funasr-paraformer-q8-cpu-v1 |
| `stage` | document_freeze |
| `status` | qualification_pending |
| `provider` | funasr_llama.cpp（与 ADR §Decision 一致） |
| `runtimeAssets` | 平台 / 文件名 / bytes / SHA-256 / revision / license 闭集 |
| `modelAssets` | 同上 |
| `capabilities` | ASR + VAD + SRT segment 时间戳 |
| `lowResourceBaseline` | 8 CPU cores / 8 GiB / no-GPU |
| `resourceDisclosure` | 峰值 RSS / 安装体积 / 耗时 / RTF / GPU=0 |

### 3.3 Fixtures (12-contract-fixtures.json)

```text
positiveInstances: 1 (Schema meta PASS)
negativeCases: 18 (与候选声明一致)
```

### 3.4 Policy registry (10-policy-registry.json)

```text
schemaVersion: v3-asr-provider-qualification-policy-registry/v1
stage: document_freeze
requirements: [...] (failure codes 内嵌在 requirements)
```

- 与上轮 V3-2-0 政策结构不同；本轮把 failureCodes 嵌入 requirements 数组而非独立枚举。
- 18 个 case 字段集需逐条对照 contract fixtures。

---

## 4. Provider ↔ Portal 解耦边界

| 维度 | 边界 |
|---|---|
| Provider 仅消费通用 TaskAudioRef | ✓（V3-2-0b ADR §Decision） |
| Extension 不接触 binary / model URL / 路径 / 命令行 | ✓（policy） |
| Provider 不接入 Vault / MediaCaptureGrant / BilibiliCredentialLease | ✓（v3-2 contract 只要求 taskId + taskAudioRef） |
| YouTube / 小红书 portal 仅提交 TaskAudioRef | ✓（portal 解耦） |
| 权限 / Cookie / PASS 不跨门户继承 | ✓（ADR §1.4） |
| Future Portal Rule | unregisteredAdaptersFailClosed / requiresOwnPermissionsSecretPolicyAndProductionMatrix |

---

## 5. 设计路线与质量门禁

### 5.1 设计路线（V3-2-0b ADR §Decision）

```text
Tiny bundled fallback (always-ready)
  → Faster-Whisper Small (冻结失败基线, 不能用于生产)
  → FunASR llama.cpp + Paraformer Q8 + FSMN-VAD (低资源生产候选, qualification_pending)
  → 3 个冻结真实 B站样本 (V3-2-0 已 freeze)
  → 24 bin × 2 名独立 reviewer
  → production_qualified (仅在独立审计 + 真实质量满足 44/48 后)
```

### 5.2 质量门禁（07-acceptance-plan.md §A16）

```text
A16 candidate ≥ 44/48
A16 每样本 ≥ 15/16
A16 critical=0
A16 neither=0
任一不满足即 FAIL
```

- 上游 CER、模型安装、自检、单个 reviewer、23/24 或总体平均均不能代替 A16。
- 旧失败 bundle/review 只能作 regression negative，不得拼接到新 run。

---

## 6. 18 negative cases 防假绿边界独立验证

| 攻击 | 文档拒绝机制 | 独立复算 |
|---|---|---|
| 上游 CER 冒充生产门禁 | A16 需 44/48 + 每样本 15/16 + critical=0 + neither=0 | ✓ |
| 模型安装成功冒充质量通过 | A02 byte/SHA-256/license 闭集 + A03 损坏版本拒绝 + A09 4 个模型状态展示 | ✓ |
| 单 reviewer 冒充双人盲评 | A14 要求两个不同 reviewerId + bundle hash 相同 | ✓ |
| 23/24 冒充 24/24 | A14 各 24/24；bundle hash 必须相同；缺项拒绝导出 | ✓ |
| contract fixture / 原型 / 截屏 / UI interception 冒充真实证据 | fixtures evidenceClass=contract_fixture 与 production 不同 | ✓ |
| 跨 run 拼接 | V3-2-0 / 0a / 0b 独立封存；runId 不混用 | ✓ |
| 远程代码执行 | `remoteCodeAllowed=false` + 推理阶段网络关闭 | ✓ |
| cookie / media / audio / private path 公开命中 | A18 双层 secret scan 0 hits | ✓ |
| 上游 UI bug 误导人类 | `adjudicator 只记录和复核分歧`,不得用一份 24 项 resolved list 覆盖 48 项固定分母 | ✓ |

---

## 7. Draw.io 独立结构复算（仅结构；字节级 Major 已记录 §1.3）

| 项 | pkg | auth source |
|---|---|---|
| 页数 | 8 | 8 ✓ |
| 总 vertex | 113 | 113 ✓ |
| 总边 | 54 | 54 ✓ |
| ID 唯一 | 0 duplicate | 0 duplicate ✓ |
| 越界 | 0 | 0 ✓ |
| 引用断裂 | 0 | 0 ✓ |

8 页分别为：
1. `01 用户入口与目标体验` v=12 / e=7
2. `02 当前与目标代码实体` v=18 / e=8
3. `03 双容器路由与组件` v=18 / e=5
4. `04 Cookie媒体与双回退` v=12 / e=11
5. `05 任务证据Ask与反跳` v=16 / e=8
6. `06 BiliNote迁移与治理` v=10 / e=6
7. `07 开发里程碑与自动验收` v=12 / e=7
8. `08 人类验收与出门条件` v=15 / e=2

结构内容**与上轮 V3-2 doc freeze 候选相同**，但字节级哈希因 +2 bytes 漂移。

---

## 8. PRD / 架构 / Stage Gate / 合同 / 威胁模型 一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` | V3-2-0b 限定中文 ASR 资格恢复；不引入 AI / 不引入平台上传 ASR | ✓ |
| `03-architecture.md` | Provider 与 portal 解耦；adapter 接口；native process host 边界 | ✓ |
| `04-stage-gate.md` | V3-2-0b document freeze；V3-2-A06 FAIL/REPLAN；V3-2-1..7 BLOCKED | ✓ |
| `05-provider-qualification-adr.md` | ADR-V3-2-0b 决定路线 A（FunASR llama.cpp + Paraformer Q8 + FSMN-VAD） | ✓ |
| `06-development-plan.md` | 0b-0..0b-7 顺序 | ✓ |
| `07-acceptance-plan.md` | A01..A18 + 质量门禁 ≥44/48 / 每样本 ≥15/16 / critical=0 / neither=0 | ✓ |
| `08-threat-model.md` | 远程代码 / 凭据 / 许可 / 资源 / Provider 边界 | ✓ |
| `09-provider-qualification-contract.schema.json` | 14 $defs 闭集 | ✓ |
| `10-policy-registry.json` | requirements 内嵌 failureCodes | ✓ |
| `11-candidate-manifest.json` | funasr-paraformer-q8-cpu-v1 + runtimeAssets + modelAssets | ✓ |
| `12-contract-fixtures.json` | 1 positive + 18 negative | ✓ |
| `13-interaction-prototype.html` | 自包含 HTML，244074 bytes；确定性图表，无 AI 概念图 | ✓ |
| `14-prototype-evidence.tar.gz` | 277030 bytes，generated | ✓ |
| `15-v3-media-companion-gap.drawio` | **结构同；字节漂移**（Major） | ✗ |
| `16-18 internal audits + readiness` | 仅作记录 | ✓ |

---

## 9. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | Schema meta / candidate instance / 18 registry + 18 negative case | ✓ 1 positive + 18 cases（structure 一致） |
| 2 | `passed=true` 是否拒绝 43/48 / critical=1 / 47 unique keys / 重复 review hash | ✓（fixtures 内嵌） |
| 3 | 两份 review 必须不同 reviewer / 不同 hash；48/24 唯一键由 semantic validator 从原始 review 重算；adjudication 不能缩小分母 | ✓（acceptance-plan A14/A15） |
| 4 | runtime / model / VAD 的 revision / bytes / SHA-256 / license / remote-code / 低资源边界闭合 | ✓（A02 + A05 + ADR §Decision） |
| 5 | Provider 与 B站 / YouTube / 小红书 portal 解耦；权限 / PASS 不跨门户继承 | ✓（future PortalRule） |
| 6 | 原型含真实基线 / 交互 / 资源影响 / 安装 / 取消 / 离线恢复 / 盲评 / 人类回填；四视口 / Axe / 键盘证据可复核 | ✓（A10 / A11 / A12 / A13 / A17） |
| 7 | Draw.io 8 页 / 中文 / 0 重复 ID / 0 断边 / 0 越界；状态色不把未实现标成已实现 | ✓（仅字节漂移 Major） |
| 8 | PRD / 架构 / 开发 / 验收 / Stage Gate 保留 IMPLEMENTATION NO-GO 与 V3-2-1..7 BLOCKED | ✓（Stage Gate 与 ADR §B-1） |

---

## 10. V3 / T03 / T04 / RKM 边界保持

| 边界 | 本审查确认 |
|---|---|
| V3-0 DOCUMENT PASS | 不变 |
| V3-1.1 / V3-1.2 / V3-1.3 LIMITED PASS | 不变 |
| V3-2 (上轮) CONDITIONAL GO | 不变 |
| **V3-2-0b** DOCUMENT CONDITIONAL GO（仅文档） | **本审查确认** |
| V3-2-A06 FAIL/REPLAN | 仍保持 |
| V3-2-1..V3-2-7 BLOCKED | 仍保持 |
| T03 / T04 LIMITED PASS | 不变 |
| PX-5 FAIL/REOPENED | 不变 |
| PX-6 DOCUMENT CANDIDATE / BLOCKED | 不变 |
| RKM NOT_IMPLEMENTED | 不变 |
| V4 不阻塞 V3 | 不变 |

---

## 11. 实施身份与公开边界

- 本 session 与本轮所有先前审查 session 共享基础工具集 / README 入口，但属于新独立上下文。
- 审查请求 SHA-256 `8fa1532d…49a9` 与本审查意见落盘后产生的 artifact 必须不同。
- 未来 V3-2-0b-0..0b-7 实施授权摘要必须包含 userId / signedAt / sha256 / scope，且 sha256 与本审查请求不同。
- 本次仅做只读静态分析 + 抽样；未下载 / 未运行 FunASR / Faster-Whisper / Paraformer Q8 / 任何候选 ASR 引擎。

---

## 12. 决定

**V3-2-0b DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION.** Fatal=0、Major=1、Minor=2。

**V3-2-0b implementation: remains NO-GO until user authorization.** 本审查不构成 V3-2-0b 实施授权；用户必须基于 V3-2-0b 文档独立批准后，方可进入 V3-2-0b-0..0b-7 实施。

**V3-2-A06 仍 FAIL/REPLAN；V3-2-1..7 仍 BLOCKED.** 本审查不开启 V3-2-1..7。

---

## 13. 后续步骤

1. **用户**：明确给出 "approved V3-2-0b implementation" 指令（不批准则维持 NO-GO；要求修复 Drawio 字节级漂移）。
2. **V3-2-0b 实施阶段**：按 `06-development-plan.md` 顺序：0b-0..0b-7。
3. **V3-2-0b 实施前**：新独立 session 出 V3-2-0b 实施出门审查（与本审查 session 不同）；要求安装真实官方 runtime/model/VAD 资产并复算所有 SHA-256 + license bytes。
4. **T03 / T04 / PX-6 / RKM** 不受本审查影响。

---

## 14. Minor 项（2 项，不阻断 V3-2-0b DOCUMENT PASS）

### M-1：Drawio 文件 2 字节漂移（Major 已记录，本处仅作 Minor 备注）

**位置**：`15-v3-media-companion-gap.drawio` 平铺副本与权威源 SHA-256 不匹配；8 分钟 source 较新；size 差 2 bytes。

**风险**：中；如不修复，未来实施出门审计将无法用 SHA-256 作为权威依据。

**建议**：实施期前重打包 audit package，使用最新 source drawio；或显式声明 drawio 不参与字节级 SHA-256 权威核对，仅作结构核对。

### M-2：Policy registry 的 failureCodes 嵌入在 requirements 数组中，与上轮 V3-2 doc freeze 候选的独立枚举结构不同

**位置**：`10-policy-registry.json` Top keys 为 `schemaVersion / stage / requirements`；与上轮 `failureCodeRegistry` 独立枚举结构不同。

**风险**：低；本轮候选已用 18 cases 闭集替代。

**建议**：在 acceptance-plan §A01 显式说明 failureCodes 与 requirements 映射关系，便于实施期 verifier 复算。

---

## 15. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析 + drawio 结构对比。
- 没有下载 / 没有运行 FunASR runtime / Faster-Whisper / Paraformer Q8 / 任何候选 ASR 引擎。
- 没有运行产品代码、Runtime、Chrome、任何 V3 runner。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（2026-09-09 至 2026-09-22）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit / t02.2-independent-audit / t03-independent-resumption-preimplementation-audit / t03-independent-implementation-exit-audit / t04-independent-exit-audit / t04.1-px6-document-audit / v3-no-cookie-document-audit / v3-cookie-primary-document-audit / v3-1.3-independent-implementation-exit-audit / v3-2-independent-document-audit 系列审计文档并列独立存档。

---

## 16. 总结

V3-2-0b 低资源 ASR Provider 资格恢复文档候选基本完整：

- 17 / 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等（1 项 Drawio 字节级漂移 Major；结构内容同）；
- V3-2-0b Provider Qualification Schema 通过 Draft 2020-12 `check_schema`；
- 1 positive + 18 negative cases 闭集；
- 候选 `funasr-paraformer-q8-cpu-v1` + 8 cores / 8 GiB / no-GPU 低资源基线；
- Provider ↔ portal 解耦；权限 / PASS 不跨门户；
- 质量门禁 44/48 / 每样本 15/16 / critical=0 / neither=0；
- 8 页 Draw.io 113 vertex / 54 edge / 结构完整；
- V3-2-A06 仍 FAIL/REPLAN；V3-2-1..7 仍 BLOCKED；
- T03 / T04 / V3-1.3 / PX-6 / RKM 边界保持。

本审查 **V3-2-0b DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION**（含 1 项 Major：Drawio 字节级漂移，需在下一轮打包前修复）。V3-2-0b implementation 仍 NO-GO。