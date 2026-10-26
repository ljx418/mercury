# Stage B B-5-3 Phase 0 实施前审计（runner 恢复审计、测试补齐、根因定位，2026-10-15）

日期：2026-10-15。范围：审计 Phase 0 详细计划 + 验收标准在以下方面的合规性：
- 权威状态词与子阶段命名（Phase 0 仅恢复审计 / 测试 / 根因定位，不启动真实 run）；
- 是否扩大权限 / 改变隐私边界 / 改变固定分母；
- 是否修改 product code / schema / 合同 / fixtures；
- 是否 commit / push；
- 是否替独立审查作 PASS。

本审计不实施任何 Chrome / Runtime / Provider / 上传动作；不修改 product
code；唯一新增文件即本审计报告 + Phase 0 系列文档 + 测试文件 + 最小 runner 修复。

## 1. 实施前指纹基线（Phase 0 期间不动）

| 文件 | SHA-256（Phase 0 完成后） | 与 B-5-2 验收一致性 |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc`（未变） | 一致 |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8`（未变） | 一致 |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py` | `34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168`（未变） | 一致 |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99`（未变） | 字节不变（V2 immutable） |
| `docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135`（未变） | M-B5-1-01 闭合后 |
| `stage-b-route-2-contract-fixtures.json` | `db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705`（未变） | M-B5-1-01 闭合后 |
| `verify-stage-b-route-2-contract-fixtures.py` | `dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e`（未变） | M-B5-1-01 闭合后 |
| `stage-b-route-2-contract-addendum.md` | `779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153`（未变） | M-B5-1-01 闭合后 |
| `stage-b-six-video-registry.json` | v1（未变） | 冻结 6 BVID 不变 |

runner 修改范围（最小）：
- `scripts/stage_b_b5_3/run_one_bvid.mjs`：仅轮询目标 + try/catch + 诊断文案 +
  状态合成 + synthesizeTaskId 命名 + expectedRevision 替换；行数约 +20 / -8；
- 不修改 `services/local-runtime/`、`apps/chrome-extension/`、`docs/`、
  `tests/`、`schemas/`。

复算命令（独立审查代理在 Phase 0 出门前可逐条复算）：

```bash
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

期望：所有 SHA 与 B-5-2 验收 §2 + `independent-b5-1-b5-2-implementation-audit-2026-10-14.md §3` 完全一致；任一不一致即 STOP。

## 2. 审计对象

- `stage-b-b5-3-phase0-detailed-plan-2026-10-15.md`（Phase 0 详细开发计划）
- `stage-b-b5-3-phase0-acceptance-criteria-2026-10-15.md`（Phase 0 验收标准）
- `stage-b-b5-3-phase0-root-cause-2026-10-15.md`（Stage A 根因）
- `stage-b-b5-3-phase0-test-results-2026-10-15.md`（测试结果）
- `stage-b-b5-3-phase0-prd-review-2026-10-15.md`（PRD 检视）
- `stage-b-b5-3-phase0-handoff-2026-10-15.md`（handoff 给独立审查）
- `stage-b-b5-3-phase0-minimal-fix-runner-should-not-apply-2026-10-15.md`
  （最小修复点）
- `scripts/stage_b_b5_3/lib/contracts.mjs`（新增，纯 helper）
- `scripts/stage_b_b5_3/test/contracts.node-test.mjs`（新增，48 项测试）
- `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`（新增，11 项测试）
- `scripts/stage_b_b5_3/test/_fixtures/stub_runner.mjs`（新增，测试沙箱）
- `scripts/stage_b_b5_3/test/_fixtures/sequencer_alt.mjs`（新增，测试沙箱）
- `scripts/stage_b_b5_3/run_one_bvid.mjs`（最小修改）

## 3. 严重度

| 严重度 | 计数 | 结果 |
|---|---:|---|
| Fatal | 0 | Phase 0 不启动真实 run；不修改 product code / schema / 合同 / fixtures；不扩展权限；不改变隐私边界；不动 6 BVID 固定分母；STOP 触发 10 条全部维持 |
| Major | 0 | 测试 59/59 PASS；最小 runner 修复受 `task_store.py:197-231` + `v3-media-experience-stage-a-fresh.mjs:578,589-591` 支持；不替换任何 stub 顶替 fresh |
| Minor | 2 | 见 §7 |

## 4. PRD 与架构审查

- Phase 0 不启动真实 fresh run，与 `handoffs/.../02-remaining-development-plan.md
  §Phase 0` 一致；
- 单任务锁单一 Provider 与 `stage-b-multi-provider-structured-output-assessment-2026-10-14.md`
  "fallback policy at most one and explicit" 一致；不允许 best-of-N 拼接；
- 测试不引入新的 Provider / Runtime / Chrome 路径，不修改 product code；
- Chat 默认 MiniMax 不变；DeepSeek 已通过凭据库安全导入、`selected=false`；
- 所有真实 Chrome 实例 `--mute-audio` 与 stage-gates §26 末尾 +
  `stage-b-b5-route-2-risk-stop-2026-10-14.md` 一致（Phase 0 不启动真实
  Chrome）；
- fresh Runtime / database / chrome-profile / task 与
  `stage-b-six-video-registry.json v1 freshIsolationRequired` 字段一致。

## 5. Schema 与负例

- Phase 0 不动 schema / fixtures / verifier / addendum；
- V2 / V2.1 schema 兼容性已在 B-5-1 / B-5-2 验证；本 Phase 0 不再触碰；
- brief 长度门槛 20-100 在 MR-02 与 DOI-02 中保持不变；composer 不调整
  阈值；
- 测试不构造 negative / positive fixture 顶替既有验证；
- 测试不调用 `verify-stage-b-route-2-contract-fixtures.py`（保留给独立
  审查在 Phase 0 出门时复算）。

## 6. 安全与隐私

- Provider receipt 仅记录 `providerId / modelId / endpointClass /
  structureMode / attemptId / latencyMs / requestSha256 / responseSha256 /
  usage / finishReason`；不写入密钥、原始视频、Cookie、本地 secret path
  （不动 product code）；
- Cookie / 密钥仅在 OS Credential Vault；SQLite 仅保留 `api_key_ref` /
  `secret_storage` / 不可逆展示掩码；SQLite 中完整密钥命中 0（不动
  product code）；
- raw upload counters：原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径 0；
  授权范围内派生 transcript / OCR / vision-caption 文本允许发送（runner
  本阶段未启动，无相应路径触发）；
- 测试 secret 扫描覆盖 6 PATTERN 阳性 + 7 类良性 + 目录递归扫描；
- 测试 6 upload counters 上传零校验覆盖 0/1/多 offender 三类。

## 7. Minor 风险与剩余

- **M-1**（沿用 B-5 恢复实施前审计 M-1）六个固定 BVID 实际访问性：
  Phase 0 不启动 fresh run；该风险随 Phase 1 启动继续观察。
- **M-2**（新增）synthesize 端点依赖 `media_tasks` 行存在：当前扩展不发
  `POST /v1/media/outline-tasks`，Phase 1 启动前必须先在 runner 中补
  outline-task 创建或调 store.create()；本计划仅落盘该缺口，不扩大权限 /
  改变隐私边界。
- **M-3**（新增）`chrome.permissions.request` native prompt：扩展不发
  `media-companion-enable` 点击 + 无 X11 fake-click 模拟 native prompt，
  resolve 流程无法触发；Phase 1 启动前必须先在 runner 中复用
  `v3-media-experience-stage-a-fresh.mjs:340-372` 的 X11 ctypes fake-click；
  本计划仅落盘该缺口，不扩大权限 / 改变隐私边界。

## 8. 独立审查闭环

- Phase 0 文档冻结后必须由独立 Claude Code CLI 审查代理在 Phase 0 出门前
  逐条复算 PH0-AR-1..PH0-AR-7 的复算命令；
- 审查报告必须按 `evidence-paths.md` 收纳 SHA-256；不得复用历史 run hash；
- 审查未通过 Fatal=M-6/SHA 不匹配 / 测试失败 / 6 upload counters 非 0
  时，Phase 0 不得继续；保留可复算证据 + STOP 报告。

## 9. 出本审计结论

- **PHASE 0 DOCUMENT CANDIDATE PASS / READINESS CONDITIONAL PASS**：
  Phase 0 仅恢复审计 / 测试补齐 / 根因定位 + 最小 runner 修复；不启动真实
  fresh run；runner 修复受 `task_store.py` + `coordinator.py` +
  `v3-media-experience-stage-a-fresh.mjs` 既有文档支持；
- Phase 0 期间工作树不动 product code / schema / 合同 / fixtures；
- Phase 0 期间不 commit / push；
- Phase 0 出门后才进入 Phase 1（B-5-3 真实六视频 fresh run）；
- B-5-4 / B-5-5 / B-5-6 / B-5-7 / B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 /
  Chat / Know 仍 NO-GO；
- 本审计不实施任何 Chrome、Runtime、Provider 或上传动作；不在 product code
  中创建、修改或删除任何文件。

## 10. STOP 触发（与 B-5-3 detailed plan §3 / §9 / acceptance §3 一致）

1. `blocked` BVID 数 ≥ 2（Phase 0 不启动 fresh run，不触发）；
2. 任何禁止数据上传（Phase 0 不启动 fresh run，不触发）；
3. 任何 Chrome 实例缺少 `--mute-audio`（Phase 0 不启动 fresh run，不触发；
   runner 内 `--mute-audio` 强校验保留）；
4. 任何 BVID 6 upload counters ≠ 0（Phase 0 不启动 fresh run，不触发；
   runner 内 upload counter 强校验保留）；
5. 任何 secret scan 命中（Phase 0 不启动 fresh run，不触发；runner 内 secret
   scan 强校验保留）；
6. 任何 HTTP 502 路径漂移（Phase 0 不启动 fresh run，不触发）；
7. 任何 V2 / V1 历史字节改动（Phase 0 不动 product code / schema）；
9. 任何 cross-run 复用产物（Phase 0 不启动 fresh run）；
10. 任何失败 1 次 retry 后仍未通过（Phase 0 不启动 fresh run）。

## 11. 拒绝清单（与 B-5 恢复实施前审计 §11 一致）

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 降低 brief 长度、claims 数、章节覆盖率门槛；
- 跨 Provider 拼接、最佳 N 选一、自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本；
- 凭旧产物或将 sentinel 评分顶替新评分；
- Phase 0 期间启动真实 fresh run；
- Phase 0 期间修改 product code；
- Phase 0 期间 commit / push。