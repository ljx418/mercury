# V3 P0 Background Capture Relay v8 严格独立只读文档审查

日期：2026-10-15  
审查角色：独立只读 reviewer  
审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`、`01-audit-request.md`  
候选状态：`V8 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`

## 0. 最终结论

**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**

| 严重度 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | 2 |
| Minor | 2 |

v8 的 18 项冻结载荷、39 项静态 verifier、绝大多数关键对抗变异、同步 staging 屏障描述、SQLite 产品终态定义和三个 revision 域均可独立复算。但是 v7 的两个 Major 尚未真正关闭：

1. v7 M1 仍未关闭。同步 stage 可以消除“worker 先于复制”的竞态，但 hard crash 后独立 ASR staging 根没有现有 recover owner；同时主实施提示仍要求以进程内 acquisition succeeded/GET 作为 completed-frame 故障证据，与 v8 的唯一持久产品终态直接冲突。
2. v7 M2 仍未关闭。冻结 inventory 的 `authoritativeScopes`、source hash 证据和实际错误码 emit 文件不相等，因此 36 项仍只是候选自报集合，不能证明是当前源码全集。

此外，删除第六个 handoff failure case 仍触发 `IndexError`/exit 1，故 v7 的稳定结构化拒绝 Minor 也未关闭。不得授权 R0-R7，也不得解锁 P1 六视频。

## 1. 输入与哈希

外审目录是平铺结构：18 个 payload + 1 个 manifest，共 19 个文件。对每项分别读取包内副本和 manifest 指向的权威源，以原始字节独立计算 SHA-256；18/18 三方一致，mismatch=0。

| 载荷 | SHA-256 | 权威源一致 |
|---|---|---|
| `01-audit-request.md` | `d2de08016f3a6311ae71e2e44a67895c2c5d829b286b11518bbb2d80317ed02b` | 是 |
| `02-prd.md` | `247cfa66a3e687915b62b8d3bea2bc26e2e081a8c82b3da1926570db04a163cb` | 是 |
| `03-architecture.md` | `6332f54d84d2c89154294490fe1d0290dab97cc46ae195d02fa994313f497870` | 是 |
| `04-development-plan.md` | `be79ca14e975712312b425e0e5ad01f93cdc7179ee3654f57167c6ba270b7b47` | 是 |
| `05-acceptance-plan.md` | `1194fd7189fdc2f0b6987dfc13985e3150354107b9cd5bec3f947daa0e3792c9` | 是 |
| `06-stage-gate.md` | `a876ea6b01184e81e0fa3d437372aa70363f3d331b101e52d8d7afc257494ed4` | 是 |
| `07-relay-architecture.md` | `89c41b7c329bb284defbcb932d197d156cf029f32e57d3583b9f0b06006bf4b0` | 是 |
| `08-relay-development-plan.md` | `cc85b048a5362e09ee937ef426fa25f0e30379f9a94332fa96be2634fdfa5297` | 是 |
| `09-relay-acceptance-plan.md` | `e4fede4860bdd70f39707c646dbf8f4086d87ac7b5c284fbb3b256cd9ceae096` | 是 |
| `10-relay-preimplementation-audit.md` | `4e222ba852795e50d9bd1647a89b9842ab8ab02ae51f7884128eceb4c040b98d` | 是 |
| `11-phase0-test-results.md` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | 是 |
| `12-v8-replan-closure.md` | `38ef1d523a7a500396b2c6972f7b0e1298a17805ca4d2c382515fa96771e4407` | 是 |
| `13-current-checkpoint.md` | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | 是 |
| `14-relay-architecture.json` | `435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d` | 是 |
| `15-internal-relay-v8.schema.json` | `96c0c324ca2875509ffa9db4d223ece56f6380cd6071c7d3d1d1ea3ac26fda8d` | 是 |
| `16-internal-relay-v8-fixtures.json` | `6dcc63194b9667fe1ad435bfb557e33dff286f25bd307f32d1f28ca30f922c83` | 是 |
| `17-internal-relay-v8-verifier.py` | `c414eedf2b59ccaa9948df84edcc9c009af9ccb8d82744aec4ab79dbf9213e08` | 是 |
| `18-main-implementation-prompt.md` | `d415c9a8d4e2cf1eedecc085ab1de2624448be1f07fda8f3531d4648888a333a` | 是 |

## 2. Findings

### Major 1：同步 barrier 关闭了 worker 竞态，但没有为 hard crash 后的 staged audio 建立恢复 owner；实施提示仍保留 v7 成功语义

v8 架构 `07-relay-architecture.md:95-99` 和机器合同冻结：

```text
sink finalize -> transcript create -> synchronous TaskAudioStager.stage
-> ownership receipt -> async worker start
```

并声称 stage 后由 transcript service 或 existing recover 独占 staged audio 与 acquisition sandbox 的 cleanup。同步屏障本身有真实实现基础：

- `TaskAudioStager.stage()` 在返回前校验 acquisition 引用、源 SHA-256/长度/WAV shape，复制到独立 ASR task root，执行 `flush`/`fsync`，再复核 inode/mtime/长度、目标权限、SHA-256 和 WAV shape（`audio_ref.py:43-105`）。
- 当前 `SenseVoiceTranscriptService.start()` 仍在 daemon thread 内调用 `run()`，而 `run()` 才执行 stage（`transcript_service.py:99-107,117-145`）。因此 R4 确实必须修改 API/调用顺序，不能把当前代码当作已满足。
- 正常进程内终结时，transcript service 先清 ASR stage，再调用 coordinator complete/cancel 清 acquisition sandbox（`transcript_service.py:167-203`）。这个正常路径与 v8 的 owner 顺序可以对齐。

但 hard crash 语义没有闭合：

1. acquisition sandbox 默认在 `~/.cache/navia/media-tasks`，ASR stage 默认在另一个根 `~/.cache/navia/media-asr-tasks`（`app.py:143-154`）。两者不是同一 sandbox。
2. `TaskAudioStager.__init__()` 只创建并 chmod ASR root，没有 owner manifest、进程启动 token或 orphan recovery（`audio_ref.py:34-41`）。它唯一的删除入口是进程内 `cleanup(task_id)`（`audio_ref.py:107-125`）。
3. `MediaAcquisitionCoordinator.recover_interrupted()` 只调用 `self.sandbox.cleanup(task_id)` 清 acquisition root，再调用 `cleanup_unpublished` 清产品 evidence（`coordinator.py:255-305`）。`app.py:1186-1197` 传入的是 `media_product_materializer.cleanup_abandoned`，不是 `TaskAudioStager.cleanup`。
4. Runtime 在 stage receipt 后、worker cleanup 前 hard crash 时，新的 Runtime 可以把 SQLite authority 判为 abandoned，但独立 ASR root 中的 WAV 仍无恢复 owner。此时 v8 的 `cleanup 0`、私有原始音频归零和 fresh single-sink 证据均不成立。

文档还存在一项直接冲突：冻结主实施提示 `18-main-implementation-prompt.md:53` 要求在 `coordinator complete` 注入，并在 completed-frame send 故障时证明 “task still succeeded and GET recoverable”。这正是 v7 被拒绝的进程内成功观察面；它与同一提示 `:39-40`、架构 `:95-99` 和 A15 所说的“completed 仅 handoff 通知，只有 SQLite ready/degraded 是 durable success”冲突。该提示是交给主实施代理的执行权威，不能视作无影响的历史文字。

**必须关闭：**

- 冻结 staged-audio crash recovery 的内部实现实体、owner metadata、调用位置和 receipt。可以扩展现有 recover 的内部 cleanup callback，但必须显式同时清 acquisition sandbox、ASR staged root 和 unpublished product evidence，并证明任一 residual 非零时 recover 失败。
- 增加 `after_stage_before_worker -> hard crash -> Runtime restart -> recover` 的真实故障门槛，检查 ASR root、acquisition root、active sink 和产品 evidence 均为 0，再允许 fresh begin。
- 将 `18-main-implementation-prompt.md:53` 改为 v8 六注入点和 handoff/product 语义；不得再要求 completed send 后 acquisition succeeded/GET 作为持久成功依据。

### Major 2：36 项 source inventory 的权威 scope、哈希证据和实际 emit 文件不闭合

v8 声称 v7 漏项已经通过 36 source / 20 target、中央 registry 与 AST/source emit scan 关闭。集合自身确实满足 36/20、分类互斥和两个 TaskArtifact mapping；但当前“源码全集”证据不是完整权威：

1. `boundaryFailureNormalization.sourceAuthority.authoritativeScopes` 明列 7 个 scope，包括 `capture_grants.py`。
2. `sourceInventoryEvidence.files` 只哈希 6 个文件，缺少上述 `capture_grants.py`，却包含其他 6 个文件。verifier 的 `sourceEvidenceHashesCurrent` 只遍历这份自报列表，因此不会发现 authoritative scope 漏证据。
3. 36 项 inventory 包含 `V3_MEDIA_CAPTURE_GRANT_EXPIRED`。它不在所列 `capture_grants.py`、`capture_sink.py`、`task_artifacts.py`、coordinator capture lifecycle、`app.capture_stream`、`MediaCaptureController.ts` 或 offscreen emit；当前实际返回位置是未列入 authoritative scopes 和 hash evidence 的 `MediaCaptureMessageClient.ts:38`。
4. verifier 的 `requiredObservedCodesExistInCurrentSources` 只搜索 6 个哈希文件中的六个已知历史漏项，不执行“所有 emit sites == registry == frozen sourceInventory”的当前源码扫描。该等式只是 R0 的文字要求，不能证明当前 36 是正确的冻结基线。

因此 v8 关闭了 v7 已知的六个名称，却仍未关闭 inventory 完备性的证明缺口。R0 若严格按当前 authoritative scopes 扫描，会发现 inventory 中的 `V3_MEDIA_CAPTURE_GRANT_EXPIRED` 没有 emit site；若按真实 emit 文件扫描，又必须加入未冻结的 `MediaCaptureMessageClient.ts`。两者无法同时满足。

**必须关闭：**

- 明确 inventory 的函数级/文件级 scope，把 `capture_grants.py` 和 `MediaCaptureMessageClient.ts` 等所有实际 emit 边界加入哈希证据，或调整 inventory，使 scope、emit sites、registry 三者精确相等。
- verifier 必须从冻结 source manifest/AST 结果计算实际 emit 集合，而不是只检查六个预知 code 是否以字符串形式存在。
- 对 source 文件增删、emit code 增删、未列文件出现 relay code、registry 多项/少项分别做结构化 exit 2 变异。

### Minor 1：删除一个 handoff/product case 仍以 exit 1 traceback 退出

在隔离临时平铺副本中删除 `handoffFailureCases` 的第六项，verifier 在输出结构化结果前直接访问 `handoff_cases[5]`（`17-internal-relay-v8-verifier.py:196`），产生：

```text
IndexError: list index out of range
exit 1
```

这违反 `01-audit-request.md` 对“六 handoff/product case 任一字段”和任何删除/错配都应稳定结构化 exit 2 的要求，也证明 `12-v8-replan-closure.md:19` 对 v7 Minor 的关闭声明不成立。应先使用长度安全访问或按 injectionPoint 建索引，再生成 `failedChecks`。

### Minor 2：Archify 浏览器视觉检查仍为 pending

独立复算结果：

- Architecture JSON：`435befea1d473241feea3368ab3b7ad5d4e2f80827656104b8371d5155ee387d`
- HTML：`9e4a19c9fff7692503f62d6d9b318c235d68d7c2c81fda8d9177998edbc6ab7d`
- visual-check receipt：`371b153f6f8aed8e91a9c29157ad751e284d8304487cb114728bfd9db811ed24`
- Archify showcase：9/9；composition：0 error / 0 warning。
- repository revision `a303551a5bf89c26ff36b24ac06c7e30c334db27` 等于当前 `HEAD`，6 个 JSON source path 均存在。

但 visual-check receipt 明确为 `status=skipped`、`visualReview=pending`、Chrome unavailable、0 viewport。候选没有外推为视觉 PASS，因此这是保留限制，不单独阻断文档方向。

## 3. Verifier 与对抗结果

### 3.1 基线

```text
python3 docs/active/project/external-audit-package/17-internal-relay-v8-verifier.py
exit 0
summary = {total: 39, passed: 39, failed: 0}
```

将 verifier、Schema、fixture 原始字节复制到独立浅层临时目录，以 `NAVIA_REPO_ROOT=/mnt/c/workspace/navia` 运行：exit 0，39/39。路径不依赖审计包目录深度。

### 3.2 关键变异

所有变异只写宿主临时目录，未修改审计包或权威源。

| 变异 | 退出码 | 结构化结果 |
|---|---:|---|
| Schema `additionalProperties` 放宽 | 2 | 是 |
| chunk 上限改变 | 2 | 是 |
| credit window 改变 | 2 | 是 |
| marker access 放宽 | 2 | 是 |
| portName 回退 v7 | 2 | 是 |
| 删除 synchronous stage barrier | 2 | 是 |
| worker 移到 stage 前 | 2 | 是 |
| transfer 后允许 handler cleanup | 2 | 是 |
| completed notification 改为产品 terminal | 2 | 是 |
| crash disposition 强制 published | 2 | 是 |
| source inventory 36 -> 35 | 2 | 是 |
| target inventory 20 -> 19 | 2 | 是 |
| 删除 `V3_MEDIA_CROSS_TASK_REUSE` mapping | 2 | 是 |
| 删除 `V3_MEDIA_TEMP_FILE_MODE_INVALID` mapping | 2 | 是 |
| source hash 错配 | 2 | 是 |
| revisionDomainCount 3 -> 4 | 2 | 是 |
| 移除 AST/registry equality | 2 | 是 |
| 第十消息 | 2 | 是 |
| decoded length 错配 | 2 | 是 |
| 非 canonical Base64 padding | 2 | 是 |
| sender context 放宽 | 2 | 是 |
| 24 步主 trace 缺项 | 2 | 是 |
| 8 步 restart trace 缺项 | 2 | 是 |
| 6 步 handoff trace 缺项 | 2 | 是 |
| 七类 recovery case 缺项 | 2 | 是 |
| RLY8-N01 mapping 错配 | 2 | 是 |
| 三类集合重叠 | 2 | 是 |
| cleanup rename mapping 删除 | 2 | 是 |
| 六个 handoff/product case 缺一项 | **1** | **否，IndexError** |

结果：27/28 关键变异稳定结构化 exit 2；1/28 异常 exit 1。静态 39/39 不能覆盖该失败。

## 4. 源码语义核对

| 问题 | 当前源码事实 | v8 判定 |
|---|---|---|
| TaskAudioStager barrier | 同步 copy/fsync/hash/length/WAV shape 已存在 | 可实现，但尚未接到 worker 前 |
| SenseVoice start | daemon thread 启动后立即返回；stage 当前在线程内 | R4 必须重构，不能视为已实现 |
| 正常 cleanup | transcript finally 先清 stage，再 complete/cancel acquisition | 与目标顺序可对齐 |
| hard-crash cleanup | recover 只清 acquisition sandbox 与产品 evidence，不清独立 ASR root | Major，目标不可观察闭环 |
| durable product authority | `MediaTaskStore.commit_terminal()` 使用 SQLite `BEGIN IMMEDIATE`、revision fence、idempotency 和原子 commit | 真实存在 |
| recover published | 只有 ready/degraded + projections 才返回 published，否则 abandoned | 与目标产品权威一致 |
| coordinator succeeded | 仍为进程内字典；重启 GET 不可恢复 | v8 架构正确拒绝，但主提示仍引用 |
| inventory evidence | 自报集合闭合；实际 scope/hash/emit 文件不相等 | Major，未证明 exact inventory |

## 5. v7 Finding 关闭状态

| v7 Finding | v8 状态 | 判定 |
|---|---|---|
| Major 1：非持久终态与 stage/cleanup 竞态 | 同步 barrier 和 SQLite 产品终态方向正确；hard-crash staged root 无 recover owner，主提示仍含 v7 succeeded/GET 语义 | **未关闭** |
| Major 2：错误码 inventory 漏项 | 六个已知漏项加入；scope/hash/真实 emit 不一致 | **未关闭** |
| Minor 1：变异 exit 1 | handoff case 缺项仍 IndexError/exit 1 | **未关闭** |
| Minor 2：revision 域计数错误 | 明确为 consent/transcript/product 三个域，变异可拒绝 | 已关闭 |
| Minor 3：视觉 pending | deterministic 通过，browser visual-check 仍 pending 且未虚报 | 保留 Minor |

## 6. 门禁决定

```text
V3 P0 Background Capture Relay v8: DOCUMENT REPLAN
Fatal=0 / Major=2 / Minor=2
R0-R7 implementation: NO-GO
P1 six-video run: BLOCKED
V3 stage PASS: NOT CLAIMED
```

下一候选至少需要：补齐 ASR staged-root crash recovery owner 与可观测 receipt；统一主实施提示的 v8 handoff/product 终态措辞；重建真正覆盖 authoritative scopes 的 source/registry/AST equality；修复 handoff case 缺项的结构化 exit 2。完成后必须重新生成不可变平铺包并从零复审。

## 7. 审查限制与工作约束

- 仅运行 Python 标准库、`jsonschema`、SHA-256、Archify deterministic validator、静态源码读取和临时副本变异。
- 未运行产品代码、Chrome、Runtime、Provider、ASR、媒体、pytest 或真实 Uvicorn。
- 未修改产品代码、测试、审计包、权威候选、旧证据或已有报告。
- 本报告是唯一仓内写入；临时变异目录在各子进程结束后删除。
- 工作树原有 dirty/untracked 状态未清理、未回退、未提交。
