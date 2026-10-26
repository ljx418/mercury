# Stage B B-5-3 实施前审计（真实 fresh 6 BVID 分母，2026-10-14）

日期：2026-10-14。范围：审计 `stage-b-b5-3-detailed-plan-2026-10-14.md` 与
`stage-b-b5-3-acceptance-2026-10-14.md` 在权威状态词、安全边界、单任务 Provider 锁定、
固定 6 BVID 分母、fresh isolation、`--mute-audio`、清理、产物路径、独立审查闭环
上的合规性。本审计不实施任何 Chrome / Runtime / Provider / 上传动作；不修改
product code、fixtures、schema、源 PRD / 架构 / 开发计划 / 验收计划 / Stage Gate /
V3-5.10 parent plan；不 commit / push；唯一新增文件即本报告。

## 1. 实施前指纹基线（B-5-3 期间不动）

| 文件 | 当前字节 SHA-256 | 大小 | 与 B-5-2 验收一致性 |
|---|---|---:|---|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc` | 20200 | 一致（见 §3） |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8` | 36026 | 一致（见 §3） |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168` | 51764 | 一致（见 §3） |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` | — | 字节不变（V2 immutable） |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135` | — | M-B5-1-01 闭合后 |
| `stage-b-route-2-contract-fixtures.json` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705` | — | M-B5-1-01 闭合后 |
| `verify-stage-b-route-2-contract-fixtures.py` | `dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e` | — | M-B5-1-01 闭合后 |
| `stage-b-route-2-contract-addendum.md` | `779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153` | — | M-B5-1-01 闭合后 |
| `stage-b-six-video-registry.json` | `v1`（冻结哈希待 B-5-3 实施后复算） | — | 冻结 6 BVID 不变 |

复算命令（独立审查代理在 B-5-3 出门前可逐条复算）：

```bash
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md
```

期望输出与 B-5-2 验收 §2 + `independent-b5-1-b5-2-implementation-audit-2026-10-14.md §3` 完全一致；
任一不一致即 STOP。

## 2. 审计对象

- `stage-b-b5-3-detailed-plan-2026-10-14.md`（B-5-3 详细开发计划）
- `stage-b-b5-3-acceptance-2026-10-14.md`（B-5-3 验收标准）
- `stage-b-six-video-registry.json` v1（6 BVID 注册表）
- `stage-b-route-2-contract-fixtures.json` + `verify-stage-b-route-2-contract-fixtures.py`
  （V2.1 接收与合同 fixtures）
- `contracts/v3_media_grounded_comprehension_v2.schema.json` +
  `contracts/v3_media_grounded_comprehension_v2_1.schema.json`
- `independent-b5-1-b5-2-implementation-audit-2026-10-14.md`（B-5-1 / B-5-2 独立审查
  + B-5-3 readiness 评估）

## 3. 严重度

| 严重度 | 计数 | 结果 |
|---|---:|---|
| Fatal | 0 | 无 secret 扩张、无 cookie 上传、无原始视频 / 音频 / 帧上传、无 Provider 自动切换；`--mute-audio` 边界闭合；fresh isolation 逐 BVID 显式保证；STOP 触发 10 条覆盖所有边界漂移 |
| Major | 0 | 单任务锁单一 Provider 与 composer 局限均有产品代码 + 合同 + fixtures 闭环；V2/V2.1 schema 兼容；6 BVID 注册表哈希冻结；fresh isolation + secret scan 复算命令固定 |
| Minor | 1 | DeepSeek 任务级启用未在 B-5-3 期间使用；B-5-3 默认 MiniMax；独立审查 §8 推荐的 DeepSeek 重写路径 401/403 翻译对齐缺口留待 B-5-3 之后若启用 DeepSeek 时再修（本子阶段不触发） |

## 4. PRD 与架构审查

- B-5-3 真实 fresh 6 BVID 分母与 `stage-b-b5-recovery-development-plan.md §5 DEV-4` 一致；
- 单任务锁单一 Provider 与 `stage-b-multi-provider-structured-output-assessment-2026-10-14.md`
  "fallback policy at most one and explicit" 一致；不允许 best-of-N 拼接；
- V2.1 路径 `<private>/grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`
  与 V2/V1 字节保留与 V3-5.10 Plan + B-5-1 / B-5-2 验收一致；
- Chat 默认 MiniMax 不变；DeepSeek 已通过凭据库安全导入、`selected=false`，与
  `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md` 一致；
- 所有真实 Chrome 实例 `--mute-audio` 与 stage-gates §26 末尾 +
  `stage-b-b5-route-2-risk-stop-2026-10-14.md` 一致；
- fresh Runtime / database / chrome-profile / task 与
  `stage-b-six-video-registry.json v1 freshIsolationRequired` 字段一致。

## 5. Schema 与负例

- V2 + V2.1 schema meta-validation 与 `verify-stage-b-route-2-contract-fixtures.py`
  通过 Draft 2020-12 meta；
- 负例 N01..N10 冻结；N02/N05/N08 与 brief 长度 / 原始前缀 / Provider 资格 不交叉；
  V2 与 V2.1 schema 兼容性已在 B-5-1 / B-5-2 验证；
- brief 长度门槛 20-100 在 MR-02 与 DOI-02 中保持不变；composer 不调整阈值；
- B-5-3 期间 product code 不动 → V2/V2.1 schema / fixtures / verifier / addendum
  字节不变。

## 6. 安全与隐私

- Provider receipt 仅记录 `providerId / modelId / endpointClass / structureMode /
  attemptId / latencyMs / requestSha256 / responseSha256 / usage / finishReason`；
  不写入密钥、原始视频、Cookie、本地 secret path；
- Cookie / 密钥仅在 OS Credential Vault；SQLite 仅保留 `api_key_ref` /
  `secret_storage` / 不可逆展示掩码；SQLite 中完整密钥命中 0；
- raw upload counters：原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径 0；授权范围内
  派生 transcript / OCR / vision-caption 文本允许发送；
- `templates/secret_scan.py` + `audit-subagent secret scan` 在真实 run 后必须 0 命中；
  MR-06 与 DOI-06 校验；
- `stage-b-b5-3-acceptance-2026-10-14.md §2 AR-4` 4 条复算命令固定，
  任一命中即 STOP。

## 7. Minor 风险与剩余

- **M-1（沿用 B-5 恢复实施前审计 M-1）六个固定 BVID 实际访问性**：当前真实 fresh
  未启动；只有 `BV1hMpE6FEXG` 与 `BV1pohR6rEEh` 有历史可见证据，其他 4 个 BVID
  访问性需 fresh 实证；
- **M-2（沿用 B-5 恢复实施前审计 M-2）DeepSeek 任务级启用与上传**：B-5-3 期间不启用
  DeepSeek 任务级；DeepSeek 任务级启用与真实项目派生文本上传仍待用户单独高风险授权
  才能进入 B-5-3 之后任何 fresh run；
- **M-3（新增）DeepSeek 重写路径 401/403 翻译对齐缺口**：独立审查 §8 推荐项；
  B-5-3 默认 MiniMax 不触发；若 B-5-3 之后启用 DeepSeek 任务级，需先在
  `synthesis.py::DeepSeekStrictGroundedSynthesisProvider._complete_once` 重写路径
  补 401/403 翻译并在 `stage-b-b5-recovery-preimplementation-audit.md §1` 追加
  product code SHA-256 变更说明。

## 8. 独立审查闭环

- B-5-3 文档冻结后必须由独立 Claude Code CLI 审查代理在每 BVID 落盘后逐条复算
  AR-1..AR-12 的复算命令；
- 审查报告必须按 `evidence-paths.md` 收纳 SHA-256；不得复用历史 run hash；
- 审查未通过 Fatal=M-6/SHA 不匹配 / ≥2 blocked / 6 upload counters 非 0 时，
  B-5-3 不得继续后续 BVID；保留可复算证据 + STOP 报告。

## 9. 出本审计结论

- **DOCUMENT CANDIDATE PASS / READINESS CONDITIONAL PASS**（与
  `independent-b5-1-b5-2-implementation-audit-2026-10-14.md §9.2` 一致）；
- B-5-3 启动权限：本轮 session 用户授权已一次性覆盖完整 6 BVID fresh run；
  执行序列由 dev plan §4 步骤 5 串联执行，不要求也不允许在每个 BVID 前再次等待
  用户开关；
- B-5-3 默认 MiniMax；DeepSeek 任务级启用本子阶段不启用；
- B-5-3 出门后才进入 B-5-4 / B-5-5 / B-5-6 / B-5-7；B-6 / B-7 / Stage C / D / E /
  V3-6 / V3-7 仍 NO-GO；
- 本审计不实施任何 Chrome、Runtime、Provider 或上传动作；不在 product code 中创建、
  修改或删除任何文件。

## 10. STOP 触发（与 dev plan §9 / acceptance plan §5 一致）

1. `blocked` BVID 数 ≥ 2；
2. 任何禁止数据上传（原始视频 / 音频 / 帧 / Cookie / API key / 本地路径 / dsKey.txt）；
3. 任何 Chrome 实例缺少 `--mute-audio`；
4. 任何 BVID 6 upload counters ≠ 0；
5. 任何 secret scan 命中；
6. 任何 HTTP 502 路径漂移；
7. 任何 V2 / V1 历史字节改动；
8. 任何 product code SHA-256 与 B-5-2 验收时不一致；
9. 任何 cross-run 复用产物（旧产物路径被新 task 覆盖）；
10. 任何失败 1 次 retry 后仍未通过。

## 11. 拒绝清单（与 B-5 恢复实施前审计 §10 一致）

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 降低 brief 长度、claims 数、章节覆盖率门槛；
- 跨 Provider 拼接、最佳 N 选一、自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本（本轮 session 用户授权已生效，
  本审计不扩大解读）；
- 凭旧产物或将 sentinel 评分顶替新评分。
