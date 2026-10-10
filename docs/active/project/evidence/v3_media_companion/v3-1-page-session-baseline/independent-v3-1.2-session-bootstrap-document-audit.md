# V3-1.2 实时会话引导补充条款独立只读文档审计

日期：2026-09-17  
审计人：Claude（独立只读审查者）  
依据：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` 与 `01-audit-request.md`  
审计目标：候选补充条款 `09-session-bootstrap-addendum.md`（及与之配套的 `08-implementation-authorization.md`、`19-v3-1.2-0-acceptance-card.md`、`10-internal-audit.md`）能否在不改变产品秘密边界的前提下，允许使用用户明确授权的实时 B站会话种子完成隔离验收。

包范围：`external-audit-package/` 平铺 19 个载荷 + manifest = 20 个文件。

本审计边界：

- 仅做文档/合同/注册表/图纸/Draw.io 重算与对账；
- 不运行、不修改任何产品代码；
- 不请求 Cookie 权限；
- **不读取** `/mnt/c/Users/Administrator/Desktop/myCk.txt`（即便它已存在于桌面，本审计独立遵循 08 §2 与 19 §PRD 检视的禁令，只确认"路径不被产品代码读取、不进入持久介质、不进入证据"这一结构性事实）；
- 不触碰 Chrome 浏览器、profile、Cookie Store；
- 不修改候选文档；
- 不扩大为 V3-1 / V3 / V3-2 通过；
- V3-1.1 外部限定 PASS 状态原样保留，未重新审计其实施。

---

## 1. 决定

```text
V3-1.1 external limited PASS: retained
V3-1.2 base document candidate: retained (PASS for external document audit, see 11-prior-independent-audit.md)
V3-1.2 live-session bootstrap addendum (09-session-bootstrap-addendum.md):
    PASS for external document re-audit
V3-1.2-1 product implementation:
    GO, conditional on:
      - this addendum's 10 §2 constraints being enforced by V3-1.2-1..V3-1.2-6 code
      - V3-1.2-A07 evidenceClass recorded as user_authorized_live_session_seed (not human_manual_login)
      - probe endpoint and success criteria locked in V3-1.2-6 (Minor M-1)
      - human_manual_login path retained as separate manual acceptance (Minor M-2)
V3-1.3 / V3-2 / future portals / V3 overall: NOT IMPLEMENTED, NOT AUTHORIZED

Fatal = 0
Major = 0
Minor = 3
```

本审计仅就"实时会话引导补充条款能否在不冒充人工登录、不绕过 `serverValidated=false`、不让用户授权 Cookie 文件进入产品/持久介质/日志/证据、不扩大 V3-1.3 / V3-2 / 未来门户范围的前提下，作为隔离验收输入支撑一次性真实会话验收"这一**文档级问题**给出 GO/NO-GO。

补充条款 GO 意味着：可以开始 V3-1.2-1 代码实施，但**前提**是实施卡与代码严格落实本审计第 4 节列出的全部 §2 与 §4 约束，特别是：

- 产品代码绝不读取 `myCk.txt`；
- 任何持久介质 0 命中 Cookie 值或可逆值 hash；
- 验收 harness 写入后必须做真实 B站服务端会话探测，且 `evidenceClass` 必须记为 `user_authorized_live_session_seed`；
- 一次性 profile 必须独立、可销毁、run 后清理。

---

## 2. 19 载荷 SHA-256 逐字节对账

计算命令：`sha256sum`（GNU coreutils，输出与候选自报可对账）。

| # | 载荷 | 重算 SHA-256 | Manifest 声明 | 状态 |
|---|---|---|---|---|
| 01 | `01-audit-request.md` | `4c6d695c580be87d64f70d3f1b93790df2753cbe59a3105e2f2c56bf8fb77172` | 同 | PASS |
| 02 | `02-prd.md` | `99554b257e06c1d548dcf76c2d33279878be9b25f88516fa7b4f3b7183526e6b` | 同 | PASS |
| 03 | `03-architecture.md` | `b6a7f54e9752e98c0ecad92dcd85afa3e546928e1e6b0755221dded407cc4c5c` | 同 | PASS |
| 04 | `04-stage-gate.md` | `fce9fe1c2b3f733f9d73a36f6c532f469603cc699d05d2bc4ca3de3d4ea0d5a5` | 同 | PASS |
| 05 | `05-development-plan.md` | `f3bbac58563488593d0b3a238b0a19ba283cb2e060eb6c48e7700924c884a87f` | 同 | PASS |
| 06 | `06-acceptance-plan.md` | `465c2334e9e23861617cf5fe52b04685480a4ccf89faa3c7d87c60d2b51e1471` | 同 | PASS |
| 07 | `07-threat-model.md` | `6a763b83f3e0d80696d3458753d02c6e11cf8c2540f04f55fe3a81a0c4aaa6e3` | 同 | PASS |
| 08 | `08-implementation-authorization.md` | `28b6b31eee17f2d0ee1b1976db12073d9f7fc5fd9c0ead9867bbc7fb3a23f9b4` | 同 | PASS |
| 09 | `09-session-bootstrap-addendum.md` | `eee16e2c872ead0a1ff5ee9073415041e8a07476bee8eaceda6bed1167d5ad38` | 同 | PASS |
| 10 | `10-internal-audit.md` | `8541db086ec8f80eca0bec405b9639ea686c0ea92a053ce4889b8eef06c0e299` | 同 | PASS |
| 11 | `11-prior-independent-audit.md` | `28b18e6f0dcf5687364e3ff5a1cb19c3d77cc1794a476273a603a56d07a39e27` | 同 | PASS |
| 12 | `12-session-policy-registry.json` | `7ce7d8b4f68dc85fa5d5945d17a3c5232fbec99ab4557137436b0856ce7b42ac` | 同 | PASS |
| 13 | `13-session-contracts.schema.json` | `a42da7292821106d33ef7e535d2201eb8b83c36037b6d6f468930e7930ec48ab` | 同 | PASS |
| 14 | `14-positive-instance.json` | `b1b50d90a81d5908fc674d63e1b45e33cce7e7b60a2577a0db9116292de091a2` | 同 | PASS |
| 15 | `15-contract-fixtures.json` | `14b9d15248ed263f6a5387499180f94c88edc26a2006e6a3331bf12289979df5` | 同 | PASS |
| 16 | `16-portal-registry.json` | `c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6` | 同 | PASS |
| 17 | `17-risk-adr.md` | `0db2d9cd21e129f1906f69b3d1fbd3c7ca6fe0b5d741f971db3a3002a7436240` | 同 | PASS |
| 18 | `18-v3-media-companion-gap.drawio` | `ed9f00436a422b5014b2afba1eab3c260b804590ff4b7425e7db76e6c0dedc0a` | 同 | PASS |
| 19 | `19-v3-1.2-0-acceptance-card.md` | `0afe18f36a2b630271fe44e7538b6477220a357929e4aa4176c03ffe9137740c` | 同 | PASS |

19/19 字节相等。`AUDIT_MANIFEST.md` 自身未在清单内，本审计将其作为权威条目但不修改目标表。

包完整性二次确认：

- 平铺文件数：`ls external-audit-package/` 列出 20 个文件 = 19 载荷 + 1 manifest，与 manifest §"包约束"声明一致。
- 包内无子目录。
- 包内未包含 `myCk.txt`、Cookie 值或值 hash、Chrome profile dump（`find external-audit-package -name '*.txt' -o -name 'myCk*' -o -name 'cookies*' -o -name 'profile*'` 仅返回 manifest 与载荷文档本身）。
- 19 载荷中无任何文件包含 B站 Cookie 名称集合以外的秘密字段名（如 `DedeUserID__ckMd5` 之外的真实 secret 字符串）。grep 全部 19 载荷 `SESSDATA|DedeUserID|b_nut|bili_jct|buvid3|buvid4|buvid_fp` 仅命中注册表、Schema、正例、fixture 与文档白名单说明。

---

## 3. Schema / 正例 / fixture / registry / Draw.io 回归

工具：`python3 -c` 临时脚本（标准库，无外部依赖）。所有路径均在 `docs/active/project/external-audit-package/`。

### 3.1 Schema Draft 2020-12 元校验

```text
schema $id:    https://navia.local/contracts/v3_media_session_contracts.schema.json
schema $schema:https://json-schema.org/draft/2020-12/schema
schema.additionalProperties = false           # PASS
PortalSessionCapability.serverValidated.const = false   # PASS
failureCode enum = 13 个明确字符串 + null                # PASS
required fields:
  policy:   schemaVersion/policyId/adapterId/policyRevision/status/scopeGrants/decidedAt/revokedAt
  capability: schemaVersion/adapterId/sessionAdapterId/policyId/policyRevision/status/
              permissionState/credentialCount/credentialNameSetSha256/serverValidated/
              observedAt/expiresAt/failureCode
```

正例 shape：14 文件 `policy` + `capability` 通过 `additionalProperties=false` 与所有 `required` 字段；`serverValidated=false`；`credentialNameSetSha256` 形如 `^[a-f0-9]{64}$`。PASS。

### 3.2 9 名 `sha256_utf8_lf_sorted_names_v1` 重算

```text
注册表 12.credentialPolicy.allowedCookieNames =
  [DedeUserID, DedeUserID__ckMd5, SESSDATA, b_nut, bili_jct, buvid3, buvid4, buvid_fp, sid]

sorted (Unicode code-point 升序):
  DedeUserID
  DedeUserID__ckMd5
  SESSDATA
  b_nut
  bili_jct
  buvid3
  buvid4
  buvid_fp
  sid

joined bytes (trailing LF) =
  b"DedeUserID\nDedeUserID__ckMd5\nSESSDATA\nb_nut\nbili_jct\nbuvid3\nbuvid4\nbuvid_fp\nsid\n"

SHA-256 =
  67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2

positive credentialNameSetSha256 =
  67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2

status: PRECISELY EQUAL  (PASS)
```

唯一性：9 项均不重复；`DedeUserID` (10) 与 `DedeUserID__ckMd5` (16) 是两个不同字符串，符合 schema `minItems:1, maxItems:16` 与 12 §"9 名白名单"。

### 3.3 Portal registry SHA-256 双向绑定

```text
12-session-policy-registry.json sourcePortalRegistry.sha256
  = c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6

16-portal-registry.json raw-bytes SHA-256 (独立重算)
  = c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6

status: PRECISELY EQUAL  (PASS)
```

portal registry 字节 hash 与 session registry 的 `sourcePortalRegistry.sha256` 完全相等，证明本审计包未篡改两个注册表之间的唯一机器级纽带。

### 3.4 12 个 requirement / 12 个 case 精确对账

```text
requirement count = 12
case count       = 12
requirementId set == case.requirementId set? True (precisely equal)
caseIds unique?   True
each requirement referenced exactly once? True

schema-layer cases (expectedSchemaValid=false): 4
  V3S-C-001 N-001 SCHEMA_ADDITIONAL_PROPERTY     (cookieValue property)
  V3S-C-002 N-002 SCHEMA_CONST_MISMATCH          (serverValidated true)
  V3S-C-003 N-003 SCHEMA_ENUM_MISMATCH           (status authenticated)
  V3S-C-004 N-004 SCHEMA_ADDITIONAL_PROPERTY     (policy credentialValue)

semantic-layer cases (expectedSchemaValid=true): 8
  V3S-C-005 N-005 SCOPE_SET_INVALID
  V3S-C-006 N-006 CAPABILITY_INCONSISTENT       (host perm false)
  V3S-C-007 N-007 CAPABILITY_INCONSISTENT       (credentialCount null)
  V3S-C-008 N-008 NAME_SET_INVALID              (zero hash)
  V3S-C-009 N-009 OBSERVATION_EXPIRED
  V3S-C-010 N-010 ADAPTER_MISMATCH              (adapterId youtube)
  V3S-C-011 N-011 REVOKED
  V3S-C-012 N-012 CAPABILITY_INCONSISTENT       (permission_required + no cred)

V3S-C-010 patch.value = "youtube" 直接证明未来门户 adapterId 必须独立注册，
否则触发 V3_MEDIA_SESSION_ADAPTER_MISMATCH；不能复用 B站通用层。PASS
```

`expectedFailureCode` 与每个 requirement 的 `failureCode` 字段逐字一致。`expectedSchemaValid` 与 schema/semantic 分布完全吻合。

注：本审计只跑 shape-level RFC 6902 + schema 校验；语义失败码的真实执行依赖 V3-1.2-1 validator（详见 Minor M-1）。

### 3.5 persistencePolicy / commands / scopes / future-adapter 关键不变式

```text
persistencePolicy.forbiddenFields 包含 8 个关键词:
  cookie, cookieValue, credential, credentialValue, header, authorization,
  envelope, lease
  -> secret/credential/envelope/lease 全部被显式排除。PASS

persistencePolicy.allowedFields 仅 8 个通用字段:
  schemaVersion, policyId, adapterId, policyRevision, status, scopeGrants,
  decidedAt, revokedAt
  -> 不含任何 Cookie 名称/值/host。PASS

commands (5 个,固定):
  get_policy, record_grant, record_denial, revoke_policy, inspect_capability
  -> 无 envelope/lease/download/acquire/run/start_task 等秘密传输或下载入口。PASS

adapters[0].consentScopes = 5 个:
  bilibili_session_access, temporary_media_download, audio_local_processing,
  frame_local_processing, selected_frame_cloud_vision
  -> 与 PRD/架构 §18.2/§22.1 五项 scope 完全一致。PASS

futureExamplesAreNotImplemented = [youtube, xiaohongshu]
futureAdapterRequirements = 9 项必备独立化要求:
  registered_page_adapter, independent_session_adapter, independent_optional_permissions,
  independent_secret_name_policy, independent_consent_scope_copy,
  real_logged_in_and_logged_out_matrix, secret_non_persistence_scan,
  independent_document_audit, independent_implementation_audit
  -> 与 17-risk-adr.md ADR-V3-11 / 02-prd.md §18.2 / 03-architecture.md §22.6 一致。PASS
```

### 3.6 Draw.io 8 页结构

```text
diagrams       = 8
01 用户入口与目标体验      vertices=12 edges=7  ids=21
02 当前与目标代码实体      vertices=18 edges=8  ids=28
03 双容器路由与组件        vertices=18 edges=5  ids=25
04 Cookie 媒体与双回退    vertices=12 edges=10 ids=24
05 任务证据 Ask 与反跳     vertices=16 edges=8  ids=26
06 BiliNote 迁移与治理    vertices=10 edges=6  ids=18
07 开发里程碑与自动验收    vertices=12 edges=7  ids=21
08 人类验收与出门条件      vertices=15 edges=2  ids=19
TOTAL PAGES:     8   (cap <= 8)             PASS
TOTAL VERTICES: 113, TOTAL EDGES: 53        PASS
DUPLICATE IDS:  none (Counter 全 1)        PASS
BROKEN EDGES:   none (每条 source/target 都在同图 id 集合内) PASS
```

第 4 页 "Cookie 媒体与双回退" 顶点文本对账：

- 通用 session 层（黄 `#fff2cc` 填充）：`PortalPermissionClient → PortalSessionBroker`、`PortalSessionRegistry`、`D Governance → MediaVisionProvider`。
- B站 plugin（蓝 `#dae8fc` 填充）：`BilibiliMediaAcquirer`、`MediaCaptureController → LocalAsrAdapter`、`MediaFramePipeline`、`LocalOcrAdapter`。
- 证据分型（绿 `#dff2eb` 填充）：`分型 Evidence Index`。
- 治理（红 `#f8cecc` 填充）：`清理门禁`、`撤销/到期`。

第 4 页在颜色与文本上明确把通用 Broker（黄）与 B站 plugin（蓝）区分开，与 PRD / 架构文档保持一致；无 `<all_urls>` / `chrome.cookies.set` / `myCk.txt` / 文件读取相关文字出现。

### 3.7 通用 session 合同 / 目标代码实体 B站平台字段与秘密名称泄漏检查

`13-session-contracts.schema.json` grep `bilibili / bvid / SESSDATA / cid / DedeUserID / b_nut / bili_jct / buvid / bilibili.com / xiaohongshu / youtube`：唯一命中为属性名 `decidedAt`（无关）。无任何 B站平台字段、host、Cookie 名称、secret 名称。

`12-session-policy-registry.json#genericBroker` 唯一相关字段均为通用字符串：

```text
contractVersion, permissionClientTarget, brokerTarget, adapterInterfaceTarget,
registryTarget, permissionRequestContext, backgroundMayRequestPermission,
secretValuesAllowedInUi = false,
secretValuesAllowedInPersistentContracts = false,
runtimeEnvelopeStage = "v3_1_3_not_implemented"
```

通用层不允许秘密值进入 UI / 持久合同；envelope 显式后置 V3-1.3。B站专属字段只出现在 `12#adapters[0].credentialPolicy` 与 `16#adapters[0].identityMapping / sessionProfile`。

---

## 4. 重点攻击面对账（只读）

以下 7 个攻击面针对 `09-session-bootstrap-addendum.md` 的具体条款，**只读**验证其结构性防线。

### 4.1 攻击 1：用户授权 Cookie 文件是否进入产品

候选补充条款防线：

- §2.1：只允许读取用户指定的绝对路径 `/mnt/c/Users/Administrator/Desktop/myCk.txt`。**该路径是用户授权书 08 §1 明示的"我的 B站已经登录了的 cookie"**；包外运行环境的实际存在与否不影响本审计。
- §2.5：写入只能由验收 harness 通过 Chrome DevTools Protocol 对一次性 profile 执行；**产品扩展不得调用 `chrome.cookies.set`，不得读取文件**。
- §3 不变的产品边界：`BilibiliPortalSessionAdapter` 仍只读 Chrome Cookie Store；`PortalPermissionClient` 仍只能在可见扩展页面的真实用户点击中请求权限。
- §4 防假绿：产品代码读取 `myCk.txt` → Major。

本审计对账：

- `grep -nE '产品扩展不得调用 `chrome.cookies.set`，不得读取文件' 09` → PASS（字面命中）。
- `grep -nE 'BilibiliPortalSessionAdapter.*仍只读 Chrome Cookie Store' 09` → PASS（字面命中 §3）。
- `grep -nE 'V3-1.2 product code reads myCk.txt' 09 §4` → PASS（Major 触发条件写明）。
- 09 addendum 不存在"产品代码应读取桌面文件以便..."或类似正向引用。
- 19-v3-1.2-0-acceptance-card.md §A02 / §PRD 检视也独立验证"产品与验收 harness 的秘密来源分离"。

**结论：PASS。** 产品代码读取 `myCk.txt` 在文档层面被显式禁止并列为 Major；产品数据源（Chrome Cookie Store）不变。**前提条件**：实施后必须用静态扫描（grep + AST）确认 `apps/chrome-extension/src/**` 无任何路径常量包含 `myCk.txt`、`/mnt/c/Users/Administrator/Desktop`、`/Desktop/`、本地文件 API (`fs.readFile`/`fetch file://`/Node fs/浏览器 file input) 调用；本审计只做文档级断言，不做静态扫描。

### 4.2 攻击 2：Cookie 值是否进入持久介质 / 日志 / 证据

候选补充条款防线：

- §2.2：读取进程不得打印、记录、复制、缓存或散列 Cookie 值；原始文件 SHA-256 也不得进入证据。
- §2.8：对持久产物执行进程内 needle 扫描时只输出 `hitCount`、冻结名称集合 hash 和扫描文件数；任一命中立即作废 run。
- §2.9：run 完成或失败后关闭 Chrome，删除一次性 profile，并验证无遗留进程、无遗留 Cookie 数据目录。
- §4 防假绿：输出任一 Cookie 值或其可逆 hash → Major；保留一次性 profile → Major。

本审计对账：

- §2.2 字面包含"不得打印、记录、复制、缓存或散列 Cookie 值；原始文件 SHA-256 也不得进入证据" → PASS。
- §2.8 字面包含"进程内 needle 扫描时只输出 `hitCount`、冻结名称集合 hash 和扫描文件数；任一命中立即作废 run" → PASS。
- §2.9 字面包含"关闭 Chrome，删除一次性 profile，并验证无遗留进程、无遗留 Cookie 数据目录" → PASS。
- §4 字面包含"输出任一 Cookie 值或其可逆 hash ... Major ... 保留一次性 profile ... Major" → PASS。
- 19-v3-1.2-0-acceptance-card.md §A03 独立验证"myCk.txt 只做非秘密结构检查：JSON 数组、26 条、全部 B站域；9 个允许名称非空，SESSDATA 非空；未输出值"。
- 10-internal-audit.md §2.1 也独立验证"未输出值、文件原文或值 hash"。

`registry.persistencePolicy.forbiddenFields` 显式包含 `cookie / cookieValue / credential / credentialValue / header / authorization / envelope / lease`；`chrome.storage.local.allowedFields` 仅 8 个通用字段。

**结论：PASS。** Cookie 值进入持久/日志/证据的路径在文档层面被完全切断，needle 扫描与 profile 删除被列为运行约束与 Major 防线。**前提条件**：V3-1.2-6 实施时 needle 扫描器必须覆盖 `chrome.storage.local` / `IndexedDB` / 事件总线 / Trace / log / error / retry / E2E / public archive（与 06 V3-1.2-A12 要求一致）；本审计只对文档断言。

### 4.3 攻击 3：是否把 `user_authorized_live_session_seed` 冒充为 `human_manual_login`

候选补充条款防线：

- §1 表格：两个证据类别互不冒充；`human_manual_login` 由人类在专用验收 profile 可见登录得到；`user_authorized_live_session_seed` 由用户明确授权的实时 Cookie 文件一次性写入全新验收 profile 得到，**不证明人工登录路径**。
- §2.10：审计材料必须记录 `evidenceClass=user_authorized_live_session_seed`，不得写成 `human_manual_login`。
- §3 不变的产品边界：使用会话种子只能声明种子证据类别通过，**不得声明"人类手动登录链已验证"**。
- §4 防假绿：把种子计为人工登录 → Major。
- 08-implementation-authorization.md §2 第 4 条：使用会话种子只能声明 `user_authorized_live_session_seed` 验收链通过，不得声明"人类手动登录链已验证"。

本审计对账：

- 09 §1 表的字面包含"两种正例互不冒充"+"`human_manual_login` ... 人工登录产品路径与候选会话能力" + "`user_authorized_live_session_seed` ... 不证明人工登录路径" → PASS。
- 09 §2.10 字面包含"`evidenceClass=user_authorized_live_session_seed`，不得写成 `human_manual_login`" → PASS。
- 09 §3 字面包含"使用会话种子只能声明种子证据类别通过，不得证明人工登录路径" → PASS。
- 09 §4 字面包含"把种子计为人工登录 → Major" → PASS。
- 08 §2 字面包含"使用会话种子只能声明 `user_authorized_live_session_seed` 验收链通过，不得声明'人类手动登录链已验证'" → PASS。
- 06-acceptance-plan.md §1 与 V3-1.2-A07 字面包含"证据类别必须是 `human_manual_login`，或按 `v3-1.2-user-session-bootstrap-addendum.md` 使用 `user_authorized_live_session_seed`；两者不得互相冒充" → PASS。
- 19-v3-1.2-0-acceptance-card.md §A04 字面包含"`human_manual_login` 与 `user_authorized_live_session_seed` 分离" → PASS。
- 10-internal-audit.md §2.4 / §3 表 "自动种子冒充人工登录 / Medium / 独立 evidenceClass；允许声明集合不同 / 已闭合" → PASS。

**结论：PASS。** 两个证据类别在 4 份独立文档（09 addendum、08 authorization、06 acceptance plan、19 acceptance card）中保持互不冒充；冒充行为在 §4 / 19-A04 / 10-§3 均列为 Major 或 Closed。

### 4.4 攻击 4：是否绕过 `serverValidated=false`

候选补充条款防线：

- §2.7：写入后必须访问冻结的 B站锚点并执行真实同源服务端会话探测；只有服务端返回当前会话有效且页面/接口身份一致时才可进入 A07 capability 观测。
- §3：`serverValidated` 在 V3-1.2 合同中仍固定为 `false`；验收 harness 的服务端有效性检查**只证明测试输入不是 fixture**，**不升级产品 capability 语义**。
- §4 防假绿：跳过服务端有效性探测 → Major。

本审计对账：

- 09 §2.7 字面包含"真实同源服务端会话探测" + "服务端返回当前会话有效且页面/接口身份一致时才可进入 A07" → PASS。
- 09 §3 字面包含"`serverValidated` 在 V3-1.2 合同中仍固定为 `false`；验收 harness 的服务端有效性检查只证明测试输入不是 fixture，不升级产品 capability 语义" → PASS。
- 09 §4 字面包含"跳过服务端有效性探测 → Major" → PASS。
- 13-session-contracts.schema.json `PortalSessionCapability.serverValidated.const = false` → PASS（机器层 const，**任何**实现也无法声明 `serverValidated=true`）。
- 06-acceptance-plan.md V3-1.2-A07 字面包含"`serverValidated=false`；credential count >0；name-set hash 可重算；记录精确 evidenceClass" → PASS。
- 07-threat-model.md T08："`serverValidated` const false；UI 文案'已检测会话候选'（非'已登录'）" → PASS。

`V3S-C-002` fixture 在 schema 层直接拒绝 `serverValidated: true` 替换（`SCHEMA_CONST_MISMATCH`），这是 schema 的强制 const 而非产品代码自报。

**结论：PASS。** `serverValidated=false` 由 schema const、合同规范、addendum §3、threat model T08、acceptance plan A07 五重锁死；服务端探测只用于证明"测试输入真实，不是 fixture"，**不升级** 产品 capability 语义，不写入 capability 字段。**前提条件**：V3-1.2-6 实施时服务端探测必须真实访问 B站锚点 `BV1ZpYd66ELP` 的同源接口（如 nav 接口返回 mid/levenshtein 校验），而非仅读 cookie 文件；详细 endpoint 与成功判据需在 V3-1.2-6 实施前固定（Minor M-1）。

### 4.5 攻击 5：是否扩大 V3-1.3 / V3-2 / 未来门户范围

候选补充条款防线：

- 09 §3：`V3-1.2` 仍不实现 Browser 到 Runtime 秘密传输、租约、下载或视频理解。
- 09 §2.3：解析器只接受 JSON Cookie 数组；所有记录的 domain 必须是 `bilibili.com` 或其子域。
- 09 §2.4：只把注册表冻结的 9 个名称写入一次性 profile；未知名称默认拒绝。

本审计对账：

- 09 全文 grep `V3-1.3 | V3-2 | envelope | lease | youtube | xiaohongshu | 小红书 | YouTube` → **0 命中**（除 §3 第 3 行的"V3-1.2 仍不实现 Browser 到 Runtime 秘密传输、租约、下载或视频理解"这一反向声明）。
- 09 全文 grep `download` → 0 命中。
- 12-session-policy-registry.json `runtimeEnvelopeStage = "v3_1_3_not_implemented"` + `commands` 列表无 envelope/lease/download → PASS。
- 16-portal-registry.json `futureExamplesAreNotImplemented = [youtube, xiaohongshu]` + `extensionPolicy.newAdapterRequires = 8 项` → PASS。
- 06-acceptance-plan.md §4 防假绿："把 V3-1.2 扩大为凭据租约、下载、视频理解或未来门户适配完成" → Major → PASS。
- 17-risk-adr.md ADR-V3-03 / 05 / 08 / 09 / 11：envelope / lease / cookiefile / 下载 全部显式标注为 V3-1.3 或 V3-2 范围 → PASS。
- 04-stage-gate.md §9：V3-1.2 仅输出 `serverValidated=false` 的浏览器内会话候选能力；不实现 envelope、lease、Runtime 传输或媒体下载；V3-1.3 / V3-2 仍 NO-GO → PASS。

**结论：PASS。** 09 addendum 没有任何语言把 V3-1.3 envelope / V3-2 下载 / YouTube/小红书适配纳入；9 名白名单与 `bilibili.com` 域限制只覆盖 B站；未来门户独立要求已在 12 / 16 / 17 三处冻结。

### 4.6 攻击 6：是否复用 run / 复用 profile 拼接正例

候选补充条款防线：

- §2.6：profile 必须使用本 run 独立目录；不得复制、复用或挂载用户主 profile。
- §2.9：run 完成或失败后关闭 Chrome，删除一次性 profile，并验证无遗留进程、无遗留 Cookie 数据目录。
- §4 防假绿：用旧 run / 旧 profile 拼接正例 → Major。

本审计对账：

- §2.6 字面包含"profile 必须使用本 run 独立目录；不得复制、复用或挂载用户主 profile" → PASS。
- §2.9 字面包含"关闭 Chrome，删除一次性 profile，并验证无遗留进程、无遗留 Cookie 数据目录" → PASS。
- §4 字面包含"用旧 run/旧 profile 拼接正例 → Major" → PASS。
- 06-acceptance-plan.md §1："产物全部位于单一新 run；匿名与登录 profile 是同 run 的两个明确 segment，不与 V3-1P/V3-1.1 原始观测拼接" → PASS。

**结论：PASS。** run 与 profile 隔离由 09 + 06 + 19 三处共同锁定。

### 4.7 攻击 7：是否静默扩大 host / 名称白名单

候选补充条款防线：

- §2.3：所有记录的 domain 必须是 `bilibili.com` 或其子域。
- §2.4：只把注册表冻结的 9 个名称写入一次性 profile；未知名称默认拒绝。
- §4 防假绿：接受非 B站域 → Major；写入注册表外名称 → Major。

本审计对账：

- §2.3 / §2.4 / §4 字面命中 → PASS。
- 12-session-policy-registry.json `credentialPolicy.allowedCookieNames` 冻结为 9 项；hash 通过 §3.2 重算确认 → PASS。
- 07-threat-model.md T05："registry 和源码集合比较；增名必须回到文档/安全审计" → PASS。
- 16-portal-registry.json `wildcardAllUrlsAllowed = false` + `equivalentGlobalHttpMatchesAllowed = false` → PASS。

**结论：PASS。** 名称与域白名单在文档与注册表两层锁定，新增需走文档/安全审计而非产品代码静默扩展。

---

## 5. 三项 Minor（每项 owner 与关闭阶段）

### M-1：服务端会话有效性探测的具体 endpoint 与成功判据需在 V3-1.2-6 collector 实施前固定（来自 10-internal-audit.md §4 M-1，并被本审计独立确认）

- 09 addendum §2.7 只规定"必须执行真实同源服务端会话探测"与"服务端返回当前会话有效且页面/接口身份一致时才可进入 A07 capability 观测"。
- 但成功判据（例如：访问哪个 endpoint、返回 JSON 的哪个字段、如何证明"当前会话有效"且不是过期泄漏的 cookie）**未在 09 addendum 中冻结**。
- 这是本审计唯一未在文档层面完全闭合的工程化约束。
- 风险：若 V3-1.2-6 实施时使用"返回 200 即认为有效"作为成功判据，可能放过 B站风险控制页、登录过期但仍 200 的页面、地区限制页。
- 防线建议：用响应 shape（payload 关键字段存在 + 字段值非空 + 字段值与所写入 cookie 的 mid/uid 哈希对账）而非昵称/UID 显示。
- Owner：V3-1.2-6 collector/verifier 实施。
- 关闭阶段：V3-1.2-6 子阶段出门前必须冻结 endpoint 与成功判据，并在验收脚本里以确定性测试覆盖。

### M-2：用户授权种子无法替代 `human_manual_login` 的可用性验证（来自 10-internal-audit.md §4 M-2，并被本审计独立确认）

- 09 §1 / §3 / §4 与 06 / 08 / 19 多处声明种子证据类别与人工登录证据类别互不冒充。
- 但这意味着：本次验收链通过只证明产品从 Cookie Store 派生候选能力可行，**不能**证明用户在专用 profile 手动登录这条路径也已经过人类验证。
- 风险：若团队把"补充条款 PASS"扩展为"人工登录路径 PASS"或"V3-1.2 完成"，则属越权。
- 防线建议：候选声明、internal audit、external audit 三处必须一致保留"人工登录路径仍需后续手动验收"的明确边界。
- Owner：V3-1.2 候选声明与后续人工验收。
- 关闭阶段：V3-7 人类验收出门前必须由人类在专用 profile 手动完成至少一次真实登录 → capability = available 的全链验证；V3-1.2 出门不可跨越此门禁。

### M-3（本审计独立新增）：09 addendum §2.1 将用户授权路径硬编码为绝对路径字符串

- §2.1 字面包含"只允许读取用户指定的绝对路径 `/mnt/c/Users/Administrator/Desktop/myCk.txt`"。
- 该路径与 08 §1 用户授权原文 `"我的 B站已经登录了的cookie"` 指向同一文件；路径不是秘密，且已在 08 / 09 / 19 / 10 文档体系中反复出现。
- 风险：若用户后续把 `myCk.txt` 移动到其他路径（例如换桌面、新建子目录），09 addendum 与 19-A03 验收卡都需要修订并重新外审，否则 V3-1.2-6 harness 会找不到文件并被解读为"种子缺失"。
- Owner：用户授权变更时必须同步更新 09 addendum 与 19-A03，并触发新的外审。
- 关闭阶段：用户授权路径变更时关闭；非阻塞 V3-1.2-1..6 当前出门。

三项 Minor 的 owner 已锁定：

| Minor | Owner | 关闭阶段 | 是否阻塞 V3-1.2-1 出门 |
|---|---|---|---|
| M-1 | V3-1.2-6 collector/verifier 实施 | V3-1.2-6 子阶段出门前 | 否，但必须 V3-1.2-6 出门前关闭 |
| M-2 | V3-1.2 候选声明 + V3-7 人工验收 | V3-7 出门前 | 否，但必须 V3-7 出门前关闭 |
| M-3 | 用户授权变更时 09 / 19 同步外审 | 路径变更时 | 否，仅在变更时阻塞 |

本审计独立确认 `10-internal-audit.md` §3 威胁表全部"已闭合到验收门槛"与本审计对账一致：产品读取（High）、值落证据（Critical）、失效 cookie 冒充（High）、自动种子冒充（Medium）、profile 遗留（High）、未来门户继承（High）。第六项"未来门户继承 B站秘密"在 09 addendum 框架内继续保持原防护：**未改变**，**继续有效**。

---

## 6. 与候选自报的对账

候选自报（`AUDIT_MANIFEST.md` 末尾 + `19-v3-1.2-0-acceptance-card.md`）：

```text
AUDIT_MANIFEST.md:
  V3-1.1 external limited PASS: retained
  V3-1.2 base document candidate: retained
  V3-1.2 live-session bootstrap addendum: INTERNAL PASS, EXTERNAL RE-AUDIT REQUIRED
  V3-1.2 product implementation: NO-GO until external Fatal=0/Major=0
  V3-1.3 / V3-2 / V3 overall: NOT IMPLEMENTED

19-v3-1.2-0-acceptance-card.md §出门结论:
  V3-1.2-0 PASS. 允许进入 V3-1.2-1 合同/注册表/语义校验器实现，
  但必须先完成补充条款外部只读复审，且 Fatal=0/Major=0.
```

本审计独立结果（与候选自报一致，措辞更精确）：

```text
V3-1.1 external limited PASS: retained
V3-1.2 base document candidate: retained (PASS for external document audit, see 11)
V3-1.2 live-session bootstrap addendum (09-session-bootstrap-addendum.md):
    PASS for external document re-audit
V3-1.2-1 product implementation:
    GO, conditional on:
      - this addendum's 10 §2 constraints being enforced by V3-1.2-1..V3-1.2-6 code
      - V3-1.2-A07 evidenceClass recorded as user_authorized_live_session_seed
      - probe endpoint and success criteria locked in V3-1.2-6 (Minor M-1)
      - human_manual_login path retained as separate manual acceptance (Minor M-2)
V3-1.3 / V3-2 / future portals / V3 overall: NOT IMPLEMENTED, NOT AUTHORIZED

Fatal = 0
Major = 0
Minor = 3
```

差异说明：

- 本审计把"AUDIT_MANIFEST 自报的 `INTERNAL PASS, EXTERNAL RE-AUDIT REQUIRED`"独立收紧为"`PASS for external document re-audit`"，并把 `V3-1.2-1 product implementation: NO-GO` 升级为"`GO, conditional`"，但**仅当** §4 的七项攻击面与本审计列出的所有 §2 / §3 / §4 / 09 §2 / 06 §1 / 19 §验收标准 约束在 V3-1.2-1..V3-1.2-6 实施时**逐条落实**。
- 该升级**不**代表产品代码实施自动通过。V3-1.2-1..V3-1.2-6 每段出门仍需独立子阶段验收卡 + 内部审计 + false-green audit；V3-1.2-7 出门仍需 V3-1.2 外部实现审计；V3-1.2-7 之后还有 V3-7 人类验收。
- 本审计**不**扩大为 V3-1.2 代码 PASS / 人工登录 PASS / 服务端会话产品验证 / V3-1 / V3 / V3-1.3 / V3-2 / YouTube / 小红书 PASS。

---

## 7. 边界与未做项

本审计严格遵守请求 §"通过门槛"的边界：

- 未运行 / 未修改任何产品代码（仅做 JSON / XML 解析、SHA-256 重算、schema 校验、字符串拼接哈希、文档对账）。
- 未读取 `/mnt/c/Users/Administrator/Desktop/myCk.txt`；即便它在桌面上存在，本审计在文档层面只断言"它不被产品代码读取、不进入持久介质、不进入证据"这一结构性事实。
- 未请求 Cookie 权限；未触碰 Chrome 浏览器、profile、Cookie Store、DevTools Protocol、CDP。
- 未修改候选文档（19 个载荷 + manifest 均按"只读"方式访问；只生成本新审计意见文件 `independent-v3-1.2-session-bootstrap-document-audit.md`）。
- 未扩大为 V3-1 / V3 / V3-2 通过。V3-1.1 外部限定 PASS 状态原样保留，未重新审计其实施；V3-2..V3-7、V3-1.3 envelope / lease、YouTube / 小红书适配仍为 NOT_IMPLEMENTED。
- 本审计未独立实现 RFC 6902 patch 引擎与 Draft 2020-12 validator 的执行（与 11-prior-independent-audit.md §3 一致）；仅做 shape-level 对账与 schema 元字段、9 名 hash、注册表绑定、fixture 字段对应表的人工 + grep 双重检查。

---

## 8. 结论

```text
V3-1.2 实时会话引导补充条款 (09-session-bootstrap-addendum.md) :
    PASS FOR EXTERNAL DOCUMENT RE-AUDIT
V3-1.2-1 产品代码实施:
    GO, conditional on §4 七项攻击面与本审计第 5 节三项 Minor 的 owner / 关闭阶段约束
Fatal = 0
Major = 0
Minor = 3
```

该决定解除"用户授权实时会话引导补充条款"这一**文档级**门禁，可作为 V3-1.2 验收输入的隔离种子来源。**不**代表：

- V3-1.2 产品代码自动通过；
- 人工登录路径已验证；
- 服务端会话在产品 capability 语义上已升级；
- V3-1.3 envelope / lease、V3-2 下载、YouTube / 小红书适配、完整 V3 通过。

实施后任何 V3-1.2 子阶段出门仍需独立子阶段验收卡、内部审计、false-green audit；V3-1.2-6 出门前必须先解决 Minor M-1；V3-7 出门前必须由人类在专用 profile 完成至少一次人工登录正例的真实链验证（Minor M-2）；用户授权路径变更时 09 / 19 必须同步更新并重新外审（Minor M-3）。
