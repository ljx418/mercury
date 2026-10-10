# V3-3-0 独立文档审查（独立审计员）

日期：2026-10-08。审查对象：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` 内 19 项载荷 + manifest 自身。审查模式：只读、隔离 Python/sha256sum/grep/find/cmp，未修改任何审计包或源文件，未运行 Chrome/Runtime/yt-dlp/ffmpeg/RapidOCR/cloud VLM，未读取凭据、未上传图像。

---

## 0. 二元门禁原话（来自 `01-audit-request.md`）

> 报告必须列出 Fatal/Major/Minor，并给出以下两个独立决定：
>
> 1. `OCR AND SAMPLE FREEZE PASS` 是否成立。
> 2. V3-3 是否仍必须等待 VLM 真实 capability probe 和用户高风险授权。

---

## 1. 19 项载荷 SHA-256 独立重算（`AUDIT_MANIFEST.md` 第 1 列对账）

`sha256sum` 复算 19 文件，与 `AUDIT_MANIFEST.md` 字面比对：

| # | 文件 | 重算 SHA-256 | Manifest 期望 | 一致 |
|---|------|---|---|---|
| 01 | `01-audit-request.md` | `fb0e00fc5663dd1d…` | `fb0e00fc…d034` | ✅ |
| 02 | `02-prd.md` | `c277d8d67f9caf9e…` | `c277d8d6…366c` | ✅ |
| 03 | `03-architecture.md` | `a56b5a57c83d05d9…` | `a56b5a57…db9a` | ✅ |
| 04 | `04-stage-gate.md` | `a40118984d371406…` | `a4011898…df91` | ✅ |
| 05 | `05-master-development-acceptance-plan.md` | `f1a4d49f78b2a11e…` | `f1a4d49f…875d8` | ✅ |
| 06 | `06-v3-3-development-plan.md` | `f010eb761fe94867…` | `f010eb76…d336` | ✅ |
| 07 | `07-v3-3-acceptance-plan.md` | `3882c3d4b26cded0…` | `3882c3d4…42a8` | ✅ |
| 08 | `08-v3-3-threat-model.md` | `c2c5c40dc79b12f8…` | `c2c5c40d…61e4` | ✅ |
| 09 | `09-v3-3-preimplementation-audit.md` | `f2451066eba0969e…` | `f2451066…1ddb` | ✅ |
| 10 | `10-dependency-freeze-plan.md` | `62adbc7d8cbe4531…` | `62adbc7d…cddd` | ✅ |
| 11 | `11-internal-audit.md` | `28f2add003385715…` | `28f2add0…365a` | ✅ |
| 12 | `12-vlm-provider-candidate.md` | `91f2ef0cf6f1fe4f…` | `91f2ef0c…bc29` | ✅ |
| 13 | `13-dependency-freeze.py` | `d16a7ab19825abe0…` | `d16a7ab1…0084` | ✅ |
| 14 | `14-requirements.txt` | `fd476cb2a0079507…` | `fd476cb2…5c2b` | ✅ |
| 15 | `15-rapidocr-manifest.json` | `fe7f49aebcfed785…` | `fe7f49ae…1e08` | ✅ |
| 16 | `16-vision-sample-registry.json` | `42c745d99bdbffcf…` | `42c745d9…eb95` | ✅ |
| 17 | `17-rapidocr-offline-probe.json` | `0721c3997080953b…` | `0721c399…fbea` | ✅ |
| 18 | `18-vision-evidence.schema.json` | `570485e0e41edafa…` | `570485e0…9128` | ✅ |
| 19 | `19-v3-2-independent-exit-audit.md` | `15d60e9ed9dec413…` | `15d60e9e…95a7` | ✅ |

19/19 SHA-256 全部匹配 `AUDIT_MANIFEST.md`，0 mismatch。

**Phase 1 结论：PASS。**

---

## 2. 包副本与权威源字节一致性

`cmp -s` 逐文件比对 19 个审计包内副本与 manifest 标注的权威源路径：

| # | 权威源路径 | 副本路径 | 字节一致 |
|---|---|---|---|
| 01 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-0-independent-document-audit-request.md` | `01-audit-request.md` | ✅ |
| 02 | `docs/active/project/01-prd.md` | `02-prd.md` | ✅ |
| 03 | `docs/active/project/02-architecture.md` | `03-architecture.md` | ✅ |
| 04 | `docs/active/project/stage-gates/v3-media-companion.md` | `04-stage-gate.md` | ✅ |
| 05 | `docs/active/project/design/v3-media-companion-development-acceptance-plan.md` | `05-master-development-acceptance-plan.md` | ✅ |
| 06 | `docs/active/project/evidence/v3_media_companion/v3-3-vision-development-plan.md` | `06-v3-3-development-plan.md` | ✅ |
| 07 | `docs/active/project/evidence/v3_media_companion/v3-3-vision-acceptance-plan.md` | `07-v3-3-acceptance-plan.md` | ✅ |
| 08 | `docs/active/project/evidence/v3_media_companion/v3-3-vision-threat-model.md` | `08-v3-3-threat-model.md` | ✅ |
| 09 | `docs/active/project/evidence/v3_media_companion/v3-3-vision-preimplementation-audit.md` | `09-v3-3-preimplementation-audit.md` | ✅ |
| 10 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-0-development-acceptance-plan.md` | `10-dependency-freeze-plan.md` | ✅ |
| 11 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-0-internal-audit.md` | `11-internal-audit.md` | ✅ |
| 12 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-vlm-provider-freeze-candidate.md` | `12-vlm-provider-candidate.md` | ✅ |
| 13 | `services/local-runtime/scripts/v3-vision-dependency-freeze.py` | `13-dependency-freeze.py` | ✅ |
| 14 | `requirements.txt` | `14-requirements.txt` | ✅ |
| 15 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-rapidocr-manifest.json` | `15-rapidocr-manifest.json` | ✅ |
| 16 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-vision-sample-registry.json` | `16-vision-sample-registry.json` | ✅ |
| 17 | `docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-rapidocr-offline-probe.json` | `17-rapidocr-offline-probe.json` | ✅ |
| 18 | `docs/active/project/contracts/v3_media_vision_evidence_v1.schema.json` | `18-vision-evidence.schema.json` | ✅ |
| 19 | `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-7-independent-implementation-exit-audit.md` | `19-v3-2-independent-exit-audit.md` | ✅ |

19/19 字节一致；包内副本与权威源没有出现 mismatch 或替换。

**Phase 2 结论：PASS。**

---

## 3. V3-2 出门审计是否真的允许 V3-3 进入实施前门禁（且未扩大为 V3-3 PASS）

来自 `19-v3-2-independent-exit-audit.md`：

- 候选 `v3-2-production-20261007T174158Z` 独立审查结果：`V3-2 LIMITED PASS`，Fatal=0/Major=0/Minor=0。
- 候选 `13-exit-candidate.json` 字段保持 `independentAuditStatus="pending"`、`v3_2Passed=false`，未被本审计修改。
- V3-2 审计明确自限：
  - 「本审计仅基于事实清单判定 V3-2 LIMITED PASS 的前置条件已经满足；V3-3 进入实施前门禁**仍受 `v3-3-*-preimplementation-audit.md` 等既有落盘文档约束**，本审计**不豁免 V3-3 自己的前置门禁**，也**不对 V3-3 文档做实质背书**」。
  - 「本审计报告**不构成**『V3 完成』『视频理解完成』『图文大纲完成』『Media Mindmap 完成』『生产质量认证』声明」。
- V3-2 审计 §12（PRD/架构/stage-gate 偏移）确认：`02-prd.md` §18.4 明确 V3-2 不展示/声称图文大纲、画面理解、Mindmap、Ask、持久历史、导出或 V4 知识能力完成；本候选未越界。`04-stage-gate.md` 顶部行 `V3-2-5..V3-7 BLOCKED`；stage-gate 自身保持历史 BLOCKED 状态。
- V3-3 既有 `09-v3-3-preimplementation-audit.md` 与 `11-internal-audit.md` 都明确：前序 V3-2 LIMITED PASS 关闭 ≠ V3-3 实施 PASS；V3-3 仍需真实 VLM capability probe + 用户授权。

**Phase 3 结论：PASS。** V3-2 LIMITED PASS 仅解锁 V3-3 实施前门禁（document/pre-implementation）；**没有扩大为 V3-3 PASS 或 V3 完成**。扩界声明为 0。

---

## 4. 10 样本独立派生

独立 Python 复算（不调用 `13-dependency-freeze.py`）：

- 读取源 `route/sample-registry-v5.json`（SHA-256 = `d683d59ffe71fcc6aa7e7955121c959d0094b0c496e90fd9a69be73dd8e40aab`，与 `16-vision-sample-registry.json.sourceRegistrySha256` 字面一致 ✅。
- 过滤 `expectedOutcome == "success"`，得到 10 个样本。
- 分类计数 `{subtitle: 6, asr: 3, multipart: 1}`，与 `16-vision-sample-registry.json.classificationCounts` 一致 ✅。
- 按源顺序前 8 个设为 `cloudVisionTarget=true`，后 2 个为 `false`，与 `cloudVisionTargetCount=8` 一致 ✅。
- 逐张重算 `probe/candidate-screenshots/NN-BVID.png` SHA-256，与源 registry 字段及派生 registry 字段三方一致：

| n | sampleId | mediaId | primaryClass | cv target | source SHA 前 16 | 派生 SHA 前 16 | 一致 |
|---|---|---|---|---|---|---|---|
| 1 | v3-sample-01 | BV1yLuwzpEt2 | subtitle | true | `6e212481aee8c64e` | `6e212481aee8c64e` | ✅ |
| 2 | v3-sample-02 | BV1VG4117775 | subtitle | true | `dc6787480a4b013a` | `dc6787480a4b013a` | ✅ |
| 3 | v3-sample-03 | BV1Bt411D78C | subtitle | true | `f24d81ec2bce49cb` | `f24d81ec2bce49cb` | ✅ |
| 4 | v3-sample-04 | BV1CiFMenEye | subtitle | true | `3d28d28cbdd27ebc` | `3d28d28cbdd27ebc` | ✅ |
| 5 | v3-sample-05 | BV1Fh1VYFEDu | subtitle | true | `3e3da98c5e776ecf` | `3e3da98c5e776ecf` | ✅ |
| 6 | v3-sample-06 | BV1iv411j7wL | subtitle | true | `97fae9eb291215ca` | `97fae9eb291215ca` | ✅ |
| 7 | v3-sample-07 | BV13W41137qV | asr | true | `d6de54be43058e9e` | `d6de54be43058e9e` | ✅ |
| 8 | v3-sample-08 | BV1ZpYd66ELP | asr | true | `f74c0e6227737c1e` | `f74c0e6227737c1e` | ✅ |
| 9 | v3-sample-09 | BV1pW421c7DH | asr | false | `2d6ee0e54b77522d` | `2d6ee0e54b77522d` | ✅ |
| 10 | v3-sample-10 | BV1PA4m1w7ya | multipart | false | `fa973a44a632a112` | `fa973a44a632a112` | ✅ |

10/10 URL、mediaId、partId=1、playbackUnitId、sourceClass、screenshot 路径/SHA 与 `16-vision-sample-registry.json.samples` 逐项字面一致；6+3+1 与 8 cloud target 与声称一致；**无拼接、无替换、无跨 run 引用**（仅消费 `v3-2-production-20261007T174158Z` 唯一前序 run）。

**Phase 4 结论：PASS。**

---

## 5. canonical content hash 与 ONNX 资产 hash 独立重算

**Canonical hash 复算**（`json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",",":"))`，去除 `contentSha256` 字段后）：

| 文件 | 声称 | 重算 | 一致 |
|---|---|---|---|
| `15-rapidocr-manifest.json` | `3cff6d5868824c357d0609671669511a507bb25fef64ed4030450ebb8f73d81f` | `3cff6d5868824c357d0609671669511a507bb25fef64ed4030450ebb8f73d81f` | ✅ |
| `16-vision-sample-registry.json` | `04a948a7d143a6bdc66c4e96cabf271a79810cf6db374b21d5ba960a1c29afb2` | `04a948a7d143a6bdc66c4e96cabf271a79810cf6db374b21d5ba960a1c29afb2` | ✅ |

**wheel SHA-256 复算**：repo 内无 `rapidocr-3.9.2-py3-none-any.whl` 实物，wheel 字节 SHA 无法在本机直接重算（依赖外部 PyPI 下载）。以下三个 wheel 哈希依赖 manifest 字段字面对账（与上游 PyPI 公开侧验证留给下一次具备 network egress 的复核）：

| package | version | wheel file | claimed wheel SHA-256 |
|---|---|---|---|
| rapidocr | 3.9.2 | `rapidocr-3.9.2-py3-none-any.whl` | `04d6b8d151f823d930bd91910555f57bea897c0c44fa6794267b94cf9c1ef9a0` |
| onnxruntime | 1.28.0 | `onnxruntime-1.28.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` | `0a83bdb70d143cede762b677789bf2a7acca54b3fb82565601d5c30695aa933c` |
| opencv-python | 5.0.0.93 | `opencv_python-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl` | `c8de2dec111122a02e8beb28e16c31904992dfd6186560b142a92c71403c1039` |

`requirements.txt`（副本 `14-requirements.txt`）使用精确 `==` 钉版本，无 `>=`/`~=` 漂移风险。

**ONNX 资产 bytes/SHA-256**：仓库内未存放三份 `.onnx` 实物，资产声明 `pathWithinWheel=models/PP-OCRv6_det_small.onnx` 等位于 `rapidocr-3.9.2-py3-none-any.whl` 内的 bundled 位置。审计员在 readonly 边界内**无法直接重算** `090f04…`、`6f3272…`、`e47ace…` 三个资产哈希，只能确认它们与上游 pinned wheel 的声明一致——验证是**by-reference**，不是 **by-recomputation**。这是本轮审计的固有限制。

| assetId | bytes | claimed sha256 | by-recompute 可复核 |
|---|---|---|---|
| PP-OCRv6_det_small | 9_929_594 | `090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f` | ❌（仓库无 .onnx 实物） |
| PP-OCRv6_rec_small | 21_234_383 | `6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884` | ❌ |
| ch_ppocr_mobile_v2.0_cls_mobile | 585_532 | `e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c` | ❌ |

`13-dependency-freeze.py` 第 102–117 行确实会在执行时按 `(bytes, sha256)` 严格断言资产漂移；脚本本身不修改产物。本审计包未运行该脚本（且在 readonly 边界内也不应运行），因此只能依赖 manifest 字面对账与脚本逻辑审查。

**Phase 5 结论：PASS（带 limitation）**。canonical content hash 重算 2/2 完全一致；wheel 与 ONNX 资产 hash 仅 by-reference 一致，需要在带 network egress 的环境补一次端到端 wheel/asset 重算才能正式升级为 by-recomputation 一致。

---

## 6. offline probe 完整性

来自 `13-dependency-freeze.py`（`run_offline_probe` 函数，第 185–228 行）：

- 网络拒绝：`sys.addaudithook(audit)` 注册 Python 级 audit hook，命中 `socket.connect` 或 `socket.getaddrinfo` 时追加 `network_attempts` 并抛 `RuntimeError("network access denied by V3-3 offline probe")`。这是 Python runtime 级（PEP 578）拦截，**不是**单纯的 monkey-patch 或 try/except；同时显式排除 RapidOCR 内部 fetch 模型/字库/配置的潜在网络尝试。声明 `networkPolicy = "python_audit_hook_deny_socket_connect_and_getaddrinfo"` 与代码一致。
- 真实 sealed 截图：probe 在 `samples[7]`（`v3-sample-08` / `BV1ZpYd66ELP`）执行；源图位于 V3-2 sealed run `probe/candidate-screenshots/08-BV1ZpYd66ELP.png`。独立 `sha256sum` 复核 = `f74c0e6227737c1eb42f19ff46c6d0494f3e0aaa53b08480ec8457f096c416f4`，与 `17-rapidocr-offline-probe.json.sourceImageSha256` 及 `16-vision-sample-registry.json.samples[7].sourceScreenshot.sha256` 字面一致 ✅。
- 引擎参数：`RapidOCR(params={"EngineConfig.onnxruntime.use_cuda": False, "EngineConfig.onnxruntime.intra_op_num_threads": 4, "EngineConfig.onnxruntime.inter_op_num_threads": 1})`；`gpuUsed=false`、`threadLimit=4` 与 manifest 一致。
- 资源门禁：`peakRssKiB = 426072`（≈ 416 MiB），远 < 1 GiB；`wallClockSeconds = 1.408202`；`textCount = 82`（非空）；`meanConfidence = 0.97391`。脚本在 `if not texts or network_attempts: raise RuntimeError("RapidOCR offline self-test failed")` 上有显式 fail-closed 短路，不允许空文本或任何网络尝试通过。
- 结果 hash：`resultSha256 = 98426e7a…` 是 `canonical_hash(normalized)`，其中 `normalized = [{"text":..., "score": round(score, 6)} for text, score in zip(texts, scores)]`。由于本审计包未运行 RapidOCR，无法独立重算该 resultSha256；审计员只能验证源图 SHA、脚本 fail-closed 逻辑和参数一致性。**未观察到结果补写（result padding）或资源假绿**（脚本不会因失败而伪造文本）。

**Phase 6 结论：PASS（带 limitation）**。断网机制真实可信（Python audit hook）、源图为 sealed 真实截图、`peak RSS < 1 GiB`、fail-closed 显式；resultSha256 与 textCount 仍需带 RapidOCR 实物的环境补一次重算。

---

## 7. yanked/retiring package 拒绝与新统一包冻结的技术合理性与跨平台风险

**技术合理性**：

- 候选 `12-vlm-provider-candidate.md` 与 `10-dependency-freeze-plan.md`、`11-internal-audit.md` 均明确：旧 `rapidocr-onnxruntime==1.4.4` 因官方退役（上游 `RapidAI/RapidOCR` 已迁移到统一包名 `rapidocr`）且 PyPI 1.4.4 标记 yanked，拒绝冻结。
- 新统一包 `rapidocr==3.9.2`（Apache-2.0，pure-python wheel `py3-none-any`）+ `onnxruntime==1.28.0`（MIT，manylinux x86_64）+ `opencv-python==5.0.0.93`（Apache-2.0，manylinux x86_64）的版本、许可、wheel 名、wheel SHA 已在 `15-rapidocr-manifest.json` 字面声明并被 `requirements.txt` 用 `==` 钉版本。
- 模型资产 `sourcePolicy = "assets_bundled_in_pinned_rapidocr_wheel"`：3 份 `.onnx` 由 `rapidocr-3.9.2-py3-none-any.whl` 直接 bundled，pinning wheel 等价 pinning 资产字节（前提是 wheel 字节 hash 已被验证，见 Phase 5 限制）。

**跨平台风险**（**Minor**）：

- `onnxruntime-1.28.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` 与 `opencv_python-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl` 均显式声明 `manylinux_2_27/2_28_x86_64`，即 Linux x86_64 单一平台。
- RapidOCR 自身是 `py3-none-any` 纯 Python wheel，跨平台，但底层依赖 ONNX Runtime + OpenCV 在 macOS / Windows / aarch64 上需另选 wheel；当前 manifest 未冻结对应 wheel SHA。
- `04-stage-gate.md` 与 `02-architecture.md` 没有把 V3-3 限定为 Linux only；PRD 与 stage-gate 暗示产品仍需在最终用户常见桌面平台可用。
- 因此本轮 freeze 在 Linux x86_64 上完全成立；在 macOS / Windows / aarch64 上的 10 OCR 复算尚不具备同等强度保证——这是 `m-1` Minor。

**Phase 7 结论：PASS**（`m-1` Minor 跨平台覆盖记录）。

---

## 8. VLM Provider 候选边界

`12-vlm-provider-candidate.md` 文档状态字段即 `CANDIDATE / CAPABILITY PROBE AND USER AUTHORIZATION PENDING`，与 `09-v3-3-preimplementation-audit.md` §2 M-2 和 `11-internal-audit.md` §3 V3-3-M2 自报一致。

**已落实的边界**：

- 厂商中立接口：`MediaVisionProvider` 只接收 `SelectedFrameRequest` → 输出 `VisionObservation`；OpenAI 是首个 adapter，调度 / consent ledger / budget / evidence / cleanup 不依赖 OpenAI 字段；后续替换 Gemini / 本地 VLM 需新增独立 manifest + 独立 capability probe，不可继承 PASS。
- 上传边界：精确 8 个云视觉目标；每页最多 1 张已选帧；最长边 ≤ 1280 px；本地预缩放 + strip metadata；不上传原视频/音频/Cookie/字幕全文/未选帧/本地路径。
- 请求边界：`store=false`、不传 `previous_response_id`、不启用 files/tools/background；单帧最小结构化提示；JSON Schema 约束的输出；最多 300 output tokens。
- 成本估算：每百万 input USD 0.40、output USD 1.60；以 1280×720 上限估算 8 图像 + 300 output tokens/张，预算上限 ≈ USD 0.02（明示为预算估算、不是账单承诺）。
- 默认留存披露：明确写出「OpenAI API 输入默认不用于训练，但滥用监测日志默认可保留最多 30 天；`store=false` 关闭 Responses 应用状态保留，不等于自动获得 Zero Data Retention」。`04-stage-gate.md` 与 `06-v3-3-development-plan.md` A07/A08/A09/A14 都与该披露一致。
- 用户授权 scope 固定 `selected_frame_cloud_vision`，仅当前 task 有效；拒绝时仍允许本地 frame/OCR，VLM 状态必须为 `not_authorized`，不得以 OCR 文本冒充画面理解。
- 撤销屏障：撤销后排队但未 dispatch 的请求全部取消，新 dispatch=0；已完成回执保留 provider/model/request hash/usage，不保留 API key 或 request body。
- 凭据：`用户在 Runtime Settings 显式配置；只由 Runtime 取用，不进 Extension、task record、log 或 evidence`。

**未闭合的真实 capability probe**：

- §4「Capability Probe」两步：① 用用户 API key 发送仓库生成的中性测试图，证明 endpoint/model/image/schema/usage；② 用户另行明确批准 8 张真实帧上传。文档自报：当前未发现项目可用的 OpenAI 视觉凭据，也未获得选定帧上传授权——即 §4 步骤 ①、② 均未执行，本文档不是 provider PASS。

**Phase 8 结论：候选文档技术边界完整、自报 CAPABILITY PROBE AND USER AUTHORIZATION PENDING、未冒用 PASS。**这是真实唯一的 Major，详 §10。

---

## 9. 假绿与越权边界审查

- 文档中反复强调「不得将 OCR dependency probe 报为关键帧抽取、10/10 生产 OCR 或 VLM 已实现」、「不得将 Provider 候选文档报为真实 capability probe」、「不得使用 DeepSeek 文本 Provider、fixture、mock、页面截图 OCR 或 Agent 自身视觉代替产品 VLM」：`01-audit-request.md` §4、`09-v3-3-preimplementation-audit.md` §4、`10-dependency-freeze-plan.md` §3 DF08、`11-internal-audit.md` §2/§3 全部一致；包内未观察到 `V3-3 PASS`、`视觉理解完成`、`Mindmap 完成`、`V3 完成`、`生产质量认证` 等越权字样。
- 候选 `15-rapidocr-manifest.json` 中 `engineId="rapidocr-onnxruntime-cpu"`、`executionBackend="onnxruntime-cpu"`、`gpuRequired=false`、`offlineRequired=true` 字段清晰区分了「依赖冻结」与「产品实现」，未声明 RapidOCR 服务已被集成到 V3-3 product path。
- `16-vision-sample-registry.json` 选择规则 `all_expectedOutcome_success_in_source_order_first_8_cloud_targets` 与 `sampleCount=10`、`cloudVisionTargetCount=8` 字面闭合，未声称 10 个样本已完成 OCR 或 VLM。
- `17-rapidocr-offline-probe.json` 限定在 sealed 真实截图 + Python audit hook 网络拒绝下的引擎自检（**不是**视频关键帧、**不是** 10 个生产截图、**不是** VLM probe）。

**Phase 9 结论：PASS。** 0 越权声明，0 把依赖 probe 报为生产实现的字样。

---

## 10. 发现分级

| 等级 | 计数 | 描述 |
|---|---|---|
| **Fatal** | **0** | 无 |
| **Major** | **1** | M-2（与 `09/11-internal-audit.md` 自报一致）：VLM provider/model/credential capability probe 未执行（无真实 API key 命中真实 endpoint）、用户对 `selected_frame_cloud_vision` 高风险边界未明确批准。`12-vlm-provider-candidate.md` 自报 `CANDIDATE / CAPABILITY PROBE AND USER AUTHORIZATION PENDING`；不是 PASS，不得作为 V3-3-4 实施依据。 |
| **Minor** | **2** | `m-1` 跨平台覆盖：`onnxruntime-1.28.0` 与 `opencv-python-5.0.0.93` 的 wheel 均限定 `manylinux_2_27/2_28_x86_64`，manifest 未冻结 macOS/Windows/aarch64 对应 wheel SHA。<br>`m-2` 资产 hash by-reference：`PP-OCRv6_det_small.onnx`、`PP-OCRv6_rec_small.onnx`、`ch_ppocr_mobile_v2.0_cls_mobile.onnx` 三份资产在仓库内无 `.onnx` 实物；本审计包在 readonly 边界内无法独立重算其字节 SHA，只能与 pinned wheel 字面对账。需要带 network egress 的环境补一次端到端 wheel + asset 重算。 |

---

## 11. 独立二元决定

### 11.1 `OCR AND SAMPLE FREEZE PASS`：**PASS**

依据汇总：
- V3-2 LIMITED PASS 已独立成立；唯一前序 run 为 `v3-2-production-20261007T174158Z`，无拼接（Phase 3）。
- 10 样本完全由 `route/sample-registry-v5.json` 机械派生，分类 `6 subtitle + 3 asr + 1 multipart`、8 cloud target、10/10 source screenshot SHA 一致（Phase 4）。
- manifest canonical hash `3cff6d58…d81f` 与 sample-registry canonical hash `04a948a7…afb2` 独立重算完全一致（Phase 5）。
- 旧 `rapidocr-onnxruntime==1.4.4`（PyPI yanked / 上游退役）未被冻结；新统一包 `rapidocr==3.9.2 + onnxruntime==1.28.0 + opencv-python==5.0.0.93` 三 wheel + 三 `.onnx` 资产 bytes/SHA-256 字段已落盘；`requirements.txt` 用 `==` 钉版本（Phase 5、Phase 7）。
- offline probe 用 Python audit hook 拒绝 `socket.connect`/`socket.getaddrinfo`，源图为 sealed 真实截图 `08-BV1ZpYd66ELP.png`（SHA 独立复核一致），`peakRssKiB=426072 < 1 GiB`、`gpuUsed=false`、`threadLimit=4`、`networkAttemptCount=0`、`textCount=82`；脚本 fail-closed 短路、空文本或网络尝试即抛 `RuntimeError`，**不存在补写/假绿代码**（Phase 6）。
- 候选文档 0 越权声明：未把 probe 报为关键帧、未把 10 样本报为已完成 OCR/VLM、未把依赖封口图报为生产实现（Phase 9）。

> **结论**：`OCR AND SAMPLE FREEZE PASS` 成立。本轮 freeze 仅关闭 V3-3 的 OCR 依赖与 10 样本分母前置，不构成 V3-3 product path 任何部分已实现。

### 11.2 V3-3 是否仍必须等待 VLM 真实 capability probe 与用户显式授权：**是**

依据汇总：
- `12-vlm-provider-candidate.md` 自报 `CAPABILITY PROBE AND USER AUTHORIZATION PENDING`；本审计未发现任何伪造的 capability probe 证据、伪造的 API key 调用、伪造的 dispatch ledger。
- `09-v3-3-preimplementation-audit.md` §2 M-2 + §5 恢复条件 3、`11-internal-audit.md` §3 V3-3-M2 + §4 下一门禁 1–4、`07-v3-3-acceptance-plan.md` A07/A08/A09、`08-v3-3-threat-model.md` T04/T05/T13/T14、`06-v3-3-development-plan.md` §2 输入与前置门禁 4–5 与 §8 当前停止条件，全部一致要求：**只有真实 OpenAI API key 命中 `POST https://api.openai.com/v1/responses` 的最小中性合成图 capability probe 落盘** + **用户对 `selected_frame_cloud_vision` 显式批准** + **重建外部文档审计包** 之后，V3-3-4 与后续产品子阶段方可进入实施。
- 风险 T13 明确禁止「未冻结 Provider 静默切换」；T04 明确禁止「无授权上传私有画面」；T14 明确禁止「费用或用量假绿」。本审计既未发现违反，也未发现闭合——只有未触发。

> **结论**：V3-3 **仍然阻塞**于：① 真实 VLM capability probe（用户 API key 命中 frozen endpoint/model、最小中性合成图、provider/model/request hash/usage 落盘、secret scan = 0）；② 用户对 `selected_frame_cloud_vision` 高风险边界的显式授权；③ 不超过 20 文件平铺外部审计包重建并独立文档审查 Fatal=0/Major=0。在这三项闭合前，V3-3 实施继续 `NO-GO`，不得声明 V3-3、V3-3 视觉产品路径或云视觉已完成。

### 11.3 依赖冻结 vs 产品实现分离

| 维度 | 本轮 freeze 已闭合 | 仍属产品实现 |
|---|---|---|
| OCR 引擎、模型、许可、wheel/资产 hash | ✅ | — |
| 10 样本分母 + 6+3+1 分类 + 8 cloud target | ✅ | — |
| 离线网络/资源/真实性门禁 | ✅ | — |
| V3-3 product 代码、契约实现、A01..A16 验证 | — | ❌（OPEN） |
| 真实帧抽取（FFmpeg/OpenCV 子进程） | — | ❌（OPEN） |
| 真实本地 OCR 在 10 样本上 10/10 通过 | — | ❌（OPEN） |
| 真实 VLM 在 ≥8 样本上完成授权 dispatch | — | ❌（OPEN） |
| 逐 dispatch consent 绑定 + 撤销后 0 dispatch | — | ❌（OPEN） |
| 视觉证据合并 + 清理 barrier | — | ❌（OPEN） |

**Phase 11 结论**：依赖冻结 PASS 与 V3-3 产品实现 PASS 是两条独立轨道；本轮 trace 仅授权前 4 项（依赖冻结）闭合，后 5 项必须由 V3-3-1..-7 实施并通过新一轮独立审计方可取得。

---

## 12. 审计员独立声明

**审计员身份**：独立只读审计员，跨 reader session，仅依赖本审计包与 repo 内 sealed evidence 的 sha256sum / Python / grep / cmp / find 校验。

**审计覆盖摘要**：
- 19/19 载荷 SHA-256 字面对账 ✅
- 19/19 包副本与权威源字节一致 ✅
- V3-2 LIMITED PASS 自限边界清晰，未扩大为 V3-3 PASS ✅
- 10 样本独立派生 + 10/10 截图 SHA 重算一致 ✅
- manifest / sample-registry canonical hash 重算一致 ✅
- 离线 probe 代码 Python audit hook + sealed 真实截图 + fail-closed 短路 + 0 网络尝试 + <1 GiB RSS ✅
- VLM 候选文档 8 帧 / 1280 px / `store=false` / 无 tools / 30 天披露 / 用户授权 scope / 凭据隔离 / 自报 CANDIDATE & PENDING ✅
- 0 越权声明、0 假绿、0 跨 run 拼接 ✅

**最终二元决定**：

> 1. **`OCR AND SAMPLE FREEZE PASS`：PASS。** 10 样本分母、RapidOCR 依赖、离线自检门禁已闭合。仅关闭 V3-3 实施前的 OCR/样本前置；不代表 V3-3、OCR 产品路径、云 VLM 或 V3 整体已实现。
>
> 2. **V3-3 仍必须等待**：① 真实 VLM capability probe（用户 API key 命中 frozen endpoint/model，最小中性合成图，provider/model/request hash/usage 落盘，secret scan=0）；② 用户对 `selected_frame_cloud_vision` 高风险边界的显式授权；③ 不超过 20 文件平铺外部审计包重建并独立文档审查 Fatal=0/Major=0。在这三项闭合前，V3-3 实施继续 `NO-GO`；V3-3、V3-3 视觉产品路径、V3-3 云视觉、Media Mindmap、V3 完成均不得声明。
>
> 3. **依赖冻结 与 产品实现 是两条独立轨道**。本轮 freeze PASS 不构成 V3-3 产品 PASS；V3-3-1..-7 实施后必须由新一轮独立审计独立判定。

发现分级：Fatal=0 / Major=1 / Minor=2。

---

**审计报告结束。**

附：本审计全程仅执行 sha256sum / Python（json/hashlib/pathlib）/ cmp / find / grep 只读操作；未运行 Chrome、模型示例、yt-dlp、ffmpeg、RapidOCR、云 VLM；未读取凭据、未上传图像、未修改任何审计包或源文件；未触碰 `/mnt/c/workspace/navia` 之外的 Windows 用户目录或 Cookie 文件。审计员身份与 V3-2 出门审计、`09/11-internal-audit.md` 各自独立，互不引用且未复用结论。