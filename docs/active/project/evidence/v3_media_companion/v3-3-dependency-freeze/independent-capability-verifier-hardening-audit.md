# V3-3 Capability Verifier 加固独立审计

日期：2026-10-08。审查对象：`docs/active/project/external-audit-package/` 内 19 项载荷 + `AUDIT_MANIFEST.md`，审查重点为 `12-capability-probe.py`（中性图 capability verifier）的退出码加固、凭据门禁、脱敏和约束静态证明。
审查模式：只读、隔离解包到 `/tmp/icva_audit/`、`sha256sum`、静态分析与字节级 import、pytest 离线运行；不发起任何云端请求、不读取 API key、不上传中性图或真实帧、不运行产品 Runtime/Chrome/OCR/VLM、不修改主工作树、历史 run、seal 或既有审计报告。

---

## 0. 审查入口与目标

依据 `01-audit-request.md`（`docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/v3-3-capability-verifier-independent-audit-request.md`），本轮只解决以下问题：

1. capability verifier 是否只构造中性图、默认不联网、缺凭据 fail closed；
2. verifier 是否精确约束 provider/model/apiBase/endpoint、image detail、`store=false`、无 tools、output schema、usage、exact model response；
3. 独立执行 dry-run 是否得 exit 3；缺凭据分支是否得 exit 2；是否可证明只有真实 probe 成功路径返回 exit 0，且 `passed=false` 仍为机器可见硬事实；
4. 报告是否不含 key、Authorization、Bearer、data URI 或原始请求体；
5. V3-1.4/V3-2 前置、OCR/sample freeze 边界是否仍成立；
6. V3-3 实施出门是否仍只能等待真实中性图 capability probe、凭据与用户对真实选定帧上传的显式授权。

---

## 1. 19 项载荷 SHA-256 复算 + 与权威源字节一致性

`sha256sum` 对 `docs/active/project/external-audit-package/01..19` 全部 19 文件独立复算，并与 `AUDIT_MANIFEST.md` 表 1 字面对账；再将包副本逐文件与权威源路径 sha256 对账（19 路径全部存在）。

| # | 文件 | 复算 SHA-256（前 16） | Manifest | 权威源 | 双闭合 |
|---|------|---|---|---|---|
| 01 | `01-audit-request.md` | `91f6530093590566` | ✅ | ✅ | ✅ |
| 02 | `02-prd.md` | `c277d8d67f9caf9e` | ✅ | ✅ | ✅ |
| 03 | `03-architecture.md` | `a56b5a57c83d05d9` | ✅ | ✅ | ✅ |
| 04 | `04-stage-gate.md` | `67712c9c3597aa25` | ✅ | ✅ | ✅ |
| 05 | `05-v3-3-development-plan.md` | `dbc65013791317b6` | ✅ | ✅ | ✅ |
| 06 | `06-v3-3-acceptance-plan.md` | `3882c3d4b26cded0` | ✅ | ✅ | ✅ |
| 07 | `07-v3-3-threat-model.md` | `c84083c1a758e249` | ✅ | ✅ | ✅ |
| 08 | `08-v3-3-preimplementation-audit.md` | `5b195bb73bb3a517` | ✅ | ✅ | ✅ |
| 09 | `09-dependency-freeze-plan.md` | `62adbc7d8cbe4531` | ✅ | ✅ | ✅ |
| 10 | `10-post-external-audit-closure.md` | `664eddb3201346e7` | ✅ | ✅ | ✅ |
| 11 | `11-vlm-provider-candidate.md` | `91f2ef0cf6f1fe4f` | ✅ | ✅ | ✅ |
| 12 | `12-capability-probe.py` | `fd776624efc101c0` | ✅ | ✅ | ✅ |
| 13 | `13-capability-probe-tests.py` | `09175468300ad546` | ✅ | ✅ | ✅ |
| 14 | `14-capability-probe-dry-run.json` | `34262ade8b76fc89` | ✅ | ✅ | ✅ |
| 15 | `15-rapidocr-manifest.json` | `fe7f49aebcfed785` | ✅ | ✅ | ✅ |
| 16 | `16-vision-sample-registry.json` | `42c745d99bdbffcf` | ✅ | ✅ | ✅ |
| 17 | `17-rapidocr-offline-probe.json` | `0721c3997080953b` | ✅ | ✅ | ✅ |
| 18 | `18-vision-evidence.schema.json` | `570485e0e41edafa` | ✅ | ✅ | ✅ |
| 19 | `19-v3-2-independent-exit-audit.md` | `15d60e9ed9dec413` | ✅ | ✅ | ✅ |

19/19 SHA-256 与 `AUDIT_MANIFEST.md` 完全一致；19/19 包副本与权威源字节级一致。`AUDIT_MANIFEST.md` 自身不参与自对账。

**Phase 1 结论：PASS。**

---

## 2. 独立执行 dry-run 并断言退出码 3

命令（无 `--execute-neutral-probe`，仅指定 `/tmp` 输出）：

```
python3 docs/active/project/external-audit-package/12-capability-probe.py \
  --output /tmp/icva_audit/dry-run.json
```

实测：`exit=3`、报告文件 `/tmp/icva_audit/dry-run.json` 字段如下：

| 字段 | 值 | 期望 | OK |
|---|---|---|---|
| `executed` | `false` | false | ✅ |
| `passed` | `false` | false | ✅ |
| `failureCode` | `VISION_CAPABILITY_PROBE_NOT_EXECUTED` | VISION_CAPABILITY_PROBE_NOT_EXECUTED | ✅ |
| `executedAt` | `null` | null | ✅ |
| `image.kind` | `generated_neutral_checkerboard` | generated_neutral_checkerboard | ✅ |
| `image.containsUserContent` | `false` | false | ✅ |
| `image.byteLength` | `589` | 589（脚本确定性） | ✅ |
| `image.sha256` | `521fa8f06e101b14c0f1b85e329b651e66ecf80406aa64021ba47ac6745e8eeb` | 与包内 dry-run fixture 一致 | ✅ |
| `request.store` | `false` | false | ✅ |
| `request.imageDetail` | `low` | low | ✅ |
| `request.toolsEnabled` | `false` | false | ✅ |
| `request.maxOutputTokens` | `300` | 300 | ✅ |

脱敏扫描（`grep -i 'authorization\|bearer \|api_key\|sk-\|data:image'` 对整文件）：**0 命中**。`passed=false` 在文件第 23 行以机器可见 JSON 字段硬存在。

**Phase 2 结论：PASS。** dry-run 路径返回 exit 3，报告严格 fail closed。

---

## 3. 独立执行缺凭据分支并断言退出码 2

命令（`env -u OPENAI_API_KEY`，并显式 `--execute-neutral-probe`）：

```
env -u OPENAI_API_KEY python3 docs/active/project/external-audit-package/12-capability-probe.py \
  --execute-neutral-probe --output /tmp/icva_audit/missing-cred.json
```

实测：`exit=2`、报告字段：

| 字段 | 值 | 期望 | OK |
|---|---|---|---|
| `executed` | `false` | false | ✅ |
| `passed` | `false` | false | ✅ |
| `failureCode` | `VISION_CREDENTIAL_MISSING` | VISION_CREDENTIAL_MISSING | ✅ |
| `executedAt` | `null` | null（未联网） | ✅ |

脱敏扫描：0 命中 `authorization`/`bearer`/`api_key`/`sk-`/`data:image`。未发起任何出站连接。

**Phase 3 结论：PASS。** 缺凭据分支返回 exit 2，`passed=false` 仍为机器可见硬事实。

---

## 4. 离线测试 4/4 PASS（隔离 /tmp 副本）

`13-capability-probe-tests.py` 第 10 行硬约束 `SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "v3_vision_capability_probe.py"`，因此必须在与 `tests/` 平级的 `scripts/` 副本目录下运行。已在 `/tmp/icva_audit/` 复制：

```
/tmp/icva_audit/scripts/v3_vision_capability_probe.py     (12 副本)
/tmp/icva_audit/tests/test_v3_vision_capability_probe.py   (13 副本)
```

`python3 -m pytest tests/test_v3_vision_capability_probe.py -v` 输出：

```
test_neutral_probe_request_is_fixed_and_contains_no_user_content PASSED
test_response_parser_requires_exact_model_usage_and_typed_output  PASSED
test_dry_run_writes_redacted_fail_closed_report                   PASSED
test_execute_fails_closed_without_credential                      PASSED
4 passed in 0.03s
```

- 测试 1 校验 model=`gpt-4.1-mini-2025-04-14`、`store=false`、`max_output_tokens=300`、detail=`low`、`containsUserContent=False`、`toolsEnabled=False`。
- 测试 2 校验 `parse_response` 严格匹配 exact model + typed usage；故意改 model 时抛 `VISION_MODEL_MISMATCH`。
- 测试 3 校验 dry-run main 返回 3、`executed/passed=false`、`failureCode=VISION_CAPABILITY_PROBE_NOT_EXECUTED`，且输出文件不含 `authorization`/`bearer`/`api_key`。
- 测试 4 用 `monkeypatch.delenv("OPENAI_API_KEY", raising=False)` 后断言 main 返回 2、`failureCode=VISION_CREDENTIAL_MISSING`。

**Phase 4 结论：PASS。** 4/4 离线测试与独立运行时观察一致。

---

## 5. 退出码控制流静态证明（仅真实成功路径返回 0）

`12-capability-probe.py` 中 `main()` 关键路径（行号引用基于包内副本 `fd776624…d7369`）：

| 行 | 行为 | 返回 |
|---|---|---|
| 205-208 | 默认初始化 `executed=false`、`passed=false`、`failureCode=VISION_CAPABILITY_PROBE_NOT_EXECUTED` | — |
| 210 | 进入 `if args.execute_neutral_probe` | — |
| 211-215 | `api_key = os.environ.get(args.credential_env, "")`；若 `len(api_key) < 20` → 写报告 → `return 2` | 2 |
| 216-223 | `try: parsed = parse_response(execute_request(payload, api_key)) except (RuntimeError, ValueError, json.JSONDecodeError)` → 写 `executed=True, failureCode=str(error)` → `return 1` | 1 |
| 224-230 | 仅在 try 成功（无异常）时执行：`report.update({executed=True, passed=True, failureCode=None, result=parsed})` | — |
| 231 | 落盘 `write_report(args.output, report)` | — |
| 232-233 | `if report["passed"]: return 0` → **唯一进入 exit 0 的路径** | 0 |
| 234-235 | `if not args.execute_neutral_probe: return 3` | 3 |
| 236 | 兜底 `return 1` | 1 |

由此构造如下可达性矩阵：

| 路径 | 触发条件 | `executed` | `passed` | `failureCode` | exit |
|---|---|---|---|---|---|
| 默认 dry-run | 无 `--execute-neutral-probe` | False | False | `VISION_CAPABILITY_PROBE_NOT_EXECUTED` | **3** |
| 缺凭据 | 有 execute 标志且 env < 20 字符 | False | False | `VISION_CREDENTIAL_MISSING` | **2** |
| 真实执行失败 | execute_request/parse_response 抛异常 | True | False | `VISION_PROVIDER_HTTP_*` / `VISION_USAGE_MISSING` / `VISION_MODEL_MISMATCH` / `VISION_RESPONSE_INVALID` / `VISION_PROVIDER_UNAVAILABLE` / `VISION_RESPONSE_INCOMPLETE` / `VISION_RESPONSE_TEXT_MISSING` 等 | **1** |
| 真实执行成功 | execute_request + parse_response 均成功 | True | **True** | `null` | **0** |
| 兜底 `return 1`（行 236） | 不可达（任何 execute 标志为 True 的真实失败路径已被行 223 捕获，且成功路径必置 `passed=True`） | — | — | — | — |

关键不变量：
- `passed=True` **只**由行 224-230 的 `report.update` 写入，且仅在 `parse_response(execute_request(...))` 不抛任何异常后到达；
- `if report["passed"]: return 0`（行 232-233）是**唯一**写 `passed=True` 后才可能执行的 return；
- 因此 **exit 0 等价于 `executed=True ∧ passed=True`**，等价于真实 HTTP 请求 200 + Structured Output 通过 schema + exact model 匹配 + 完整 typed usage。

**Phase 5 结论：PASS。** 静态证明：仅真实能力探测成功路径返回 exit 0；其他任何路径都不返回 0；`passed=false` 永远是机器可见硬事实（无论是 dry-run、缺凭据还是真实失败）。

---

## 6. 脱敏静态审查

`probe_manifest`（行 164-185）+ `main` 报告合并路径（行 205-230）写入输出 JSON 的字段集合：

```
schemaVersion, providerId, modelId, apiBase, endpoint,
image.{kind, mimeType, byteLength, sha256, containsUserContent},
request.{sha256, store, imageDetail, maxOutputTokens, toolsEnabled},
executedAt, executed, passed, failureCode, result
```

逐一排除清单（执行于 `/tmp/icva_audit/dry-run.json`、`/tmp/icva_audit/missing-cred.json` 两份报告）：

| 危险串 | 出现处 | 写入报告 | 备注 |
|---|---|---|---|
| `api_key` 变量值 | 行 211、217、148（HTTP header） | 否 | 仅进程内存使用 |
| `Authorization: Bearer …` | 行 148（`urllib.request.Request` header） | 否 | 仅 HTTP 请求 |
| `data:image/png;base64,…` | 行 79（`build_request` payload） | 否 | 仅 payload，**不**经 `probe_manifest` 写盘；payload 只通过 canonical JSON 的 SHA-256 间接存在 |
| 原始 image bytes | `neutral_probe_png()` | 否（仅 SHA-256 与 byteLength） | 行 175 |
| 原始 request body | `execute_request` 序列化 | 否（仅 SHA-256） | 行 179 |
| 真实响应 body | `parse_response` | 否（仅 `responseSha256`、`responseIdSha256`、typed usage、typed observation） | 行 134-138 |
| `sk-*` 形态 | 不存在于 probe 代码 | 否 | — |

`build_request`（行 65-92）中虽含 `data:image/png;base64,…`，但 `probe_manifest`（行 164-185）只选取 `payload["store"]`、`payload["max_output_tokens"]`、`"low"` 字面量以及 `canonical_sha256(payload)`。data URI 字符串不被读取、不被 JSON 序列化进 report。`parse_response` 同样只输出 `responseIdSha256` 和 `responseSha256`，不写入 raw body。

报告字段值字面扫描（`grep -i 'authorization\|bearer \|api_key\|sk-\|data:image'`）：0 命中。`request.sha256` 是 canonical SHA-256 摘要而非 raw body。

**Phase 6 结论：PASS。** 无 key、Authorization、Bearer、data URI 或原始请求体出现在报告。

---

## 7. 约束静态审查（provider/model/store/detail/no-tools/schema/usage）

直接 import 探针模块并对 `build_request`/`probe_manifest`/`parse_response` 做静态断言：

```
PNG SHA = 521fa8f06e101b14c0f1b85e329b651e66ecf80406aa64021ba47ac6745e8eeb
PNG byteLength = 589
payload['model'] == 'gpt-4.1-mini-2025-04-14'                       ✅
payload['store'] is False                                           ✅
payload['max_output_tokens'] == 300                                 ✅
payload['input'][0]['content'][1]['detail'] == 'low'                ✅
'tools' not in payload                                              ✅
payload['text']['format']['type'] == 'json_schema'                  ✅
payload['text']['format']['strict'] is True                         ✅
payload['text']['format']['name'] == 'navia_v3_vision_capability'   ✅
manifest['providerId'] == 'openai-responses-vision'                 ✅
manifest['apiBase'] == 'https://api.openai.com/v1'                  ✅
manifest['endpoint'] == '/responses'                                ✅
manifest['image']['containsUserContent'] is False                   ✅
manifest['request']['toolsEnabled'] is False                        ✅
manifest['request']['store'] is False                               ✅
manifest['request']['imageDetail'] == 'low'                         ✅
manifest['request']['maxOutputTokens'] == 300                       ✅
```

`parse_response`（行 123-139）约束：

| 字段 | 规则 | 实测 fail-closed 形态 |
|---|---|---|
| `status` | 必须 == `"completed"` | `VISION_RESPONSE_INCOMPLETE` ✅ |
| `model` | 必须严格 == `gpt-4.1-mini-2025-04-14` | `VISION_MODEL_MISMATCH` ✅ |
| `usage` 形状 | `input_tokens/output_tokens/total_tokens` 全部为 int | `VISION_USAGE_MISSING` ✅ |
| `output[].content[].type="output_text"` 必须存在且 `.text` 是 str | — | `VISION_RESPONSE_TEXT_MISSING` ✅ |
| `observation` 形状 | `summary` 1..240 字符、`containsText` 严格 bool、`dominantColors` 1..4 项且每项 1..40 字符 | `VISION_RESPONSE_INVALID` ✅（行 110-120 严格 `set(value) == {"summary","containsText","dominantColors"}` 闭键） |

`response_schema`（行 47-62）额外约束：JSON Schema `strict=True`、`additionalProperties=False`、`required=["summary","containsText","dominantColors"]`、`summary` minLength=1/maxLength=240、`dominantColors` 1..4 项、`containsText` 严格 bool。OpenAI 端将据此拒绝任意额外字段；客户端 `validate_observation` 二次守门。

`execute_request`（行 142-161）行为：

| 维度 | 实现 | 合规 |
|---|---|---|
| HTTP method | `POST` | ✅ |
| URL | `https://api.openai.com/v1/responses`（`API_BASE + ENDPOINT`，均常量） | ✅ |
| Timeout | 30 s（默认参数） | ✅ |
| Retry | 仅 `429` 和 `5xx` 在第 1 次失败后 sleep 0.5-1.0 s 重试 1 次；不重试 4xx | ✅ |
| Header | 仅 `Authorization: Bearer {api_key}` 与 `Content-Type: application/json` | ✅ |
| Body | canonical JSON（无空格、`ensure_ascii=False`、`sort_keys=False` 用默认）；无任何额外字段 | ✅ |

**Phase 7 结论：PASS。** provider/model/apiBase/endpoint、image detail=`low`、`store=false`、无 tools、`max_output_tokens=300`、JSON Schema Structured Output、exact model、typed usage 全部按候选文档冻结。

---

## 8. V3-1.4 / V3-2 前置与 OCR/sample freeze 边界

`04-stage-gate.md` 第 5 行状态行：`V3-1.4 LIMITED PASS / SenseVoice development baseline / V3-2 LIMITED PASS / V3-3 DEPENDENCY FREEZE IN PROGRESS / V3-4..V3-7 BLOCKED BY PREDECESSOR`。V3-3 LIMITED PASS 不被本候选或本轮 verifier 准备所声称；审计范围严格限于 V3-3 capability verifier 加固，不扩大为 V3 完成、视频理解完成、图文大纲完成或 Media Mindmap 完成。

`16-vision-sample-registry.json` 边界校验：

| 字段 | 值 | 期望 | OK |
|---|---|---|---|
| `sourceRunId` | `v3-2-production-20261007T174158Z` | V3-2 唯一生产 run | ✅ |
| `sampleCount` | `10` | 10 | ✅ |
| `classificationCounts` | `{subtitle:6, asr:3, multipart:1}` | 6+3+1=10 | ✅ |
| `cloudVisionTargetCount` | `8` | 8 | ✅ |
| 前 8 个 `cloudVisionTarget` | `[T,T,T,T,T,T,T,T]` | 全 True | ✅ |
| sample-09/10 `cloudVisionTarget` | `False` | False | ✅ |

`15-rapidocr-manifest.json` 冻结 `rapidocr==3.9.2 + onnxruntime==1.28.0 + opencv-python==5.0.0.93` 及三份 ONNX 资产（PP-OCRv6_det_small、PP-OCRv6_rec_small、ch_ppocr_mobile_v2.0_cls_mobile），wheel/model SHA-256 完整；`17-rapidocr-offline-probe.json` 记录网络尝试 0、GPU=false、线程 4、峰值 RSS 426072 KiB、textCount=82、meanConfidence=0.97391。OCR/sample freeze 边界未扩张、未重写、未与失败 run 拼接。

**Phase 8 结论：PASS。** V3-1.4 / V3-2 LIMITED PASS 不被升级为 V3 通过；OCR/sample freeze 闭集保持完整。

---

## 9. Capability verifier 自身的固定分母

候选自报 4 项离线测试 PASS（Phase 4 已独立复算）、dry-run 报告 `executed=false/passed=false`（Phase 2）、缺凭据分支 `VISION_CREDENTIAL_MISSING`（Phase 3）。本审计额外确认：

- 不会自动把 `--execute-neutral-probe` 视为默认；默认 `executed=False`、`passed=False`、`failureCode=VISION_CAPABILITY_PROBE_NOT_EXECUTED`、exit 3。
- 中性 PNG 由 `neutral_probe_png()` 确定性生成（589 bytes，SHA-256 `521fa8f0…8eeb`），不含 B站、字幕、Cookie、用户内容；`image.containsUserContent=False` 由 manifest 强制写入。
- 无 `--execute-neutral-probe` 时不读取 `OPENAI_API_KEY`、不构造 `urllib.request.Request`、不发 HTTP。
- 即使 `OPENAI_API_KEY` 在环境存在但长度 < 20，仍 fail closed 返回 exit 2，避免把空字符串/短 stub 误判为可用凭据。
- 真实成功必须 `executed=True ∧ passed=True`，等价于真实联网且响应通过 exact model + typed usage + JSON Schema 守门。

**Phase 9 结论：PASS。** 退出码加固和凭据门禁与候选自报一致；`passed=false` 在缺凭据和 dry-run 路径下都是机器可见硬事实。

---

## 10. 反假绿保护

下列边界被 probe 自身锁死，不允许任何“脚本可运行 = PASS”式假绿：

1. 退出码不与 passed=True 等价的任何路径：
   - exit 0 ←→ passed=True ←→ execute_request + parse_response 双双成功；
   - exit 1 / 2 / 3 都强制 `passed=false`。
2. 报告字段 `passed` 始终是 JSON bool（不是字符串、不是 null、不是缺省）；下游消费者无法把 `passed=false` 误读为缺失。
3. 中性图 capability probe 不允许被偷换为真实 B站帧上传授权：probe manifest 写入 `image.containsUserContent=False`，且 probe 不接收外部 frame 输入；用户对真实选定帧上传的高风险授权属于独立 V3-3-4 出门条件，不被本 verifier 通过或否决。
4. 报告不含 raw request body、不含 `Authorization` header、不含 `Bearer ` token、不含 data URI、不含真实 image bytes——避免把脱敏失误假绿成 capability PASS。

---

## 11. 发现分级

| 等级 | 计数 | 描述 |
|---|---|---|
| Fatal | **0** | 无 |
| Major | **0** | 无 |
| Minor | **0** | 无 |

可选观察（不计级）：`12-capability-probe.py` 行 236 的兜底 `return 1` 在当前控制流下不可达（成功路径必置 `passed=True` 走行 233；失败路径必在行 223 抛出）。无安全后果；若未来重构复位 `passed` 需同步处理。

---

## 12. 三个独立决定

1. **V3-1.4 / V3-2 前置是否仍有效：是。** `04-stage-gate.md` 状态行与 `19-v3-2-independent-exit-audit.md` 的 `V3-2 LIMITED PASS`（Fatal=0/Major=0/Minor=0）保持一致；本轮 capability verifier 加固既不重写 stage-gate，也不替代 V3-2 LIMITED PASS；V3-1.4 LIMITED PASS、V3-2 LIMITED PASS 边界未被扩大为 V3 通过。
2. **OCR / sample freeze 是否仍成立：是。** 10 个成功样本（`6 subtitle + 3 asr + 1 multipart`）机械派生自 V3-2 sealed run `v3-2-production-20261007T174158Z`；前 8 个按源顺序固定为云 VLM 目标；RapidOCR manifest/offline probe/SenseVoice development baseline 未变。
3. **V3-3 是否仍只能等待真实中性图 capability probe、凭据与用户对真实选定帧上传的显式授权：是。** 本审计范围内 capability verifier 加固无新增 Fatal/Major，且仅当 `executed=True ∧ passed=True`（即真实 HTTP 200 + 全套 schema/usage/model 守门通过）才返回 exit 0。任何用 dry-run / 缺凭据分支 / 离线测试 / fixture / BiliNote 输出 / provider mock 报 V3-3 PASS 仍是 Major；选定帧上传授权属于独立高风险边界，不被 verifier 关闭。

---

## 13. 显式阻断条件

下列任一项未关闭前，V3-3 实施出门保持 NO-GO；本审计不豁免其中任何一项：

1. **真实中性图 capability probe**：必须使用真实凭据运行 `12-capability-probe.py --execute-neutral-probe`，观察到 exit 0 且报告 `executed=true`、`passed=true`、`failureCode=null`、`result.model == "gpt-4.1-mini-2025-04-14"`、typed usage 完整。
2. **视觉凭据**：项目侧仍无任何已配置 `OPENAI_API_KEY`；候选与本审计均未触及或读取任何凭据。
3. **用户对真实 8 张选定 B站帧上传的高风险授权**：属于 `v3-3-vlm-provider-freeze-candidate.md` §3 显式列出的 `selected_frame_cloud_vision` scope，须用户在 V3-3 实施出门前给出独立授权；中性图 probe 授权不构成选定帧上传授权。

---

## 14. 禁止扩大声明（重申）

- 本审计**不构成**V3 完成、视频理解完成、图文大纲完成、Media Mindmap 完成、V3-3 LIMITED PASS、V3-3 capability PASS 等任何扩大声明。
- 本审计**不修改**主工作树、历史 run、seal、既有审计或候选字段；所有写入仅落在 `/tmp/icva_audit/` 与本审计报告自身。
- 本审计**不豁免**V3-3 实施出门任何既有门禁；V3-3 LIMITED PASS 仍须待 V3-3-4（真实矩阵与产品回归）和 V3-3-7（独立出门审计）按既有顺序重新审计。

---

## 15. 审计员独立声明 + 最终决定

身份：独立只读审计员；本次会话未读取任何凭据、未发起任何云端请求、未运行任何产品代码；所有写入限于 `/tmp/icva_audit/`（`scripts/`、`tests/`、`dry-run.json`、`missing-cred.json`）与本报告自身。

覆盖摘要：19/19 SHA-256 字面对账、19/19 包副本与权威源字节一致；dry-run exit 3 + executed/passed=false + `VISION_CAPABILITY_PROBE_NOT_EXECUTED` + 脱敏 0 命中；缺凭据分支 exit 2 + `VISION_CREDENTIAL_MISSING` + 脱敏 0 命中；4/4 离线测试 PASS（隔离 /tmp 副本）；退出码控制流静态证明仅真实成功返回 exit 0；provider/model/apiBase/endpoint/store=false/detail=low/no-tools/300 tokens/JSON Schema/exact model/typed usage 全部按候选冻结；V3-1.4 / V3-2 LIMITED PASS 边界不扩大；OCR / sample freeze 边界不扩大；报告不含 key / Authorization / Bearer / data URI / 原始请求体。

**审计报告结束。决定：V3-3 capability verifier 加固 PASS（Fatal=0/Major=0/Minor=0）；V3-1.4/V3-2 前置仍有效；OCR/sample freeze 仍成立；V3-3 实施出门仍只能等待真实中性图 capability probe、视觉凭据与用户对真实选定帧上传的高风险授权。除上述三项独立硬条件外，本审计未发现任何额外 blocker。**
