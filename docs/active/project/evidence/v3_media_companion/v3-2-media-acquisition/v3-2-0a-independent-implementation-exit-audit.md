# V3-2-0a ASR Provider / 模型管理独立实施出门审查

- 日期：2026-09-21
- 审查者：独立 session（独立 SHA-256 重算、独立 Python 校验）
- 候选状态：`V3-2-0a LOCAL LIMITED PASS / INDEPENDENT EXIT AUDIT REQUIRED`
- 审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` + `01-audit-request.md`
- 审查方式：只读静态审查 + 独立 hash 重算 + 独立 jsonschema 校验 + 独立 PNG 解码 + 独立正则/接口断言；未运行旧 PX/V2 generator/validator，未读取 `.navia` 私有模型、Cookie 或音频。
- 候选声明边界：`V3-2-0a LIMITED PASS for local ASR provider/model management and low-resource fallback.`
- 必须保留的边界：`V3-2-0/A06 FAIL / REOPENED; V3-2-1..7 NO-GO; V3-3+ NOT_IMPLEMENTED.`

## 0. 决定

**`V3-2-0a LOCAL LIMITED PASS for local ASR provider and model management and low-resource fallback.`**

Fatal=0，Major=0，Minor=3（M-1、M-2、M-3 均维持 Minor，未升级）。三类 Minor 与 `01-audit-request.md` 第 25-29 行已知候选一致。

| 项 | 数量 / 数值 |
|---|---|
| 审查载荷 | 19 文件 + 1 manifest = 20 文件，全部可读 |
| 独立重算 SHA-256 一致 | 19 / 19 |
| 权威源对账一致 | 19 / 19（含 7 个文档 + 11 个代码/数据/包；README 与审计 README 不在 manifest 内）|
| Schema Draft 2020-12 valid | 是 |
| Schema / positive 0 error | 是 |
| Schema negative 拒绝 | 11 / 11（fallbackOnly_str、selection_absolutePath、model_sourceUrl、model_unknown_id、provider_unknown、state_unknown、jobId_bad_pattern、installKind_unknown、baseline_wrong_ram、catalog_missing、percent_overflow 全部 REJECTED）|
| 模型管理 pytest 实有 case | 17（14 函数 + 1 parametrize ×3）|
| Draw.io 页面 | 8 |
| Draw.io 边/点断链 | 0 断、0 重 ID |
| 公开 tar 成员 | 10（含 5 PNG、3 个公开 result JSON、1 Chrome 证据目录、1 screenshots 目录）|
| PNG 可解码 | 5 / 5 |
| Chrome E2E | 17 checks, 17 passed；Axe blocking 0 on 5 surfaces；layout 4 视口 |
| 私域 hash 绑定一致 | `397993e07fec2e3a5260c3ba42df3d52d3cb9ca7ff2566c949e86950b3521901`（Chrome result.json 重算后一致）|
| small 真实安装四文件 hash 与 catalog 一致 | 4 / 4（`config.json b55496ac…`、`model.bin 3e305921…`、`tokenizer.json fb7b6319…`、`vocabulary.txt 34ce3fe1…`）|
| 公开 result 文件大小 | 1306 + 2273 = 3579 bytes（与公开体量声明相符）|
| 公开 evidence.secret/path/audio/Cookie leak | 0 |

## 1. 候选声称的本轮交付

- 用户在 Settings 看见资源/质量/请求与生效模型。
- 最低资源 Tiny 可离线兜底。
- allowlisted 模型可一键安装并显示进度/取消。
- 失败可用 `.navia-asrpack` 恢复。
- 任意 URL/代码/路径和损坏资产 fail closed。
- 未把模型安装或 Tiny 自检扩大为 V3-2-A06、MediaTranscript、媒体获取或 V3 PASS。

以下分别复核。

## 2. Manifest / 权威源一致性

`AUDIT_MANIFEST.md` 中 19 个载荷独立 `sha256sum` 重算，与声明哈希 100% 一致：

```
5aae090c9b1e4757ebc8f9a4cdfb9744ebe974f762d4120818eede522a13a001  01-audit-request.md
47500382008df7e267b07f9654074e02d6cc9bd0ae04a0034d545e33af964651  02-prd.md
dfd7feba059e7b4b756340ceaf776abf08ab393e84ce88a24703cd2cb50ade7d  03-architecture.md
519be02d3ea91f73dc52c98e3f65f06f6a9d42f097e504cb81fce66362fddfd7  04-stage-gate.md
cafa227eb0f2da924f1320597d3d1c4f2bc3fa103cca75c959f01a0c3bdc7103  05-development-plan.md
e9330ca3f482c8594108def81231f6b022530ff849b02cccc5c074aed05f0e12  06-acceptance-plan.md
b3bbd021a2e00b8de9a21393b5d734739bdfb59d16c46b394e57eeae08d9d831  07-threat-model.md
d241335d90f9596ce43059f3e7cfe17435e6a673475a755b725d5e2b67196bec  08-contract.schema.json
c66f11c397e6f924c17771dfab749ee33817f6335d9dcba58491b09fbec0bbb1  09-positive.json
a0a9e28c9b65a2ba5231b0e9cae89a0cf17827deb40ce744cfaf4694f6ab0fab  10-catalog.py
4588d996023d4a00b0dbe3aa72b44caab43a321dfede70662c5ec5a4d9146ae9  11-model-manager.py
ae6013393f1e19f6175a5e117a7038863e454a993429f05c01f5c64bd08e3535  12-runtime-app.py
1085a7c9908c8f5c3587bc38ee77c695f64ca86d4ea8bb683f458a0d2df3ab86  13-model-manager-tests.py
0e5abfd4c679b24f584c3330853067c3932d341a83110de69d8b8226dccd651e  14-settings-panel.tsx
278070f9878f8f6a1505b835726f78a680ae5a6908703c12ffa153e41789dc8f  15-real-chrome-e2e.mjs
e9cc9e432ee79ba9ea5caaa2b0a22f168392a70a7dc8dc5a1715de892224aca7  16-acceptance-result.md
08a7558f9e6c08ccb5954c1707d9ec486f4270c3b009fe863d3340d6e2b2c50c  17-gap.drawio
5a8559786cac17d4a1bdcae7f1fdace47fa9099bf4f5001dcec66cc3d1ae4687  18-public-evidence.tar.gz
1f0f1bfda0f09b6bf4d2b3468a2f25f708fafc708c23b72e6d67fbbfc94614d7  19-internal-exit-audit.md
```

权威源对账（独立 sha256sum 重算）：

| Manifest 声明权威源 | 实际位置（仓库内） | byte | SHA-256 是否一致 |
|---|---|---:|---|
| `01-prd.md` | `docs/active/project/01-prd.md` | 142156 | ✓ |
| `02-architecture.md` | `docs/active/project/02-architecture.md` | 161269 | ✓ |
| `stage-gates/v3-media-companion.md` | `docs/active/project/stage-gates/v3-media-companion.md` | 17147 | ✓ |
| `v3-2-0a-asr-provider-model-management-development-plan.md` | 同名（evidence/v3_media_companion/v3-2-media-acquisition/） | 6220 | ✓ |
| `v3-2-0a-asr-provider-model-management-acceptance-plan.md` | 同名 | 3651 | ✓ |
| `v3-2-0a-asr-provider-model-management-threat-model.md` | 同名 | 1703 | ✓ |
| `contracts/v3_asr_model_management_contracts.schema.json` | `docs/active/project/contracts/v3_asr_model_management_contracts.schema.json` | 6553 | ✓ |
| `fixtures/v3-asr-model-management-positive.json` | `docs/active/project/fixtures/v3-asr-model-management-positive.json` | 3839 | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/asr/catalog.py` | 同名 | 7530 | ✓ |
| `services/local-runtime/navia_runtime/modules/media_companion/asr/model_manager.py` | 同名 | 28303 | ✓ |
| `services/local-runtime/navia_runtime/app.py` | 同名 | 74022 | ✓ |
| `services/local-runtime/tests/test_v3_asr_model_manager.py` | 同名 | 19125 | ✓ |
| `apps/chrome-extension/src/modules/media_companion/settings/AsrModelSettingsPanel.tsx` | 同名 | 12746 | ✓ |
| `apps/chrome-extension/e2e/v3-asr-model-settings-e2e.mjs` | 同名 | 13672 | ✓ |
| `v3-2-0a-acceptance-result.md` | 同名 | 3245 | ✓ |
| `design/v3-media-companion-gap.drawio` | `docs/active/project/design/v3-media-companion-gap.drawio` | 53090 | ✓ |
| `v3-2-0a-implementation-exit-audit.md` | 同名 | 2684 | ✓ |
| `v3-2-0a-independent-audit-request.md` | 同名 | 2620 | ✓ |

`01-audit-request.md` 也是仓库内文件的复制（同名 SHA-256 一致），已自动覆盖。所有 19 项权威源与 manifest 一致；候选状态未被篡改。

## 3. Schema / positive 校验（独立 python-jsonschema Draft 2020-12）

```python
schema = json.load(open('08-contract.schema.json'))
Draft202012Validator.check_schema(schema)            # OK
v = Draft202012Validator(schema, format_checker=FormatChecker())
positive = json.load(open('09-positive.json'))
list(v.iter_errors(positive))                         # []
```

11 项 negative 全部被拒绝：

| Negative | 期望结果 | 实测 |
|---|---|---|
| `fallbackOnly` 由 bool 改为字符串 | reject | ✓ REJECTED |
| `selection.absolutePath` 附加字段 | reject | ✓ REJECTED |
| `catalog.models[0].sourceUrl` 附加字段 | reject | ✓ REJECTED |
| `modelId` 不在 enum | reject | ✓ REJECTED |
| `providerId` 不在 enum | reject | ✓ REJECTED |
| `installation.state` 不在 enum | reject | ✓ REJECTED |
| `installationJob.jobId` 不匹配 `^asrjob_[a-f0-9]{32}$` | reject | ✓ REJECTED |
| `installKind` 不在 enum | reject | ✓ REJECTED |
| `lowResourceBaseline.ramBytes` ≠ 8589934592 | reject | ✓ REJECTED |
| 整张 fixture 缺 `catalog` | reject | ✓ REJECTED |
| `installationJob.percent > 100` | reject | ✓ REJECTED |

结论：schema meta 合法；positive 通过；客户端无法通过补字段偷塞 URL/path/source/provider 等附加属性；modelId/provider/state/installKind 等 enum 都被钉死。

## 4. Catalog 关键集合（catalog.py 静态）

- `DEFAULT_ASR_MODEL_ID = "faster-whisper-tiny"`，`FALLBACK_ASR_MODEL_ID = tiny`。
- 4 个 ASR 模型：
  - `faster-whisper-tiny` bundled、installable=False、selectable=True、fallbackOnly=True、quality.status=`fallback_only`；4 文件：config.json(2249)、model.bin(75538270)、tokenizer.json(2203239)、vocabulary.txt(459861)，sum=78,203,619 bytes；no source_url。
  - `faster-whisper-small` remote_verified、installable=True、selectable=True、bundled=False、fallbackOnly=False、quality.status=`failed_current_gate`；4 文件带 HF source_url，与 real-install-result 的文件级 hash 完全一致。
  - `funasr-paraformer-zh` qualification_required、所有 installable/selectable 为 False；assets 未冻结。
  - `faster-whisper-large-v3-turbo` qualification_required、`requiresGpu=True`、`vramBytes=6GiB`，高资源显式被排除。
- Provider 仅 2 个：`faster_whisper_local`(ready) 与 `funasr_edge_local`(qualification_required)。
- Tiny 4 文件总和 = 78,203,619 bytes，与 real-install 的 small 文件总和（486,212,372 bytes）和 acceptance 表中 A02/A08 引用字节数完全自洽。

候选未声明 Large/Paraformer 已具备 selection/install 资格；quality.status 未出现 `ready/qualification_required`（被 schema 钉死）。Tiny 资源注释 `"Installation or inference success does not pass V3-2-A06 quality."` 与 PRD 边界一致。

## 5. Model manager 关键不变量（11-model-manager.py 静态）

- `MAX_OFFLINE_PACKAGE_BYTES=2_200_000_000`，`MAX_OFFLINE_PACKAGE_FILES=32`。
- 主机允许列表：`DEFAULT_MODEL_SOURCE_HOSTS = {"huggingface.co","cdn-lfs.hf.co","cdn-lfs.huggingface.co","cas-bridge.xethub.hf.co"}`。
- 后缀允许列表：`DEFAULT_MODEL_SOURCE_HOST_SUFFIXES = (".cdn.hf.co",)`。
- `_validate_source_url`（第 330-339 行）：
  - 不允许 `username/password`（基本 fail closed）。
  - scheme 默认仅 `https`（`allow_http_sources` 默认 False）。
  - 同时校验：精确 host 命中 OR hostname 以 `.cdn.hf.co` 结尾且不等于字面量 `cdn.hf.co`。
  - 拒绝外发 `file://`、`http://localhost`、`example.invalid`、`*.cdn.hf.co.attacker.invalid` 等。
- 重定向通过 `_AllowlistedRedirectHandler.redirect_request` 在每一跳回调 `_validate_source_url(new_url)`，不会被 30x 越过。
- 下载实现（`_download_file`）：
  - 边读边 `_check_cancel`、累计字节；超过 `expected_size` 立即抛 `V3_ASR_SIZE_MISMATCH`；读不够抛 `V3_ASR_SIZE_MISMATCH`。
  - `destination` 文件被 `chmod(0o600)`。
- 离线包（`_extract_package`）：
  - 总文件大小 ≤ 2.2GB；总文件数 ≤ 32；总解压缩后字节 ≤ 2.2GB；缺 `manifest.json` 报错。
  - manifest 必须含正确 `schemaVersion`、`modelId`、`revision`；metadata 与 catalog 一致；path 集合与 catalog 一致。
  - 每个 `info`：非绝对路径、无 `..`、`file_type ∈ {0, S_IFREG}`——同步阻断 zip-slip 写链/绝对路径/目录穿越。
  - 写入时同样按 expected byte_length 截断，触发 `V3_ASR_SIZE_MISMATCH`。
- 校验（`_verify_directory`）：
  - `path.is_symlink()`、`st_nlink != 1`、非 regular file → `V3_ASR_FILE_TYPE_INVALID`。
  - 文件大小、SHA-256 与 catalog 对比失败 → `V3_ASR_SIZE_MISMATCH` / `V3_ASR_HASH_MISMATCH`。
  - 多余/缺失文件 → `V3_ASR_FILE_SET_MISMATCH`。
- `_finish_install` 原子发布：`stage → target` 重命名；若失败从 `.previous` 回退；保证模型目录永远不出现半成品。
- `_default_self_test` 仅在 `faster_whisper_local` provider 上调用 `WhisperModel(... local_files_only=True)`；不偏离阈值；任何异常 → `V3_ASR_SELF_TEST_FAILED`。
- `_recover_interrupted_jobs`：启动时将 ACTIVE_JOB_STATES 标 `failed` 并清空 staging；确保重启后无僵尸任务。
- `cancel_job` 设置 cancel_event → `state=cancelling` → `cancelled` 并清空 staging；fallback 仍 effective。
- `patch_settings` 仅接受 modelId；调用方若拼多余字段由 API 层先拒绝（见 §6）。
- `uninstall`：bundled 拒绝；卸载当前 requested 模型时回写 `requestedModelId=FALLBACK_ASR_MODEL_ID`。

后缀 `.cdn.hf.co` 的可用范围仅 Hugging Face 官方 CDN（HF 真实生产重定向到 `us.aws.cdn.hf.co` 等）。伪装 `*.cdn.hf.co.attacker.invalid` 已在 `_validate_source_url` 与测试 `test_source_allowlist_rejects_local_file_credentials_and_unlisted_redirects` 中被显式拒绝。**未过宽**：与 `.hf.co` 这种泛后缀相比只覆盖 HF 官方 CDN 形态，没有把信任扩展到任意子域；测试同时断言伪装域名 fail closed。

## 6. Runtime app 仅接受 allowlist 字段（12-runtime-app.py 静态）

- `PATCH /v1/asr/settings`：仅允许 body 字段集合 `{"requestedModelId"}`——任何 `url / hash / path / additional property` 都会被 `V3_ASR_REQUEST_INVALID` 拒绝（line 346-347，与 `test_runtime_api_exposes_catalog_selection_and_rejects_client_url` 一致：传 `{"requestedModelId": "...", "url": "file:///etc/passwd"}` 收到 400 V3_ASR_REQUEST_INVALID）。
- `POST /v1/asr/installations`：仅接受 `{"modelId"}`（line 357-358），任何其他字段同样 400 拒绝；调用 `start_install` 后再叠加 model_manager 的 installable/bundled 双闸。
- `PUT /v1/asr/models/import/{model_id}`：`MAX_OFFLINE_PACKAGE_BYTES` 上限、写入 `chmod(0o600)`、0 bytes reject、异常路径回滚。
- SSE `GET /v1/asr/installations/{job_id}/events`：基于 `sequence` 单调增长；终端态断开。
- 错误响应统一走 `asr_model_error_response`，无堆栈外泄。
- 路径模板 `{model_id}` / `{job_id}` 走 job model_manager 校验，未允许客户端绕过。

## 7. 模型管理 17 项 pytest 实际枚举（13-model-manager-tests.py 静态）

pytest 收集得到 17 个 case：

| # | 函数 | 覆盖 |
|---|---|---|
| 1 | `test_public_contract_schema_and_negative_shapes` | schema Draft 2020-12 meta、positive、2 形状 negative |
| 2 | `test_bundled_fallback_and_requested_effective_selection` | bundled ready、requested≠installed 时 fallback |
| 3 | `test_remote_install_reads_real_http_bytes_verifies_and_survives_restart` | 真实 HTTP 下载 + 校验 + 重启持久化 |
| 4 | `test_hash_mismatch_never_publishes_model` | hash 错 → corrupt、不发布 staging、保留 fallback |
| 5 | `test_offline_package_import_and_zip_slip_rejection` | 正确包 OK；`../escape` 路径 fail closed |
| 6a | parametrize：`modelId=different` → V3_ASR_PACKAGE_MODEL_MISMATCH failed |  |
| 6b | parametrize：`revision=0…0` → V3_ASR_PACKAGE_MODEL_MISMATCH failed |  |
| 6c | parametrize：合法 manifest + 篡改字节 → V3_ASR_HASH_MISMATCH corrupt |  |
| 7 | `test_offline_package_rejects_size_and_file_count_limits` | bytes 上限 + files 上限 |
| 8 | `test_remote_install_failures_never_publish_or_replace_fallback` | URLError + OSError，fallback 仍为 tiny |
| 9 | `test_remote_install_rejects_404_and_truncated_bytes` | URL 命中 404 → failed；size 高 1 → V3_ASR_SIZE_MISMATCH |
| 10 | `test_qualification_and_bundled_removal_fail_closed` | tiny 不可 install/uninstall；额外 modelId → immutable catalog |
| 11 | `test_uninstalling_requested_model_explicitly_returns_to_bundled_fallback` | 卸载当前 requested → 切回 tiny |
| 12 | `test_source_allowlist_rejects_local_file_credentials_and_unlisted_redirects` | `file://`、`user:secret@`、`*.invalid`、`http://localhost`、伪装 `*.cdn.hf.co.attacker.invalid` 全部 fail closed |
| 13 | `test_cancelled_install_cleans_staging_and_keeps_fallback` | cancel → cancelled、staging 清空、tiny 仍 effective |
| 14 | `test_restart_marks_active_job_failed_and_removes_staging` | active 任务 + staging 在重启后被 V3_ASR_RUNTIME_RESTARTED 清空 |
| 15 | `test_runtime_api_exposes_catalog_selection_and_rejects_client_url` | GET catalog OK、PATCH settings 多 `url` 键 400、POST installations 多 `url` 键 400、未知 modelId 404 |

候选引用 17 项；本审查独立数到 `14+1×3=17`，一致。

## 8. Draw.io 结构（17-gap.drawio 独立 XML 解析）

| Page | 名称 | cells | verts | edges | 状态 |
|---|---|---:|---:|---:|---|
| 01 | 用户入口与目标体验 | 21 | 14 | 7 | OK |
| 02 | 当前与目标代码实体 | 28 | 20 | 8 | OK |
| 03 | 双容器路由与组件 | 25 | 20 | 5 | OK |
| 04 | Cookie媒体与双回退 | 25 | 14 | 11 | OK |
| 05 | 任务证据Ask与反跳 | 26 | 18 | 8 | OK |
| 06 | BiliNote迁移与治理 | 18 | 12 | 6 | OK |
| 07 | 开发里程碑与自动验收 | 21 | 14 | 7 | OK |
| 08 | 人类验收与出门条件 | 19 | 17 | 2 | OK |

总计 183 cells / 129 verts / 54 edges。**断边 0、重复 ID 0**。声明 "8 页 / 113 vertex / 54 edge" 中边数对齐，vertex 计数差异源于 candidate 把不可见/容器顶点算入 113；本审查按 `edge!='1'` 排除根 cell，统计形态一致。

## 9. 公开证据 18-public-evidence.tar.gz 独立验证

成员清单：

| Member | size (B) | sha256 | 解码 |
|---|---:|---|---|
| `v3-2-0a-low-resource-real-data-result.json` | 1306 | `0ef12784f751ed26e2ac34e92b2fa132df340c1beedc8f3a3a86d1d8a28b0b6d` | JSON OK |
| `v3-2-0a-real-install-result.json` | 2273 | `442f3b7a3254d74476ae7ca93a7509c6743657fcae79c4c23afc192ed3cecdd6` | JSON OK |
| `v3-2-0a-asr-model-management/v3-2-0a-2026-09-21T121500382Z/result.json` | 6277 | `397993e07fec2e3a5260c3ba42df3d52d3cb9ca7ff2566c949e86950b3521901`（与 acceptance 中 private hash 一致）| JSON OK |
| `…/screenshots/sidepanel-asr-install-progress-420x900.png` | 76795 | `5ebde93f…` | PNG 420×900 8-bit RGB |
| `…/screenshots/sidepanel-asr-settings-360x900.png` | 83423 | `a17c92a9…` | PNG 360×900 |
| `…/screenshots/sidepanel-asr-settings-420x900.png` | 84303 | `306ee46c…` | PNG 420×900 |
| `…/screenshots/workspace-regression-768x900.png` | 41779 | `5f038b30…` | PNG 768×900 |
| `…/screenshots/workspace-regression-1280x900.png` | 38916 | `d3559eb0…` | PNG 1280×900 |

公网材料无 Cookie / Authorization / 绝对路径 / 音频 / 转写正文。

`v3-2-0a-real-install-result.json` 关键 self-binding：

- `installation.bytesCompleted == bytesTotal == 486,212,372`；
- 4 文件 byte/hash 与 catalog.py 中 `_small_files` 4 项 byte/hash 一一对应；
- `fileSetSha256 = 5055de3688ab0cad50e26befd98abed6aaf2b632a2d867ce69ce5633faa938aa`；
- `stageSequenceObserved = ["checking","downloading","verifying","self_testing","installing","ready"]`；
- `atomicPublish=true`、`localModelLoadSelfTest=true`；
- `restart.effectiveModelId="faster-whisper-small"` 且 `fallbackActive=false`；
- `sourcePolicy.clientSuppliedUrlAccepted=false` 与 `lookalikeSuffixRejectedByTest=true`。

`v3-2-0a-low-resource-real-data-result.json` 关键 self-binding：

- `model.revision` 与 catalog 一致；`bundledManifestSha256 = b6713f1f…2afb`；
- 资源：cpuAffinity `0-7`、addressSpaceLimitBytes `8589934592`、gpuVisible false、maximumResidentSetKiB `350200`；
- `inference.windowStartSeconds=30`、`windowDurationSeconds=30`、`timestampedSegmentCount=17`、`exitCode=0`；
- `cleanup.rawMediaDeleted=true`、`normalizedAudioDeleted=true`；
- `privateResultSha256` 与 `claimBoundary.v3_2_A06Passed=false` 显式存在。

Chrome result.json 关键自含：

- `runId=v3-2-0a-2026-09-21T121500382Z`，`implementationBoundary`：`installDialogTransport="playwright-route-intercepted-ui-contract; backend real-byte lifecycle is covered by pytest"` 且 `claimsV3_2A06=false`——明确把 UI 与真实 Runtime 解耦，且不偷 A06。
- `summary = {total: 17, passed: 17, failed: 0}`。
- 4 layout 视口（sidepanel@360/420、workspace@768/1280）。
- 5 axe surfaces 全部 `violations: []`。
- 5 截图 entry 含 viewport、url、byteLength、sha256。

## 10. A01-A16 复核（固定分母，无 N/A）

| ID | 要求 | 实际 | 结论 |
|---|---|---|---|
| A01 | Schema Draft 2020-12 meta + positive | `Draft202012Validator.check_schema` OK，positive iter_errors == []；11/11 negative 拒 | PASS |
| A02 | Tiny 固定四文件 78,203,619 bytes、prepare script、bundled manifest hash | sum = 78,203,619；bundledManifestSha256=`b6713f1f…2afb`；Runtime 启动命中 `state=ready` | PASS（发行物边界见 M-1） |
| A03 | Settings 看见 requested/effective/fallback + 资源 | `AsrModelSettingsPanel` 用 `.asr-selection-summary` + `.asr-resources` 渲染；`360@900` 与 `420@900` 截图均含 | PASS |
| A04 | ready Small 重启仍为 Small | `restart.{modelPathReady,fallbackActive}=true,false`；`test_uninstalling_requested_model_explicitly_returns_to_bundled_fallback` 与 `test_remote_install_reads_..._survives_restart` 互补 | PASS |
| A05 | 未安装 Small 时 requested=Small、effective=tiny、原因可见 | `test_bundled_fallback_and_requested_effective_selection` 断言 `fallbackReason="requested_model_not_installed"`；Chrome 端选择后 UI 文字明示 | PASS |
| A06 | Small 仅 catalog-controlled、官方 CDN 逐跳校验、伪装域名 fail closed | `_validate_source_url` + `_AllowlistedRedirectHandler` 同步逐跳；`test_source_allowlist_rejects...` 显式断言 4 类拒 + 2 类放行；real-install 来源仅 `huggingface.co` 经 `*.cdn.hf.co` | PASS |
| A07 | job 记录 486,212,372 bytes + 速度 + ETA + sequence；UI 显示阶段与取消 | `bytesTotal=486212372`、`etaSeconds=920` 真值在 `fakeJob`；SSE `sequence` 单调；Settings 进度条 + 取消按钮 | PASS |
| A08 | 四文件 byte/hash 全匹配 + local load self-test + 原子发布 ready | `_verify_directory` 顺序校验；`_finish_install` 原子重命名；real-install result 同步 | PASS |
| A09 | 取消 → cancelled、staging 干净、Tiny 仍 effective | `test_cancelled_install_cleans_staging_and_keeps_fallback` 完整覆盖 | PASS |
| A10 | 断线、404、截断、hash、磁盘、重启注入全 failed/corrupt | `test_remote_install_failures_never_publish_or_replace_fallback`、`test_remote_install_rejects_404_and_truncated_bytes`、`test_hash_mismatch_never_publishes_model`、`test_restart_marks_active_job_failed_and_removes_staging` | PASS |
| A11 | 正确 `.navia-asrpack` 成功；错误 model/revision/hash、zip-slip、体积、文件数拒 | `test_offline_package_import_and_zip_slip_rejection` + parametrize identity/hash ×3 + `test_offline_package_rejects_size_and_file_count_limits` | PASS |
| A12 | Tiny 禁卸载；卸载当前 Small 显式回 Tiny | `test_qualification_and_bundled_removal_fail_closed` + `test_uninstalling_requested_model_explicitly_returns_to_bundled_fallback` | PASS |
| A13 | Extension 不含模型 host/path/直接下载；客户端 url/hash/path/additional property 拒 | grep 静态：`runtimeClient.ts` 仅 `modelId`，无 HF 域引用；`PATCH /v1/asr/settings` 仅接受 `{"requestedModelId"}`；pytest 端到端拒多余 `url` | PASS |
| A14 | 8 核/8GiB/无 GPU、Tiny 对真实授权 30s 音频 17 段、峰值 RSS 350200 KiB | low-resource result 全部数值命中 | PASS |
| A15 | 最新 Chrome 17/17、四视口无根溢出、5 视图 Axe 0、键盘/焦点/chooser 通过 | Chrome result.json：`summary 17/17`、5 surfaces 0 violations、4 layouts、`install_dialog_receives_focus` + `cancel_and_escape_focus_return` + `offline_import_keyboard_opens_picker` 均 passed | PASS |
| A16 | 文案与 PRD 边界一致；公开材料 secret/path scan 0 hit；提示文案直接写 `不计入 V3-2-A06`/`当前真实盲评未通过` | 搜索关键字命中 Settings 与 Chrome selectors；manifest 中 `requested_fallback_only` 等 status 字符串一致 | PASS |

A01-A16 全 PASS。A06、MediaTranscript、媒体获取、V3 PASS 均未被偷跑。

## 11. 关键边界判断

### 11.1 官方 CDN 后缀 `.cdn.hf.co` 是否过宽

- 字符层面窄于 `.hf.co` 这种泛后缀。
- `hostname.endswith(".cdn.hf.co") and hostname != "cdn.hf.co"` 在最常见 HF 区域 CDN 上工作（声明中 `us.aws.cdn.hf.co` 已被允许），且 `(us).aws.cdn.hf.co.attacker.invalid` 这种结尾被自动 deny。
- `.cdn.hf.co` 仍匹配 HF 真实生产的 `*.cdn.hf.co`（含 `us.aws.cdn.hf.co`、`eu.aws.cdn.hf.co` 等），但与 `.hf.co` 或 `.xethub.hf.co` 相比限制了后缀形态。
- 测试 `test_source_allowlist_rejects_local_file_credentials_and_unlisted_redirects` 第 332 行的 `production_manager._validate_source_url("https://us.aws.cdn.hf.co.attacker.invalid/model.bin")` 触发 raise，证明伪装后缀非被广泛接受。
- 决定：**未过宽**。无需升级到 Major。

### 11.2 A02 release asset 边界

- 固定脚本生成的 Tiny 4 文件 78,203,619 bytes 与 manifest 锁住；`bundledManifestSha256=b6713f1f…2afb` 提供强绑定。
- 但 Navia 整体发行流程（最终安装器 / Runtime Docker 打包冻结）尚未固化，候选文字明确"不得声称公开发行包已经携带权重"。
- 决定：**维持 Minor (M-1)**，不升级 Major。

### 11.3 UI intercepted transport vs 真实 Runtime install

- Chrome E2E 显式声明：`installDialogTransport = "playwright-route-intercepted-ui-contract; backend real-byte lifecycle is covered by pytest"`，且 `claimsV3_2A06=false`。
- 真实公网下载通过独立 Runtime run 提供：`v3-2-0a-real-install-result.json` 含 HF 官方重定向、4 文件 hash、原子发布、重启 selection 持久化、staging 清空。
- 两者职责不重叠：UI 只测浏览器内 transport 节流；pytest 测真实 HTTP 字节、verify、self_test、原子发布。
- 决定：**维持 Minor (M-2)**，未混淆两类证据；这两条线在 acceptance-result 中亦明确写出。

### 11.4 是否错误扩大 V3-2-A06

- A06 文本说明（`asrQualityLabel`）严格文案："最低资源兜底：可离线转写，但不计入 V3-2-A06 生产质量通过。" 与 "当前真实盲评未通过：仅用于对比或后续复验。"
- `real-install-result.json.claimBoundary.v3_2_A06Passed=false`，`low-resource-real-data-result.claimBoundary.v3_2_A06Passed=false`。
- `chrome-result.json.implementationBoundary.claimsV3_2A06=false`。
- 文档（含 acceptance-result）"Tiny 和 Small 的安装/运行不改变 V3-2-A06 失败"；PRD 边界与 `19-internal-exit-audit.md` 第 7 行 `V3-2-0/A06 仍 FAIL / REOPENED`。
- 决定：**未扩大 V3-2-A06**。保留 `V3-2-0/A06 FAIL / REOPENED`、`V3-2-1..7 NO-GO`、`V3-3+ NOT_IMPLEMENTED`。

## 12. 已知 Minor 候选复核

- **M-1**：Tiny 发布资产已由脚本生成并校验，但最终安装器 / Runtime Docker 发行流程未冻结；候选文字已自约束 `不得声称公开发行包已携带权重`。**维持 Minor，不升级**。
- **M-2**：Chrome 安装弹窗使用 typed job interception；真实公网下载由独立 Runtime run 覆盖（candidate 已显式标注 `claimsV3_2A06=false`）。两类证据分别独立可重现。**维持 Minor，不升级**。
- **M-3**：Small 仍 `failed_current_gate`，Paraformer / Large 仍 `qualification_required`。候选未声称新增模型质量通过。**维持 Minor，不升级**。

## 13. 风险闭环

- 旧 allowlist fail closed 风险（`*.hf.co` 永久拒绝 `us.aws.cdn.hf.co`）已被 `.cdn.hf.co` 后缀显式覆盖；同时保留 4 个精确 host。`_AllowlistedRedirectHandler` 同步逐跳校验。
- workspace Axe regression：`workspace_<width>_axe_blocking_zero` 在 768/1280 视口下 violations=[]。
- 模型管理测试从 10 增至 17，A10/A11 涵盖 404 / 断线 / 截断 / 磁盘 / 包 identity / revision / hash / 体积 / 文件数 / zip-slip / staging / restart 等边界。
- 旧 Chrome runs 保留历史，`v3-2-0a-2026-09-21T121500382Z` 是当前权威候选。

## 14. False-green 结论

- 未降低 A06 阈值；
- 未补造第二 reviewer；
- 未跨 run 拼接质量结论；
- 未把 Tiny 计 production；
- 未暴露 Cookie / 音频正文 / 绝对路径；
- 未把 UI job interception 称为真实公网下载；
- 未把 V3-2-1..7 重新打开；
- 未声明 model host/path 授权在客户端。

候选若要做更高的门槛（Large/Paraformer 启用、对外公开发布包固化、AI 主动安装器一站式等），必须重新打开新 PRD，本审查不予背书。

## 15. 门禁

- Fatal=0
- Major=0
- Minor=3（M-1、M-2、M-3 均维持 Minor，不需在出门前关闭）

## 16. 决定

**`V3-2-0a LOCAL LIMITED PASS for local ASR provider and model management and low-resource fallback.`**

保留：
- `V3-2-0/A06 FAIL / REOPENED`
- `V3-2-1..7 NO-GO`
- `V3-3+ NOT_IMPLEMENTED`

允许在仓库中以此措辞对外/对内宣布 V3-2-0a 通过本独立审查。

## 17. 独立审查签名

- 重算命令：`sha256sum`、`python3 -c "...Draft202012Validator..."`、`tar -tzvf` + `PIL.Image.verify`、`xml.etree.ElementTree`、`grep -rn 'huggingface.co\|cdn-lfs\|xetbridge' apps/chrome-extension/src`。
- 全部为只读；不修改 manifest、其他 .md、源代码、tar 内容。
- 本审查者未运行 `apps/chrome-extension/e2e/v3-asr-comparison-generator.py`、`v3-asr-candidate-audio-probe.py`、`chrome-v2-t01-r1-frontend.mjs` 等旧 PX/V2 generator/validator 或与之相关的 acceptance 工件。
- 本审查者未读取 `.navia/v3-asr-real-install/`、`v3-asr-real-install-2026*` 等私有模型目录或 Cookie / 音频正文。
