# V3 Media Companion Cookie 主路径外部独立文档审查

日期：2026-09-17  
审查者：当前 session（独立只读静态 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析 + BiliNote 本地 checkout 文件 hash 抽样复算；未启动浏览器、Runtime、Chrome 真实采集、ASR/VLM/OCR 工具、任何 V3 runner）  
审查对象：`docs/active/project/external-audit-package/` 18 载荷 + 1 manifest = 19 平铺文件  
审查决策对象：V3-0 Cookie 主路径文档候选能否在用户另行明确授权后无歧义支撑 V3-1..V3-7 自动化开发与真实验收。  
输入文件：`AUDIT_MANIFEST.md`、`01-audit-request.md`（明确：本轮只复审 Cookie 主路径候选；旧 `independent-document-audit.md` 是 no-cookie 历史，仅作记录不得作为本轮路线 PASS 依据）。

---

## 0. 摘要

```text
V3-0 DOCUMENT PASS / V3-1 IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
```

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 自报哈希逐字节相等（diff exit 0），权威源与平铺文件 0 mismatch。
- V3 Schema v2 通过 Draft 2020-12 `check_schema`；23 项 requirement registry 与 23 个 case 的 (requirementId, requirementKey) 集合精确相等；FailureCode 集合一致；5 schema + 18 semantic negatives 计数与候选声明一致。
- BiliNote migration allowlist v1：default-deny + `copyAuthorization=not_authorized_in_v3_0` + `dirtyWorkingTreeAllowed=false` + `allowedAction=reference_only`；6 个允许 clean-commit 文件 + 5 个显式 deny（含 cookie_manager.py / downloader.json / BillNote_frontend/ / backend/app/db/ / local_dirty_diff）。
- 本 session 抽样独立复算 3 个允许文件 SHA-256（`backend/app/routers/note.py`、`backend/app/services/note.py`、`backend/app/utils/video_reader.py`）全部与 allowlist 声明一致。
- Draw.io 8 页 / 113 vertex / 53 边 / ID 唯一 / 0 越界 / 0 引用断裂；第 4 页 `Cookie媒体与双回退`（与旧 no-cookie 候选的 `字幕音频OCR与VLM` 替换）显式反映 Cookie 主路径。
- 受控 Cookie 会话主路径（ADR-V3-03 / ADR-V3-09）：浏览器权威 + 短租约 + Runtime 内存 + 任务期 0600 cookiefile + 强制清理；秘密传输经认证 loopback 使用一次性 `BilibiliCredentialEnvelope`，请求体不得进入 access log / EventStore / Trace / 异常转储 / 重试队列；拒绝 `<all_urls>` 与未审计 Cookie 名称。
- 公开 No-Go 已显式禁止 mock / fixture 计生产结果；Cookie 值持久化；秘密 request body 记录；无租约下载 / 跨任务凭据复用 / 绕过平台限制；tabCapture 无可信点击；无授权上传帧；无证据生成画面结论 / Ask；跨 run 拼接；缩小 12 页分母；凭据 / 临时媒体清理失败仍成功；Side Panel 和 Workspace 使用不同 task；本地导出声明为 V4 知识持久化。

**Fatals：0。Majors：0。Minors：3（详见 §14）。**

---

## 1. 载荷完整性：18 项 SHA-256 独立重算

### 1.1 计算结果

```text
18 项载荷哈希逐字节匹配 AUDIT_MANIFEST.md（diff exit 0）。
权威源 vs 平铺副本：18 项 SHA-256 一一相等（0 mismatch）。
文件数：19（18 载荷 + 1 manifest），无子目录。
```

### 1.2 关键文件 SHA-256 对账

| 文件 | 平铺 SHA-256 | 权威源 SHA-256 | 一致 |
|---|---|---|---|
| `01-audit-request.md` | `50497e22…9db63` | 同 | ✓ |
| `02-prd.md` | `83371bc8…bbb61` | 同 | ✓ |
| `03-architecture.md` | `345fb69b…7326` | 同 | ✓ |
| `04-development-plan.md` | `11bc8fd5…2155` | 同 | ✓ |
| `05-acceptance-plan.md` | `49cc034a…5bac` | 同 | ✓ |
| `06-v3-stage-gate.md` | `53f6f1c2…3684` | 同 | ✓ |
| `07-v3-detailed-plan.md` | `a3e988dc…6cec` | 同 | ✓ |
| `08-prototype-self-contained.html` | `27e03b1b…ca91` | 同 | ✓ |
| `09-gap.md` | `72742784…ea04` | 同 | ✓ |
| `10-gap.drawio` | `eab8146d…17fb` | 同 | ✓ |
| `11-component-route.md` | `0c89807e…c7e4` | 同 | ✓ |
| `12-contract.schema.json` | `2ba21b12…5389` | 同 | ✓ |
| `13-contract-fixtures.json` | `948b858d…d6d5` | 同 | ✓ |
| `14-bilinote-study.md` | `57ffcc03…0f35` | 同 | ✓ |
| `15-risk-adr.md` | `fca31449…62b6` | 同 | ✓ |
| `16-internal-false-green-audit.md` | `0f2e1c8e…2cbe5` | 同 | ✓ |
| `17-readiness-audit.md` | `45107b8f…23b4` | 同 | ✓ |
| `18-bilinote-migration-allowlist.json` | `05f92482…cf41` | 同 | ✓ |

---

## 2. 隔离与上游基线

| 项目 | 字节 SHA-256 | 状态 |
|---|---|---|
| 旧 T02 / T02.1 / T02.2 / T02.4 / T02.5 raw | 各自保持恒等（前几轮审查已确认） | 字节恒等 ✓ |
| T04 LIMITED PASS（独立审计） | `cd64f8db…090c9b` | 字节恒等 ✓ |
| T03 R3 production-candidate | 134804 | 字节恒等 ✓ |
| T03 LIMITED PASS | ✓ | 本包不涉及 ✓ |
| BiliNote clean commit `be3889395afb5346aa4339ae933d3ba2e08f25a8` | n/a（外部仓库） | reference_only ✓ |
| 本地 `bilinote/` dirty diff | n/a | `policy.dirtyWorkingTreeAllowed=false` 显式拒绝 ✓ |

- T04 LIMITED PASS 边界保持；T03 R3 边界保持；BiliNote 边界由 allowlist v1 显式 `default-deny` + `copyAuthorization=not_authorized_in_v3_0` 锁定。
- 旧 `independent-document-audit.md`（no-cookie 候选）已明示被本 Cookie 候选取代；本审查不沿用旧 PASS 结论。

---

## 3. T03 / T04 边界保持

| 边界 | 本审查确认 |
|---|---|
| T03 LIMITED PASS | 不变；T04 R4 snapshot revalidation 在 T03 之上；本 V3 文档不修改 T03 / T04 任何产物 |
| T04 LIMITED PASS, Fatal 0 / Major 0 / Minor 1 | 不变；T04 ExitManifest SHA-256 = `5e492bd5…16cd`（与本审查材料 12 一致） |
| PX-5 FAIL / REOPENED | 仍保持；本 V3 文档未涉及 |
| PX-6 DOCUMENT CANDIDATE / IMPLEMENTATION BLOCKED | 仍保持；本 V3 文档不修改 PX-6 runner / 验收材料 |
| V2/RKM PAUSED / INCOMPLETE | 仍保持；不阻塞 V3 |
| V4 承接真实知识持久化 | ADR-V3-01 显式 V3 不依赖 V4 出门；`knowledgeImportStatus=deferred_to_v4` |

---

## 4. Schema 与 Fixtures 独立复算

### 4.1 Schema meta-validation

```text
V3 Schema v2 Draft 2020-12 check_schema: PASS
$defs keys (16): Id, Sha256, Timestamp, MediaPageContext, MediaConsentPolicy,
  MediaCaptureGrant, BilibiliCredentialLease, MediaAcquisitionRecord, EvidenceRef,
  MediaTask, TimelineSegment, VideoOutline, MediaMindmapProjection, AskVideoResult,
  MediaExportManifest, ProductionValidationInputs
```

### 4.2 Fixtures 结构

| 项 | 候选声明 | 独立实测 |
|---|---|---|
| positiveInstances | 1 | 1 ✓ |
| requirementRegistry | 23 (5 schema + 18 semantic) | 23 (5 schema + 18 semantic) ✓ |
| negativeCases | 23 | 23 ✓ |
| FailureCode unique in registry | 23 | 23 ✓ |
| (requirementId, requirementKey) set match | yes | **精确相等** ✓ |
| Case failure codes subset of registry | yes | **True** ✓ |
| Fixture schemaVersion | v3-media-companion-fixtures/v1 | 同 ✓ |

### 4.3 新合同对象

- `BilibiliCredentialLease`：字段集 = `{leaseId, taskId, profile hash, cookie-name-set hash, cookie policy revision, one-shot transport, issuedAt, expiresAt}`；**禁止 Cookie 值**（与 risk-adr §09 ADR-V3-09 一致）。
- `MediaCaptureGrant`：只在 tabCapture 回退路径创建；可信用户点击生成；不可与产品 scope 合并为布尔。
- `MediaAcquisitionRecord`：任务期临时媒体获取记录；终态清理必须确定性。
- `ProductionValidationInputs`：6 类子项（raw、derived、validator、semanticSpec、registry、fixtureSuite），不允许 `virtual/*` 或虚构 mock。

---

## 5. BiliNote migration allowlist 独立复算

### 5.1 Allowlist policy

```text
schemaVersion: v3-bilinote-migration-allowlist/v1
status: document_freeze_reference_only
default: deny
dirtyWorkingTreeAllowed: false
copyAuthorization: not_authorized_in_v3_0
allowedAction: reference_only
futureCopyRequires:
  - stage_specific_user_authorization
  - source_and_target_file_mapping
  - preserved_mit_attribution
  - independent_preimplementation_audit
```

### 5.2 6 个允许 reference_only 来源

| 文件 | 字节 | 用途 |
|---|---:|---|
| `backend/app/routers/note.py` | 12,847 | background task and status polling flow |
| `backend/app/services/note.py` | 29,909 | subtitle-first and ASR-fallback orchestration study |
| `backend/app/utils/video_reader.py` | 7,801 | FFmpeg frame sampling and adjacent-frame deduplication study |
| `backend/app/gpt/prompt_builder.py` | 5,413 | timestamp and screenshot prompt-boundary study |
| `backend/app/utils/screenshot_marker.py` | 494 | marker failure-mode study; markers are not Navia authority |
| `backend/app/utils/note_helper.py` | 2,407 | platform timestamp-link rendering study |

### 5.3 5 个显式 deny

| 路径 | 原因 |
|---|---|
| `backend/app/services/cookie_manager.py` | 明文或长期 Cookie 配置与 Navia 凭据租约不兼容 |
| `config/downloader.json` | 持久原始 Cookie 值被禁止 |
| `BillNote_frontend/` | BiliNote 应用壳超出 V3 迁移边界 |
| `backend/app/db/` | BiliNote 账号和数据库拓扑超出 V3 迁移边界 |
| `local_dirty_diff` | 仅 frozen clean commit 的字节可被研究 |

### 5.4 本地抽样独立复算

| 文件 | allowlist SHA256 前 16 | 实际 SHA256 前 16 | 匹配 |
|---|---|---|---|
| `backend/app/routers/note.py` | `d9e1dee82e96260c` | `d9e1dee82e96260c` | ✓ |
| `backend/app/services/note.py` | `58e0c0569fb4974f` | `58e0c0569fb4974f` | ✓ |
| `backend/app/utils/video_reader.py` | `e838a1c5b91fb5d6` | `e838a1c5b91fb5d6` | ✓ |

注：本地 `bilinote/` 工作树存在 dirty diff；allowlist policy 显式禁止 `local_dirty_diff` 来源；本审查只复算来自 frozen clean commit 的 6 个允许文件。

---

## 6. Draw.io 独立结构复算

| 项 | 候选自报 | 独立实测 |
|---|---|---|
| 页数 | 8 | 8 ✓ |
| 总 vertex | 113 | 113 ✓ |
| 总边 | 53 | 53 ✓ |
| ID 唯一 | 0 duplicate | 0 duplicate ✓ |
| 越界 | 0 | 0 ✓ |
| 引用断裂 | 0 | 0 ✓ |

8 页分别为：
1. `01 用户入口与目标体验` v=12 / e=7
2. `02 当前与目标代码实体` v=18 / e=8
3. `03 双容器路由与组件` v=18 / e=5
4. `04 Cookie媒体与双回退`（旧 no-cookie 候选为 `04 字幕音频OCR与VLM`）v=12 / e=10
5. `05 任务证据Ask与反跳` v=16 / e=8
6. `06 BiliNote迁移与治理` v=10 / e=6
7. `07 开发里程碑与自动验收` v=12 / e=7
8. `08 人类验收与出门条件` v=15 / e=2

第 4 页反映 Cookie 主路径修订（与审计请求 §2 一致）。

---

## 7. Cookie 主路径设计原则（来自 risk-adr §09 / §ADR-V3-03）

- **浏览器权威**：Background `BilibiliSessionBroker` 只从当前 Chrome profile 读取完成当前任务所需的 B站 Cookie。
- **短租约**：签发短期 `BilibiliCredentialLease`（仅 leaseId / taskId / profile hash / cookie-name-set hash / cookie policy revision / one-shot transport / issuedAt / expiresAt），不含 Cookie 值。
- **Runtime 内存 + 任务期 0600 cookiefile**：Cookie 值只存在于浏览器 Cookie Store、进程内存和任务期随机 0600 Netscape cookiefile；任务完成 / 失败 / 取消 / 租约到期 / 撤销时必须删除。
- **秘密传输固定经现有认证 loopback Runtime 通道**：使用一次性 `BilibiliCredentialEnvelope`；请求体不得进入 access log / EventStore / Trace / 异常转储 / 重试队列。
- **Chrome 权限最小化**：可选 `cookies` + `https://*.bilibili.com/*`；禁止 `<all_urls>` 与静默新增 Cookie 名称；按版本化 Cookie 名称白名单过滤。
- **三重采集回退**：凭据字幕/临时媒体 → 公开或页内字幕 → 可信点击 `chrome.tabCapture`。
- **失败 fail closed**：权限未授予 / Cookie 缺失 / 平台拒绝 / 媒体受保护 / 清理失败 → blocked 或 degraded；不得以抓取技巧或 mock 伪装成功。

---

## 8. PRD / 架构 / Stage Gate / 详细计划 一致性

| 文档 | 关键条款 | 本审查一致度 |
|---|---|---|
| `02-prd.md` | V3 限定 B站 12 页分母；首版受控 Cookie 主路径；V4 承接知识持久化；no-go 列出全平台 / 直播 / 自动下载 / 跨视频 RAG | ✓ |
| `03-architecture.md` | P0-P7 实体边界 + Cookie / 媒体 / 证据流；BilibiliSessionBroker + BilibiliMediaAcquirer + BilibiliCredentialLease 边界 | ✓ |
| `06-v3-stage-gate.md` | V3-0..V3-7 顺序 + 出门判定 + No-Go；product code 需用户另外明确授权 | ✓ |
| `04-development-plan.md` | 主开发计划；V3-1..V3-7 实施边界 | ✓ |
| `05-acceptance-plan.md` | 验收分母与门槛 | ✓ |
| `07-v3-detailed-plan.md` | 详细开发 / 验收 / 证据矩阵 | ✓ |
| `11-component-route.md` | 双容器路由 + 组件职责 | ✓ |
| `14-bilinote-study.md` | BiliNote 技术路线（commit `be388939...`）+ 拒绝清单 | ✓ |
| `15-risk-adr.md` | ADR-V3-01..09 + 风险登记表 | ✓ |
| `18-bilinote-migration-allowlist.json` | 6 允许 + 5 deny + policy 字段 | ✓ |
| `16-internal-false-green-audit.md` | 内部对抗审计 | 仅作记录 |
| `17-readiness-audit.md` | 多轮检查汇总 | 仅作记录 |

---

## 9. 防假绿边界独立验证

| 攻击 | 文档拒绝机制 | 独立复算 |
|---|---|---|
| mock VLM / 静态截图冒充视觉证据 | V3-0 生产 profile 拒绝 mock；Stage Gate §6 No-Go 列出 | ✓ |
| 重复 URL 缩分母 | 12 页固定分母；V3-1 实施前真实 Chrome 探测冻结；Stage Gate §4 | ✓ |
| 标题冒充转录 | 公开字幕为空必须显式 `transcript_unavailable`；bilinote-study §6 已声明 | ✓ |
| 持久授权替代同 task 租约 | ADR-V3-05 五项产品 scope 与租约分离；UI 不可合并 | ✓ |
| tabCapture 无可信 grant | ADR-V3-05 + ADR-V3-09：tabCapture 只能在可信点击创建 MediaCaptureGrant | ✓ |
| Cookie 值落盘 / 日志 / 公开证据 | risk-adr §09 闭包：禁止 `<all_urls>`、持久 Cookie、request body 记录、跨任务复用 | ✓ |
| 清理失败仍成功 | ADR-V3-08 失败策略：清理失败时任务不得进入成功终态 | ✓ |
| 缓存冒充恢复 | ADR-V3-06 同一 VideoOutline 派生；缓存不冒充证据 | ✓ |
| Ask 无引用 | Ask 只消费 EvidenceRef 索引 | ✓ |
| seek 不回读 | MediaJumpbackTarget 必带 located / fallback_shown / blocked | ✓ |
| V2/V4 污染 | ADR-V3-01 V3 不依赖 V2 知识服务；`knowledgeImportStatus=deferred_to_v4` | ✓ |
| 跨 run 拼接 | 12 页分母同 run；新 run 独立封存 | ✓ |
| 明文 Cookie 持久化 | allowlist 显式 deny `cookie_manager.py` / `downloader.json`；本地复制 `not_authorized_in_v3_0` | ✓ |
| 整仓 BiliNote 桥接 | allowlist policy `default-deny`；6 文件 reference_only；dirty diff 拒绝 | ✓ |

---

## 10. 必答审查问题逐项

| # | 问题 | 回答 |
|---|---|---|
| 1 | 受控 Cookie 主路径、公开 / 页内字幕、可信 tabCapture 回退、本地 ASR、关键帧、OCR、授权云端 VLM 是否一致 | ✓ ADR-V3-03/05/06/08/09、stage-gate §4-§6、risk-adr §07-§09、contracts §BilibiliCredentialLease 全部一致 |
| 2 | Chrome cookies/host 最小化、Cookie 名称白名单、loopback 一次性 envelope、任务终态清理 | ✓ ADR-V3-09 闭包 |
| 3 | Side Panel / Media Workspace / Runtime / A/C/D / MediaTaskStore / V4 Adapter 职责明确 | ✓ |
| 4 | 8 route × 4 modes、四视口、Axe/Keyboard、真实 Provider、真实 seek、H01-H10 出门条件 | ✓ acceptance-plan §9 + stage-gate §3 |
| 5 | 确定性 HTML 是否仍完整覆盖当前基线、目标总体设计、详细模块、用户路线、人类回填 | ✓ prototype-self-contained.html 2,844,095 bytes 自包含；可离线操作；6 张权威图片内联；Lucide 内联 |
| 6 | 是否仍存在需要实施者自行决定的字段、失败码、状态、分母、路径、授权、清理、证据等级 | ✓ 23 个 FailureCode + 16 个 $defs 字段已固定；V3-1 实施前 12 URL 探测后冻结 |
| 7 | V3-0 文档完成后是否足以先制定 V3-1 独立开发 / 验收计划，不提前承诺 V3-2..V3-7 | ✓ dev-plan §2 + dev §6 明确 V3-1 collector/session/credential/context/双容器入口为独立子阶段 |

---

## 11. T03 / T04 与 V3 隔离关系

| 维度 | 边界 |
|---|---|
| T03 production-candidate evidence pipeline | LIMITED PASS；不可被 V3 文档 / 原型 / fixture 升级为 V3 PASS |
| T04 snapshot revalidation | LIMITED PASS；不可被 V3 跨越 |
| PX-5 / PX-6 | 仍 FAIL / BLOCKED；V3 不复用 PX-6 runner |
| V2/RKM | PAUSED；V3 写 `MediaTaskStore` + `knowledgeImportStatus=deferred_to_v4` |
| V4 | 知识持久化承接方；V3 不承诺跨视频 Query/RAG |

---

## 12. 实施身份与公开边界

- 本 session 与本轮所有先前审查 session 共享基础工具集 / README 入口，但属于新独立上下文。
- 审查请求 SHA-256 `50497e22…9db63` 与本审查意见落盘后产生的 artifact 必须不同。
- 未来实施授权摘要必须包含 userId / signedAt / sha256 / scope，且 sha256 与本审查请求不同（强制约束）。
- 公开证据归档 `08-prototype-self-contained.html` 在 prototype 自包含范围内 0 外部资源引用（确认）。

---

## 13. 决定

**V3-0 DOCUMENT PASS / V3-1 IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION.** 本 session 对 V3 Cookie 主路径修订候选做独立只读静态核验：

- 18 项载荷 SHA-256 与 `AUDIT_MANIFEST.md` 逐字节相等。
- 23 项 requirement registry 与 23 个 case 的 (requirementId, requirementKey) 集合精确相等；FailureCode 集合一致。
- BiliNote migration allowlist v1 default-deny + 6 允许 reference_only + 5 deny；本 session 抽样独立复算 3 个允许文件 SHA-256 与声明一致。
- Draw.io 8 页 / 113 vertex / 53 边 / 0 越界 / 0 引用断裂；第 4 页反映 Cookie 主路径修订。
- Cookie 主路径 ADR-V3-03/05/06/08/09 完整；受控 Cookie 会话 + 短租约 + Runtime 内存 + 0600 cookiefile + 一次性 envelope + 强制清理。
- 13 项防假绿攻击全部由文档机制阻断。
- 3 项 Minor 均为审查覆盖度或文档措辞（详见 §14），不构成 Fatal/Major 阻断。

**允许进入**：用户**另行明确批准**后开始 V3-1 自动化开发与真实 Chrome 探测；12 URL 注册表在 V3-1 探测后冻结；任何 mock / fixture / 跨 run 拼接均 NO-GO。

**禁止**：
- 不允许把本审查扩大为 V3 产品、全平台、直播、自动下载、跨任务复用、绕过平台限制、跨视频 RAG、V4 或完整 BiliNote/Monica parity 已完成。
- 不允许 V3-1..V3-7 在本审查通过 + 用户明确批准前进入实质实现。
- 不允许修改 T03 / T04 / PX-6 / RKM 任何 run、seal、audit doc。
- 不允许跨 run 拼接 / 缩分母 / mock 冒充。
- 不允许把本审查与实施后独立审计等同。

---

## 14. Minor 项（3 项，不阻断 V3-0 DOCUMENT PASS）

### M-1：12 个具体 B站 URL 未在 V3-0 冻结（仅固定分母；V3-1 实施前必须真实 Chrome 探测）

**位置**：`06-v3-stage-gate.md §4`：12 页固定分母（6 字幕 + 3 ASR + 1 多 P + 1 受限 blocked + 1 低信号 degraded）；锚点 `BV1ZpYd66ELP`；其余 11 URL 待 V3-1 探测后冻结。

**风险**：低；V3-1 探测步骤明确。

**建议**：在 `07-v3-detailed-plan.md` 增加"V3-1 探测产物固化"小节，强制 12 URL 注册表 + 11 身份校验脚本在 V3-1 完成时落盘。

### M-2：`08-prototype-self-contained.html`（2,844,095 bytes）四视口可操作性 / Axe 0/0 / 键盘主流程通过未由本 session 实跑验证

**位置**：自包含原型的四张逐步操作截图已内联；本审计仅做 HTML 解析与字段抽样，不实跑浏览器。

**风险**：低；Axe 0/0 由本地 152 真实 Chrome 验证。

**建议**：R3 / 后续轮次由新独立 session 用 Playwright + 真 axe-core 重新加载本地 HTML 验证。

### M-3：本地 `bilinote/` 工作树存在 dirty diff，本 session 未对全部 6 个 allowlist 文件做独立 hash 复算（仅抽 3 个）

**位置**：allowlist 18-bilinote-migration-allowlist.json 声明 6 个 reference_only 文件的 sha256 / byteLength；本地 checkout 存在 dirty diff（policy 禁止）。

**风险**：低；3 / 6 抽样全部匹配；policy 显式 default-deny + dirty working tree refused。

**建议**：未来 BiliNote 真实迁移前由新独立 session 复算全部 6 个文件 SHA-256 + dirty diff 拒绝证明。

---

## 15. 工作约束

- 仅做只读静态分析 + Python 标准库 + sha256sum + jsonschema + ElementTree XML 解析 + bilinote 本地 checkout 文件 hash 抽样复算。
- 没有运行产品代码、Runtime、Chrome、ASR / VLM / OCR 工具、任何 V3 runner、T04 runner、T03 runner。
- 没有修改主工作树、没有 commit、没有 push。
- tracked diff 与未跟踪文件原样保留。
- 上一轮（9-09 / 9-10 / 9-11 / 9-12 上午 / 9-12 下午 / 9-13 / 9-14 / 9-16 / 9-17 上午）所有已封存 run / seal / audit doc 原样保留。
- 与 r1-independent-audit / rkm-doc-readiness-review / t02-independent-audit / t02.1-independent-audit / t02.2-independent-audit / t03-independent-resumption-preimplementation-audit / t03-independent-implementation-exit-audit / t04-independent-exit-audit / t04.1-px6-document-audit / v3-no-cookie-document-audit 系列审计文档并列独立存档。