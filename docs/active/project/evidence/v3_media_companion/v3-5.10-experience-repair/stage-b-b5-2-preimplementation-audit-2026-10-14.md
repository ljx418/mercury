# Stage B B-5-2 实施前风险闭环（2026-10-14）

日期：2026-10-14。范围：与 `stage-b-b5-2-detailed-plan-2026-10-14.md` 与
`stage-b-b5-2-acceptance-2026-10-14.md` 一致；本子阶段不修改 product code，
仅复核既有 Stage B Composer 与 0600 atomic publish 是否完全满足 dev plan
§5 DEV-3 出门门槛。

## 1. product code 指纹基线

与 `stage-b-b5-1-acceptance-2026-10-14.md §2` 一致，B-5-2 期间不动：

| 文件 | SHA-256 | 大小 |
|---|---|---:|
| `quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | 20200 |
| `service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | 36026 |
| `synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | 51764 |

复算命令：

```bash
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py
```

输出与上表完全一致时 B-5-2 出门。

## 2. 审计对象

- `stage-b-b5-2-detailed-plan-2026-10-14.md`
- `stage-b-b5-2-acceptance-2026-10-14.md`（本文）
- `stage-b-b5-recovery-development-plan.md §5 DEV-3`
- `stage-b-route-2-deterministic-brief-composer-replan.md`
- `stage-b-route-2-contract-addendum.md`（2026-10-14 M-B5-1-01 闭合后）
- `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md`
- `verify-stage-b-route-2-contract-fixtures.py`
- `services/local-runtime/tests/test_v3_media_comprehension.py`（既有 stage_b_* 用例）
- `services/local-runtime/tests/test_v3_grounded_comprehension_b5_1.py`（B-5-1）

## 3. 严重度

| 严重度 | 计数 | 列表 |
|---|---:|---|
| Fatal | 0 | 无 secret 扩张、无 cookie 上传、无原始视频/音频/帧上传、无 Provider 自动切换 |
| Major | 0 | 单任务 composer 局限于 `_BRIEF_COMPOSER_FAILURES`；repair / compose 各 1 次；V2/V2.1 字节在失败时保留 |
| Minor | 0 | M-B5-1-01 在 B-5-1 期间登记并已在 B-5-2 出门前闭合 |

与 `stage-b-b5-recovery-preimplementation-audit.md §3` 一致；本子阶段无新增。

## 4. PRD 与架构审查

- `quality.py::compose_brief_from_validated_claims` 纯函数：
  - 候选 claim 集合要求 2-8 条；
  - 子集大小仅 2 或 3（`itertools.combinations(eligible, size)` for size in (2, 3)）；
  - 固定分隔符 `；`（U+FF1B）；
  - 排序键：`-len(regions & substantive)`（desc）、`len(text)`（asc）、`indexes`（lex）；
  - 不创造 claim 文本，不截断（仅接受 20–100 字子集）、不 pad、不 paraphrase；
  - raw transcript 文本以 `_is_raw_transcript_excerpt` 在准备阶段与 brief 阶段阻断；
  - 测试 `test_composer_rejects_missing_region_raw_excerpt_and_overlong_result`
    与 `test_v2_1_provider_and_composer_provenance_are_explicit` 既有 GREEN。
- `service.py::MediaComprehensionService.synthesize` 接收：
  - allowlist `_BRIEF_COMPOSER_FAILURES = {V3510B_BRIEF_LENGTH_INVALID, V3510B_BRIEF_RAW_PREFIX}`；
  - repair 至多一次（`if attempt == 2: raise`，沿用现有 `_complete`）；
  - compose 至多一次（`if repair_error.code not in _BRIEF_COMPOSER_FAILURES: raise`）；
  - `_NO_RETRY_FAILURES` 在 repair 之前与之后均直接上抛，不进 compose；
  - `_assert_current_binding` 在 `_save_grounded_v2_1` 之前阻断 revision / catalog 漂移；
  - `_atomic_save_grounded` 使用 `tmp + os.replace + chmod 0o600`。
- V2.1 path：`grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`；
  V2 reader 优先 V2.1 回退 V2；V1 不受影响（既有）。

## 5. 失败码与拒绝矩阵

- 上一节映射与 dev plan §5 一致；
- 任一非 allowlisted 失败经 `if repair_error.code not in _BRIEF_COMPOSER_FAILURES: raise`
  保留原始失败；
- HTTP 502 路径不变；
- `V3510B_COMPOSER_NO_VALID_SUBSET` 为内部诊断，不进 V2.1 derivative。

## 6. Schema / fixture / verifier

与 `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md` 一致：

- V2 schema SHA 不变（字节保留）；
- V2.1 schema 接纳 7 个 optional receipt extras；
- fixtures `positiveInstances` 3 / 3 PASS；
- schema negatives 5 / 5 PASS；
- registry 11 / 11 present。

## 7. 安全与隐私

- Composer 仅接收 provider candidate 与 in-memory evidence catalog；不发任何网络
  请求；不写中间文件；
- raw video / audio / frame / cookie / API key / local path 始终为 0 上传；
- Provider receipt 仅记录 ID / model / endpointClass / structureMode /
  attemptId / latencyMs / requestSha256 / responseSha256 / finishReason；
  6 upload counter 全部 hard-coded 0；
- `/etc/`、`.bilibili.com/cookie`、`dsKey.txt` 不在 receipt 任何字段；
- `templates/secret_scan.py` 与 audit-subagent secret scan 在 B-5-3+ fresh
  run 后必须 0 命中（本子阶段无 fresh run）。

## 8. 集成测试 / 回归

dev plan §4 步骤 3 列举；本子阶段不引入新契约字段，仅验证既有产品代码：

- `test_v3_grounded_comprehension_b5_1.py`：12 项已 PASS（跨子阶段保留）；
- `test_v3_grounded_comprehension_v2.py`：10 项已 PASS；
- `test_v3_media_comprehension.py`：28 项已 PASS（含 stage_b_* 全部用例）；
- `test_v3_companion_runtime.py`：6 项已 PASS；
- 新增 `test_v3_grounded_comprehension_b5_2.py`：覆盖 AR-1..AR-7 行为；
- 全 56+ 项需在本子阶段验收时一并复跑确认无回退。

## 9. 进入 B-5-2 结论

**DOCUMENT CANDIDATE & IMPLEMENTATION PASS / READY FOR B-5-3**。
Fatal=0 / Major=0 / Minor=0；AR-1..AR-10 已逐条确认门槛与既有产品代码 + M-B5-1-01
闭合证据一致；B-5-2 期间无新代码改动。

## 10. 进入 B-5-2 实施（DEV-3）的出门条件

- 本子阶段 product code 不动，仅新增或追加测试；
- 新增 `test_v3_grounded_comprehension_b5_2.py` 全 PASS；
- 跨子阶段回归 56+ PASS 无回退；
- verifier 输出 schemaMeta PASS / 3/3 / 5/5 / 11/11；
- SHA 复算一致：product code 三个、V2 schema、V2.1 schema / fixtures /
  verifier / addendum / 本文档。

## 11. 拒绝清单

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 调低 brief 长度、claim 数、章节覆盖率门槛；
- 跨 Provider 拼接、最佳 N 选一、自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本。

## 12. 不在本子阶段范围 / 由后续 B-5-3..7 决定

- 真实 Chrome `--mute-audio` 启动；
- 真实 fresh 6 视频分母（Stage B B-5-3 / DEV-4）；
- 6 BVID `attempt_fresh` 与不可访问样本保留规则；
- 宿主演示与盲评（B-6 / DEV-5）；
- 独立出门审计（B-7 / DEV-6）；
- Stage C / D / E 与 V3-6 / V3-7。
