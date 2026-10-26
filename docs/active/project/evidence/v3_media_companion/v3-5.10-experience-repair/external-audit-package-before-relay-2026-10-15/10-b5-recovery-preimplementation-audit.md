# Stage B B-5 恢复实施前审计（V3-5.10）

日期：2026-10-14。范围：审查 `stage-b-b5-recovery-development-plan.md` 与 `stage-b-b5-recovery-acceptance-plan.md` 在权威状态词、安全边界、单任务 Provider 锁定、固定 BVID 分母与外部审查闭环上的合规性。

## 1. 实施前指纹基线（未跟踪产品代码当前 SHA-256）

B-5 实施前必须落盘以下两文件当前字节 SHA-256 作为可复算起点；任一文件字节在 DEV-3 实施时发生变动，需重算并以本节风格追加变更说明，不得静默改动。

| 文件 | 当前字节 SHA-256 | 大小 | mtime (UTC) |
|---|---|---:|---|
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997` | 18202 | 2026-10-14T13:20:00Z |
| `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a` | 34343 | 2026-10-14T13:20:00Z |

复算命令（独立审查代理在 B-5 出门前可逐条复算）：

```bash
cd <repo_root>
sha256sum services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
          services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py
```

与 stage-a 既有实现差异列表（截至 2026-10-14）：
- `quality.py` 当前仅承载 stage-b 起草期间的 selection/dedup 草案与 `format = "；"` 规范化；与 stage-a 既有 V1 comprehension 不存在函数级复用。
- `service.py` 当前仅承载 stage-b Route 2 起草期间的 composer 入口与 `0600` atomic replace 草案；与 stage-a 既有 V1 comprehension 不存在函数级复用。
- 两文件均未与现有 V1/V2 grounded-comprehension 路径联通，**不得在 B-5 实施前被任何生产路径引用**。
- 若 B-5 实施时两文件任一字节发生变动，必须在本表重算并以本节风格追加变更说明；不得静默改动。

## 2. 审计对象

- `stage-b-b5-recovery-development-plan.md`（B-5 恢复详细开发计划）
- `stage-b-b5-recovery-acceptance-plan.md`（B-5 恢复验收计划）
- `stage-b-six-video-registry.json` v1（6 BVID 注册表）
- `stage-b-route-2-contract-fixtures.json` + `verify-stage-b-route-2-contract-fixtures.py`（V2.1 接收与合同 fixtures）
- `contracts/v3_media_grounded_comprehension_v2.schema.json` + `contracts/v3_media_grounded_comprehension_v2_1.schema.json`
- `stage-b-route-2-deterministic-brief-composer-replan.md`（Route 2 文档与实施范围）
- `stage-b-deepseek-strict-adapter-plan-2026-10-14.md` + `stage-b-deepseek-strict-adapter-implementation-exit-2026-10-14.md`
- `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md`
- `stage-b-b5-provider-contract-risk-stop-2026-10-13.md` / `stage-b-b5-route-2-risk-stop-2026-10-14.md`

## 3. 严重度

| 严重度 | 计数 | 结果 |
|---|---:|---|
| Fatal | 0 | 无 secret 扩张、无 cookie 上传、无原始视频/音频/帧上传、无 Provider 自动切换 |
| Major | 0 | 单任务锁单一 Provider 与 composer 局限均有文档/合同与 fixtures 闭环 |
| Minor | 2 | 六视频 BVID 真实 fresh 实施仍待用户高风险授权；DeepSeek 任务级选择与上传仍待用户单独高风险授权 |

## 4. PRD 与架构审查

- B-5 接收链路与 `stage-b-route-2-deterministic-brief-composer-replan.md` 一致；composer 不创造 claim，不截断/不 pad/不 paraphrase，raw transcript 不接收。
- 单任务锁单一 Provider 与 `stage-b-multi-provider-structured-output-assessment-2026-10-14.md` 中 "fallback policy at most one and explicit" 一致；不允许 best-of-N 拼接。
- V2.1 路径 `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json` 与 V2/V1 字节保留等均与 V3-5.10 Plan 一致。
- Chat 默认 MiniMax 不受影响；DeepSeek 已通过凭据库安全导入、`selected=false`，与 chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md 一致。
- 所有真实 Chrome 实例 `--mute-audio` 与 stage-gates 中 26 节末尾与 `stage-b-b5-route-2-risk-stop-2026-10-14.md` 一致。
- fresh Runtime/database/chrome-profile/task 与 stage-b-six-video-registry.json v1 `freshIsolationRequired` 字段一致。

## 5. Schema 与负例

- V2 + V2.1 schema meta-validation 与 `verify-stage-b-route-2-contract-fixtures.py` 通过 Draft 2020-12 meta。
- 负例 N01..N10 冻结，N02/N05/N08 与 brief 长度/原始前缀/Provider 资格 不交叉：必须在 B-5 实施前验证 V2 与 V2.1 schema 兼容性，并在 V2.1 接收路径下生成 2/2 positive + N01/N07 schema negative。
- brief 长度门槛 20-100 在 MR-02 与 DOI-02 中保持不变；composer 不调整阈值。

## 6. 安全与隐私

- Provider receipt 仅记录 ID/model/endpointClass/structureMode/attemptId/latencyMs/requestSha256/responseSha256/usage/finishReason；不写入密钥、原始视频、Cookie、本地 secret path。
- Cookie/密钥仅在 OS Credential Vault；SQLite 仅保留 `api_key_ref`、`secret_storage`、不可逆展示掩码；SQLite 中完整密钥命中 0。
- raw upload counters：原始视频/音频/帧/Cookie/密钥/本地路径 0；授权范围内派生 transcript/OCR/vision-caption 文本允许发送。
- `templates/secret_scan.py` 与 `audit-subagent secret scan` 在真实 run 后必须 0 命中；MR-06 与 DOI-06 校验。

## 7. Minor 风险与剩余

- **M-1，六个固定 BVID 实际访问性**：当前真实 fresh 未启动；只有 `BV1hMpE6FEXG` 与 `BV1pohR6rEEh` 有历史可见证据，其他 4 个 BVID 访问性仍需 fresh 实证。
- **M-2，DeepSeek 任务级启用与上传**：当前 Chat 默认仍是 MiniMax；DeepSeek 任务级启用与真实项目派生文本上传必须用户单独高风险授权才能进入 B-5 fresh。

## 8. 独立审查闭环

- B-5 文档冻结后必须重启独立 Claude Code CLI 审查，复算 SHA-256 与 schema meta；预期与 Route 2 审查一致的 Minor 范畴。
- 审查报告必须按 evidence/v3_media_companion/v3-5.10-experience-repair/evidence-paths.md 收纳 SHA-256；不得复用历史 run hash。
- 审查未通过 Fatal=M-6/SHA 不匹配时，B-5 不得启动实施。

## 9. 出本审计结论

- **DOCUMENT CANDIDATE PASS / IMPLEMENTATION NO-GO pending external independent document audit and explicit B-5 recovery high-risk authorization**。
- B-5 仍是 FAIL/REPLAN；B-6/B-7/Stage C/D/E 与 V3-6/V3-7 仍 NO-GO。
- 本审计不实施任何 Chrome、Runtime、Provider 或上传动作；不在 product code 中创建、修改或删除任何文件。

## 10. 拒绝清单

- 单元测试/合规模型/旧 run 拼接顶替真实 fresh run；
- 降低 brief 长度、claims 数、章节覆盖率门槛；
- 跨 Provider 拼接、最佳 N 选一、自动 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独高风险授权时上传真实项目派生文本；
- 凭旧产物或将 sentinel 评分顶替新评分。