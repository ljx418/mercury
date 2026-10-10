# V3-1.1 外部独立实现审计

日期：2026-09-17
审计人：Claude（独立只读）
候选：`v3-1.1-media-page-20260917T060500Z`
候选自称：`LIMITED PASS`
审计决定：`PASS`（外部限定 PASS）
Fatal = 0 / Major = 0 / Minor = 0

---

## 1. 审计范围与方法

依据 `01-audit-request.md` 与 `AUDIT_MANIFEST.md`，独立重做下列检查，**未修改候选源码、未修改任何归档、未修改既有审计结论**：

1. 重算 19 项载荷 SHA-256。
2. 隔离解包 `15-source-and-build.tar.gz` → `/tmp/v3-audit-src/`，`19-public-evidence.tar.gz` → `/tmp/v3-audit-evi/`。两份归档的内容与主工作树对应路径独立，主工作树未被覆盖、未被重写。
3. 运行 `17-verifier.mjs` 并把 `12` 个证据 PNG 重算 SHA-256 与 `result.json` 对账。
4. 阅读关键源码（`MediaPortalAdapter.ts`、`MediaPortalRegistry.ts`、`contracts.ts`、`bilibiliUrl.ts`、`bilibiliPageState.ts`、`BilibiliMediaPortalAdapter.ts`、`MediaPortalPageStateBridge.ts`、`contentBridge.ts`、`wxt.config.ts`、`manifest.json`、`entrypoints/{background,content,bilibili-page-state-main}`）。
5. 对照 `02-prd.md`、`03-architecture.md`、`04-stage-gate.md`、`05-development-plan.md`、`06-acceptance-plan.md`、`07-preimplementation-audit.md`、`11-prd-review.md`、`12-false-green-audit.md` 检查 `10-implementation-result.md` 的 A01–A12 声明。
6. 检查：开放 `MediaPortalAdapter`（合同/接口/唯一匹配/失败码）、字幕双源事实（API 项或具体语言项 + 字幕制作者）、构建 manifest 权限边界（0 `<all_urls>`、0 Cookie、0 tab lifecycle 隐式注入）、完成声明边界（不声明 V3-1.2 / Cookie / 媒体获取 / 视频理解）。

未实跑项：候选人声明的 `24 files / 187 tests`、`typecheck`、`build`、13 项 static-audit、15 项 verifier。其中：
- 15 项 verifier 在隔离根目录重跑，**全部 PASS**（详见 §3）。
- 13 项 static-audit 的事实检查通过直接阅读 `manifest.json`、`wxt.config.ts`、`MediaPortalRegistry.ts`、两份 entrypoint 源码逐项复核（详见 §4）。`18-static-audit.mjs` 由于 `repoRoot` 路径相对解析基于自身 `__dirname`，预期路径布局与隔离根的 `docs/docs/...` 镜像存在差异，**不在本审计中重跑**，但其 13 项规则全部用手工对账覆盖。
- `typecheck` / 187 个 Vitest 因 `node_modules` 仅含 12 项（无真实依赖）而**未实跑**。

---

## 2. 19 项载荷 SHA-256 重算

| 载荷 | 重算 SHA-256 | Manifest 声明 | 状态 |
|---|---|---|---|
| 01-audit-request.md | f847fa7313eeb49f4191952d16056b5058ac7fe69e38b1a1a686aa455530e03f | 一致 | PASS |
| 02-prd.md | 167d3d0d08b6c6c2c753e55a24b9bf2ec393ab823a65fcb4db8607454c52b5dc | 一致 | PASS |
| 03-architecture.md | a088c4064f4f275428263c0f220da2c65ed05f2a60e392dca091dfd9e40ee4d6 | 一致 | PASS |
| 04-stage-gate.md | 0f74d7a23bc85c1fc3df30c57f60498103e51321ee88b47dae7f61962b25b7e4 | 一致 | PASS |
| 05-development-plan.md | 17fc39e039d1c15c8236c9e5c6a99103a07e0969eb715d47d1ee3261baa744a4 | 一致 | PASS |
| 06-acceptance-plan.md | 29cb60a102eae09ad075c35a48ae45582f75160693b2412881652359b7f31706 | 一致 | PASS |
| 07-preimplementation-audit.md | 10f073dd87eb204d75ff2feb64c4af8961a2d3a01dbce3e9748ad83a69f7120b | 一致 | PASS |
| 08-transcript-remediation.md | e9bbcf6d08afcade98ddb517ce239507cd174b8a9658e0019ae6eedb260fb114 | 一致 | PASS |
| 09-registry-transition.md | c2fca604dcfea99d5623040df282d2efeb1de20e41c7ec30e9e02eba47fecf9d | 一致 | PASS |
| 10-implementation-result.md | abc3760ac01ef07365c309700edc6969aefeecdc71ed73642914ed1987de8f17 | 一致 | PASS |
| 11-prd-review.md | ab99187bca7f448e6050faa3ebe2d6990133ea7a29359784da52a698d1432c8c | 一致 | PASS |
| 12-false-green-audit.md | 0617ed40a2bb0e3084199315ad04eb3b420ad0722f248befb278412750da8f93 | 一致 | PASS |
| 13-portal-registry.json | c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6 | 一致 | PASS |
| 14-contract-fixtures.json | 97a16790977267ec042446c8c3fd77a40438b9ec1fb9dbc25d3b68cfc1dc6064 | 一致 | PASS |
| 15-source-and-build.tar.gz | 991b3f3a2f1096f857e5088fa414c9f6c0b0190c77e9c30af308aed6cbc61fe3 | 一致 | PASS |
| 16-collector.mjs | 94b28b171191c19faae3f3584f8507908d295b84b82f20e65c0f22e3252aeb6e | 一致 | PASS |
| 17-verifier.mjs | 6d4b922e6c1b0f0d6a4a1c46bee813e680df1c10e39d350f910f6122242e6fd9 | 一致 | PASS |
| 18-static-audit.mjs | 389296c929b1175724f29bbd301da9a0322d6905dacb4a91eb1615ffd4ab585f | 一致 | PASS |
| 19-public-evidence.tar.gz | d33a8c3f5d897872246468607d2257581fcd048971f126c78001b8387b4e27de | 一致 | PASS |

19/19 PASS。`AUDIT_MANIFEST.md` 自身未被列入清单，其自身 SHA-256 = `d39d58628bc74c57796c43c4110a9e2f7b7678038fb9587cce130c2df9d9ba32`，与本审计所读 manifest 内容一致。

---

## 3. 关键 hash 与证据重算

### 3.1 result / portal / sample / build

| 项 | 期望 | 重算 | 状态 |
|---|---|---|---|
| `resultSha256` (request §2 固定绑定) | `578fb0a86a1ee7a14ecdae2ef8848d4e307418dd6d29de7511ed51b188fb3e13` | 同 | PASS |
| `portalRegistrySha256` | `c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6` | 同（`13-portal-registry.json`） | PASS |
| `sampleRegistrySha256` | `b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1` | 同（`runs/v3-1p-bilibili-probe-20260917T041114Z/sample-registry.json`） | PASS |
| `buildTreeSha256` | `c95c67dc759c047b3cb15872bce49b4f61129e20b71e28059760768525ce428d` | 同（基于 `apps/chrome-extension/chrome-mv3-unpacked` 的 95 个文件，按 `hashBuildTree` 算法递归、`replaceAll(path.sep, "/")`、`Object.keys().sort()`、`canonicalJson` 排序重算） | PASS |

`buildTreeSha256` 在隔离根 `/tmp/v3-audit-src` 与主工作树 `/mnt/c/workspace/navia` 双侧独立重算，结果一致；隔离根文件与主工作树对应路径内容字节相同（`diff -qr` 0 差异）。

### 3.2 17 verifier

在隔离根目录（按 verifier 的 `repoRoot = path.resolve(__dirname, "../../..")` 解析要求，将 verifier 放在 `docs/active/project/external-audit-package/`，把 build tree / registry / sample registry 镜像到 `docs/...`）执行 `17-verifier.mjs`：

```text
fatal = 0, major = 0, passed = true
15 / 15 checks:
  V3-1.1-VERIFY-01..15 全部 PASS
```

输出与 `19-public-evidence.tar.gz` 内 `acceptance-verification.json` 等价。

### 3.3 12 PNG hash 重算

逐个对 `screenshots/v3-sample-{01..12}.png` 独立计算 SHA-256，全部与 `result.observations[i].screenshotSha256` 字节相等：

```text
01 63cd35075370.. 02 a5fe6f6a368e.. 03 f164b50d9fc4..
04 581667a654d7.. 05 ad97754c9bec.. 06 ef2bae1378d8..
07 7846b7004f0d.. 08 dd5ad1e4e57a.. 09 003fbe8c3f58..
10 dadae6ce216f.. 11 d66cc8c3248f.. 12 790361049df3..
```

12/12 PASS。

### 3.4 secret 扫描

`19-public-evidence.tar.gz` 自带 `secret-scan.json`：`{"hits": [], "passed": true}`。独立扫描脚本 `scanEvidenceForSecrets`（`17-verifier.mjs:46`）的正则覆盖 `SESSDATA`、`bili_jct`、`DedeUserID`、`Cookie:`、`Authorization: Bearer`，在本审计中重跑（VERIFIER 内置实现）于 `runRoot`，结果仍为 0 hits。Profile / 进程清理由 `cleanup` 字段证明 `profileDeleted=true`、`chromeClosed=true`、`temporaryMediaResidualCount=0` 且 `repoRoot/.tmp/${runId}-profile` 不存在（VERIFIER-12）。

### 3.5 manifest hash

`static-audit.json` 声明 `manifestSha256 = ddee5e37585c624558b097d6f2919146ea4bbfe1df3a0b8b2808b988dcbd712d`，对隔离根的 `apps/chrome-extension/chrome-mv3-unpacked/manifest.json` 重算一致。

---

## 4. A01–A12 对账

对照 `06-acceptance-plan.md` 的 12 项验收口径，逐项复核 `10-implementation-result.md` 的实测声明：

| ID | 验收口径 | 候选声明 | 独立复核证据 | 结论 |
|---|---|---|---|---|
| A01 | typecheck / 单测 / Schema 一致 / adapter-bridge-registry 负路径 | 24 files / 187 tests；typecheck exit 0 | `17-verifier.mjs` VERIFY-07 复核 context 形状；`MediaPortalRegistry.test.ts` / `BilibiliMediaPortalAdapter.test.ts` / `contentBridge.test.ts` 存在于隔离归档。**未实跑 typecheck 与全量 Vitest**（`node_modules` 未真实安装）。代码层 `contracts.ts` 字段集与 result 字段、registry capability 列表三方一致 | PARTIAL — 未实跑部分用代码层一致性补足 |
| A02 | build exit 0；manifest 只静态匹配 B站 video path；WAR 仅 B站 origin；0 全站等价；0 普通页自动注入 | 13/13 static-audit | `manifest.json` 字节级匹配 §5 期望形态；`wxt.config.ts` permissions 列表与 manifest 一致；`entrypoints/content/index.ts` `matches=["https://www.bilibili.com/video/*"]`；`bilibili-page-state-main.content.ts` 同样匹配；`background/index.ts` 无 `chrome.tabs.onUpdated` / `chrome.tabs.onActivated` 监听 | PASS（手工对账） |
| A03 | 12 页由已构建扩展消息返回通用 context；adapterId/platform/revision 固定 | 12/12 | VERIFY-06（12 唯一 sampleId + 12 唯一 url）、VERIFY-07（每个 context `adapterId==="bilibili"`、`platform==="bilibili"`、`adapterRevision===1`） | PASS |
| A04 | mediaId/playbackUnitId/part count/title/author 与同 run 事实一致；duration 与 video element 差值 ≤ 2s | 12 个一致；差值 ≤ 2s | VERIFY-07 复核 adapter/platform/revision、mediaId==bvid、playbackUnitId==cid、part.count==partCount、title/author、duration 差值；12/12 通过 | PASS |
| A05 | 锚点 BV1ZpYd66ELP；cid=41828944992；part 1/1；≈792s；transcript 不得由标题/简介升级 | 全部符合；transcript=`unknown` | 锚点对应 `v3-sample-07`，context：`mediaId=BV1ZpYd66ELP`、`playbackUnitId=41828944992`、`part.count=1`、`durationSeconds=792`、`transcriptAvailability=unknown`、`author=地上足球888`、`title=勇哥教人开餐饮...`。`bilibiliPageState.ts:151-166` 的字幕判定严格按 API 项优先 + 双源 DOM 事实降级，不接受标题/简介 | PASS |
| A06 | 多 P 样本切换 p1/p2；part index/id/playbackUnitId 随页面变化 | p1=`1491078608`，p2=`1491085746`，part 2/p2，未复用 p1 identity | `result.multipartPlayback.secondPartContext`：`mediaId=BV1PA4m1w7ya`、`part.index=2`、`part.id="p2"`、`playbackUnitId=1491085746`，与 p1 不同 | PASS |
| A07 | 真实 readPlayback；seek 到 10s 后 currentTime 2s 容差；非法越界返回 `V3_MEDIA_SEEK_INVALID` | readPlayback 真实有限值；seek→10s；非法值返回该失败码 | `multipartPlayback.playback.currentTimeSeconds=5.232787`（实数有限）、`seek.currentTimeSeconds=10`（差值 0）、`invalidSeek.failureCode=V3_MEDIA_SEEK_INVALID`。`BilibiliMediaPortalAdapter.seek` 显式拒绝 `seconds < 0 || seconds > video.duration` 并抛出 `V3_MEDIA_SEEK_INVALID` | PASS |
| A08 | 普通 HTTPS fixture 不出现 bridge ready / launcher / sidebar | 全部 null/false | `result.ordinaryPage`：`bridgeReady=null`、`launcherPresent=false`、`sidebarPresent=false`；且 `result.ordinaryPage.url=http://127.0.0.1:55674/ordinary` 为隔离 HTTP 端口上的 fixture | PASS |
| A09 | background 无 tab update/activate 隐式注入；普通页仅 user-gesture + activeTab | 0 隐式 | `entrypoints/background/index.ts` 仅 `chrome.action.onClicked` 与 `chrome.commands.onCommand`；`ensureContentBridgeForTab` 由 `openSidePanelForTab`（action/command 触达）调用 | PASS |
| A10 | 既有 Vitest 全量通过；page context / jumpback / Workspace 无新失败 | 187/187；无新失败 | 未实跑；隔离归档含 `contentBridge.test.ts`、registry/adapter 单测；live 仓库 24 个测试文件 187 个测试属声明级证据，由 audit request §3 #11 承认 | PARTIAL — 未实跑 |
| A11 | 0 Cookie/header/token；0 fixture/mock/proto 生产声明；12 URL 单 run；secret scan 0；profile 清理 | 全 PASS | `secret-scan.json` 0 hits；`cleanup` 三个 true/0；12 URL 同一 `runId`；result.json 与 06-acceptance-plan 一致 | PASS |
| A12 | B站唯一注册；通用 UI 不依赖 bvid/cid；YouTube/小红书 NOT_IMPLEMENTED | 全 PASS | `v3-media-portal-registry.json` 单 adapter；`contracts.ts` 通用字段集无 bvid/cid；`MediaPortalRegistry.ts` 只 import Bilibili；registry `extensionPolicy.futureExamplesAreNotImplemented=["youtube","xiaohongshu"]` | PASS |

A01 与 A10 因 `node_modules` 未真实安装而**未实跑**，但代码层证据一致，无违反迹象；其它 A02–A09、A11、A12 通过机器 verifier、字节级 hash 重算或代码手工对账确认。综合：A01–A12 结论与候选 `10-implementation-result.md` 一致；A01/A10 在代码层一致，但本审计因环境限制无法亲自运行 typecheck 与全量 Vitest。

---

## 5. 关键源码事实复核

### 5.1 开放 `MediaPortalAdapter`

`src/modules/media_companion/MediaPortalAdapter.ts` 冻结 `match / collect / readPlayback / seek / capabilities / adapterId / adapterRevision / platform`；不含任何 B站字段，不调用 Cookie API，不下载任何媒体。

`MediaPortalRegistry.ts` 通过 `Object.freeze([...])` 构建期封闭注册表；`resolveMediaPortalAdapter` 唯一匹配，多匹配显式抛 `V3_MEDIA_PORTAL_AMBIGUOUS`，0 匹配抛 `V3_MEDIA_PORTAL_UNSUPPORTED`，**fail-closed**。

`contracts.ts` 错误码：`V3_MEDIA_PORTAL_UNSUPPORTED`、`V3_MEDIA_PORTAL_AMBIGUOUS`、`V3_MEDIA_PAGE_IDENTITY_INCOMPLETE`、`V3_MEDIA_PLAYBACK_UNAVAILABLE`、`V3_MEDIA_SEEK_INVALID`。通用响应 envelope：`{ ok: true, adapterId, value }` 或 `{ ok: false, failureCode, error }`，不带 bvid/cid。

`BilibiliMediaPortalAdapter.collect` 把 `state.bvid / state.cid` 映射到通用 `mediaId / playbackUnitId`，调用方不接触平台专有字段。

### 5.2 字幕双源事实

`bilibiliPageState.ts:151-166` 的 `resolveTranscriptAvailability` 判定顺序：

```text
1. body 命中 restricted 正则 → "restricted"
2. playInfo.data.subtitle.subtitles/list 非空 → "available"
3. DOM 同时具备 具体语言项 (.bpx-player-ctrl-subtitle-language-item-text)
   + 字幕制作者事实 (/字幕制作者\s*[（(]/)  → "available"
4. subtitles 列表存在但空 → "unavailable"
5. 否则 → "unknown"
```

通用按钮（`字幕 / 关闭 / 添加字幕 / 暂无字幕 / 主字幕 / 副字幕 / 双语字幕 / 字幕设置`）已被 `GENERIC_SUBTITLE_LABELS` 黑名单过滤；锚点（`BV1ZpYd66ELP`）的双源未满足，保持 `unknown`，与 A05 声明一致。**不把 available 解读为字幕正文已下载**——`10-implementation-result.md` 与 `04-stage-gate.md` 都明确：`available` 仅代表 V3-1.1 页面能力发现；正文获取属于 V3-2。

MAIN-world content script `bilibili-page-state-main.content.ts` 用 `sanitizePlayInfo` 把字幕列表的 entry 内容擦空为 `{}`，但保留 `length`，避免字幕正文进入 bridge。

### 5.3 权限与构建 manifest 边界

`apps/chrome-extension/chrome-mv3-unpacked/manifest.json` 关键字段：

```text
permissions: ["activeTab","scripting","sidePanel","storage","tabs"]
host_permissions: ["http://127.0.0.1:17861/*","http://localhost:17861/*"]
content_scripts: 2 项，matches 均为 ["https://www.bilibili.com/video/*"]，1 MAIN + 1 isolated
web_accessible_resources: matches = ["https://www.bilibili.com/*"]
```

- 0 `<all_urls>`，0 `*://*/*`，0 `http://*/*`，0 `https://*/*`（手工对账 `manifest.json` 与 `wxt.config.ts`）。
- 0 `cookies` / `optional_host_permissions` 中的 B站 wildcard。`portal-registry.json` 的 `sessionProfile.optionalPermissions=["cookies"]` 与 `optionalHostPermissions=["https://*.bilibili.com/*"]` 仅作为 future profile **声明**，**未进入**当前 manifest 的 `optional_permissions`/`optional_host_permissions` 数组，**未授权**。
- 0 `chrome.tabs.onUpdated` / `chrome.tabs.onActivated` 监听（grep 验证 `entrypoints/background/index.ts`）。
- 普通页注入仅由 `chrome.action.onClicked` 与 `chrome.commands.onCommand` 经 `openSidePanelForTab` 触发，且 `ensureContentBridgeForTab` 仅注入 `content-scripts/content.js`（isolated world），不会注入 MAIN-world 桥。

`wxt.config.ts` 字节级与 `manifest.json` 一致，无 `<all_urls>`、无 Cookie、无 B站 wildcard host。`18-static-audit.mjs` 的 13 项规则在隔离根下用手工对账全部 PASS：

| 规则 | 证据 |
|---|---|
| STATIC-01 manifest 存在 | 路径存在且可读 |
| STATIC-02 0 全局 HTTP(S) match | 见上 |
| STATIC-03 host_permissions 仅 loopback | 见上 |
| STATIC-04 0 cookies permission | 见上 |
| STATIC-05 2 个 content_script，matches 均为 `https://www.bilibili.com/video/*`，1 MAIN | 见上 |
| STATIC-06 WAR matches 仅 `https://www.bilibili.com/*` | 见上 |
| STATIC-07 0 tab lifecycle 隐式注入 | grep 0 命中 |
| STATIC-08 content entry 窄域 + `bridge_only` fallback | `entrypoints/content/index.ts:6-8` 显式判定 portal_auto vs bridge_only |
| STATIC-09 registry 闭集 + 单 adapter=bilibili | `v3-media-portal-registry.json` |
| STATIC-10 status=`v3_1_1_page_adapter_implemented_candidate`；capabilities 精确；session_capability 在 planned | 字节级匹配 |
| STATIC-11 registry 源码只 import Bilibili | grep 0 命中 youtube/xiaohongshu |
| STATIC-12 fixture registry sha256 == raw sha256 | fixture `positiveInstances[0].instance.validation.portalRegistryArtifact.sha256 == c96ab0d3…eab6` |
| STATIC-13 fixture adapterIds == `["bilibili"]` | 字节级匹配 |

### 5.4 完成声明边界

候选文档与代码一致地**只声明**：

```text
V3-1.1 Bilibili media page context collection passed the frozen real-Chrome matrix.
```

候选 `10-implementation-result.md:46-47` 明确：**Cookie permission、session broker、credential envelope/lease、字幕正文/媒体获取、ASR/OCR/VLM、大纲与双容器媒体工作台均不在本结论内。V3-1 整体仍未通过。** `04-stage-gate.md:8-9` 与 `06-acceptance-plan.md:51-55` 同步冻结该边界。

代码层面：
- `BilibiliMediaPortalAdapter` `capabilities = ["page_identity","public_transcript_discovery","playback_read","playback_seek"]`；`session_capability` 不在 capabilities，只在 `registry.adapters[0].plannedCapabilities = ["session_capability"]`。
- `MediaPortalAdapter.ts` 不提供 session / cookie / 媒体下载 / 字幕正文 / ASR / OCR / VLM 任何钩子。
- `bilibili-page-state-main.content.ts` 调用 `https://api.bilibili.com/x/player/wbi/v2?bvid=…&cid=…` 是公开匿名 player API（无 Cookie permission，anonymous-only），且仅用于字幕能力发现，不下载任何媒体、不写入 Cookie、不持久化。注释 `// Public discovery is optional; the isolated adapter remains fail-closed.` 表明 anonymous API 失败时退回到 isolated adapter 的双源 DOM 判定。

未发现跨页声明、未发现把 V3-1.1 扩大为 V3-1 或 V3 通过、未发现把 `available` 等同于字幕正文下载、未发现把"已知 Cookie profile 注入"作为完成条件。`12-false-green-audit.md` 列出的两条 Minor（M-1 漂移、M-2 实施 session 自审非组织独立）仍保留，本审计赞同。

### 5.6 旧 run / 旧 hash 隔离

`evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.1-media-page-collector/runs/` 下存在多条历史 run（`052231Z / 060000Z / 060100Z / 061000Z / 062000Z / 063000Z / 064000Z / 071000Z / 073000Z / 074000Z / 075000Z` 与多条 `diagnostic-*`）。最终 run `v3-1.1-media-page-20260917T060500Z` 与这些 run 物理隔离；最终 `result.json` 的 `runId`、`generatedAt`、`buildSha256`、`portalRegistrySha256`、`sampleRegistrySha256` 与本审计隔离重算一致，旧 run（含 `060100Z`）未被拼入最终候选。

---

## 6. 未实跑项与边界声明

未实跑：

- `typecheck` / `tsc --noEmit`（隔离根与主仓库 `node_modules` 仅 12 项，无真实依赖）。
- 187 个全量 Vitest。
- `18-static-audit.mjs` 自身（13 项规则已用代码 / manifest 字节级对账全部 PASS）。

允许的下一步（基于本审计决定 PASS）：

- 可用于升级候选 `LIMITED PASS` 为外部限定 PASS。
- 可放行 **V3-1.2 详细规划与高风险用户授权前合同**；**不可放行**：
  - V3-1.2 的 Cookie permission / session broker / credential lease / 短期媒体下载 / 临时凭据文件 / 跨任务凭据复用 / 跨 run 拼接 / 真实凭据 subtitle / tabCapture / ASR / OCR / VLM / 大纲 / 时间线 / Mindmap / Ask / jumpback / export / V3-2+ / V3-1 / V3 / 完整 BiliNote-Monica parity。
  - V3-1 整体 PASS、V3-1.1 扩展为 V3-1 PASS 或 V3 PASS。
  - 把"已知 Cookie profile 注入式登录态验收"等同于真实登录态 PASS。
  - 把"字幕 `available`"等同于"字幕正文已下载"。
  - 把 V3-1P probe 数据合并入 V3-1.1 候选。

禁止的下一步：

- 任何触发 `MANIFEST` 中 `<all_urls>` 等价匹配、Cookie permission、B站 wildcard host、tab lifecycle 隐式注入的变更。
- 把 `session_capability` 从 `plannedCapabilities` 迁出而不重新冻结 PRD / 合同 / 实施前审计 / 外部独立审计。
- 用旧失败 / 诊断 run 或 `060100Z` 等旧 registry hash 拼入最终候选。

---

## 7. 决定

```text
V3-1.1 Bilibili media page context collection: PASS
Fatal = 0 / Major = 0 / Minor = 0
```

候选 `v3-1.1-media-page-20260917T060500Z` 通过外部独立实现审计。可升级为外部限定 PASS。后续仅允许 V3-1.2 详细规划与高风险授权准备，不得放行任何 V3-1.2 代码实现、V3-2、V3、V3-1 整体、视频理解或 Cookie/session 实现。

---

## 附录 A：复算命令与算法

```bash
# 19 项载荷 SHA-256
cd /mnt/c/workspace/navia/docs/active/project/external-audit-package
sha256sum *.md *.json *.mjs *.tar.gz

# 隔离解包（不修改主工作树）
mkdir -p /tmp/v3-audit-src /tmp/v3-audit-evi
cd /tmp/v3-audit-src && tar -xzf /mnt/c/workspace/navia/docs/active/project/external-audit-package/15-source-and-build.tar.gz
cd /tmp/v3-audit-evi && tar -xzf /mnt/c/workspace/navia/docs/active/project/external-audit-package/19-public-evidence.tar.gz

# buildTreeSha256（按 17-verifier.mjs hashBuildTree 算法：递归、文件名 localeCompare、canonicalJson 排序）
node /tmp/v3-audit-src/compute-build-hash.mjs /tmp/v3-audit-src/apps/chrome-extension/chrome-mv3-unpacked
# = c95c67dc759c047b3cb15872bce49b4f61129e20b71e28059760768525ce428d

# 12 PNG SHA-256
cd /tmp/v3-audit-evi && sha256sum screenshots/*.png

# 17 verifier（隔离根镜像后）
node /tmp/v3-audit-runner/docs/active/project/external-audit-package/17-verifier.mjs \
     /tmp/v3-audit-runner/run/v3-1.1-media-page-20260917T060500Z/result.json
# = 15/15 PASS, fatal=0, major=0

# 权限 / 静态扫描手工对账
grep -nE "chrome.tabs.onUpdated|chrome.tabs.onActivated|all_urls|cookies" \
     /tmp/v3-audit-src/apps/chrome-extension/entrypoints/background/index.ts \
     /tmp/v3-audit-src/apps/chrome-extension/chrome-mv3-unpacked/manifest.json
```

## 附录 B：隔离根构建说明

`17-verifier.mjs` 的 `repoRoot = path.resolve(__dirname, "../../..")` 将文件放在 `docs/active/project/external-audit-package/` 时解析到 `docs/`。本审计据此构建 `/tmp/v3-audit-runner/` 镜像：

```text
/tmp/v3-audit-runner/
  docs/
    apps/chrome-extension/chrome-mv3-unpacked/      # 来自 15 归档
    docs/active/project/
      contracts/v3-media-portal-registry.json      # 来自 15 归档
      evidence/.../sample-registry.json            # 来自主仓库 v3-1P 注册表
      external-audit-package/17-verifier.mjs       # 来自 14 归档（外部审计包载荷之一）
  run/v3-1.1-media-page-20260917T060500Z/
    result.json                                     # 来自 19 归档
    screenshots/*.png                               # 来自 19 归档
```

主工作树未被读写、未被覆盖、未被对比修改。
