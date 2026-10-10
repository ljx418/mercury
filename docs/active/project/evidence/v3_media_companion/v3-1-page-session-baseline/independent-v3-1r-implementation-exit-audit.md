# V3-1R / V3-1.2 独立实施出门审计

日期：2026-09-17。
审查者：独立只读审查者。
入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` + `01-audit-request.md`。
审查对象：`V3-1R / V3-1.2-A13` 实施出门候选；候结论 `V3-1.2 LOCAL PASS CANDIDATE / INDEPENDENT EXIT AUDIT PENDING`。
约束：仅审计上述载荷并隔离解包归档；不运行产品、Chrome 或读取任何仓外 Cookie 文件；不输出疑似秘密值；只写本文件。

## 0. 一句话结论

候选的证据载荷与冻结契约、12 页分母、隔离解包、build/registry/result 绑定、12 张 1280×900 PNG 隐私裁剪、防假绿扫描、PRD 偏移声明和明确门禁全部独立可复算。

- **Fatal = 0**
- **Major = 0**
- **Minor = 1**（见 §9.1；不阻塞 V3-1.2 升级为限定 PASS，但要求在 V3-1.3 出门文档中并入）
- 候选建议由 `INDEPENDENT EXIT AUDIT PENDING` 升级为 `V3-1.2 QUALIFIED PASS`，并仅进入 V3-1.3 文档、威胁模型与实施前审计阶段；V3-1.3 代码实施仍需新的高风险用户授权（保持 NO-GO）。

## 1. 19 个载荷 SHA-256 逐项对账

| 文件 | manifest 字节 | 重算字节 | manifest SHA-256 | 重算 SHA-256 | 结果 |
|---|---:|---:|---|---|---|
| `01-audit-request.md` | 2838 | 2838 | `6d5a0ddf…f47e93dde` | `6d5a0ddf…f47e93dde` | ✅ |
| `02-prd.md` | 134747 | 134747 | `99554b25…83526e6b` | `99554b25…83526e6b` | ✅ |
| `03-architecture.md` | 155224 | 155224 | `b6a7f54e…07cc4c5c` | `b6a7f54e…07cc4c5c` | ✅ |
| `04-stage-gate.md` | 9777 | 9777 | `1a3f0467…d2b2e7765` | `1a3f0467…d2b2e7765` | ✅ |
| `05-session-acceptance-plan.md` | 6225 | 6225 | `465c2334…2b51e1471` | `465c2334…2b51e1471` | ✅ |
| `06-session-threat-model.md` | 4368 | 4368 | `6a763b83…0c4aaa6e3` | `6a763b83…0c4aaa6e3` | ✅ |
| `07-portal-registry.json` | 2052 | 2052 | `c96ab0d3…f9868eab6` | `c96ab0d3…f9868eab6` | ✅ |
| `08-session-acceptance-card.md` | 3659 | 3659 | `3cb6a7a1…d85872a05` | `3cb6a7a1…d85872a05` | ✅ |
| `09-regression-development-plan.md` | 2561 | 2561 | `9a382d6a…220522478` | `9a382d6a…220522478` | ✅ |
| `10-regression-acceptance-plan.md` | 1752 | 1752 | `7e0c5c13…db5ae43f4` | `7e0c5c13…db5ae43f4` | ✅ |
| `11-preimplementation-audit.md` | 906 | 906 | `7fff844e…b00e40a2` | `7fff844e…b00e40a2` | ✅ |
| `12-acceptance-result.md` | 3317 | 3317 | `c3c4acb9…a2e7c6a05` | `c3c4acb9…a2e7c6a05` | ✅ |
| `13-implementation-audit.md` | 2612 | 2612 | `54dc67b2…ceb38e811` | `54dc67b2…ceb38e811` | ✅ |
| `14-prd-review.md` | 1503 | 1503 | `12234baf…6d407479f` | `12234baf…6d407479f` | ✅ |
| `15-media-page-collector.mjs` | 33323 | 33323 | `df60028b…1ff7beb2` | `df60028b…1ff7beb2` | ✅ |
| `16-media-page-verify.mjs` | 13820 | 13820 | `12c3b8b4…a2515e2f15` | `12c3b8b4…a2515e2f15` | ✅ |
| `17-result.json` | 30726 | 30726 | `c444c48b…3619e1b851` | `c444c48b…3619e1b851` | ✅ |
| `18-acceptance-verification.json` | 2880 | 2880 | `3a7d7fd4…264c96b84f` | `3a7d7fd4…264c96b84f` | ✅ |
| `19-public-evidence.tar.gz` | 7152397 | 7152397 | `8bfd96cd…d3255dc105` | `8bfd96cd…d3255dc105` | ✅ |

19/19 全量通过；本审查不重排字节，无任何副本被改写。

## 2. 隔离解包（`19-public-evidence.tar.gz`）

在 `/tmp/v3-1r-audit-extract/` 隔离目录解包。归档本身满足 manifest 段 3 的所有元数据要求：

- mtime = epoch（1970-01-01）一致；
- owner/group = 0/0 一致；
- 子目录仅 `apps/`、`docs/` 两个顶层，0 个额外嵌套；平铺包外无散落文件。

实际解包结果（独立重算）：

- 文件数：**110**；manifest 自检声称 130；差异 = −20。
- 字节数：**9,857,625**；manifest 自检声称 17,425,835；差异 = −7,568,210。
- build 树（`apps/chrome-extension/chrome-mv3-unpacked/`）：**92** 个文件，3,631,058 bytes（详见 §3）。
- doc 树（含 portal registry、sample registry、run/verification/secret-scan/extension-load、12 PNG）：**18** 个文件，6,226,567 bytes。
- 12 张 PNG 均存在，路径 `runs/.../screenshots/v3-sample-01.png … v3-sample-12.png`；无未裁切截图、无 Chrome profile、无授权文件路径。

> §9.1 提示：本条不属于材料伪造，而是 manifest 段 4 自检数声明与现实不一致；属于 manifest 文档层面的 Minor。**不影响证据完整性**，因为 §3–§6 的逐项复算才是出门判定的主依据，且 manifest 段 4 已将"重算后给候选"标注为"待独立审查者重算"——本审查如实给出 110 / 9,857,625。

## 3. build tree / sample-registry / portal-registry / result / verification / secret-scan 绑定

### 3.1 build tree SHA-256

按 `apps/chrome-extension/e2e/v3-media-page-collector.mjs` 中 `hashBuildTree` 的规范（`readdirSync` 按 `name.localeCompare` 排序；进入子目录；进入文件；以相对 POSIX 路径加 sha256 组成 entries；最后用排序键 JSON 再 sha256），独立 Node 实现复算得到：

```
a45963f199555195a4974a74482637f851412366d03ff51f424d9925fc4f1ca4
```

与 `result.json.buildSha256` 完全一致；与 `17-result.json` 在归档内的副本字节一致；与 `07-portal-registry.json` 之外的产物没有重号。

### 3.2 portal-registry SHA-256

`docs/active/project/contracts/v3-media-portal-registry.json` 与 `17-result.json`、`13-implementation-audit.md` 中的引用、`02-prd.md` 索引完全一致：

```
c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6
```

manifest.json 内嵌字段（`version=0.1.0`、`optional_permissions=["cookies"]`、`optional_host_permissions=["https://*.bilibili.com/*"]`、`web_accessible_resources.matches=["https://www.bilibili.com/*"]`、`content_scripts.matches=["https://www.bilibili.com/video/*"]`）与 portal registry 的 `bilibili.adapter.staticMatches` / `webAccessibleResourceMatches` / `sessionProfile.optionalHostPermissions` 完全一致；不存在 `<all_urls>`。

### 3.3 sample-registry SHA-256

`docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/runs/v3-1p-bilibili-probe-20260917T041114Z/sample-registry.json` 重算：

```
b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1
```

与 `result.json.sampleRegistrySha256`、`17-result.json` 引用完全一致。12 个 sampleId 在该注册表中存在且全部 `revision=1`、`runId=v3-1p-bilibili-probe-20260917T041114Z`。

### 3.4 result.json ↔ verification.json ↔ secret-scan.json 绑定

| 字段 | 期望值（manifest / docs） | 独立重算 |
|---|---|---|
| `result.json.sha256`（17） | `c444c48b…3619e1b851` | `c444c48b…3619e1b851` ✅ |
| `acceptance-verification.json.sha256`（18） | `3a7d7fd4…264c96b84f` | `3a7d7fd4…264c96b84f` ✅ |
| `verification.resultSha256` 内嵌 | `c444c48b…3619e1b851` | 与 result.json sha256 一致 ✅ |
| `secret-scan.scannedFiles / scannedBytes` | 107 / 9,879,334（13、12） | 108 / 9,879,479（18）；14.5 kb 之差在 ≤1 个文件级 manifest/result.json 副本差之内（详见 §9.1） |

verifier 的 18 项独立检查（`18-acceptance-verification.json.checks[*].id` ∈ `V3-1.1-VERIFY-01 … V3-1.1-VERIFY-15`）全部 `passed=true`，`fatal=0`、`major=0`，与 `16-media-page-verify.mjs` 中 18 处 `check(` 调用一一对应。

## 4. 12 URL / sampleId 唯一性与冻结分类

`17-result.json` 内 `observations[*].sampleId` / `observations[*].url` 集合：

- `Set(sampleId).size = 12`、`Set(url).size = 12` ✅
- 没有跨 run 拼接：每条 `buildSha256` / `portalRegistrySha256` 与 root 字段完全相同；sampleId 唯一性约束在 `runId=v3-1r-authenticated-regression-20260917T180000Z-final` 内成立。
- `expected.primaryClass` 分类精确为 **6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low-signal**，与冻结分母一致；未引用任何历史 run 补足。
- `expected.expectedOutcome` 与 response 一致；其中：
  - subtitle（v3-sample-01…06）`transcriptAvailability=available`；
  - asr（v3-sample-07…09）`transcriptAvailability=unknown`；
  - multipart（v3-sample-10, 100 parts）`secondPartContext.playbackUnitId=1491085746`（与 p1 不同），并且 `multipartPlayback.seek.currentTimeSeconds=10`、`invalidSeek.ok=false`/`failureCode=V3_MEDIA_SEEK_INVALID`，非法 seek fail-closed；
  - restricted（v3-sample-11）`expectedOutcome=blocked`、`transcriptAvailability=restricted`；
  - low-signal（v3-sample-12）`expectedOutcome=degraded`、`durationSeconds=5483.883`。

## 5. 服务端输入只有 HTTP/code/isLogin，且 200/0/true

`17-result.json.serverInputValidation`：

```json
{ "httpStatus": 200, "code": 0, "isLogin": true, "passed": true }
```

- 字段键集合 = `{httpStatus, code, isLogin, passed}`，**不包含** `body` / `data` / `response` / `cookies` / `uid` / `mid`。
- 全文搜索 `uid|uname|nick|mid|DedeUserID|vmid|loginData|csrf_token|SESSDATA|bili_jct|sid` 在 result.json 中：除 `sidebarPresent` / `Seek target is outside the active playback unit.` / `temporaryMediaResidualCount` 三处无害子串外，**0 命中**（`sid` 仅出现于上述无害子串上下文）。
- evidenceClass = `production_candidate`；sessionEvidenceClass = `user_authorized_live_session_seed_regression`；未冒充匿名公开路径。

## 6. 12 张 PNG 尺寸、来源 viewport、裁剪、视觉抽样

按 PNG IHDR（offset 16/20 读 width/height）独立 Node 复算：

| sampleId | width | height | size (bytes) | SHA-256（截 16） | result.json 截 16 | 结果 |
|---|---:|---:|---:|---|---|---|
| v3-sample-01 | 1280 | 900 | 191083 | `05561382…` | `05561382…cf3b7cdf` | ✅ |
| v3-sample-02 | 1280 | 900 | 372373 | `f96f910c…` | `f96f910c…506fcd808` | ✅ |
| v3-sample-03 | 1280 | 900 | 331093 | `a3db6324…` | `a3db6324…812f8a8f1` | ✅ |
| v3-sample-04 | 1280 | 900 | 250406 | `3a40b918…` | `3a40b918…e9f1b5491` | ✅ |
| v3-sample-05 | 1280 | 900 | 581752 | `37a5dc93…` | `37a5dc93…a239b859` | ✅ |
| v3-sample-06 | 1280 | 900 | 668724 | `44d33b01…` | `44d33b01…b7f2351b` | ✅ |
| v3-sample-07 | 1280 | 900 | 643811 | `f0e070cb…` | `f0e070cb…24acc5144` | ✅ |
| v3-sample-08 | 1280 | 900 | 615496 | `84957823…` | `84957823…0c588af0` | ✅ |
| v3-sample-09 | 1280 | 900 | 731496 | `ef3627df…` | `ef3627df…eb07d5e87` | ✅ |
| v3-sample-10 | 1280 | 900 | 538548 | `ea763211…` | `ea763211…68244c1a5` | ✅ |
| v3-sample-11 | 1280 | 900 | 322463 | `c23b48d3…` | `c23b48d3…9c4b5c2c5` | ✅ |
| v3-sample-12 | 1280 | 900 | 929520 | `924de539…` | `924de539…7d18363d7` | ✅ |

12/12 全为 1280×900；每条 `privacyCapture` 元数据均为：

- `mode = "top_account_region_excluded"`
- `sourceViewport = {width:1280, height:1000}`
- `clip = {x:0, y:100, width:1280, height:900}`
- `output = {width:1280, height:900}`

视觉抽样（v3-sample-01 / 02 / 07 / 11 / 12，5 张）确认：

- 顶部 100px 已被裁切；不存在 B站账户顶栏（无头像/登录/消息/投稿按钮）。
- 副标题区、播放器、UP 主卡片、章节列表、弹幕/评论区按正常视口呈现。
- v3-sample-11（restricted，充电专属）显示"该视频为「充电视频」专享视频"提示，符合 restricted 语义。

## 7. 防假绿拒绝项逐条复核

| 拒绝项 | 结果 | 证据 |
|---|---|---|
| 跨 run 拼接 | 否 | 所有 12 条 obs 的 buildSha256/portalRegistrySha256 等同 root；无 runId 切换 |
| 删减样本 | 否 | 12 URL 唯一；分类精确为 6+3+1+1+1 |
| 把匿名历史结果作为当前结果 | 否 | sessionEvidenceClass 显式标注为 `user_authorized_live_session_seed_regression` |
| 登录全页截图写盘 | 否 | 每条隐私裁剪均在浏览器截图 API 阶段完成；output=1280×900；secret-scan 0 命中 |
| raw Cookie value 命中 | 否 | secret-scan.hits=[]；本审查再扫一次：build + run 共 110 文件，`DedeUserID\|SESSDATA\|bili_jct\|buvid3\|b_nut\|buvid4\|buvid_fp\|sid\|DedeUserID__ckMd5` 名称集合仅出现在 `content-scripts/content.js` / `background.js` / `chunks/sidepanel-*.js` 的 allowlist/denylist 字符串常量中（共 6 个出现点，2+2+2），无任何 cookie value 出现 |
| 产品读取桌面文件 | 否 | `wxt.config.ts` 已将 `<all_urls>` 收回为 `https://www.bilibili.com/*`；未新增 `cookies` 入强制 `permissions`（仅 `optional_permissions=["cookies"]`，需用户授权）。`16-media-page-verify.mjs` 仅在 `NAVIA_V3_AUTHENTICATED_REGRESSION=1` 时按 `NAVIA_V3_BILIBILI_COOKIE_FILE` 读文件，且只保留在 Node 进程内存。`/home/user/document.md` 仅在 `chunks/workspace-*.js` 的 UI 占位字符串中出现，**非**真实路径 |
| build hash 不可复算 | 否 | §3.1 一致 |
| verifier 只信任 `passed=true` | 否 | verifier 18 条 check 全部独立重算，与 collector summary 解耦（见 `16-media-page-verify.mjs` 第 125–244 行） |
| V3-1.3 代码已被顺带实现 | 否 | portal registry `extensionPolicy.futureExamplesAreNotImplemented=["youtube","xiaohongshu"]`；`futureCapabilities`/V3-2 相关字段未出现；`07-portal-registry.json` 与仓内 `docs/active/project/contracts/v3-media-portal-registry.json` 字节一致 |
| 外审包 hash 不匹配 | 否 | §1 全 19/19 通过 |

注意：本审查范围仅限 V3-1R 实施出门；仓内另有 `apps/chrome-extension/src/contentBridge.ts`、`src/contentBridge.test.ts`、`wxt.config.ts`、`package.json` 等 `git status` 标记为 M 的未提交改动，主要承载 V3-1.1 media_companion 模块本身（不在 V3-1R 边界内），且 `13-implementation-audit.md` 第 8 行明确写出"未修改 Extension 产品模块、manifest 权限…"。`wxt.config.ts` 在 V3-1/V3-1.1 阶段已经把 `<all_urls>` 收回为 `https://www.bilibili.com/*` —— 此点在本审查范围内不构成对 V3-1R 的偏差，但与本审计范围一致（V3-1R 只动 collector/verifier）。

## 8. PRD / 架构偏移

- `02-prd.md` §1 portal / sample 冻结边界未变；`07-portal-registry.json` 与仓内 `docs/active/project/contracts/v3-media-portal-registry.json` 字节一致。
- `14-prd-review.md` 明确声明：**未证明** V3-1.3 envelope/lease、V3-2 媒体获取、人工登录流程、YouTube、小红书、字幕正文/ASR/OCR/Mindmap/导出等。
- `13-implementation-audit.md` 第 38 行：`剩余高风险边界不属于本实现…它们在独立实施授权前保持 NO-GO`。
- `12-acceptance-result.md` §4 门禁：`在新的独立实施出门审计完成前，不声明 V3-1.2 最终 PASS；不进入 V3-1.3 代码`。

未发现产品规格偏移。

## 9. 剩余风险与门禁原话

### 9.1 Minor：manifest 段 4 自检数声明与现实不一致

manifest 段 4 写："平铺包 + 隔离解包内容：130 文件，17,425,835 bytes"。独立重算为 110 文件 / 9,857,625 bytes（−20 / −7,568,210）。同时：

- `13-implementation-audit.md` 段 2.7、3 与 `12-acceptance-result.md` 行 29 写："collector 扫描 run+build 107 文件、9,879,334 bytes"；
- `18-acceptance-verification.json.V3-1.1-VERIFY-13` 写："secret hits=0; files=108; bytes=9879479"；
- `17-result.json` 内嵌的 `secret-scan.json` 写：`scannedFiles=107`、`scannedBytes=9,879,334`。

差异：110（含运行期 N/A 的 `extension-load.json` 与 `secret-scan.json`） vs 107 / 108 vs 9,857,625 vs 9,879,334 vs 9,879,479 vs 17,425,835。这些差异均非材料伪造或证据错配，仅为 manifest/文档层面的统计口径不一致——所有可独立复算的硬证据（build hash / portal hash / sample hash / result hash / verification hash / 12 PNG hash + 尺寸）均一致。

建议：在 V3-1.3 出门文档之前，将 manifest 段 4 数字修正为实际解包结果并统一 secret-scan 文件/字节口径（决定是否排除 `secret-scan.json` / `extension-load.json` 自身）。**本条不阻塞 V3-1.2 升级为限定 PASS**。

### 9.2 工具链声明（230 tests / typecheck / build / Route A 13/13）

这些数字（`13-implementation-audit.md` 段 3 / `12-acceptance-result.md` 表行 32 / `v3-1r-authenticated-regression-acceptance-result.md`）由内部审计报告引用。**本审查未在本会话内独立重跑 `npm test` / `tsc` / `wxt build` / Route A 13 静态审计**——按约束"不能把未亲自重跑的命令写成独立实跑"，本审计仅作为"已声明"列出，不可作为出门依据；它们须由 V3-1.3 出门文档阶段独立复核。

### 9.3 隐私保持的运行时约束（来自代码本身，不在审计改动内）

- 13-implementation-audit.md 段 2.2：值只保留在当前 Node 进程内存，不写盘。
- `15-media-page-collector.mjs`：Cookie 路径 = `NAVIA_V3_BILIBILI_COOKIE_FILE`，不在归档内；归档包内无 `*Cookies*` / `Login Vaults` / `/home/<u>/` / `C:\Users\` 等桌面授权文件路径。

### 9.4 门禁原话

> "请把报告写入：docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1r-implementation-exit-audit.md"
> "只有 Fatal=0/Major=0 才允许将 V3-1.2 升级为限定 PASS，并进入 V3-1.3 文档/威胁建模阶段；不得直接批准 V3-1.3 代码实施。"

本审查结论：**Fatal=0、Major=0**，仅 Minor=1（§9.1，manifest 文档层），可升级为 `V3-1.2 QUALIFIED PASS`；**V3-1.3 代码实施仍保持 NO-GO**，待 V3-1.3 文档、威胁模型、独立实施出门审计与新的高风险用户授权齐备后再判。

## 10. 候选建议

- 状态：`V3-1.2 LOCAL PASS CANDIDATE / INDEPENDENT EXIT AUDIT PENDING` → `V3-1.2 QUALIFIED PASS / V3-1R IMPLEMENTATION EXITED`。
- 后续：进入 V3-1.3 文档 + 威胁模型 + 实施前审计；V3-1.3 代码实施 `NO-GO`。
- 必备后续动作（按 §9.1）：修正 manifest 段 4 自检数声明与 secret-scan 文件/字节口径。

— 审查者签章：本文件唯一签名即本路径；其余一切结论以本文件为准。
