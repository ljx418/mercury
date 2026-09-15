# T04 R4 隔离快照复验验收计划

日期：2026-09-14  
状态：`FROZEN DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 固定验收分母

| ID | 必须结果 |
|---|---|
| T04-A01 | SnapshotInputManifest 的 product base、T02.5 raw/seal、T03 candidate 134804、审计 hash、T04 local acceptance commit、tree/index/toolchain 全部可重算；旧 132413 明确拒绝 |
| T04-A02 | T01/R2/T03/T04 的相对 import、Schema、spec、registry、fixture、lockfile 和命令入口形成完整依赖闭包；`missingEdges=0`、`undeclaredReads=0`、`unexpectedFiles=0` |
| T04-A03 | detached snapshot 可从空目录重建；主工作树 HEAD/index 不变；产品路径与 T02.5 product snapshot byte-equal；依赖只从 manifest 读取 |
| T04-A04 | R4-P 在隔离快照中实际执行四步且 exitCode 全 0；十项 deterministic artifact byte-equal；InvocationRecord 仅 `/recordedAt` 可归一化，其他 mismatch=0 |
| T04-A05 | R4-E 使用全新 build/profile/Runtime/database/run/output 执行真实 Chrome；不得复用或链接 T02.5/R4-P artifact；失败 run 不 seal |
| T04-A06 | R4-E 新 raw 独立满足 T02 固定 12 项及 production-positive 分母：6+3+3 source、三入口、5x4 route、2 recovery、3x4 Forget、四 fault、四 viewport、Axe 0/0、Keyboard 5/5、T01 36/36、0 orphan |
| T04-A07 | 只以 R4-E 新 raw 完整执行 T03-A01..A14；每项有独立结果，无 N/A，不从 T02.5 或 R4-P 借分母 |
| T04-A08 | R4-E candidate 精确执行 63 RuleId、109 contract cases、42 production mutations、204 或由新 raw 重算的完整 Status 分母；G4 读取本 T04 commit Git blob 并执行 AST |
| T04-A09 | R4-P 的 byte comparison 与 R4-E 的 semantic invariant comparison 分开建模；动态 runId/time/requestId 不得加入 byte-equal 白名单，R4-E 只按正式合同和分母重算 |
| T04-A10 | T04-N-001..025 全部从各自 valid base 单独变异并命中登记 primary failure；不能只改 Report、result 或 passed 字段 |
| T04-A11 | 两泳道各自单 run、单 seal、单因果链；最终 R4 production candidate 只引用 R4-E，新旧 run/candidate/泳道交叉引用数为 0 |
| T04-A12 | SnapshotRevalidation、unsigned ExitManifest、JSON/中文 HTML/Drawio、命令日志、测试和审计路径/hash/length 全部可重算；`publicArchivePolicy=payload_only_excludes_exit_manifest_and_independent_audit` 与 tar member index 一致；public secret/private-path scan 0 |
| T04-A13 | frontend full、typecheck、build、Runtime V2、T01 real Chrome、collector、T03 node/contract/mutation/orchestrator 和 R4 tests 全部从隔离 snapshot 实跑并保存原始 exitCode/stdout/stderr |
| T04-A14 | PRD、架构、Drawio 和 false-green 实现方检视无范围扩大；文档外审已通过且其 hash 被绑定；Human Review/G7/final 保持 pending/pending/false；实现方两轮内部审计 Fatal 0/Major 0 |

固定 14 项，无 N/A。任何 failed、pending、deferred 或缺少原始字节均阻止 T04 LIMITED PASS。

新的独立实现出门审查发生在 SnapshotRevalidation、payload archive 和 unsigned ExitManifest 生成之后，是 T04 LIMITED PASS 的外层必要门禁，不写入上述候选自报的 A01..A14，也不写入其引用的 payload archive。该审查必须引用 ExitManifest 原始字节 SHA-256；只有其结论 `Fatal=0 / Major=0` 后，Stage Gate 才能将 T04 标记为 LIMITED PASS。

## 2. R4-P 确定性比较

以下 baseline 路径与 replay 同名路径必须逐字节相等：

```text
derived-facts.json
contract-regression.json
production-mutation-results.json
production-validation.json
architecture-scan-manifest.json
status-contract-errors.json
human-review.pending.json
report.json
acceptance-report.html
production-package.json
```

`invocation-record.json` 只允许在两边删除 JSON Pointer `/recordedAt` 后按 canonical JSON 比较。允许忽略指针的封闭集合精确等于 `[/recordedAt]`；不能用通配符、父对象或额外字段。stdout/stderr 原始字节仍分别比较。若其他动态字段导致 mismatch，应修复确定性来源或重新规划，不得扩大白名单。

## 3. R4-E 用户场景与操作

| 场景 | 操作 | 实际观察 | 出门阈值 |
|---|---|---|---|
| 保存并查看来源 | 在真实宿主页面点击保存，等待 trace_ready，点击查看来源 | trusted DOM -> Background -> Runtime -> Source Detail | `view_source>=3`，稳定 workspace/source，0 orphan |
| 打开工作台 | 分别点击“打开工作台”和“在工作台中打开” | tab create/focus/reuse、prior route、Runtime 重新取数 | 三入口达到分母；重复 ingest=0 |
| 五路由恢复 | 五类 route 分别 direct/reload/Back/reopen | navigation、Runtime authority、最终 route/ID | 20/20；ID mismatch=0 |
| 无效路由回库 | 触发 INVALID_ROUTE 与 WORKSPACE_NOT_FOUND，真实点击回库 | error DOM、trusted click、Source Library route | 至少 2 类，可信恢复 100% |
| Permission | 两容器分别输入会话 token，grant/scan/import/revoke | 真实 API/IO、容器内存隔离、撤销屏障 | 3 origin 各 >=2；路径/token 公开泄漏 0 |
| Durable Forget | 对 3 个 source 二次确认后按四种方式重开 | 12 trigger -> 12 trusted click -> 12 recovery | 同 workspace/source；12/12 `SOURCE_NOT_FOUND`；四面 absent |
| 故障状态 | adapter/data service/source/runtime 四类受控故障 | 区间内状态或 transport failure、截图、恢复 | 四区间不重叠；offline 无成功 Runtime response |
| 可访问性 | 四视口、键盘 Trace/dialog/error recovery | PNG 解码、surface、Axe、keyboard | 360/420/768/1280；serious=0、critical=0；5/5 |

## 4. Mandatory negative registry

| ID | requirementKey | 主要失败 |
|---|---|---|
| T04-N-001 | dependency_closure_missing_relative_import | `T04_DEPENDENCY_CLOSURE_INVALID` |
| T04-N-002 | dependency_file_hash_mismatch | `T04_DEPENDENCY_CLOSURE_INVALID` |
| T04-N-003 | lockfile_or_toolchain_unbound | `T04_ENVIRONMENT_NOT_REPRODUCIBLE` |
| T04-N-004 | product_snapshot_path_drift | `T04_PRODUCT_SNAPSHOT_DRIFT` |
| T04-N-005 | stale_t03_candidate_selected | `T04_BASELINE_CANDIDATE_INVALID` |
| T04-N-006 | sealed_t02_input_modified | `T04_BASELINE_INPUT_MODIFIED` |
| T04-N-007 | main_worktree_used_as_runtime_source | `T04_ISOLATION_BOUNDARY_FAILED` |
| T04-N-008 | nonempty_or_overwritten_replay_output | `T04_OUTPUT_IMMUTABILITY_FAILED` |
| T04-N-009 | deterministic_artifact_byte_mismatch | `T04_REPLAY_MISMATCH` |
| T04-N-010 | invocation_normalization_pointer_widened | `T04_REPLAY_NORMALIZATION_INVALID` |
| T04-N-011 | replay_step_not_actually_executed | `T04_INVOCATION_EVIDENCE_INVALID` |
| T04-N-012 | fresh_chrome_lane_missing | `T04_FRESH_E2E_REQUIRED` |
| T04-N-013 | fresh_lane_reuses_baseline_artifact | `T04_CROSS_RUN_EVIDENCE_MIXED` |
| T04-N-014 | fresh_raw_not_independently_sealed | `T04_FRESH_RAW_INVALID` |
| T04-N-015 | inherited_t03_denominator_missing | `T04_T03_REGRESSION_FAILED` |
| T04-N-016 | rule_fixture_mutation_count_reduced | `T04_VALIDATION_DENOMINATOR_MISMATCH` |
| T04-N-017 | architecture_scan_trusts_report | `T04_ARCHITECTURE_REPLAY_FAILED` |
| T04-N-018 | private_or_secret_bytes_in_public_package | `T04_PUBLIC_EVIDENCE_LEAK` |
| T04-N-019 | exit_manifest_artifact_hash_mismatch | `T04_EXIT_MANIFEST_INVALID` |
| T04-N-020 | human_review_auto_signed | `T04_HUMAN_BOUNDARY_VIOLATION` |
| T04-N-021 | g7_or_final_promoted | `T04_CLAIM_OVERREACH` |
| T04-N-022 | legacy_generator_or_validator_used | `T04_LEGACY_PIPELINE_FORBIDDEN` |
| T04-N-023 | comparison_artifact_path_identity_mismatch | `T04_REPLAY_MISMATCH` |
| T04-N-024 | public_archive_membership_policy_mismatch | `T04_EXIT_MANIFEST_INVALID` |
| T04-N-025 | authorization_record_or_audit_binding_mismatch | `T04_INDEPENDENT_AUDIT_REQUIRED` |

实现时 registry 与 case 集合必须精确相等；每个 case 记录 requirementId、requirementKey、expectedLayer、expectedPrimaryFailure 和原始输入 mutation。失败码在 T04 Validation Contracts v1 中封闭枚举，不得临时别名。

## 5. 证据目录

```text
runs/<t04RunId>/
  snapshot-input-manifest.json
  dependency-index.json
  environment-index.json
  replay/
    output/**
    comparison.json
    invocation-record.json
  fresh/
    raw/**
    validation/**
    t02-acceptance.json
    t03-acceptance.json
  snapshot-revalidation.json
  exit-manifest.json
  acceptance-report.zh-CN.html
  logs/**
  audits/**
```

`exit-manifest.json` 在 T04 始终 unsigned；不得生成 `human-review.passed.json`。payload archive 必须先生成且不得包含 ExitManifest 或后续独立审计，validator 必须检查真实 tar member index。PX-6 后续只能签署该 ExitManifest 的精确 SHA-256，任何 T04 产物变化都使签署失效。

## 6. 允许声明

T04 机器及独立审查通过后最多允许：

```text
T04 LIMITED PASS for isolated snapshot revalidation and PX-6 review input.
```

同时必须紧邻声明：

```text
Human Review pending. G7 pending. finalPassed=false.
PX-5 final disposition and PX-6 are not passed.
```
