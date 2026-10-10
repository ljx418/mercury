# V3-3 Capability Verifier 独立只读文档审查

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md` 与 `01-audit-request.md`。
审查对象：19 项载荷 + 本 manifest = 20 个平铺文件，重点是 `12-capability-probe.py`、`13-capability-probe-tests.py`、`14-capability-probe-dry-run.json` 与 `11-vlm-provider-candidate.md`。
审查模式：只读；只使用 `sha256sum`、Python 标准库与 `jsonschema`。**本审查未运行网络/云端请求、未读取或请求 API key、未上传中性图或真实帧、未运行 Chrome/Runtime/产品实现、未运行 `12-capability-probe.py --execute-neutral-probe`。**

---

## 0. 二元决策原话（来自 `01-audit-request.md` 第 5 节）

> 1. V3-1.4/V3-2 前置是否仍有效。
> 2. OCR/sample freeze 是否仍成立。
> 3. V3-3 是否仍只能等待真实 capability probe、凭据与用户高风险授权。

---

## 1. 19 项载荷 SHA-256 与权威源字节对账

使用 `sha256sum` 重新计算 `docs/active/project/external-audit-package/` 内 19 个文件，再将其与权威源路径做 `sha256sum` 对账（不读取 `AUDIT_MANIFEST.md` 自身）：

| # | 文件 | 重算 SHA-256 | Manifest 期望 | 字节一致 |
|---|---|---|---|---|
| 01 | `01-audit-request.md` | `17fde44b5292b033ab66dc07e899d933519bed9b57a38dee7eb371668b192dfc` | `17fde44b…2dfc` | ✅ |
| 02 | `02-prd.md` | `c277d8d67f9caf9e61349752007b2942e9ba5949ca502e3b920bbf009166366c` | `c277d8d6…366c` | ✅ |
| 03 | `03-architecture.md` | `a56b5a57c83d05d970c44cb349f4554777f65f8b6c8a2d8bd61f4f29edb7db9a` | `a56b5a57…db9a` | ✅ |
| 04 | `04-stage-gate.md` | `67712c9c3597aa25149e2476fac9a15f63b324cb3583b9f8049aeba676d40bd4` | `67712c9c…0bd4` | ✅ |
| 05 | `05-v3-3-development-plan.md` | `f010eb761fe948672629572ab54e28d4ccebc40243a49dd99b71589b47d4d336` | `f010eb76…d336` | ✅ |
| 06 | `06-v3-3-acceptance-plan.md` | `3882c3d4b26cded0af3ac713c7ebd1e3a68be5413af5f01591cc6211ee4942a8` | `3882c3d4…42a8` | ✅ |
| 07 | `07-v3-3-threat-model.md` | `c2c5c40dc79b12f83e4d33c6359a21d562091d7caa681da30b6c9bbd614961e4` | `c2c5c40d…61e4` | ✅ |
| 08 | `08-v3-3-preimplementation-audit.md` | `5b195bb73bb3a517094ae0bf3cd268665d2d04cde4da1acdf2eb947264ed6651` | `5b195bb7…d6651` | ✅ |
| 09 | `09-dependency-freeze-plan.md` | `62adbc7d8cbe4531f51f76fc5777e2b5b4704ed06021e4c0bdf1aaf17a1bcddd` | `62adbc7d…cddd` | ✅ |
| 10 | `10-post-external-audit-closure.md` | `7a2e94fb0ffb6fa7d817b99cffbade71ed2d1727b19b8c087a139cc8217bf97f` | `7a2e94fb…f97f` | ✅ |
| 11 | `11-vlm-provider-candidate.md` | `91f2ef0cf6f1fe4f4b50b5e9a914f456d14e566526e31bccff83eca77129bc29` | `91f2ef0c…bc29` | ✅ |
| 12 | `12-capability-probe.py` | `0044cefbc6dab2107eb2535d7ff07c172a16dc9d4005fefd9350012623696fa2` | `0044cefb…6fa2` | ✅ |
| 13 | `13-capability-probe-tests.py` | `0d7941998cb065f3e0d9feadcde11b8be51ac64e6c7d3fa8a15347067322d58d` | `0d794199…2d58d` | ✅ |
| 14 | `14-capability-probe-dry-run.json` | `34262ade8b76fc89089dc2af0623b19ca04f7bca8ae0074443becfd4c84fed7a` | `34262ade…ed7a` | ✅ |
| 15 | `15-rapidocr-manifest.json` | `fe7f49aebcfed785557d607282ce8817e280d7a04e639d5722497d0db6d41e08` | `fe7f49ae…1e08` | ✅ |
| 16 | `16-vision-sample-registry.json` | `42c745d99bdbffcf41f261287393a08779cb99dee0028fdaea717af29dcfeb95` | `42c745d9…feb95` | ✅ |
| 17 | `17-rapidocr-offline-probe.json` | `0721c3997080953b23c5663e38dae28e0a9e1a7977072a54ffd0acf34d68fbea` | `0721c399…8fbea` | ✅ |
| 18 | `18-vision-evidence.schema.json` | `570485e0e41edafa5d2ad89acbcc6495293daf57ee930638cc9e54d2c25a9128` | `570485e0…9128` | ✅ |
| 19 | `19-v3-2-independent-exit-audit.md` | `15d60e9ed9dec4133eb3d77ccd032e042f8cd4d455b145ef705344eb40f695a7` | `15d60e9e…95a7` | ✅ |

19/19 SHA-256 全部匹配 `AUDIT_MANIFEST.md`；19/19 与权威源字节级一致（`diff` 为空）。**`AUDIT_MANIFEST.md` 自身不参与自对账。**

**Phase 1 结论：PASS。**

---

## 2. capability verifier 源码独立分析（`12-capability-probe.py`）

### 2.1 默认 no-network / 显式 execute 开关

`main()` 第 196–209 行：默认行为为生成中性图、构造 payload、写 `executed=False / passed=False / failureCode="VISION_CAPABILITY_PROBE_NOT_EXECUTED"` 报告，**不调用 `urllib.request` 任何联网接口**。`--execute-neutral-probe` 是显式 `store_true` 参数；未提供时整个 main 函数不会进入 `if args.execute_neutral_probe:` 分支（L210–230），`execute_request()` 永远不会被调用。即默认无网络、显式开关。

### 2.2 缺凭据 fail-closed

L211–215：进入 `--execute-neutral-probe` 分支后，`api_key = os.environ.get(args.credential_env, "")`，`if len(api_key) < 20: failureCode = "VISION_CREDENTIAL_MISSING"; write_report(...); return 2`。20 字符阈值与 `13-capability-probe-tests.py` L63–69 一致，且 `test_execute_fails_closed_without_credential` 断言 `exit=2`、`executed=False`、`failureCode="VISION_CREDENTIAL_MISSING"`。**任何缺凭据尝试都被显式拒绝并以非零退出。**

### 2.3 报告再发布（report redaction）

`probe_manifest()`（L164–185）只输出 schema 元、provider/model/base/endpoint、image 摘要（kind/mime/byteLength/sha256/containsUserContent=False）、request 摘要（sha256/store/imageDetail/maxOutputTokens/toolsEnabled=False）。**未写出 API key、Authorization、Bearer、原始请求体、原始响应体或 data URI**。

`dry-run`（`14-capability-probe-dry-run.json`）独立扫描：

| 字符串 | 出现次数 |
|---|---|
| `authorization` | 0 |
| `bearer` | 0 |
| `api_key` | 0 |
| `sk-` | 0 |
| `data:image` | 0 |
| `previous_response_id` | 0 |

`write_report()` L188–192 将产物写入并 `chmod(0o600)`。`build_request()` L65–92 构造 `data:image/png;base64,...` 仅用于进程内 payload，**不进入 `probe_manifest`**。`parse_response()` L123–139 仅保留 `id` 的 SHA-256、`model`、`usage`、验过的 `observation` 和 canonical `responseSha256`；原始响应字段（如 `output_text`、`choices` 等）均被丢弃。

### 2.4 精确 provider/model/request/output/usage 约束

源码冻结的常量（L22–26）与 `11-vlm-provider-candidate.md` 第 1 节字段一一对应：

| 字段 | 源码值 | 文档候选值 | 一致 |
|---|---|---|---|
| `PROVIDER_ID` | `openai-responses-vision` | `openai-responses-vision` | ✅ |
| `MODEL_ID` | `gpt-4.1-mini-2025-04-14` | `gpt-4.1-mini-2025-04-14` | ✅ |
| `API_BASE` | `https://api.openai.com/v1` | `https://api.openai.com/v1` | ✅ |
| `ENDPOINT` | `/responses` | `POST /responses` | ✅ |
| `imageDetail` | `low`（L79） | `low` | ✅ |
| `store` | `False`（L90） | `store=false` | ✅ |
| `max_output_tokens` | `300`（L91） | ≤300 output tokens | ✅ |
| `tools/files/previous_response_id` | 不出现 | 不启用 | ✅ |
| Structured Output | `text.format.type=json_schema` `strict=True`（L82–89） | JSON Schema 约束 | ✅ |
| `parse_response` 模型比对 | `model != MODEL_ID` 抛 `VISION_MODEL_MISMATCH`（L127） | exact model | ✅ |
| `parse_response` usage 比对 | 必须含整型 `input_tokens/output_tokens/total_tokens`，否则 `VISION_USAGE_MISSING`（L129–131） | usage 完整 | ✅ |
| `parse_response` 响应状态 | `status != "completed"` 抛 `VISION_RESPONSE_INCOMPLETE`（L124–125） | exact response | ✅ |
| 重试 | 仅 429 与 5xx 最多 1 次抖动重试；4xx 不重试（L150–158） | 4xx 不重试；429/5xx ≤1 | ✅ |
| 超时 | `timeout_seconds=30.0`（L142） | 30 s | ✅ |

**注**：源码同时固定 `response_schema()`（L47–62）要求 `summary(1..240)`、`containsText(bool)`、`dominantColors(1..4 strings)` 且 `additionalProperties=False`，由 `validate_observation()`（L110–120）严格校验。

### 2.5 中性图保证

`neutral_probe_png()`（L33–44）：固定 256×128 RGB checkerboard（4 色 + 每 64 像素切换），生成确定性 PNG；不读取用户内容、不下载、不拼接字幕。`manifest["image"].containsUserContent = False`（L176）由 manifest 直接断言。dry-run 中实际生成图 `byteLength=589`、SHA-256 `521fa8f0…eeb`，与 `canonical_sha256(payload)=08460e57…caa` 字面回放一致（L95–97）。

### 2.6 测试覆盖（`13-capability-probe-tests.py`）

四类断言（4/4）：

| 测试 | 关键断言 |
|---|---|
| `test_neutral_probe_request_is_fixed_and_contains_no_user_content` | `model`、`store=False`、`max_output_tokens=300`、`detail=low`、`containsUserContent=False`、`toolsEnabled=False` |
| `test_response_parser_requires_exact_model_usage_and_typed_output` | `usage.total_tokens`、`observation.containsText=False`、`model` 不匹配 → `VISION_MODEL_MISMATCH` |
| `test_dry_run_writes_redacted_fail_closed_report` | 报告 `executed=False/passed=False/failureCode=VISION_CAPABILITY_PROBE_NOT_EXECUTED`；不含 `authorization`、`bearer`、`api_key` |
| `test_execute_fails_closed_without_credential` | 无 `OPENAI_API_KEY` 时 `exit=2`、`executed=False`、`failureCode=VISION_CREDENTIAL_MISSING` |

测试断言与源码语义 1:1 对齐，且没有把 `passed` 字段设为 `True` 的成功路径。

**Phase 2 结论：PASS。** verifier 默认无网络、显式开关、缺凭据 fail-closed、报告无敏感字段、provider/model/request/output/usage 全部按文档冻结。

---

## 3. dry-run 与测试 exit 0 的假绿风险评估

### 3.1 `passed=false` 是机器可见硬事实

`main()` L207 显式写 `report["passed"] = False`；最终 L231–232 的退出码逻辑：

```python
return 0 if report["passed"] or not args.execute_neutral_probe else 1
```

- **dry-run 路径**（无 `--execute-neutral-probe`）：`args.execute_neutral_probe` 为 `False` → `not args.execute_neutral_probe` 为 `True` → 返回 `0`。
- **执行路径**（带 `--execute-neutral-probe`）：写 `passed=True` 时 `report["passed"] or ...` 为 `True` → 返回 `0`；写 `passed=False` 时返回 `1`。

dry-run 与 `passed=False` **共存**：`exit=0` 仅表示「未执行」，并不等于「PASS」。`14-capability-probe-dry-run.json` 字面同时持 `executed=false / passed=false / failureCode="VISION_CAPABILITY_PROBE_NOT_EXECUTED"`。任何下游消费方只看退出码将**误判为绿色**；只看 `passed` 字段则保持红色。`08-v3-3-preimplementation-audit.md` §4、M-2 与 `10-post-external-audit-closure.md` §3 明确这一点。

### 3.2 假绿的具体触发面

仅当某消费方：
1. 只读 verifier 进程退出码，不读产物 JSON；或
2. 把 `--execute-neutral-probe` 缺席时的「未执行」与「能力通过」混淆。

verifier 自身**未提供任何「dry-run = PASS」路径**：dry-run 报告里 `passed=false`、`failureCode` 非空、`executedAt=null`；`write_report()` 写出 `chmod 0o600` 的物理文件（不是 stdout-only），下游必须读 `passed` 才能认定结论。本审查独立检查 19 个 JSON 文件，发现仅 `17-rapidocr-offline-probe.json` 含 `passed=true`（RapidOCR 离线 OCR 自检，非 VLM capability），其它 18 个 JSON 均无 `passed=true`。

### 3.3 `passed=false` 的硬事实再确认

源码层：
- L207 初始化 `passed=False`。
- L227 在 execute 成功路径才置 `passed=True`（且同时写 `executed=True`、`failureCode=None`）。
- 没有第二路径写入 `passed=True`。

测试层：
- `test_dry_run_writes_redacted_fail_closed_report` 断言 dry-run 报告 `passed=False`。
- `test_execute_fails_closed_without_credential` 断言缺凭据 `passed` 字段不进入 `True` 分支（`executed=False`）。

**Phase 3 结论：PASS。** dry-run 与测试 exit 0 在当前 verifier 设计下**不能被升级为 capability PASS**；`passed=False` 是机器可读字段且不可绕过。`01-audit-request.md` 第 3.6 条要求的「确认 `passed=false` 是机器可见硬事实」成立。

---

## 4. V3-1.4 / V3-2 前置门禁边界

### 4.1 候选自报 vs. 文档边界

`01-audit-request.md` 第 2 节自报：

> V3-1.4 已由当前工作树真实 Chrome/Runtime 再验证 7/7，V3-2 唯一生产 run 已取得独立 `LIMITED PASS`。

`04-stage-gate.md` 顶部与 §21 同时声明：

> V3-1.3 PASS / SenseVoice development baseline / V3-2-1 LIMITED PASS / V3-2-2 Route B3 LIMITED PASS / V3-2-3 LIMITED PASS / V3-2-4 IMPLEMENTATION CANDIDATE + ACCEPTANCE FAIL / V3-2-5..7 BLOCKED。
>
> V3-3 当前为 `DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / IMPLEMENTATION NO-GO`。

`19-v3-2-independent-exit-audit.md` §13 末尾明确：

> **V3-3 是否可进入既有实施前门禁：是。** 本审计仅基于事实清单判定 V3-2 LIMITED PASS 的前置条件已经满足；V3-3 进入实施前门禁**仍受 `v3-3-*-preimplementation-audit.md` 等既有落盘文档约束**，本审计不豁免 V3-3 自己的前置门禁，也不对 V3-3 文档做实质背书。
>
> **禁止声明**：本审计报告**不构成**「V3 完成」「视频理解完成」「图文大纲完成」「Media Mindmap 完成」「生产质量认证」声明。

### 4.2 本审查的边界判定

- V3-1.4 LIMITED PASS 与 V3-2 LIMITED PASS 由 `19-v3-2-independent-exit-audit.md` 独立复算并取得 `Fatal=0/Major=0/Minor=0`，本审查未重做实施级复算（任务范围限于 capability verifier 增量审查）。
- V3-2 PASS 仅解锁「V3-3 进入既有实施前门禁」，**不豁免 V3-3 自己的前置门禁**：
  - `08-v3-3-preimplementation-audit.md` §0 仍维持 `DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / IMPLEMENTATION NO-GO`。
  - `10-post-external-audit-closure.md` §3 维持 `OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`。
- 新增 capability verifier **不改变** V3-3 实施状态；它只关闭 M-2 的「缺少可复现 probe 工具」子项，不关闭「真实 provider/model/credential capability probe + 用户高风险授权」整项。

**Phase 4 结论：PASS。** V3-1.4/V3-2 前置仍有效；未被扩大为 V3 总体通过、未被扩大为 V3-3 产品实施 PASS。

---

## 5. OCR / sample freeze 边界

### 5.1 10 样本 registry

`16-vision-sample-registry.json`：

- `sampleCount = 10`、`cloudVisionTargetCount = 8`、`classificationCounts = {subtitle: 6, asr: 3, multipart: 1}`。
- 前 8 个样本 `cloudVisionTarget=true`、后 2 个 `cloudVisionTarget=false`，与 `08-v3-3-preimplementation-audit.md` §1「前 8 个按源顺序固定为云 VLM 目标」一致。
- `sourceRegistrySha256 = d683d59f…0aab`，与 V3-2 sealed `route/sample-registry-v5.json` 字面一致（重算同）。
- `selectionRule = "all_expectedOutcome_success_in_source_order_first_8_cloud_targets"`，规则确定。

### 5.2 RapidOCR 冻结

`15-rapidocr-manifest.json`：

| 字段 | 值 |
|---|---|
| `engineId` | `rapidocr-onnxruntime-cpu` |
| `engineVersion` | `3.9.2` |
| `executionBackend` | `onnxruntime-cpu` |
| `offlineRequired` | `true` |
| `gpuRequired` | `false` |
| `threadLimit` | `4` |
| packages | `rapidocr 3.9.2` (Apache-2.0) + `onnxruntime 1.28.0` (MIT) + `opencv-python 5.0.0.93` (Apache-2.0) |
| assets | 3 份 ONNX：`PP-OCRv6_det_small` (9929594 B) / `PP-OCRv6_rec_small` (21234383 B) / `ch_ppocr_mobile_v2.0_cls_mobile` (585532 B) |
| `contentSha256` | `3cff6d58…d81f` |

旧 `rapidocr-onnxruntime==1.4.4` 因官方退役且 PyPI yanked 而未被冻结（`09-dependency-freeze-plan.md` §2）。

### 5.3 离线 OCR probe

`17-rapidocr-offline-probe.json`：

- `passed = true`、`engineManifestSha256 = 3cff6d58…d81f`（与 manifest 字面一致）。
- `sourceSampleId = v3-sample-08`、`sourceImageSha256 = f74c0e622…16f4`（与 sample registry 字面一致）。
- `networkPolicy = python_audit_hook_deny_socket_connect_and_getaddrinfo`、`networkAttemptCount = 0`、`gpuUsed = false`、`threadLimit = 4`。
- `textCount = 82`、`meanConfidence = 0.97391`、`peakRssKiB = 426072`（< 1 GiB）、`wallClockSeconds = 1.408202`。

`09-dependency-freeze-plan.md` DF06/DF07、验收 DF01..DF08 全部 PASS。

### 5.4 V3-2 独立审计支撑

`19-v3-2-independent-exit-audit.md` 给出 V3-2-7 唯一生产 run `v3-2-production-20261007T174158Z` LIMITED PASS，结论 `Fatal=0/Major=0/Minor=0`。样本 registry 的 `sourceRunId` 与 `sourceRegistryPath` 均指向该 sealed run；本审查未在样本文件、manifest 或 probe 中发现旧失败 run id（`164857Z`、`165511Z`、`170132Z`、`170822Z`、`172103Z`、`173526Z`）的引用（与 V3-2 审计一致的隔离原则）。

**Phase 5 结论：PASS。** OCR / sample freeze 仍成立：10 个样本的来源、分类、确定性规则与 V3-2 sealed run 一致；RapidOCR 3.9.2 资产冻结与离线 probe PASS；网络/GPU/线程边界不变。

---

## 6. Vision evidence schema 二次校验（`18-vision-evidence.schema.json`）

| 字段 | 约束 | 一致 |
|---|---|---|
| `SamplingPolicy.candidateFrameLimit` | `const 24` | ✅ |
| `SamplingPolicy.selectedEvidenceLimit` | `const 12` | ✅ |
| `SamplingPolicy.cloudVisionFrameLimit` | `const 8` | ✅ |
| `SamplingPolicy.maxDimensionPx` | `const 1280` | ✅ |
| `SamplingPolicy.rawVideoUploadAllowed` | `const false` | ✅ |
| `SamplingPolicy.algorithm` | `const scene-change-plus-timeline-budget/v1` | ✅ |
| `ConsentReceipt.scope` | `const selected_frame_cloud_vision` | ✅ |
| `ConsentReceipt.state` | `enum {granted, revoked, not_granted}` | ✅ |
| `ConsentReceipt.authorizedDispatchCount` | `0..8` | ✅ |
| `ConsentReceipt.postRevocationDispatchCount` | `const 0` | ✅ |
| `ConsentReceipt.consentCheckedPerDispatch` | `const true` | ✅ |
| `VisionObservation.usage.inputImageCount` | `const 1`（VLM 单帧） | ✅ |
| `VisionObservation.status` | `const succeeded`、`failureCode: null`（成功观察不可有失败码） | ✅ |
| `CleanupReceipt.residualNonEvidenceFrameCount` | `const 0`、`pendingOutboundRequestCount: const 0` | ✅ |
| `additionalProperties: false` | 全文 | ✅ |

`18-vision-evidence.schema.json` 自身 Draft 2020-12 元 schema 通过 `Draft202012Validator.check_schema(schema)`（仅元，不跑业务实例）。其内部 `oneOf`、`$ref`、`pattern` 全部闭合；`v3-media-vision-evidence/v1` 标题与权威路径 `contracts/v3_media_vision_evidence_v1.schema.json` 字面一致。

**Phase 6 结论：PASS。** Schema 维持 24/12/8/1280、`selected_frame_cloud_vision` 唯一 scope、单帧上传、`postRevocationDispatchCount=0` 等硬约束。

---

## 7. 防假绿交叉验证

- `01-audit-request.md` §4「禁止扩大」三条明确：不得跑 `--execute-neutral-probe`、不得把 dry-run/测试/fixture/当前 Agent OCR probe 报为真实 PASS、不得把中性图 capability probe 授权等同真实帧上传授权。本审查未触发任何一条。
- `08-v3-3-preimplementation-audit.md` §4：Schema / fixture / 合同测试只能证明合同可表达，不证明产品实现。本审查同意。
- `11-vlm-provider-candidate.md` §5：`MediaVisionProvider` 替换 provider 时必须新增独立 manifest/capability probe，不得继承 PASS。本审查同意。
- `05-v3-3-development-plan.md` §6 FailureCode 闭集与 `06-v3-3-acceptance-plan.md` §1 A01..A16 维持。

**Phase 7 结论：PASS。** 未发现新增假绿路径。

---

## 8. 发现分级

| 等级 | 计数 | 描述 |
|---|---|---|
| Fatal | **0** | 无 |
| Major | **0** | 无 |
| Minor | **0** | 无 |

**新增致命/重大项**：无。
**保留未关闭的 Major**（来自上游 `08-v3-3-preimplementation-audit.md` M-2 与 `10-post-external-audit-closure.md`）：真实 VLM provider/model/credential capability probe + 用户 `selected_frame_cloud_vision` 高风险授权——本审查未扩大或缩小该 Major，仅验证「verifier 工具已就位」不构成该 Major 关闭证据。
**Minor 候选**：无。`04-stage-gate.md` 维持 V3-3 `DOCUMENT PASS`；`10-post-external-audit-closure.md` 已闭环先前 2 项 Minor（m-1 平台支持 addendum、m-2 ONNX 权重不提交的有意供应链边界）。

---

## 9. 三个独立决定

### 9.1 V3-1.4 / V3-2 前置是否仍有效

> **维持。** V3-1.4 LIMITED PASS（7/7 真实 Chrome 再验证）与 V3-2 LIMITED PASS（`v3-2-production-20261007T174158Z`，`19-v3-2-independent-exit-audit.md` Fatal=0/Major=0/Minor=0）均有效，仅解锁「V3-3 进入既有实施前门禁」，不豁免 V3-3 自己的前置门禁，不构成 V3 总体 PASS、视频理解 PASS、图文大纲 PASS 或 Media Mindmap PASS。

### 9.2 OCR / sample freeze 是否仍成立

> **维持。** RapidOCR 3.9.2 + onnxruntime 1.28.0 + opencv-python 5.0.0.93 三方 wheel 与三份 ONNX 资产 bytes/SHA-256 冻结；离线 probe `passed=true` 且 `networkAttemptCount=0 / gpuUsed=false / threadLimit=4 / peakRss<1 GiB`；10 样本 registry 从 V3-2 sealed `sample-registry-v5.json` 派生（`d683d59f…0aab` 字面一致），前 8 个为云 VLM 目标，分类 `6 subtitle + 3 asr + 1 multipart`，未引用任何失败 run id。

### 9.3 V3-3 是否仍只能等待真实 capability probe、凭据与用户高风险授权

> **维持。** 新增 `v3_vision_capability_probe.py` 与 4 项离线测试、1 份 dry-run 报告构成**可复现 probe 工具**，但 verifier 自身 `passed=false / failureCode="VISION_CAPABILITY_PROBE_NOT_EXECUTED"`、无凭据、`exit 0` 仅表示「未执行」、`store=false / detail=low / no tools / max 300 output tokens / Structured Output / exact model & usage` 全部冻结与 `11-vlm-provider-candidate.md` 一致——这些**只关闭 M-2 的「缺少可复现 probe 工具」子项**，**不关闭**整项 M-2（即真实 provider/model/credential capability probe + `selected_frame_cloud_vision` 用户高风险授权）。V3-3 实施仍保持 `IMPLEMENTATION NO-GO`。

---

## 10. 审计员独立声明 + 边界声明

**审计员身份**：独立只读审计员，跨 reader session；仅依赖本审计包与 Python 标准库（`json`、`hashlib`、`re`、`subprocess`）+ `sha256sum`。本审查：

- 未运行任何网络/云端请求，未读取、未请求、未打印任何 API key / Cookie / Authorization / Bearer / `sk-*` 字符串；
- 未运行 `--execute-neutral-probe` 或任何产品实现（Runtime、Chrome、yt-dlp、ffmpeg、SenseVoice、OpenCV、Browser MCP 等）；
- 未读取 `/mnt/c/workspace/navia` 之外的 Windows 用户目录或 Cookie 文件；
- 未运行 `12-capability-probe.py`、`13-capability-probe-tests.py`、`11-verifier.py`、`production-runner.mjs` 等任一脚本；
- 未修改审计包内任何文件、未修改主工作树、未修改既有 run、seal、manifest、source 或 package；
- 未把 verifier、dry-run、fixture、当前 Agent 视觉或 OCR probe 报成真实 VLM capability PASS；
- 未把中性图 capability probe 授权等同于真实选定帧上传授权；
- 未把 V3-1.4/V3-2 LIMITED PASS 扩大为 V3 总体 PASS；
- 未签署任何 H01..H10 人工判断。

**最终二元结论**：

> 1. **V3-1.4 / V3-2 前置仍有效**。
> 2. **OCR / sample freeze 仍成立**。
> 3. **V3-3 仍只能等待真实 capability probe、凭据与用户高风险授权**。

Fatal=0 / Major=0 / Minor=0。`OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO` 维持。

---

**审计报告结束。**
