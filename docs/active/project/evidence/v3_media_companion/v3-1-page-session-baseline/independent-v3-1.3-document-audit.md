# V3-1.3 一次性凭据通道文档候选独立审查

日期：2026-09-17。审查类型：只读、独立、文档与机器合同准备度审查。
范围：`docs/active/project/external-audit-package/` 平铺 20 文件（19 载荷 + 1 manifest）。
不审查/不放行：媒体下载、ASR、OCR、VLM、完整视频理解、YouTube/小红书、V4 知识。
允许的最高结论：`V3-1.3 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER HIGH-RISK IMPLEMENTATION AUTHORIZATION.`

---

## 1. 总览

| 项 | 结论 |
|---|---|
| 19 载荷 SHA-256 重算 | 19/19 全部一致 |
| 10-session-policy-registry.json SHA-256 vs 11-transport sourceSessionPolicy.sha256 | 一致 |
| B站 9 名 C-sort + UTF-8 + LF SHA-256 vs 11 allowedCredentialNameSetSha256 | 一致 |
| 12-credential-lease.schema.json Draft 2020-12 元校验 | PASS |
| 13-positive.json 对 Schema 校验 | PASS（0 error） |
| 14-fixtures.json 25 cases 应用 | 12 negative 全部 invalid；13 semantic 全部 schema-valid |
| 09 drawio 8 页结构 | 8 页 / 1600x900 / 0 重名 / 0 缺边 / 0 顶层越界 |
| 抽样页面（2/4/7/8）与 08-gap.md 文本一致性 | 一致 |
| V3-1.2 QUALIFIED PASS 保持 | 是 |
| V3-1.3 IMPLEMENTATION NO-GO 保持 | 是 |
| V3/V3-2 不得扩大为通过 | 严格遵守 |
| 本轮 Fatal / Major / Minor | **Fatal = 0 / Major = 0 / Minor = 2** |
| 可否进入用户高风险实施授权 | **可附带条件**：以本报告 Minor 全部纳入 `V3-1.3-0..7` 验收卡，且用户单独签署 `V3-1.3 Browser-to-Runtime credential transport implementation` 高风险授权 |

---

## 2. 19 载荷 SHA-256 重算

全部 `sha256sum docs/active/project/external-audit-package/*.{md,json,drawio}`：

| 文件 | manifest 自报 | 本机重算 | 通过 |
|---|---|---|---|
| 01-audit-request.md | `a2d30901…0efd` | `a2d30901…0efd` | ✓ |
| 02-prd.md | `5e8043e0…4a79` | `5e8043e0…4a79` | ✓ |
| 03-architecture.md | `171d825c…8d7a` | `171d825c…8d7a` | ✓ |
| 04-development-plan.md | `cddcc444…2a645` | `cddcc444…2a645` | ✓ |
| 05-acceptance-plan.md | `168bd164…1d7d5` | `168bd164…1d7d5` | ✓ |
| 06-stage-gate.md | `b0570f21…d5592` | `b0570f21…d5592` | ✓ |
| 07-risk-adr.md | `0db2d9cd…6240` | `0db2d9cd…6240` | ✓ |
| 08-gap.md | `83413e96…b252` | `83413e96…b252` | ✓ |
| 09-v3-media-companion-gap.drawio | `77f11c56…fd4` | `77f11c56…fd4` | ✓ |
| 10-session-policy-registry.json | `7ce7d8b4…42ac` | `7ce7d8b4…42ac` | ✓ |
| 11-transport-policy-registry.json | `be4bd841…95d5` | `be4bd841…95d5` | ✓ |
| 12-credential-lease.schema.json | `30ff2a0c…8593` | `30ff2a0c…8593` | ✓ |
| 13-positive.json | `83e26e92…c171` | `83e26e92…c171` | ✓ |
| 14-fixtures.json | `88df17c1…1fa3` | `88df17c1…1fa3` | ✓ |
| 15-development-plan.md | `002976ec…5e8` | `002976ec…5e8` | ✓ |
| 16-acceptance-plan.md | `69489985…a962` | `69489985…a962` | ✓ |
| 17-threat-model.md | `0d0f1291…20e7` | `0d0f1291…20e7` | ✓ |
| 18-internal-audit.md | `e1c9e058…08aa` | `e1c9e058…08aa` | ✓ |
| 19-preimplementation-audit.md | `501c5163…713d` | `501c5163…713d` | ✓ |

19/19 全部匹配。manifest 文件自身不参与（哈希为 `d1d6b3fd…2cad`），符合 manifest 自述。

---

## 3. 注册表与名称集合对账

### 3.1 Session policy ↔ transport policy

- `10-session-policy-registry.json` 原始字节 SHA-256 = `7ce7d8b4f68dc85fa5d5945d17a3c5232fbec99ab4557137436b0856ce7b42ac`
- `11-transport-policy-registry.json.sourceSessionPolicy.sha256` = `7ce7d8b4f68dc85fa5d5945d17a3c5232fbec99ab4557137436b0856ce7b42ac`

完全相等，绑定一致。

### 3.2 B站 9 名 C-sort + UTF-8 + LF SHA-256

输入：`DedeUserID, DedeUserID__ckMd5, SESSDATA, b_nut, bili_jct, buvid3, buvid4, buvid_fp, sid`。
C-sort（ASCII 字节序）排序后（短前缀先；大写 < `_` < 小写；数字 < `_`；小写 b < s）：

```
DedeUserID\nDedeUserID__ckMd5\nSESSDATA\nb_nut\nbili_jct\nbuvid3\nbuvid4\nbuvid_fp\nsid\n
```

SHA-256 = `67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2`。
`11-transport-policy-registry.json.adapters[bilibili].allowedCredentialNameSetSha256` = `67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2`。

完全相等。`apps/chrome-extension/src/modules/media_companion/session/bilibili/bilibiliCookiePolicy.ts:16` 中的 `BILIBILI_COOKIE_NAME_SET_SHA256` 常量也与此值一致，可在 `V3-1.3-0` 直接复用而无需重新实现。

---

## 4. Schema 与 25 cases

### 4.1 Schema 元校验

`12-credential-lease.schema.json` 顶部声明 `$schema=https://json-schema.org/draft/2020-12/schema` 且仅使用 Draft 2020-12 合规关键字（`type/object/required/properties/additionalProperties/$defs/$ref/pattern/format/enum/const/minimum/maximum`），`jsonschema 4.26.0` `Draft202012Validator.check_schema()` 通过。`additionalProperties: false` 在所有嵌套对象上一致闭合，未引入 2019-09/2020-12 已废弃关键字。

### 4.2 Positive 实例

`13-positive.json` 通过 Schema 校验（0 error）。检查项：
- 三层对象（`channel`/`lease`/`transportAudit`）均无额外字段；
- `channel.expiresAt - issuedAt = 20 秒`；`lease.expiresAt - issuedAt = 60 秒`；TTL 落在 `11-transport-policy-registry.json` 上限内；
- `channel.credentialNameSetSha256 = lease.credentialNameSetSha256 = 67166981…0fc2`；
- `browserSessionBindingSha256` 在 channel 与 lease 上相等；
- `transportAudit` 13 个 const=true/false 全部命中（`requestAttemptCount=1`、`oneShot=true`、`channelTokenPersisted=false`、`persistentSecretHitCount=0/publicSecretHitCount=0/rawCredentialValueHashed=false/genericRuntimeProxyDenied=true/contentScriptDenied=true/exactOriginBound=true/replayRejected=true/expiredChannelRejected=true/runtimeRestartClearedLeases=true/revocationClearedLease=true`）。

### 4.3 25 cases

应用 `14-fixtures.json` patch 到 positive 实例：

| 层 | 期望 | 实测 |
|---|---|---|
| Schema 12 negative | `expectedSchemaValid=false` | 12/12 全部 invalid（`additionalProperties` 或 `const` mismatch） |
| Semantic 13 negative | `expectedSchemaValid=true`，由 semantic layer 拒绝并返回 `expectedFailureCode` | 13/13 全部 schema-valid（patch 后形状合法） |

FailureCode 单义性检查：

- 12 schema negative：负例期望 `SCHEMA_ADDITIONAL_PROPERTY`（4 项）或 `SCHEMA_CONST_MISMATCH`（8 项），与 Schema 层拒绝原因一一对应，无重叠；
- 13 semantic：每个负例对应唯一 `expectedFailureCode`，且全部 17 个 FailureCode 覆盖在 `11-transport-policy-registry.json.failureCodes` 枚举中；`serverValidationStatus=not_performed` const 与 `cookieNameSetSha256` 比对逻辑绑定到 `V3_MEDIA_CREDENTIAL_SET_INVALID`，与 ADR-V3-09 的“禁止服务端会话有效声明”一致；
- 21/22 跨记录 binding mismatch 全部以 `lease-task/adapter/policy/revision/binding/hash/TTL` 命名空间区分，避免与 envelope 字段问题共用 `V3_MEDIA_ENVELOPE_INVALID`，提升定位精度；唯一例外是 `V3L-N-021`（lease issued before channel）也映射到 `V3_MEDIA_CHANNEL_INVALID`，因主因是 channel 时序而非 envelope 字段——语义上无歧义，但与 `V3L-N-017`（browserSessionBindingSha256 不匹配）共用同一 code。**评估**：可接受，原因是“拒绝在读取 Cookie 之前”同属 channel gate。

---

## 5. Draw.io 8 页结构

`09-v3-media-companion-gap.drawio`：

| 页 | id | name | page | cells | edges | 重复 ID | 缺边引用 | 顶层越界 |
|---|---|---|---|---:|---:|---|---|---:|
| 1 | v3-page-01 | 01 用户入口与目标体验 | 1600x900 | 20 | 7 | 0 | 0 | 0 |
| 2 | v3-page-02 | 02 当前与目标代码实体 | 1600x900 | 27 | 8 | 0 | 0 | 0 |
| 3 | v3-page-03 | 03 双容器路由与组件 | 1600x900 | 24 | 5 | 0 | 0 | 0 |
| 4 | v3-page-04 | 04 Cookie 媒体与双回退 | 1600x900 | 24 | 11 | 0 | 0 | 0 |
| 5 | v3-page-05 | 05 任务证据 Ask 与反跳 | 1600x900 | 25 | 8 | 0 | 0 | 0 |
| 6 | v3-page-06 | 06 BiliNote 迁移与治理 | 1600x900 | 17 | 6 | 0 | 0 | 0 |
| 7 | v3-page-07 | 07 开发里程碑与自动验收 | 1600x900 | 20 | 7 | 0 | 0 | 0 |
| 8 | v3-page-08 | 08 人类验收与出门条件 | 1600x900 | 18 | 2 | 0 | 0 | 0 |

8 页、1600x900 页面、所有 ID 唯一、所有边端点存在、顶层节点无越界。Page 4/7/8 抽样文本与 `08-gap.md`/Stage Gate 一致：

- 第 4 页：“PortalPermissionClient → PortalSessionBroker 五项 scope 持久到主动撤销 / 真实 click 请求；Background 只复核 / UI bearer 只创建短期 channel / V3-1.3 Credential Channel（待新增）精确 Origin + 20 秒一次性 ticket / Background 9 名 envelope → 60 秒 Runtime 内存 lease / 专用 fetch；同 body 不重试 / 撤销/到期 阻止新租约 / 下载 / capture / 上传”；
- 第 7 页：“V3-1 页面/会话/租约 1.1 页面与 1.2 会话已限定 PASS / 1.3：20 秒 channel + 60 秒 lease 待实施 / V3-2 受控媒体与本地 ASR / V3-3 画面理解 / V3-4 任务与语义 / V3-5 双容器交互 / V3-6 生产矩阵 / V3-7 人类出门 / 固定自动分母 A01-A14”；
- 第 8 页：“H01-H10 / A01-A14 / Fatal=0 / Major=0 / V3 出门 人类签署 + 独立审计 / 只声明 B站固定矩阵 / V4 / 全平台 / 直播仍禁止”。

注：内部审计 18-internal-audit.md 报 “113 vertex / 54 edge”；本机用 `mxCell` 解析含根容器 + 群组 cells 得每页 10-27 不等，与该统计口径略有差异（应为只统计可视 vertex 不含根），但本审查关心的是 ID 唯一与边引用完整性，两口径均闭合。

---

## 6. 当前代码事实核查与可实现性

### 6.1 Runtime CORS

`apps/chrome-extension/src/runtimeClient.ts:7` 中 `RUNTIME_URL = "http://127.0.0.1:17861"`。开发计划 `15-development-plan.md §2` 与 ADR-V3-03、V3-09 均明确“Runtime 当前通用 CORS 接受任意 chrome-extension:// Origin，不能作为秘密接口的授权依据”。架构 §22.5 / 02-architecture.md:2441 复述相同事实。

事实成立：`15-development-plan.md` §2 描述的缺口与代码现状一致；该缺口由 `V3-1.3-1` 在 Runtime 侧新增 `MediaCredentialAuthenticator` 独立校验 exact Origin 修复，不依赖放宽。

### 6.2 Knowledge bearer 与 Background 持久 token

`runtimeClient.ts:898-901` 仅在 `request.path.startsWith("/v1/knowledge/")` 且 `localRuntimeSession.token` 非空时附加 `Authorization: Bearer`，路径白名单已收敛；Background 没有持久 token，只有进程内 `localRuntimeSession.token`，来源为 UI 输入或单次 Runtime 注入（`setLocalRuntimeToken` 调用方为扩展页面）。事实成立：Background 不持有独立持久的 Runtime bearer。

### 6.3 runtimeClient E2E body observation

`runtimeClient.ts:933-948`、`955-963`、`979-985` 通过 `emitR2RuntimeObservation({ phase, bodyBase64 })` 记录请求与响应字节 base64；该观测只用于 `__NAVIA_E2E_BRIDGE__` 与 `e2eR2ObservationQueue`（`entrypoints/background/index.ts:202-206`），但代码路径在 production build 下仍存在调用分支。

事实成立：开发计划 §2 描述的“通用 runtimeClient 会产生请求观测”成立。`V3-1.3-3` 必须在 Background 内新增专用 `BilibiliCredentialEnvelopeBroker` fetch，且在 `15-development-plan.md §4` 实体表中明确禁止复用通用 fetch——文档与代码事实一致，**未发现文档要求复用通用路径**。

### 6.4 Background generic proxy

`entrypoints/background/index.ts:154-163` 接受 `navia.runtimeFetch` 并由 `proxyRuntimeFetch`（329-340 行）将任意 path/method/headers/body 转发到 `RUNTIME_URL`，**不做 Origin/path/header 白名单校验**。文档 `15-development-plan.md §5.2` 与 `06-stage-gate.md §11` 明确 Background 与 Runtime 双端拒绝 `navia.runtimeFetch` 调用三个秘密 endpoint。

事实成立：`A07` 验收要求写明 Background 拒绝 + Runtime 拒绝，但当前 Background 入口未做拒绝，需在 `V3-1.3-3` 中加入 path/Origin 守卫；这是文档已识别的待办，不是文档缺陷。

### 6.5 V3-1.2 session 代码现状

- `apps/chrome-extension/src/modules/media_companion/session/PortalSessionBroker.ts`（164 行）；
- `apps/chrome-extension/src/modules/media_companion/session/bilibili/BilibiliPortalSessionAdapter.ts`（83 行）；
- `apps/chrome-extension/src/modules/media_companion/session/bilibili/bilibiliCookiePolicy.ts`（40 行，9 名常量 + name-set hash 一致）；
- `entrypoints/background/index.ts:38-49` 已实例化 `mediaSessionBroker` 与 `mediaSessionMessageRouter`，并把 `chrome.runtime.id` 与 `chrome.runtime.getURL("")` 注入 router；
- `06-stage-gate.md §10` 记录 V3-1.2 已 QUALIFIED PASS 并锁定原始字节 `7ce7d8b4…42ac`。

事实成立：V3-1.2 代码与本轮文档候选所引用的目标实体路径（`apps/chrome-extension/src/modules/media_companion/session/...` 与 `services/local-runtime/navia_runtime/modules/media_companion/`）一致，V3-1.3 子阶段 V3-1.3-0..7 可在不破坏 V3-1.2 既有 build 树的前提下增量落地。

### 6.6 可实现性结论

- 依赖方向：UI→Background→Runtime 单向；Runtime 不回调 Browser；
- 分期：8 子阶段（V3-1.3-0..7）每个有独立 acceptance card 与 PRD review 钩子，且阶段序号与 16-acceptance-plan 的 A01-A20 顺序对齐；
- 既有代码不需要回退重写，但 Background 与 Runtime 都需要新增专用 handler / endpoint；
- 通用 dialog/CORS 不被新协议依赖，符合 “不得放宽任意 chrome-extension:// Origin” 的停止条件。

---

## 7. 威胁审查

依据 `17-threat-model.md` 与本轮独立判断：

| ID | 威胁 | 文档防线 | 独立判断 |
|---|---|---|---|
| T01 Origin spoofing | 任意扩展借宽 CORS 创建 channel | `MediaCredentialAuthenticator` 独立校验 exact Origin（15-§5.1）；A04 | 设计闭合；缺口在“真实 Chrome probe 未跑”，见 M-1 |
| T02 主 bearer 窃取 | UI 把 token 交给 Background/storage/log | 主 bearer 只用于 UI 直连 bootstrap；Background 仅收 20 秒 ticket；A03/A17 | 文档明确禁止，代码现状（Background 无持久 bearer）支持落地 |
| T03 content script 伪造 command | 页面脚本经 content bridge 请求 envelope | exact extension document sender；router 重查；A06 | 与现有 V3-1.2 `PortalSessionMessageRouter` 已用 `chrome.runtime.id` + `sender.url` 模式一致，可复制 |
| T04 通用 proxy body 泄露 | runtimeClient E2E observation 含 bodyBase64 | Background 与 Runtime 双端 deny；专用 fetch；A07/A17 | 文档与代码事实一致；需要新增专用 fetch 路径 |
| T05 envelope 重放 | 捕获 ticket/body 重复签发 lease | ticket 首次请求即消费；envelopeId replay cache；A11 | 设计闭合；Runtime restart clear（15-§5.3）已声明 |
| T06 响应丢失重试 | 重发同 Cookie body | attempt=1；丢弃旧 body；新 channel/new envelope；A13 | 设计闭合；`requestAttemptCount=1` const 由 Schema 强制 |
| T07 扩大 Cookie 范围 | caller 传入 host/name 或插件静默加名 | 输入不接受 host/name；绑定 session registry hash；A02/A09 | 9 名常量 `BILIBILI_ALLOWED_COOKIE_NAMES` 已 freeze，hash 校验可复用 |
| T08 task/adapter 混淆 | B 站 Cookie 租给另一任务或未来门户 | channel/envelope/lease exact equality；A12/A19 | `taskId/adapterId/policyId/policyRevision/browserSessionBindingSha256/credentialNameSetSha256` 六向约束，13 个 semantic 负例覆盖 |
| T09 policy TOCTOU | channel 创建后用户撤销，Background 仍读 | 读 Cookie 前再次检查 policy/permission/capability；A08/A15 | 文档闭合；需要在 `V3-1.3-3` 落实 |
| T10 secret 持久化 | DB/EventStore/Trace/error/retry/screenshot/archive 含值 | endpoint 无 body observability；全介质 needle 扫描；A17 | Schema `requestBodyLogged/eventStorePayloadWritten/traceArgumentWritten/exceptionBodyWritten/retryBodyPersisted/rawCredentialValueHashed` 7 个 const=false 强制 |
| T11 可逆 secret hash | 低熵 Cookie 或字典攻击恢复值 | 禁止对值作证据 hash；只 hash 名称集合；A17 | 公共 Schema 不暴露值字段；`rawCredentialValueHashed=false` 与 `persistentSecretHitCount=0` const 强制 |
| T12 内存租约越期 | 过期 / Runtime restart 后仍可解析 | monotonic expiry + store clear + fail closed；A14/A16 | 60 秒 TTL + restart clear 已声明；Runtime restart 残余上界 60 秒 |
| T13 撤销竞态 | Cookie 变更 / permission remove 后旧 lease 可用 | listener 主动 revoke；Background 崩溃残余 ≤60 秒；A15/A16 | 设计闭合；残余窗口已声明上界 |
| T14 body 放大 / DoS | 巨大 credentials JSON 耗尽 Runtime | Content-Length 与实际 bytes 双检查 ≤32768；A10/A12 | Schema `requestBodyBytes ≤32768` 与 `maxEnvelopeBodyBytes=32768` 一致 |
| T15 exception 泄露 | JSON / Pydantic / HTTP 错误回显 body/value | 固定错误文案 / FailureCode；禁 stack/body；A10/A17 | 17 个 FailureCode 枚举覆盖，避免错误字符串注入 fake secret |
| T16 假服务端有效 | lease 签发被 UI 描述成登录验证 | `serverValidationStatus=not_performed` const；A10 | Schema 与 positive 实例强制；声明边界仅限 B站固定矩阵 |
| T17 未来门户继承 B 站能力 | YouTube/XHS 复用 B 站 host/白名单/PASS | adapter registry 分离、默认拒绝、独立审计；A19 | `11-transport-policy-registry.json.futureAdapterRequirements` 7 项 + `futurePortalInheritanceAllowed=false` 强制 |

残余风险（与 `17-threat-model.md §5` 对齐）：垃圾回收环境下进程内存物理清零不可保证、Background 崩溃后无法主动 revoke 的 60 秒上界、loopback HTTP 不带 TLS、扩展页面 XSS 影响 channel ticket、服务端会话有效性与平台风控属于 V3-2 acquirer。**这些残余风险在 V3-1.3 范围内可接受**，但不得通过降低秘密扫描、放宽 Origin、延长 TTL 或保存重试 body 解决。

---

## 8. False-green 判断（覆盖 A01-A20）

依据 `16-acceptance-plan.md §4`：

| 假绿手法 | 文档是否拒绝 | 结论 |
|---|---|---|
| 仅校验 public Schema 而不真实发送 secret envelope | Major | 已写为 A07 + A09 + A10 |
| fake Cookie / 产品 `chrome.cookies.set` / 旧 run / 跨 run 拼接 / 手改 lease | Fatal | A18 + PRD review 强制单 run；`v3-1p-bilibili-probe-20260917T041114Z` revision 1 registry 锁定 |
| 任意 `chrome-extension://` CORS 视为认证 / generic proxy 当秘密 transport | Fatal | A04 + A07；专用 fetch 路径独立 |
| 为重试保存/复发原 body / 从日志/E2E observation 还原 body | Fatal | A13 + A17；7 个 const=false Schema 强制 |
| 只看 lease UI badge 而不独立检查 Runtime memory store / expiry/replay/restart/revoke | Major | A11 + A14 + A15 + A16 |
| 以 Cookie 值 hash 代替 needle 扫描 / 保存该 hash | Major / Fatal | A17；manifest 隐私声明禁止 value hash |
| `serverValidationStatus=not_performed` 宣称为 B 站登录有效 / 媒体可获取 | Major | A10 + 17-§5 + 18-§5；`16-§4` 显式禁止 |
| 为通过放宽 channel/lease TTL、body 上限、Origin、adapter、host、Cookie 名 | Fatal | A01 + A02 + A10 + A12 + A19；Schema 与 registry 强制 |
| mock / 跨 run / 跨任务复用 / 缩减 12 页分母 | Fatal | `06-stage-gate.md §6` No-Go 显式拒绝 |
| 把本地导出声明为 V4 知识持久化 | Fatal | ADR-V3-01 + `06-stage-gate.md §6` 拒绝 |
| 缩小 secret 扫描范围 / 缺全介质 needle | Fatal | A17 显式要求 extension storage / IndexedDB / Runtime DB / EventStore / Trace / stdout / stderr / error / retry / screenshot / archive 全介质 |

判定：文档对 16-§4 的 8 条假绿规则与 17-§2 的 17 个威胁均有可追溯的 acceptance ID；不存在 “仅 UI badge / 仅 Schema shape / 仅 Cookie 值 hash” 通过的灰色通道。

---

## 9. 状态保留

| 状态 | 本轮前 | 本轮后 |
|---|---|---|
| V3-1.2 QUALIFIED PASS | retained | **retained**（原始字节 hash 不变） |
| V3-1.3 DOCUMENT CANDIDATE | — | **DOCUMENT CANDIDATE** |
| V3-1.3 IMPLEMENTATION | NO-GO | **NO-GO**（未经用户高风险授权不得写产品代码） |
| V3-2+ | BLOCKED / NOT_IMPLEMENTED | **BLOCKED / NOT_IMPLEMENTED** |
| V3 / 全平台 / 直播 / RAG / V4 | 禁止声明 | **禁止声明** |

---

## 10. 特别问题回应

### 10.1 Browser service worker loopback fetch 的 Origin header

本轮**未在真实 Chrome 中探测** extension page 对 `http://127.0.0.1:17861` 的实际 `Origin` header 字节。开发计划 §2 与 `18-internal-audit.md` M-1 已识别：`V3-1.3-1` 必须先做真实 Chrome probe；若 header 缺失或不稳定，必须停止并回到架构选择，**不得放宽为任意/无 Origin**。

判定：**符合本轮审查边界**（文档候选审查不要求立即跑 Chrome），但本条件必须写为 `V3-1.3-1` 的先决卡。

### 10.2 20 秒 channel / 60 秒 lease

20 秒足以完成同一任务的一次 channel bootstrap + Background 重查 policy/permission/capability + Cookie read + 专用 fetch + Runtime 解析；60 秒足以覆盖 Runtime 内存 lease 在单任务期间供 `BilibiliMediaAcquirer` 使用。两者**不提前承诺 V3-2 下载时长**——`18-internal-audit.md` M-2 明确：若 V3-2 证明需要更长 credential 生命周期，必须采用同任务受控续租并重新威胁建模，**不得直接延长现有 lease**。

判定：当前 TTL 边界与 V3-1.3 范围一致。

### 10.3 主 bearer 只用于 UI bootstrap、Background 只获 scoped ticket

是。`runtimeClient.ts:898-901` 已将主 bearer 限制在 `/v1/knowledge/*` 路径且仅在 UI 进程内；Background 当前无持久 token，开发计划 §5.1-5.2 明确 Background 只接受 20 秒 channel ticket 与专用 `Navia-Media-Channel` header，不接受主 bearer。**比把主 bearer 交给 Background 更符合最小权限**——即便 Background 受损，攻击者只能换 ticket 而不能直接 bootstrap 新 channel。

判定：与最小权限原则一致。

### 10.4 public JSON Schema 不保存 secret envelope 实例

是。`12-credential-lease.schema.json` 与 `13-positive.json` 均不出现 `cookieValue/channelToken/revocationToken/cookieNames/secret/envelope body`；Schema `additionalProperties: false` + 17 个 `const` 强制。实现侧只能持有严格进程内类型，公共 Schema 不约束进程内 envelope 实例——这避免公开 artifact 成为秘密的二级存储。**足够可实施和可审计**：13 个 semantic negative 全部 schema-valid，runtime 内 envelope 验证逻辑可独立用单元测试覆盖，无需把实例落盘。

判定：满足“public schema 只表达公开承诺”的边界。

---

## 11. Fatal / Major / Minor

### Fatal = 0

无致命缺陷。

### Major = 0

无主要缺陷。

### Minor = 2

1. **M-1 待 Chrome Origin probe（继承自内部审查，边界同 18-M-1）**
   `V3-1.3-1` 必须在真实 Chrome extension page → `http://127.0.0.1:17861` 抓取 `Origin` header 字节并写为 acceptance 卡的先决条件；若 header 缺失或不稳定，必须停止并回到架构选择，禁止放宽为任意/无 Origin。本轮只读文档审查不要求立即跑 Chrome。
   **为何 Minor**：缺口已被显式承认并设置先决卡，未在文档中隐瞒。

2. **M-2 60 秒 lease 覆盖范围（继承自内部审查，边界同 18-M-2）**
   60 秒仅覆盖 V3-1.3 transport/lifecycle，不为 V3-2 下载承诺延长。`16-§3`、`17-§5` 与本轮审查均显式声明：若 V3-2 需要更长生命周期，必须采用同任务受控续租 + 重新威胁建模，不得直接放宽 TTL。
   **为何 Minor**：TTL 上界由 Schema 与 registry 锁死，调整需要重新审计而非静默放宽。

---

## 12. 残余风险与显式声明

- V3-1.3 不实现媒体下载、不证明 B 站服务端会话有效、不实现 ASR/OCR/VLM、不实现 YouTube/小红书、不实现 V4 知识；任何超出此范围的声明均为假绿；
- 进程内存物理清零、Background 崩溃 60 秒残余窗口、loopback HTTP 无 TLS、扩展页面 XSS、服务端风控 5 项残余风险见 `17-threat-model.md §5`，不得通过降低秘密扫描、放宽 Origin、延长 TTL 或保存重试 body 解决；
- 任何实施期对 `12-credential-lease.schema.json`、`10/11` registry、`13-positive.json`、`14-fixtures.json` 的字节修改都必须重算 hash 并重跑 25 cases 后再继续；
- 任何需要把主 bearer 或 Cookie 值写入 storage / log / 公开 JSON / retry queue / E2E observation / EventStore / Trace 的实施必须停止并回到文档审计。

---

## 13. 明确门禁（最高允许结论）

```text
V3-1.3 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER HIGH-RISK IMPLEMENTATION AUTHORIZATION.
```

放行实施的全部条件：

1. **本报告 Fatal = 0 / Major = 0 / Minor = 2（M-1、M-2）**已显式纳入 `V3-1.3-0..7` 验收卡；M-1 必须在 `V3-1.3-1` acceptance card 内以“真实 Chrome probe + accept Origin 字节 + reject 否则”作为唯一先决；
2. 用户**单独签署** `V3-1.3 Browser-to-Runtime credential transport implementation` 高风险授权（参考 `v3-1.2-implementation-authorization.md` 模板），授权范围仅限 V3-1.3-0..7，**不延伸到 V3-2 或 V4**；
3. V3-1.2 QUALIFIED PASS 与原始 registry 字节 `7ce7d8b4…42ac` 保持不变；
4. 实施必须从 `V3-1.3-0` 开始，顺序推进，每个子阶段先写独立 acceptance card 再写代码，任一 Critical/High、新 Fatal/Major、真实 secret 命中或 Origin probe 不成立时立即停止并回到文档审计；
5. 单 run 全量 A01-A20 PASS，Fatal=0、Major=0，全部旧回归通过；
6. 独立实现审计由不同 session 执行并重算 hash、负例、真实 run 与秘密扫描边界。

禁止声明：

- V3-1.3 已实现 / 媒体可下载 / B 站服务端会话有效 / V3 已通过 / V3-2 通过 / 全平台 / 直播 / V4 知识 / 跨视频 RAG。
