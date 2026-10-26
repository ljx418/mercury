# Stage B B-5-2 子阶段验收(单任务 Composer 接收与原子发布,2026-10-14)

日期：2026-10-14。本文件是 B-5-2 出门的执行结果记录,与
`stage-b-b5-2-detailed-plan-2026-10-14.md` (AR-1..AR-10)、
`stage-b-b5-2-acceptance-2026-10-14.md`(自动验收分母)、
`stage-b-b5-2-preimplementation-audit-2026-10-14.md`(实施前审计) 一一对应。
本子阶段 product code 不动,仅复核既有 Stage B 路径并追加 `test_v3_grounded_comprehension_b5_2.py`。

## 1. 范围与边界

- 范围：单任务 Composer 接收 + 0600 atomic publish + revision / catalog 漂移拒绝；
- 不进入 B-5-3..B-5-7；
- 不启动 Chrome / Runtime / Provider；无 fresh BVID run；DeepSeek 任务级启用
  仍待另行高风险授权。

## 2. product code 与契约指纹基线(B-5-2 期间不动)

| 文件 | SHA-256 | 大小 |
|---|---|---:|
| `quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | 20200 |
| `service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | 36026 |
| `synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | 51764 |
| `v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | (字节不变) |
| `v3_media_grounded_comprehension_v2_1.schema.json` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` | (M-B5-1-01 闭合后) |
| `stage-b-route-2-contract-fixtures.json` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705` | (M-B5-1-01 闭合后) |

复算命令：

```bash
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json
```

## 3. AR 逐条复核(与 plan §2 一致)

| AR | 结论 | 证据 |
|---|---|---|
| AR-1 | **PASS** | `test_ar1_brief_composer_failure_allowlist_includes_brief_length_invalid_and_raw_prefix`：断言 `_BRIEF_COMPOSER_FAILURES` 集合包含两码且不含 CHAPTER/CLAIM 失败；`test_ar1_composer_recovers_brief_length_invalid_with_two_or_three_claim_subset`：BRIEF 太短 → repair 仍太短 → composer 命中、`len(sourceClaimIds) in {2,3}`、`origin=deterministic_claim_composer`、composed brief 含 U+FF1B 分隔；`test_ar1_brief_raw_prefix_validator_fails_closed_in_unit_path`：BRIEF = `evidence[0]["text"]` 经 validator 抛 `V3510B_BRIEF_RAW_PREFIX` |
| AR-2 | **PASS** | `test_ar2_chapter_failure_does_not_enter_composer`：两章 evidenceIds 同一段 → `V3510B_CHAPTER_TIME_INVALID`；service 重抛同 code、`calls={"initial":1,"repair":1}`、V2.1 文件不落盘 |
| AR-3 | **PASS** | `test_ar3_repair_called_at_most_once_per_synthesize`：两次 synthesize 后 provider 计数仍 `{initial:1, repair:1}`；`test_ar3_no_valid_subset_does_not_invoke_a_second_compose`：无闭合子集 → `V3510B_BRIEF_LENGTH_INVALID` 保留、V2.1 不落盘 |
| AR-4 | **PASS** | `test_ar4_v2_1_publish_is_0600_atomic_replace`：V2.1 文件 mode `0o600`、`schemaVersion="v3-media-grounded-comprehension/v2.1"` |
| AR-5 | **PASS** | `test_ar5_failed_v2_1_attempt_preserves_prior_bytes`：第二次 synthesize 制造 `V3510B_PROVIDER_RESPONSE_INVALID`，前次 V2.1 字节 `read_bytes()` 与 sha256 前后完全一致 |
| AR-6 | **PASS** | `test_ar6_status_502_and_ar7_uploads_zero`：原 BRIEF 失败抛 `MediaTaskStoreError.status == 502` |
| AR-7 | **PASS** | `test_ar6_status_502_and_ar7_uploads_zero`：成功路径 V2.1 文件 receipt 中 6 upload counter 全部 = 0；projection authorization 中 `rawMediaUploadCount = 0` |
| AR-8 | **PASS** | `verify-stage-b-route-2-contract-fixtures.py` 输出 `schemaMeta: PASS` / `positiveInstances: 3/3 PASS` / `schemaNegatives: 5/5 PASS` / `registry: 11/11 present` |
| AR-9 | **PASS** | 见 §4 测试摘要 |
| AR-10 | **PASS** | 见 §2 SHA 复算；B-5-2 期间 product code 不动 |

## 4. 测试与回归摘要

B-5-2 专属测试(新建 `tests/test_v3_grounded_comprehension_b5_2.py`,共 9 项)：

| 测试 | 覆盖 |
|---|---|
| `test_ar1_brief_composer_failure_allowlist_includes_brief_length_invalid_and_raw_prefix` | AR-1 allowlist 内容 |
| `test_ar1_composer_recovers_brief_length_invalid_with_two_or_three_claim_subset` | AR-1 BRIEF_LENGTH_INVALID → composer |
| `test_ar1_brief_raw_prefix_validator_fails_closed_in_unit_path` | AR-1 BRIEF_RAW_PREFIX validator 路径 |
| `test_ar2_chapter_failure_does_not_enter_composer` | AR-2 非 allowlisted 失败不进 composer |
| `test_ar3_repair_called_at_most_once_per_synthesize` | AR-3 单 synthesize 内 repair 最多一次 |
| `test_ar3_no_valid_subset_does_not_invoke_a_second_compose` | AR-3 无闭合子集不触发第二次 compose |
| `test_ar4_v2_1_publish_is_0600_atomic_replace` | AR-4 atomic publish + 0600 |
| `test_ar5_failed_v2_1_attempt_preserves_prior_bytes` | AR-5 历史字节保留 |
| `test_ar6_status_502_and_ar7_uploads_zero` | AR-6 / AR-7 |

全回归命令与输出(本会话)：

```bash
cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py
```

结果(verbatim):

```
65 passed in 6.80s
```

分项：

- `test_v3_grounded_comprehension_b5_1.py`：12 passed(B-5-1 跨子阶段保留);
- `test_v3_grounded_comprehension_b5_2.py`：9 passed(本子阶段新增);
- `test_v3_grounded_comprehension_v2.py`：10 passed(既有);
- `test_v3_media_comprehension.py`：28 passed(含 stage_b_* 全部用例);
- `test_v3_companion_runtime.py`：6 passed。

合计 65/65 PASS；无回退。

verifier：

```bash
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
```

输出(verbatim)：

```json
{
  "implementationAuthorized": false,
  "implementationPending": ["V3510B21-N02", "V3510B21-N03", "V3510B21-N04",
                            "V3510B21-N05", "V3510B21-N06", "V3510B21-N08",
                            "V3510B21-N09", "V3510B21-N10"],
  "positiveInstances": "3/3 PASS",
  "registry": "11/11 present",
  "schemaMeta": "PASS",
  "schemaNegatives": "5/5 PASS"
}
```

`implementationPending` 是 semantic / orchestration / persistence / real_run_harness
层，由产品代码 + 真实 harness 保证；本子阶段不触发。

## 5. PRD / 架构 / 合同复检

- PRD：`docs/active/project/01-prd.md` + `docs/active/project/stage-gates/v3-media-companion.md`
  - 单任务锁单一 Provider — Stage B `compose_brief_from_validated_claims` 不接
    Provider 切换,仍走原 task 的唯一 provider;V2.1 receipt 不写多 providerId;
    与 `stage-b-b5-1-acceptance-2026-10-14.md §5.1` 一致。
  - 0 原始视频/音频/帧/Cookie/密钥上传 — AR-7 测试断言 6 上传计数为 0;
    Provider receipt 仅记录 ID / model / endpointClass / structureMode /
    attemptId / latencyMs / requestSha256 / responseSha256 / finishReason。
  - Chat 默认 MiniMax / DeepSeek `selected=false` — B-5-2 不动
    `provider_settings` / `chatProviderSelection`。
- 架构契约：
  - V2 immutable / V2.1 是新写入格式 / reader 优先 V2.1 回退 V2 / 不跨版本合并
    — 既有 `service.py::MediaComprehensionService.get` 维持;
    `_load_grounded_v2_1` 失败回退到 `_load_grounded_v2`(沿用)。
  - compose 仅在两 allowlisted code 触发 — 既有
    `_BRIEF_COMPOSER_FAILURES = {"V3510B_BRIEF_LENGTH_INVALID", "V3510B_BRIEF_RAW_PREFIX"}`
    不变；AR-1 allowlist 测试固化。
  - atomic publish — `tmp + os.replace + chmod 0o600`,既有 `_atomic_save_grounded`。
  - revision / catalog 漂移阻断 — `_assert_current_binding` 在 commit 前；
    AR-5 V2.1 字节保留测试锁定。
- 合同 schema：M-B5-1-01 已闭合,V2.1 schema 接纳 7 个 optional receipt extras;
  V2 schema 字节不变;verifier 3/3 positive、5/5 schema negatives、11/11 registry。

## 6. 严重度

| 严重度 | 计数 | 列表 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | — |
| Minor | 0 | M-B5-1-01 已在 B-5-2 出门前闭合 |

与 `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §7` 一致。

## 7. 上传与隐私

- 本子阶段无 fresh run、无 Provider 调用、无 Chrome/Runtime 启动；
- receipt extras 中 `requestSha256` / `responseSha256` / `attemptId` 仅是不可逆
  摘要或 16-hex prefix,不携带密钥、Cookie、路径或原始媒体;
- 6 upload counter 全部 hard-coded 0;composer 不收任何额外输入,不发网络请求,
  不写中间文件。

## 8. 不允许验收姿势

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run;
- 调低 brief 长度、claim 数、章节覆盖率门槛;
- 跨 Provider 拼接、最佳 N、自动 fallback;
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek;
- 在用户未单独授权时上传真实项目派生文本。

## 9. 出 B-5-2 结论

**DOCUMENT CANDIDATE & IMPLEMENTATION PASS / READY FOR B-5-3**。
Fatal=0 / Major=0 / Minor=0；AR-1..AR-10 全部 PASS；产品代码零改动；
65 项相关测试 100% PASS;verifier PASS。M-B5-1-01 已闭合。

## 10. 进入 B-5-3 前置条件

- 真实 Chrome 实例仍 `--mute-audio`(沿用 stage-gates 26 节末尾);
- 单任务锁单一 Provider；不跨 Provider 拼接;
- Provider 默认 MiniMax；DeepSeek 任务级启用仍未授权,B-5-3/DEV-4 不使用;
- B-5-3/DEV-4 真实 fresh 6 BVID 分母须配 fresh Runtime / database / chrome-profile
  / task 命名空间;任一 BVID 失败一次 retry 后仍未通过即整 B-5 FAIL/REPLAN;
- 用户对真实 Chrome / Runtime / 派生文本上传的高风险授权已在本轮生效;
- B-5-2 出门审计的独立 Claude Code CLI 复算仍待执行,与 B-6/B-7 一起启动。

## 11. B-5-3..B-5-7 后续子阶段(后续 session 范围)

本会话覆盖到 B-5-2 出门。B-5-3..B-5-7(真实 fresh 6 BVID + 宿主语义 + 独立实施
出门 + 清理 + handoff + external-audit-package)的详细计划与执行需独立
session,在前置条件(用户单独对 DeepSeek 任务级启用 + 真实项目派生文本上传
的高风险授权)未下达前,任一阶段都不可启动 fresh Chrome。
