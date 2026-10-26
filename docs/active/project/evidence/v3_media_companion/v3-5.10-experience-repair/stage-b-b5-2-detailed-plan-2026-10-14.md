# Stage B B-5-2 详细开发计划（单任务 Composer 接收与原子发布，2026-10-14）

范围：承接 B-5-1（DEV-2 Provider 集中授权边界），仅实施 B-5 recovery dev plan §5 的
**DEV-3 单任务 Composer 接收与原子发布**：验证 `quality.py` 中的确定性 brief
composer 路径在 `service.py` 的接收链路上按两次 allowlisted 失败码触发、0600
原子发布、revision/catalog 漂移拒绝，并使已有的短暂历史 V2/V2.1 字节保留。
不进入 B-5-3..B-5-7，不启动 Chrome/Runtime/Provider，不上传任何媒体或派生文本。

## 1. 范围与不扩展

- 范围：
  - `compose_brief_from_validated_claims` 仍是 `quality.py` 的纯函数，不创造 claim 文本，
    不截断、不 pad、不 paraphrase；raw transcript 文本不被接收为 brief；
  - `service.py::MediaComprehensionService.synthesize` 接收链确认两个 allowlisted
    失败码（`V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX`）进入
    composer，且任何其它失败码（含 `_NO_RETRY_FAILURES`）继续 fail-closed；
  - provider repair 调用至多一次，之后直接 composer（无第二次 repair / 无第二次 composer）；
  - 0600 atomic publish：`tmp + os.replace + chmod 0600`；`_save_grounded_v2_1`
    与 V2/V2.1 历史字节隔离；V2/V1 落盘不被重新落写；
  - `_assert_current_binding` 在 commit 前阻断 revision / evidence-catalog 漂移；
  - 失败诊断 `V3510B_COMPOSER_NO_VALID_SUBSET` 不进 V2.1 derivative，仅在
    service log 出现；HTTP 502 路径不变。
- 不扩展：B-5-3（fresh run）/ B-5-4（自验证与 PRD 检视）/ B-5-5（清理）/ B-5-6
  （handoff）/ B-5-7（external-audit-package）/ 跨 Provider 拼接 / 最佳 N /
  隐式 fallback / 阈值降低 / 新 Provider 引入 / `--mute-audio` Chrome 实例启用 /
  DeepSeek 任务级启用。

## 2. 验收门槛（只对本子阶段）

| ID | 描述 | 门槛 |
|---|---|---|
| AR-1 | 两次 allowlisted 失败码均能落 composer | BRIEF 太短 / BRIEF RAW PREFIX 经过一次 repair + 一次 compose 仍失败时，service 抛原 code；2-3 claim 子集闭合 → composer 命中、`brief.origin=deterministic_claim_composer`、`brief.sourceClaimIds` 长度 2 或 3 |
| AR-2 | 非 allowlisted 失败码不进 composer | `V3510B_CHAPTER_TIME_INVALID` / `V3510B_CLAIM_EVIDENCE_UNCLOSED` / `V3510B_ENDING_EVIDENCE_MISSING` 等由 compose 阻断，原始 provider 失败语义保留 |
| AR-3 | repair 最多一次 / compose 最多一次 | synthesize 调用对同一 task 经 repair 与 compose 各一次后再失败 → service 抛原失败；不出现第三次 provider 调用、不出现第二次 compose |
| AR-4 | 0600 原子发布 | V2.1 derivative 写到 `<private>/grounded-comprehension-v2.1/<task>/revision-<r>/<catalog>.json`；模式 `0o600`；commit 前 authority 屏障拒绝 revision / catalog 漂移 |
| AR-5 | V2/V2.1 历史字节保留 | 失败重试不修改已落盘 V2/V2.1；新一次成功不替换已落盘 V2/V2.1（除非同 task / revision / catalog hash 字节完全一致） |
| AR-6 | HTTP 502 路径不变 | provider / compose 任意失败 → HTTP 502（沿用 `MediaTaskStoreError(status=502)`） |
| AR-7 | 上传计数仍为 0 | `_save_grounded_v2_1` 输出不引入任何 rawVideo / rawAudio / frameByte / cookie / apiKey / localPath |
| AR-8 | MR-07 schema meta-validation 通过 | `verify-stage-b-route-2-contract-fixtures.py` 输出 `schemaMeta: PASS`、`positiveInstances: 3/3 PASS`、`schemaNegatives: 5/5 PASS`、`registry: 11/11 present` |
| AR-9 | 单元测试持续 PASS | `test_v3_grounded_comprehension_v2.py` 与既有 `test_v3_media_comprehension.py` 全 PASS；新增 B-5-2 专属测试全 PASS |
| AR-10 | 文件改动可复算 | B-5-2 期间 product code 不动；SHA-256 与 B-5-1 验收时一致；新增 schema / fixtures / verifier 指纹与 B-5-1-M-B5-1-01 关闭证据一致 |

## 3. 风险闭环

| 风险 | 闭环 |
|---|---|
| Composer 触发超出 allowlisted | 仅 `V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` 进入（B-5-1 的 `_BRIEF_COMPOSER_FAILURES`，沿用） |
| Compose 无有效 subset | 返回原 provider 失败，service log `V3510B_COMPOSER_NO_VALID_SUBSET` 内部诊断；V2.1 derivative 不落盘 |
| Repair 内部触发第二次 compose | 第二次 repair 失败直接抛（service.py:267-276），不进入 compose |
| Revision / catalog 漂移 | `_assert_current_binding` 在 `tmp.replace` 之前阻断；落盘前再 snapshot；失败保留旧 V2/V2.1 字节 |
| 文件权限错位 | `path.parent.mkdir(..., mode=0o700)` + `tmp.chmod(0o600)` + `os.replace` |
| Provider 单点回退无兜底 | `_NO_RETRY_FAILURES` 仍优先上抛（B-5-1 已闭合） |
| 测试 RED | 任一 AR 不达 → 本子阶段冻结，回 `test_v3_media_comprehension.py` 既有 stage_b_* 测试 |

## 4. 详细实施步骤

1. **不修改 product code**：B-5-2 的 DEV-3 路径在
   `quality.py::compose_brief_from_validated_claims`、
   `service.py::MediaComprehensionService.synthesize`、
   `_atomic_save_grounded`、
   `_save_grounded_v2_1`、
   `_assert_current_binding` 中已就位；
   - 仅复核既有实现与本子阶段 AR 对齐，不重新落代码。
2. **B-5-2 专属测试**：在
   `services/local-runtime/tests/test_v3_grounded_comprehension_b5_2.py`
   增补或新建：
   - `test_b5_2_composer_recovers_brief_length_invalid_with_two_claim_subset`
     （2-claim 闭合子集 → composer 命中、`origin=deterministic_claim_composer`、
     `sourceClaimIds` 长度 2）；
   - `test_b5_2_composer_recovers_brief_raw_prefix_when_two_claim_subset_covers_regions`
     （brief 为 transcript 子串，2-claim 闭合子集不含 raw → composer 命中）；
   - `test_b5_2_composer_no_valid_subset_keeps_original_failure`
     （无闭合子集 → `V3510B_BRIEF_LENGTH_INVALID` 保留，`V2.1 derivative` 不落）；
   - `test_b5_2_chapter_failure_does_not_enter_composer`
     （`V3510B_CHAPTER_TIME_INVALID` 由 compose 阻断，原始失败语义保留）；
   - `test_b5_2_revision_drift_before_commit_writes_nothing`
     （commit 屏障阻断 `_assert_current_binding` 失败 → V2.1 不落）；
   - `test_b5_2_v2_1_publish_is_0600_atomic_replace`
     （模式 0o600 + `tmp + os.replace`）；
   - `test_b5_2_failed_v2_1_attempt_preserves_prior_bytes`
     （失败再次提交，sha256(前) == sha256(后)）。
3. **跑 verifier 与回归**：
   ```bash
   python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
   cd services/local-runtime
   python3 -m pytest tests/test_v3_grounded_comprehension_b5_1.py \
                          tests/test_v3_grounded_comprehension_v5_2.py \
                          tests/test_v3_grounded_comprehension_v2.py \
                          tests/test_v3_media_comprehension.py \
                          tests/test_v3_companion_runtime.py -v
   ```
4. **PRD / 架构 / 合同复检**：与本子阶段 AR 对齐；与 M-B5-1-01 关闭证据交叉；
   与 route-2 replan / route-2 contract addendum / route-2 preimplementation
   audit 一致。
5. **落盘 `stage-b-b5-2-acceptance-2026-10-14.md`**：逐条 AR 证据、SHA 复算、
   测试摘要、Fatal/Major/Minor 计数、进入 B-5-3 前置条件。

## 5. 失败码映射（DEV-3 接收边界）

| code | 接收门 | B-5-2 期望 |
|---|---|---|
| `V3510B_BRIEF_LENGTH_INVALID` | 进入 compose（at most once） | 命中子集时 → composer 命中；否则原 code 保留 + 内部诊断 `V3510B_COMPOSER_NO_VALID_SUBSET` |
| `V3510B_BRIEF_RAW_PREFIX` | 进入 compose（at most once） | 同上 |
| `V3510B_CLAIM_*` / `V3510B_CHAPTER_*` | fail-closed；不进 compose | 测试 |
| `V3510B_PROVIDER_REFUSAL` | 仍 fail-closed（B-5-1 闭合） | 跨子阶段回归 |
| `V3510B_PROVIDER_AUTHORIZATION_DENIED` | 仍 fail-closed（B-5-1 闭合） | 跨子阶段回归 |

## 6. 风险与不达预期处置

- 任何一项 AR 不达 → 本子阶段冻结；不进入 B-5-3；
- MR-07 verifier 不通过 → 必属 schema 缺口，先修复 stage-b-route-2-contract-* 后再回归；
- HTTP 502 被替换 → 立即停止，回 `MediaTaskStoreError(status=...)` 调用栈；
- V2/V1 历史字节改动 → 立即停止，记录期望保留字节与实际字节差异。

## 7. 出本计划的依赖

- B-5-1 验收已 PASS；
- M-B5-1-01 已闭合（schema 缺口已修复）；
- V2.1 verifier 输出 PASS、3/3 positive、5/5 schema negatives、11/11 registry；
- 用户对真实 fresh Chrome / Runtime 的高风险授权已生效（按本会话用户指令）；
- MiniMax 默认；DeepSeek 任务级启用仍未授权，本子阶段不使用。
