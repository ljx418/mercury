# Stage B B-5 恢复详细开发计划（V3-5.10）

日期：2026-10-14。范围：V3-5.10 Stage B B-5 真实 fresh 六视频分母的恢复与单任务 Provider 锁定实施边界。本计划是状态纠偏后第一份冻结开发计划，不授权立即执行真实 Chrome / Runtime / 上传；恢复实施仍需用户单独下达高风险授权。

## 1. 背景

- `stage-b-b5-route-2-risk-stop-2026-10-14.md`：Route 2 实施 LIMITED PASS 但 B-5 FAIL/REPLAN。固定 `BV1pohR6rEEh` 第一次 Provider brief < 20 字、第二次 provider breakdown 不通过 claims cardinality，Composer 按合同未被调用；继续不后端代理试图换 MiniMax 结果会触发拼凑假绿风险。
- `stage-b-deepseek-strict-adapter-implementation-exit-2026-10-14.md`：DeepSeek strict adapter DS-1..DS-5 LIMITED PASS，结构 20/20，但只证明 JSON 形状，不证明内容正确，亦不替代默认 Provider。
- `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md`：MiniMax 仍为默认；DeepSeek 已通过 Windows Credential Vault 安全导入，`selected=false`；首次使用不诱导、不自动切换。
- 历史 MiniMax 真实失败保留为只读，不得被改写为当前输入。

## 2. 范围与不扩展

- 范围仅为 B-5 真实 fresh 六视频分母：依次取得 6 个 `attempt_fresh` disposition、输出独立 V2.1 `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json` 产物、机器门槛全过。
- 不扩展到：B-6 宿主语义审查、B-7 独立实施出门审计、Stage C/D/E、V3-6/V3-7、阈值降低、跨 Provider 拼接、最佳 N 选一、自动 fallback、SecretStore 兼容列回填、原始视频/音频/帧上传、Cookie 复活、脚本退出和临时文件路径清理。

## 3. 架构与责任边界

- 单任务锁单一 Provider。允许的 Provider 选择（仅在 Settings 手动选择后）：
  - `minimax_chat_completions`：默认路径，V3-3 LIMITED PASS 范围内。
  - `deepseek-strict-tool`：仅 `deepseek-chat` 模型在 `deepseek_beta_strict_tool_v1` 资格下可用，不与 MiniMax 同时运行同一任务。
- 任务级 composer 自动从默认路由与单个手动选择 Provider 中二选一；严禁隐式跨 Provider fallback、最佳 N、隐式拼接。
- B-5 接收链路：
  - `ProviderAttempt` → `JSON schema validator` → `semantic/evidence validator` → `task/revision/authorization freshness validator` → `atomic publication`。
  - 全部失败关闭路径保持 fail-closed；不允许阈值降低、补丁插入 claim、简化失败码。
- V2.1 路径与读取优先级：`grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`，读取优先 V2.1，其次 V2，最后 V1。

## 4. 固定六视频分母

`stage-b-six-video-registry.json` v1：

| `order` | `bvid` | `requiredDisposition` | `freshIsolationRequired` | Chrome flags |
|---:|---|---|---|---|
| 1 | `BV1pohR6rEEh` | `attempt_fresh` | runtime / database / chromeProfile / task | `--mute-audio` |
| 2 | `BV1hMpE6FEXG` | `attempt_fresh` | 同上 | `--mute-audio` |
| 3 | `BV1VHHe6kEH3` | `attempt_fresh` | 同上 | `--mute-audio` |
| 4 | `BV1SDHy6aEiB` | `attempt_fresh` | 同上 | `--mute-audio` |
| 5 | `BV1vSHD6tEsM` | `attempt_fresh` | 同上 | `--mute-audio` |
| 6 | `BV1FCps68EGf` | `attempt_fresh` | 同上 | `--mute-audio` |

- `allowedFinalDispositions = ["complete", "limited", "blocked", "failed"]`。
- `positiveDisposition = "complete"`；`maximumBlockedForStageExit = 1`；`substitutionAllowed = false`；`crossRunArtifactReuseAllowed = false`。
- 不得以“不可访问/受限”为由静默替换或从分母移除；至少 1 个 blocked 仍允许退出，>=2 个 blocked 触发 NO-GO/REPLAN。

## 5. 详细开发顺序

### DEV-1 文档冻结与外部审查（恢复前置，零代码）

- 子项：
  - 重新冻结开发计划（本文件）、验收计划 `stage-b-b5-recovery-acceptance-plan.md` 与实施前审计 `stage-b-b5-recovery-preimplementation-audit.md`。
  - `contracts/v3_media_grounded_comprehension_v2_1.schema.json` 与 `stage-b-route-2-contract-fixtures.json` 重新冻结。
  - 完整列明接收链路与失败码的清单；外部独立文档审查 Fatal=0 / Major=0。
  - **质量/服务两文件当前 SHA-256 落盘**：`quality.py` 当前 `ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997`、`service.py` 当前 `579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a`；DEV-3 实施前两文件任一字节变动必须重算并在 `stage-b-b5-recovery-preimplementation-audit.md §1` 中追加变更说明。
- 出门：审计结论与 SHA-256 在审查包登记；上述两文件指纹与 stage-a 既有实现的差异列表已写入 `stage-b-b5-recovery-preimplementation-audit.md §1`。

### DEV-2 Provider 集中授权边界（接收与路由）

- 子项：
  - Settings：默认 MiniMax；DeepSeek 保存 ≠ 选择；首次使用不诱导，不自动切换。
  - 任务级 Provider 锁定：单任务仅一个权威 Provider；`provider_settings` 在任务级 receipt 中写入 `providerId / model / endpointClass / structureMode / attemptId / latencyMs / requestSha256 / responseSha256 / usage / finishReason`。
  - 失败分类：unavailable、timeout、empty、malformed、schema-invalid、refusal、authorization-denied。Refusal / authorization-denied 不触发自动 fallback。
- 出门：原 HTTP 502 路径不变；新增 provider 字段在 V2.1 写入，但不跨越原 V2 schema。

### DEV-3 单任务 Composer 接收与原子发布

- 子项：
  - `quality.py`：确定性 selection；normalize `format = "；"`；不引入 claim 文本，不截断、不 pad、不 paraphrase；raw transcript 不接收。
  - `service.py`：执行限定一次 provider repair；`V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` 才进入 composer；所有语义/事实/权限失败回到原始 provider 失败。
  - 原子发布：`0600` 临时文件 + atomic replace；revision/catalog 漂移拒绝提交；只接受 V2.1 路径；V2/V1 字节保留。
- 出门：composer 路径下完整 V2.1 写入；raw transcript 不被读取；HTTP 502 路径不变。

### DEV-4 真实 fresh 6 视频分母（B-5）

- 子项：
  - 6 个 BVID 各自 fresh Runtime/database/chrome-profile/task；每个任务完整锁 PrimaryProvider，6 个任务可分批调整（不混批、不拼接、不复用产物）。
  - 单任务 1 个 Provider；下载仅限既有授权范围内的派生文本（transcript / OCR / vision-caption）；0 原始视频/音频/帧/Cookie/密钥上传。
  - 每个 Chrome 实例显式带 `--mute-audio`；不允许 Xvfb 静音。
  - 失败/取消/重启/进程退出/路径异常/cookie 异常/页异常/lease 失效：Traceback 流程可复算；当前临时媒体、cookie、token、profile 与残留在退出后被清理。
  - 全部完成后写入独立产物 `grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`，附带 receipt、provider list、fingerprint、secret 扫描结果。
- 出门：所有可机器入口 PASS 且每个任务写入独立 V2.1 产物；不得拼凑、不得调低门槛。

### DEV-5 B-6 宿主语义审查（独立审查，需另起实施门禁）

- 子项：
  - 独立宿主模型 ID、prompt SHA-256、session ID 记录到 receipt；盲评不提供 Provider/model。
  - 6 个 BVID 独立评分（accuracy / whole-span coverage / fit / chapter boundary），每项 ≥ 4，零 critical 错误。
  - 1 个 sentinel 视频 BVID 同主题同主要论点重复；任何实质性反转 Major。
- 出来条件：宿主语义评审的 PASS；不取代 B-7 独立出门审查。

### DEV-6 B-7 独立实施出门审查

- 子项：
  - 独立 Claude Code CLI / Orca reviewer 与 B-6 责任人和实现责任人不同。
  - Fatal=0 / Major=0；只接受 6 个 BVID 全 PASS，额外接受 1 个 blocked。
- 出来条件：B-7 出门后 Stage C 可进入详细计划，不在本期范围。

## 6. Provider 与隐私边界

- 单任务仅一个权威 Provider；Provider 选择与 Chat Provider 选择同时默认 MiniMax；DeepSeek 仅以 “保存 ≠ 选择” 原则使用；任务中 Chat Provider 仍未启用 DeepSeek 才允许。
- 不扩展现有云授权范围：仅发送授权范围内派生 transcript / OCR / vision-caption 文本。
- Cookie/密钥/原始视频/音频/帧/本地路径/本地 secret path 始终为 0 上传；密钥仅在 OS Credential Vault / Windows Credential Vault；SQLite 仅保留 `api_key_ref`、`secret_storage`、不可逆展示掩码。
- 不引入不属于本次 B-5 的新 Provider/Route 参数/未公开敏感路径。

## 7. 失败与回滚

- 任一 BVID 超过 1 次 retry 后未通过，B-5 仍 FAIL/REPLAN；保留 6 个真实 run trace 与原文重跑路径。
- 任一独立审查或宿主评审 Major 上升，立即停止后续 BVID；保留可复算证据。
- 单次失败不得重置 account/凭据；不得重写历史失败证据。