# Stage B B-5-2 验收标准（单任务 Composer 接收与原子发布,2026-10-14）

日期：2026-10-14。范围：与 `stage-b-b5-2-detailed-plan-2026-10-14.md §2` AR-1..AR-10
一一对应的机器可复算门槛；不与 dev plan 冲突；不授权真实 Chrome/Runtime 启动。

## 1. 验收原则

- 验收只接受本子阶段 product code 的当前行为 + 既有 B-5-1 改动 + 既有 stage-b-*
  测试 + 本子阶段新增 `test_v3_grounded_comprehension_b5_2.py`；
- 单任务锁单一 Provider；跨 Provider 拼接 / 最佳 N / 隐式 fallback 视为
  fail-closed；
- Provider 范围：MiniMax 默认；DeepSeek 任务级启用保持未授权；
- 0 原始视频/音频/帧/Cookie/密钥上传；Provider receipt 仅记录 providerId /
  modelId / endpointClass / structureMode / attemptId / latencyMs /
  requestSha256 / responseSha256 / finishReason 与 6 个上传 0 计数。

## 2. 自动验收分母（AR-1..AR-10）

逐项门槛与 plan §2 同名；下面给出可机器复算的最小集。

### AR-1 composer 在两码下命中

- `BRIEF_LENGTH_INVALID` + 2-claim 子集闭合 → `brief.origin=deterministic_claim_composer` + `len(sourceClaimIds)==2`；
- `BRIEF_RAW_PREFIX` + 2-claim 子集不含 raw transcript → composer 命中。

### AR-2 非 allowlisted 失败码不进 composer

- 注入 `V3510B_CHAPTER_TIME_INVALID`（制造章节时间非法），repair_v2 返回同样的章节非法 → service 抛 `V3510B_CHAPTER_TIME_INVALID`、`V2.1` 不落盘。

### AR-3 repair 最多一次 / compose 最多一次

- 同一个 task 连续两次 synthesize 调用，第二次 repair_v2 返回与第一次相同失败 → 不应进入第二次 compose；`repair_v2` 调用计数 ≤ 1 / synthesize。

### AR-4 0600 原子发布

- V2.1 derivative 落到
  `<private>/grounded-comprehension-v2.1/<task>/revision-<revision>/<catalogHash>.json`，
  mode `0o600`。

### AR-5 V2/V2.1 历史字节保留

- 失败的第二次 synthesize 必须保留前次 V2.1 字节：`hashlib.sha256(path.read_bytes())` 前后一致。

### AR-6 HTTP 502 路径不变

- 任意失败抛 `MediaTaskStoreError` 时 status=502（沿用 `quality.py::_fail` 默认值）。

### AR-7 上传计数仍为 0

- V2.1 receipt 中 `rawVideoUploadCount / rawAudioUploadCount / frameByteUploadCount / cookieUploadCount / apiKeyDisclosureCount / localPathUploadCount` 全部 = 0；
- 测试断言。

### AR-8 MR-07 schema meta-validation 通过

- `verify-stage-b-route-2-contract-fixtures.py` 输出
  `schemaMeta: PASS` / `positiveInstances: 3/3 PASS` /
  `schemaNegatives: 5/5 PASS` / `registry: 11/11 present`。

### AR-9 单元测试持续 PASS

- `test_v3_grounded_comprehension_v2.py`：既有 10 passed；
- `test_v3_grounded_comprehension_b5_1.py`：B-5-1 既有 12 passed；
- `test_v3_grounded_comprehension_b5_2.py`：本子阶段新增（详见 dev plan §4 步骤 2）；
- `test_v3_media_comprehension.py`：既有 28 passed（含 stage_b_* 全部 stage-b 用例）；
- `test_v3_companion_runtime.py`：既有 6 passed。

### AR-10 文件改动可复算

- quality.py / service.py / synthesis.py SHA 与 `stage-b-b5-1-acceptance-2026-10-14.md §2` 一致；
- V2 schema SHA 与 `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §3` 一致；
- V2.1 schema / fixtures / verifier / addendum SHA 与
  `stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md §4` 一致。

## 3. 失败码映射（仅允许 fail-closed）

| code | 接收门 |
|---|---|
| `V3510B_BRIEF_LENGTH_INVALID` | 进 composer 至多一次；无闭合子集保留原 code + 内部诊断 |
| `V3510B_BRIEF_RAW_PREFIX` | 同上 |
| 任何 `V3510B_*` 非 brief 失败 | 不进 composer；保留原始失败 |
| `V3510B_PROVIDER_REFUSAL` / `V3510B_PROVIDER_AUTHORIZATION_DENIED` | 不进 repair / composer（B-5-1 闭合） |

## 4. 复算命令（独立审查代理出门前逐条复算）

```bash
# (a) product code SHA（不应与 B-5-1 验收时不同）
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py

# (b) V2 schema SHA（不应与 M-B5-1-01 关闭时不同）
sha256sum \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json

# (c) V2.1 schema / fixtures / verifier / addendum SHA
sha256sum \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md

# (d) verifier
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py

# (e) 全回归
cd services/local-runtime
python3 -m pytest tests/test_v3_grounded_comprehension_b5_1.py \
                       tests/test_v3_grounded_comprehension_b5_2.py \
                       tests/test_v3_grounded_comprehension_v2.py \
                       tests/test_v3_media_comprehension.py \
                       tests/test_v3_companion_runtime.py -v
```

任一项不达即 B-5-2 FAIL；不进入 B-5-3。

## 5. 不允许的验收姿势

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 调低 brief 长度、claim 数量、章节覆盖率门槛；
- 跨 Provider 拼接、最佳 N 选一、自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本；
- 凭旧产物或将 sentinel 评分顶替新评分。

## 6. 出本验收外的依赖

- 用户对 DeepSeek 任务级启用与真实项目派生文本上传的 high-risk 授权仍待另行下达；
- B-5-3..B-5-7 之前必须再次重启独立 Claude Code CLI 审查；
- B-5-3+ 真实 fresh run 必须使用 `--mute-audio` Chrome 实例 + fresh Runtime /
  database / chrome-profile / task 命名空间。
