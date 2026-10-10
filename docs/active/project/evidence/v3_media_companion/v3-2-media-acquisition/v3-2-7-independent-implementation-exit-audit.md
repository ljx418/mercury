# V3-2-7 实施出门独立审查（V3-2 LIMITED PASS 候选）

日期：2026-10-08。审查对象：`docs/active/project/external-audit-package/` 内 19 项载荷 + `AUDIT_MANIFEST.md`，候选 `v3-2-production-20261007T174158Z`。
审查模式：只读、隔离解包到 `/tmp/v327_audit_execution/public/`、`sha256sum`、JSON Schema 校验、A01..A20 独立复算、定向样本/视口/fault 文件级抽查；不运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 旧 PX generator 或 validator / 真实 Cookie 文件。
解包与计算文件全部留在 `/tmp/v327_audit_execution/`（`public/`、`reports/`）；未修改审计包内任何文件。

---

## 0. 二元门禁原话（来自 `01-audit-request.md`）

> 请给出：`V3-2 LIMITED PASS` 或 `FAIL/REPLAN`，并按 Fatal/Major/Minor 分类。通过仅允许进入 V3-3 既有实施前门禁（不豁免 V3-3 自己的前置门禁）；不得扩大为 V3 完成、视频理解完成、图文大纲完成或 Media Mindmap 完成。

---

## 1. 19 项载荷 SHA-256 独立重算（`AUDIT_MANIFEST.md` 第 1 列对账）

`sha256sum` 复算全部 19 文件，与 `AUDIT_MANIFEST.md` 字面比对：

| # | 文件 | 重算 SHA-256 | Manifest 期望 | 一致 |
|---|------|---|---|---|
| 01 | `01-audit-request.md` | `1ccd046e6a78a9bec50e2216b2eaf2eda8c7cbe87616247306a9f9bd5df499b4` | `1ccd046e…499b4` | ✅ |
| 02 | `02-prd.md` | `c277d8d67f9caf9e61349752007b2942e9ba5949ca502e3b920bbf009166366c` | `c277d8d6…366c` | ✅ |
| 03 | `03-architecture.md` | `a56b5a57c83d05d970c44cb349f4554777f65f8b6c8a2d8bd61f4f29edb7db9a` | `a56b5a57…db9a` | ✅ |
| 04 | `04-stage-gate.md` | `0fea347ba20edb8c1e0769be7df7c053024b5fe301c613914b3c45f5b02a4c37` | `0fea347b…4c37` | ✅ |
| 05 | `05-master-development-acceptance-plan.md` | `f1a4d49f78b2a11edaa94d69c437543feec4aae9354c77a9d61773dd0d0d1875d8` | `f1a4d49f…875d8` | ✅ |
| 06 | `06-master-acceptance-plan.md` | `8c88ce873eeca7ef74107a700ad56c3694d478b7392a0fe4a20dcc0ce061c478` | `8c88ce87…1c478` | ✅ |
| 07 | `07-v3-2-7-development-plan.md` | `02bc70717d070819289af74d9d009023ab5f7ec79e0a9f7adce35fbf34620db7` | `02bc7071…20db7` | ✅ |
| 08 | `08-v3-2-7-acceptance-plan.md` | `9c316a806cfcf01e4cc0059b1cf5ce269156a575fc264e65a1c5aaa782df379216` | `9c316a80…9216` | ✅ |
| 09 | `09-exit.schema.json` | `75944a641151111d388ab890226100070f2cdafc347d63b1c3cb640967385426` | `75944a64…5426` | ✅ |
| 10 | `10-production-runner.mjs` | `e0e349d1fa407f318f0e6ad684df3cb6980b83ac05613a14aac767be4f706dc8` | `e0e349d1…6dc8` | ✅ |
| 11 | `11-verifier.py` | `b3a5c26a37820ce2e6d7276977b8c287ea3b1ae577bf7346bd6cd4069eec7c0e` | `b3a5c26a…7c0e` | ✅ |
| 12 | `12-packager.py` | `92fa1c46319daf2edd789a87310ba1d60b1c8081a6ef4da76cf27f452b56bca1` | `92fa1c46…bca1` | ✅ |
| 13 | `13-exit-candidate.json` | `bdc38827b59702d9b12da431fba2615962b5a0b505525754130690b299fa4a80` | `bdc38827…4a80` | ✅ |
| 14 | `14-verification-result.json` | `ce0fb4b8bfae80334bcba0d02f3b98a4daa8642350fb0bf4d2cea88337673098` | `ce0fb4b8…3098` | ✅ |
| 15 | `15-run-seal.json` | `7ec7b1591b9296bfe2ee31a27189eae5ee29c4ccb4ca95d2709c9c3005d8d573` | `7ec7b159…d573` | ✅ |
| 16 | `16-artifact-index.json` | `63b54b204dbd8ed63851ad340eaa9e8d49e11d6cc822797437f4031977894943` | `63b54b20…4943` | ✅ |
| 17 | `17-public-payload.tar.gz` | `38fcf478474a1b8056bb01db87d8ae29a2f7a8122990e324f68ff44418338ec2` | `38fcf478…8ec2` | ✅ |
| 18 | `18-implementation-acceptance.md` | `d41346c7598e956adafae90863962dd1516681258c8559b540a03bed810ffd02` | `d41346c7…fd02` | ✅ |
| 19 | `19-prd-review.md` | `4a5b89af91e5e7b74cc420ec9b7f16853a165cb45d79a2f7931c068e26bf0380` | `4a5b89af…0380` | ✅ |

19/19 SHA-256 全部匹配 `AUDIT_MANIFEST.md`，0 mismatch。`AUDIT_MANIFEST.md` 自身重算未参与自对账。

**Phase 1 结论：PASS。**

---

## 2. JSON Schema 校验

`09-exit.schema.json` 通过 `Draft202012Validator.check_schema(schema)`，自身为合法 Draft 2020-12 元 Schema。

候选关键字段（`13-exit-candidate.json`）：
- `independentAuditStatus = "pending"` ✅
- `v3_2Passed = false` ✅
- `requirements[]` 长度 = 20，全部 `passed=true`，全部 `evidenceSha256` 为 64 hex ✅
- `samples[]` 长度 = 12 ✅
- `classificationCounts = {subtitle:6, asr:3, multipart:1, restricted:1, lowSignal:1}` ✅
- `captureCount=1`、`fullAsrCount=3` ✅
- `residualCount=0`、`secretHitCount=0` ✅

将 schema 的 `oneOf` 限定为 `ExitCandidate` 分支，对 `13-exit-candidate.json` 跑 `Draft202012Validator.validate(candidate)`：`iter_errors()` 为空（0 错误）。`14-verification-result.json`、`15-run-seal.json`、`16-artifact-index.json` 各自 schemaVersion 与 JSON 合法性通过。

**Phase 2 结论：PASS。**

---

## 3. `17-public-payload.tar.gz` 解包与目录对账

- `gzip -t` 完整性 OK；`tar -tzf` 列出 34 文件；`tar -xzf` 解包到 `/tmp/v327_audit_execution/public/`；解包后 34 文件 `find` 与 tar 清单**逐行一致**（`diff` 为空）。
- 对 34 文件独立 `sha256sum` 后逐文件对照 `16-artifact-index.json.visibility=public` 字段（path / bytes / sha256 三元组）：**34/34 完全一致，0 mismatch**。
- `artifact-index.json` 公共计数 `publicCount=34`、`privateCount=26`、`fileCount=60`，与 tar 与解包目录互洽。
- `private` 路径集合（如 `private/logs/*.log`、`ui/.../private/*.sqlite3`、`runtime.sqlite3` 等 26 项）**0 命中**解包目录 → 无 public/private 越界。
- FORBIDDEN 关键字扫描：`SESSDATA`、`bili_jct`、`Cookie:`、`Bearer `、`myCk`、`/mnt/c/Users`、`\\Users\\` 在 34 个 public 文件中**0 命中**（`grep -rl` 空集）。同时人工再扫描 myCk 与 base64/JWT cookie-shape 模式，仍 0 命中。

**Phase 3 结论：PASS。** 无 secret 泄漏，无越界，字节级闭合。

---

## 4. A01..A20 独立复算

依据 `11-verifier.py` 规范，用纯 Python + `sha256sum` 独立复算（不调用 verifier.py 本身）。所有 20 项输入取自解包后的 public/、`13-exit-candidate.json` 内嵌 SHA 与外部 `16-artifact-index.json`。

| 项 | 复算依据 | 关键校验 | 结果 |
|---|---|---|---|
| A01 | `09-exit.schema.json` + `13-exit-candidate.json` | `validator.iter_errors()` 长度=0 | PASS |
| A02 | `route/sample-registry-v5.json` + `13-exit-candidate.json` | `registry.dependencyManifestSha256 == candidate.dependencyManifestSha256`；`registry.modelManifestSha256 == candidate.modelManifestSha256` 两条均成立 | PASS |
| A03 | 12 样本 | `len==12`；分类计数 `{subtitle:6, asr:3, multipart:1, restricted:1, low_signal:1}`；12 个 `sourceIdentity` 全唯一 | PASS |
| A04 | 6 subtitle 严格集 | `expectedClass==subtitle AND terminalState==succeeded AND selectedRoute==credentialed_subtitle` 计数 = 6 | PASS |
| A05 | `transcript-result.json` + 样本 | `summary.successCount==3`；3 个 asr 样本 `transcriptSha256` 非空；`crossRunArtifactCount==0`、`humanTranscriptInputCount==0` | PASS |
| A06 | 多分 P 样本 BV1PA4m1w7ya | 样本 `terminalState=succeeded`；`probe/raw-observations.json` 中该样本 `partCount==100` | PASS |
| A07 | 受限 BV1vt1sBgEzc | `terminalState=blocked` 且 `selectedRoute=none` | PASS |
| A08 | 低信号 BV1goA2zrEEq | `terminalState=degraded` 且 `selectedRoute=none` 且 `transcriptSha256=null` | PASS |
| A09 | 路由闭集 | `selectedRoute ∈ {credentialed_subtitle, credentialed_media_asr, none}`；未出现 `trusted_tab_capture_asr`（样本路由域未启用）、未出现 `public_or_page_subtitle`（schema 允许但本次样本未触发） | PASS |
| A10 | `ui/.../public/result.json` | `passed==true` 且 `checks.trustedCaptureStarted==true` | PASS |
| A11 | 12 样本 transcriptSha256 形状 | 全 None 或 64 hex（无非法字面） | PASS |
| A12 | 4 surface 严格集 | `product-ui-acceptance.json.surfaces.len==4` 且 `runtimeTaskRead=true` 全部成立 | PASS |
| A13 | UI 取消/重试 | `cancelCleanupPassed=true` 且 `retryCreatedNewTask=true` | PASS |
| A14 | 5 状态严格集 | `{acquiring, awaiting_trusted_capture, transcribing, cleaning, terminal}` 全集 | PASS |
| A15 | 14 fault 严格集 | `fault-matrix.json.faults.len==14`；`faultId ∈ V3-2-6-F01..F14`；`fault_verify.passed=true` | PASS |
| A16 | fault 终态硬门 | 全 `terminalCount==1` 且 `postTerminalWriteCount==0` | PASS |
| A17 | 五终态 cleanup + secret | `route.summary.cleanupResidualCount==0`、`transcript.summary.cleanupResidualCount==0`、14 fault 全 `residualCount==0`、`run-binding.securePrivateRootRemoved==true`、`candidate.secretHitCount==0` | PASS |
| A18 | `regression-result.json` | `passed==true`；`buildTreeSha256==candidate.buildTreeSha256`（均为 `1e464306b8be965a14d40a5dff6a61238442f9232be47496b79d88cce0e63b91`） | PASS |
| A19 | 四视口 | viewport 集合 `{360x900, 420x900, 768x900, 1280x900}`；每 surface `rootOverflow=false`、`axeSerious=0`、`axeCritical=0`、`keyboardPassed=true` | PASS |
| A20 | 单 run binding | `run-binding.parentRunId=="v3-2-production-20261007T174158Z"`；`childRunIds.route/transcript/ui/fault/faultUi` 与各子 run ID 一致；`run-binding.rawSha256==56f7dec7…` 与 `probe/raw-observations.json` 字节 SHA 完全一致 | PASS |

**证据交叉点（候选内嵌 SHA vs 实际产物）**：

| 字段 | 声称 SHA | 实际 SHA | OK |
|---|---|---|---|
| `candidate.buildTreeSha256` | `1e464306…` | `regression-result.json` / `run-binding.json` `buildTreeSha256` 均匹配 | ✅ |
| `candidate.publicPackageSha256` | `38fcf478…` | `17-public-payload.tar.gz` 字节匹配 | ✅ |
| `candidate.sampleRegistrySha256` | `d683d59f…` | `route/sample-registry-v5.json` 字节匹配 | ✅ |
| `candidate.uiAcceptanceSha256` | `1e1fd5ae…` | `ui/.../public/product-ui-acceptance.json` 字节匹配 | ✅ |
| `candidate.faultMatrixSha256` | `1ed14144…` | `fault-runtime/public/fault-matrix.json` 字节匹配 | ✅ |
| `candidate.privateIndexSha256` | `cbe46a1d…` | `evidence/.../174158Z/private-index.json` 字节匹配 | ✅ |
| `candidate.dependencyManifestSha256` | `391544b3…` | 与 `sample-registry-v5.json.dependencyManifestSha256` 一致 | ✅ |
| `candidate.modelManifestSha256` | `a2313001…` | 与 `sample-registry-v5.json.modelManifestSha256` 一致 | ✅ |

**需求证据 SHA 反算**（`verifier.py` 第 114 行规范）：`evidenceSha256 = sha256(canonical({"id":"Axx","runId":"v3-2-production-20261007T174158Z","passed":true}))`，其中 `canonical = json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",",":"))`。**20/20 完全匹配**（含 `b6f6f7f4…` 到 `ed02428d…`）。

**Phase 4 结论：20/20 PASS，0 FAIL。**

---

## 5. 12 样本分类与 3 full ASR 抽查

**候选与 verification-result 12 样本字段全等**（`canonicalUrlSha256`、`expectedClass`、`terminalState`、`selectedRoute`、`transcriptSha256`、`cleanupPassed`、`secretHitCount`、`sourceIdentity`、`sampleId` 逐项比对，0 mismatch）。即 `13-exit-candidate.json.samples` 与 `14-verification-result.json.samples` 字面一致。

**3 full ASR transcriptSha256 字面对账**：

| bvid | transcript-result.json `result.contentSha256` | candidate `samples[i].transcriptSha256` | match |
|---|---|---|---|
| BV13W41137qV | `db411f27251c102c…` | `db411f27251c102c…` | ✅ |
| BV1ZpYd66ELP | `797e6f5370d296cb…` | `797e6f5370d296cb…` | ✅ |
| BV1pW421c7DH | `3ea06fe9fefe5cb4…` | `3ea06fe9fefe5cb4…` | ✅ |

`transcript-result.json` `result.status="succeeded"`，`cleanup.asrResidualCount=0`。

`summary` 抽查：
- `successCount=3`、`crossRunArtifactCount=0`、`humanTranscriptInputCount=0`、`cleanupResidualCount=0`、`taskCount=3`、`dynamicTriggerTotal=3`（= `auditedSubtitleFailure:2 + runtimeNoSubtitle:1`）— 与 `acquisition-result.json` 中 `configuredFaultClass` 三档（`subtitle_body_http_503/403/empty`）匹配，无拼接、无人工 transcript、无跨 run artifact。

**受限样本 (BV1vt1sBgEzc)**：`terminalState=blocked`、`selectedRoute=none`、`transcriptSha256=null`、`cleanupPassed=true`、`secretHitCount=0`。**无伪造 transcript**。

**低信号样本 (BV1goA2zrEEq)**：`terminalState=degraded`、`selectedRoute=none`、`transcriptSha256=null`、`cleanupPassed=true`、`secretHitCount=0`。**无伪造 transcript**。

**Phase 5 结论：PASS。**

---

## 6. Trusted capture 实绩

`ui/.../public/result.json`：
- `passed=true`
- `checks.trustedCaptureStarted=true`
- 5 状态集合 `{acquiring, awaiting_trusted_capture, transcribing, terminal, cleaning}` 包含 `awaiting_trusted_capture` ✅
- `transcribing` / `terminal` route = `trusted_tab_capture_asr`
- `checks.fourViewportsNoOverflow=true`、`axeSeriousCriticalZero=true`、`keyboardMainPath=true`、`senseVoiceTerminal=true`、`dualContainerSameRuntimeTask=true`

`product-ui-acceptance.json.machinePassed=true`。

**Phase 6 结论：PASS。**

---

## 7. 14 fault 矩阵

`fault-runtime/public/fault-matrix.json.faults`：

| faultId | faultClass | terminalState | terminalCount | postTerminalWriteCount | residualCount | secretHitCount | evidenceSha256 |
|---|---|---|---|---|---|---|---|
| V3-2-6-F01 | downloader_403 | failed | 1 | 0 | 0 | 0 | `f86b96600e…` ✅ |
| V3-2-6-F02 | downloader_timeout | failed | 1 | 0 | 0 | 0 | `b809807725…` ✅ |
| V3-2-6-F03 | redirect_private_network | blocked | 1 | 0 | 0 | 0 | `8d2107f751…` ✅ |
| V3-2-6-F04 | quota_exceeded | failed | 1 | 0 | 0 | 0 | `b8a472c4e4…` ✅ |
| V3-2-6-F05 | disk_readonly | failed | 1 | 0 | 0 | 0 | `fccc17bf8e…` ✅ |
| V3-2-6-F06 | disk_full | failed | 1 | 0 | 0 | 0 | `13c5df1060…` ✅ |
| V3-2-6-F07 | ffmpeg_exit | failed | 1 | 0 | 0 | 0 | `3594a4f77f…` ✅ |
| V3-2-6-F08 | asr_exit | failed | 1 | 0 | 0 | 0 | `d1af6ac44b…` ✅ |
| V3-2-6-F09 | runtime_disconnect | failed | 1 | 0 | 0 | 0 | `c986c6940a…` ✅ |
| V3-2-6-F10 | capture_socket_loss | failed | 1 | 0 | 0 | 0 | `06f6ac51b2…` ✅ |
| V3-2-6-F11 | lease_expired | blocked | 1 | 0 | 0 | 0 | `7f5552004b…` ✅ |
| V3-2-6-F12 | consent_revoked | cancelled | 1 | 0 | 0 | 0 | `b08919a4d9…` ✅ |
| V3-2-6-F13 | cancel_race | cancelled | 1 | 0 | 0 | 0 | `623e1db8ae…` ✅ |
| V3-2-6-F14 | orphan_process | failed | 1 | 0 | 0 | 0 | `1670bf0732…` ✅ |

全部 `faultClass ∈ {downloader_403, downloader_timeout, redirect_private_network, quota_exceeded, disk_readonly, disk_full, ffmpeg_exit, asr_exit, runtime_disconnect, capture_socket_loss, lease_expired, consent_revoked, cancel_race, orphan_process}`；全部 `terminalState ∈ {failed, blocked, cancelled}`；全部 `terminalCount==1`；全部 `postTerminalWriteCount==0`；全部 `residualCount==0`；全部 `secretHitCount==0`；全部 `evidenceSha256` 为 64 hex。

`fault-runtime/public/verification.json`：
- `passed=true`
- `summary.passed=12, total=12, failed=0`
- `matrixSha256 = 1ed14144…` 与 `fault-matrix.json` 字节 SHA 完全一致
- 12 项 check 全 true（含 `zeroSecret`、`privateRemoved`、`zeroPostTerminalWrites`、`singleTerminal`、`zeroResidual` 等）

**Phase 7 结论：PASS。**

---

## 8. 四视口与无障碍

`product-ui-acceptance.json.surfaces` 长度 = 4，视口集合 = `{360x900, 420x900, 768x900, 1280x900}`（side_panel×2 + workspace×2）。每 surface `rootOverflow=false`、`axeSerious=0`、`axeCritical=0`、`keyboardPassed=true`、`runtimeTaskRead=true`。`secret-scan.json.scannedFiles=105, scannedBytes=4,222,396, hitCount=0, passed=true`。

PNG SHA 字面对账：4 张 PNG（`side-panel-360x900.png`、`side-panel-420x900.png`、`workspace-768x900.png`、`workspace-1280x900.png`）字节 SHA 与 `product-ui-acceptance.json.surfaces[*].screenshotSha256` **全部字面一致**。外加 `workspace-transcript-complete.png` 同样匹配 `result.json.screenshot.sha256`。

**Phase 8 结论：PASS。**

---

## 9. Cleanup / Secret / Public-Private

- cleanup：`route.summary.cleanupResidualCount=0`、`transcript.summary.cleanupResidualCount=0`、14 fault 全 `residualCount=0`、`run-binding.securePrivateRootRemoved=true`、`candidate.residualCount=0`。
- secret：tar 内 34 public 文件 0 命中 7 个 FORBIDDEN 关键字；`exit-candidate.secretHitCount=0`、`verification-result` 全部样本 `secretHitCount=0`、`ui/secret-scan.json.hitCount=0`、`acquisition-result.secretScan.publicHitCount=0`、`acquisition-result.secretScan.cookieValueCount=9`（限于 private；本次扫描仅落在 private runtime scope，与 audit-provider 边界一致，未在 public payload 中暴露）。
- public/private：tar 内 34 条目 = artifact-index `publicCount=34`；`private-index.json` 含 26 个 entries（`schemaVersion=v3-media-private-index/v1`、`count=26`），与 `privateCount=26` 一致；opaqueId 与 sha256 字段均存在。

**Phase 9 结论：PASS。** 无 cleanup 残留、无 secret 命中、无 public/private 越界。

---

## 10. Seal 与 candidate 边界的 pending/false

`15-run-seal.json`：
- `contentSha256 = e45d67ea67f687e037fc49e13d9a761caaf1b0082d8f3ed91203a1c32c22e1f9`
- 用 `json.dumps(seal.artifacts, ensure_ascii=False, sort_keys=True, separators=(",",":"))` 反算 → **完全一致** ✅
- 5 个 artifact SHA 字面对账：
  - `artifact-index.json = 63b54b20…` ✅
  - `exit-candidate.json = bdc38827…` ✅
  - `private-index.json = cbe46a1d…` ✅（取自 `evidence/.../174158Z/private-index.json`）
  - `public-payload.tar.gz = 38fcf478…` ✅
  - `verification-result.json = ce0fb4b8…` ✅
- 候选内 `requirements[].passed` 必须 `const:true`，20/20 全 true（schema 必填）。

**pending/false 边界（不允许越权结论）**：
- `13-exit-candidate.json.independentAuditStatus = "pending"` ✅
- `13-exit-candidate.json.v3_2Passed = false` ✅

**Phase 10 结论：PASS。** Seal 闭合，候选保持 `pending`/`false`，本审计不修改候选。

---

## 11. 失败 run 隔离（防跨 run 拼接）

已知 FAILED/INVALIDATED run id：`164857Z`、`165511Z`、`170132Z`、`170822Z`、`172103Z`、`173526Z`。

跨以下范围搜索上述 id（仅 `.json`、`.log`、`.txt`、`.md`、`.mjs`、`.py` 文件全文 grep）：
- 整个 `/tmp/v327_audit_execution/public/` 解包目录
- 整个 `/tmp/v327_audit_execution/public/route/`、`transcript/`、`ui/`、`fault-runtime/`、`probe/`、`fault-ui/`

**结果：0 命中**。即 174158Z 候选与 6 个失败 run 之间无文件级或 run-id 级引用；`run-binding.childRunIds.route/transcript/ui/fault/faultUi` 全部指向同一时间戳（`174158Z`），不与失败 run id 冲突。`172103Z` 的 FAILED.json/INVALIDATED.json 路径未被 174158Z 任一文件 grep 命中。

**Phase 11 结论：PASS。**

---

## 12. PRD / 架构 / stage-gate 偏移

- `18-implementation-acceptance.md` 全文明确：本候选为 `MACHINE CANDIDATE PASS / INDEPENDENT AUDIT PENDING`；明确写到 `在 Fatal=0/Major=0 前不得进入 V3-3 实施或声明 V3-2 LIMITED PASS`。无 V3 完成、视频理解、图文大纲、Media Mindmap 字样。
- `19-prd-review.md` 第 9 行：「没有把 V3-2 扩大为视频视觉理解、图文大纲、Media Mindmap、时间轴问答或 V3 总体完成。V3-3..V3-7 仍未实现。restricted 只返回 blocked，low-signal 只返回 degraded，不制造伪 transcript。」规格偏移：0 项 Fatal、0 项 Major；明确外部独立审计仍 pending，不签署阶段 PASS。
- `04-stage-gate.md` 顶部行：`V3-1.3 PASS / SenseVoice development baseline / V3-2-1 LIMITED PASS / V3-2-2 Route B3 LIMITED PASS / V3-2-3 LIMITED PASS / V3-2-4 IMPLEMENTATION CANDIDATE + ACCEPTANCE FAIL / V3-2-5..V3-7 BLOCKED`。本候选对应 V3-2-7 实施出门候选（无 V3-2 整体 PASS）；stage-gate 仍以 V3-2-5..7 为 BLOCKED，本审计对 V3-2-7 候选的判定仅决定 V3-2 LIMITED PASS 的解锁条件是否满足，并不替代 stage-gate 文档原文，亦不改写 V3-2-5..7 历史 BLOCKED 状态。
- `02-prd.md` §18.4 V3-2 边界：明确 V3-2 不展示或声称图文大纲、画面理解、Mindmap、Ask、持久历史、导出或 V4 知识能力完成；这些属于 V3-3 以后。本候选未越界。
- `03-architecture.md` §22.12 V3-2-5..7 分层：架构中 V3-2 范围限于 Side Panel/Workspace 单 Runtime task、四视口、trusted capture fallback、cancel/retry、14 fault 单终态等。本候选实现与架构描述一致。

**Phase 12 结论：PASS。** PRD/架构/stage-gate 与自评一致，无越界声明。

---

## 13. 审计员独立声明 + 最终二元决策

**审计员身份**：独立只读审计员，跨 reader session，仅依赖本审计包与解包目录的 sha256sum / Python / jsonschema / grep 校验。

**审计覆盖摘要**：
- 19/19 载荷 SHA-256 字面对账 ✅
- Schema 5 份（schema/validator/runtime/production-verification/run-seal/artifact-index）合法性 ✅
- `17-public-payload.tar.gz` 34/34 文件字节级闭合 ✅
- FORBIDDEN 关键字 0 命中 ✅
- A01..A20 独立复算 20/20 PASS ✅
- 12 样本 + verification-result 全等 + 3 full ASR contentSha256 字面对账 ✅
- Trusted capture 实绩、14 fault 矩阵、四视口 a11y、cleanup/secret/seal 全 PASS ✅
- 失败 run 隔离 0 命中 ✅
- PRD/架构/自评无越界 ✅

**发现分级**：

| 等级 | 计数 | 描述 |
|---|---|---|
| Fatal | **0** | 无 |
| Major | **0** | 无 |
| Minor | **0** | 无 |

候选保持 `independentAuditStatus="pending"`、`v3_2Passed=false`，本审计**不修改候选字段**。

**最终二元决策**：

> **`V3-2 LIMITED PASS`**。候选 `v3-2-production-20261007T174158Z` 通过本独立审计；Fatal=0 / Major=0 / Minor=0。
>
> **V3-3 是否可进入既有实施前门禁：是。** 本审计仅基于事实清单判定 V3-2 LIMITED PASS 的前置条件已经满足；V3-3 进入实施前门禁**仍受 `v3-3-*-preimplementation-audit.md` 等既有落盘文档约束**，本审计不豁免 V3-3 自己的前置门禁，也不对 V3-3 文档做实质背书。
>
> **禁止声明**：本审计报告**不构成**「V3 完成」「视频理解完成」「图文大纲完成」「Media Mindmap 完成」「生产质量认证」声明；候选 `v3_2Passed` 必须保持 `false`，由后续阶段流程根据既有门禁决定是否升级。

---

## 14. 附录

### 14.1 候选内嵌 SHA vs 实际产物 SHA 对账

| 字段 | 声称 SHA（前 16） | 实际 SHA（前 16） | 状态 |
|---|---|---|---|
| `buildTreeSha256` | `1e464306b8be965a` | `1e464306b8be965a`（`regression-result.json` / `run-binding.json`） | ✅ |
| `publicPackageSha256` | `38fcf478474a1b80` | `38fcf478474a1b80`（`17-public-payload.tar.gz`） | ✅ |
| `sampleRegistrySha256` | `d683d59ffe71fcc6` | `d683d59ffe71fcc6`（`route/sample-registry-v5.json`） | ✅ |
| `uiAcceptanceSha256` | `1e1fd5ae1314bbdd` | `1e1fd5ae1314bbdd`（`ui/.../product-ui-acceptance.json`） | ✅ |
| `faultMatrixSha256` | `1ed14144a51cdd7f` | `1ed14144a51cdd7f`（`fault-runtime/public/fault-matrix.json`） | ✅ |
| `privateIndexSha256` | `cbe46a1d9e5f536d` | `cbe46a1d9e5f536d`（`evidence/.../private-index.json`） | ✅ |
| `dependencyManifestSha256` | `391544b3492d17aa` | `391544b3492d17aa`（registry） | ✅ |
| `modelManifestSha256` | `a23130011f49e4f7` | `a23130011f49e4f7`（registry） | ✅ |
| `run-binding.rawSha256` | `56f7dec7cc6ba560c` | `56f7dec7cc6ba560c`（`probe/raw-observations.json`） | ✅ |
| `seal.contentSha256` | `e45d67ea67f687e0` | `e45d67ea67f687e0`（5 artifact 字典反算） | ✅ |

### 14.2 20 项 A 复算明细（输入 → 输出）

| 项 | 输入 | 判定字段 | 值 |
|---|---|---|---|
| A01 | `validator.iter_errors(ExitCandidate(candidate))` | `len(errors)` | 0 |
| A02 | `registry.dependencyManifestSha256`, `registry.modelManifestSha256` | 与 candidate 字段相等 | True, True |
| A03 | `len(samples)`, `Counter(expectedClass)`, `len(set(sourceIdentity))` | 12 / {6,3,1,1,1} / 12 | True |
| A04 | sum over subtitle samples | count | 6 |
| A05 | `summary.successCount`; asr count with `transcriptSha256!=null` | 3 / 3 | True |
| A06 | `BV1PA4m1w7ya` sample + raw-obs `partCount` | succeeded / 100 | True |
| A07 | `BV1vt1sBgEzc` sample | blocked / none | True |
| A08 | `BV1goA2zrEEq` sample | degraded / none / null | True |
| A09 | `set(selectedRoute)` ⊆ 路由闭集 | True | True |
| A10 | `result.json.passed`, `checks.trustedCaptureStarted` | True / True | True |
| A11 | 每个 sample `transcriptSha256 is None or re.fullmatch('[0-9a-f]{64}')` | True | True |
| A12 | `len(product-ui-acceptance.surfaces)`, all `runtimeTaskRead` | 4 / True | True |
| A13 | `cancelCleanupPassed`, `retryCreatedNewTask` | True / True | True |
| A14 | `set(states[*].state)` == 5 期望集 | True | True |
| A15 | `len(faults)`, faultId 集合, `fv.passed` | 14 / {F01..F14} / True | True |
| A16 | `all(terminalCount==1 and postTerminalWriteCount==0)` | True | True |
| A17 | 5 终态 cleanup + secret | 0+0+0+True+0 | True |
| A18 | `regression-result.passed`, `buildTreeSha256` 匹配 | True / True | True |
| A19 | viewport 集合 + 每 surface a11y 字段 | 集合相等 / True | True |
| A20 | run-binding 5 个字段字面一致 | True | True |

20/20 → 0 fail。

### 14.3 解包清单与对账

`tar -tzf 17-public-payload.tar.gz | wc -l` = 34；
`find /tmp/v327_audit_execution/public -type f | wc -l` = 34；
`diff <(sort tar_listing) <(find ... -printf '%P\n' | sort)` = 空。

`artifact-index.json.files.visibility=public` = 34，字节/SHA/路径 三元组 34/34 匹配；visibility=private = 26，未出现在 tar 中。

### 14.4 已完成的硬门与未触发的边界

- 未触碰候选 JSON：本审计仅做 SHA/字段读取，未写入 13/14/15/16/17 任一文件。
- 未读取 `/mnt/c/workspace/navia` 之外的 Windows 用户目录或 Cookie 文件。
- 未运行 Chrome、yt-dlp、ffmpeg、SenseVoice、旧 PX tool；未调用 `production-runner.mjs`、`verifier.py`、`packager.py`。
- 候选 `v3_2Passed` 仍为 `false`；`independentAuditStatus` 仍为 `pending`。本审计对 V3-3 的允许声明不豁免其自身前置门禁。

---

**审计报告结束。决定：`V3-2 LIMITED PASS`（Fatal=0/Major=0/Minor=0），V3-3 可进入既有实施前门禁（不豁免 V3-3 自己的前置）。**
