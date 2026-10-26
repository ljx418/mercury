# V3 P0 Background Capture Relay v7 独立只读文档审查

日期：2026-10-15  
审查角色：严格独立只读 reviewer  
审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`、`01-audit-request.md`  
候选状态：`V7 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`

## 0. 最终结论

**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**

| 严重度 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | 2 |
| Minor | 3 |

v7 的冻结字节、Schema、fixture、36 项静态 verifier、27 项对抗变异和 Archify showcase 均能独立复算；但是静态自洽不足以关闭 v6 的全部 Major。源码追踪证明：

1. v6 M1 仍未关闭。候选把进程内、异步转写尚未完成的 acquisition 状态误写为 durable terminal commit；按文档顺序直接调用 `complete()` 还会与转写服务对音频 artifact 的生命周期竞争。
2. v6 M3 仍未关闭。冻结的 30 项 source inventory 未包含当前相关边界实际发出的 4 个公共错误码，verifier 只证明候选列表自洽，未证明它与源码全集相等。

因此不得授权 R0-R7 实施，也不得解锁 P1 六视频。任一其他 reviewer 的宽口径 PASS 不能覆盖本结论。

## 1. 输入完整性

外审目录为平铺结构，18 个 payload + 1 个 manifest，共 19 个文件。18 项 manifest hash、包内副本 hash、权威源 hash 三者逐字节一致，mismatch=0。

| Payload | SHA-256 | 权威源一致 |
|---|---|---|
| `01-audit-request.md` | `42adbbc393c66a181503d35d61f1ebb201d50695dce5b02640d9cc42d4f8d1eb` | 是 |
| `02-prd.md` | `38a2471d969873405f6a0e332e786ef5a4b292fb95e74e77aa956e627ca73cec` | 是 |
| `03-architecture.md` | `514bc366f8223884969486ead924975746e5bbc83f94a682dd1fcd70dd85e46c` | 是 |
| `04-development-plan.md` | `db72a15470a72a737be224793ba6c0f36e36af3e09d5e2559c6c080e2837ed7b` | 是 |
| `05-acceptance-plan.md` | `d8d97b973944252c365aa14214b5f65a7666103b54e3d67560bad2126fb77b63` | 是 |
| `06-stage-gate.md` | `12cc84ef70f1bdb019ff58c824d4865b40fa8cf8290a5960160f03776fbe6442` | 是 |
| `07-relay-architecture.md` | `5d3498e515aac39f5a90aa17691d688b425dcb85a626da13c4d0466a1e440613` | 是 |
| `08-relay-development-plan.md` | `5dbaa73eb4df60e186817758de8c33f44638b5788e72bd842332f6373d9f2579` | 是 |
| `09-relay-acceptance-plan.md` | `60fc84ad167fd9381c4268d6398e4f0b27aa97ee4005a5ef4b5eb1f9dbf07d95` | 是 |
| `10-relay-preimplementation-audit.md` | `87b783e37f974bb7e4786f1f97a6c26d8fbfdc5b6742539e73c9e415040dfd4d` | 是 |
| `11-phase0-test-results.md` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` | 是 |
| `12-v7-replan-closure.md` | `ae102caecb7a029b530c9b6ce9af99c3c1f36cd86991dcdcdb0738fef81860dc` | 是 |
| `13-current-checkpoint.md` | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` | 是 |
| `14-relay-architecture.json` | `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` | 是 |
| `15-internal-relay-v7.schema.json` | `e7b8d1e2dc5bfe76db6210cf037499b60344afe937d6ce4a5cc33383a20c8913` | 是 |
| `16-internal-relay-v7-fixtures.json` | `c6301cdf24688c1cb9fa57200f758ef12f78d950be1cd5f7fc6136f43b39b319` | 是 |
| `17-internal-relay-v7-verifier.py` | `9b27f284ad6e685723e8a977ca2cac55876c9271de8e57627f3ba4dd7b2bcd1f` | 是 |
| `18-main-implementation-prompt.md` | `761929913359844b95ae731a281c0acab4c82ab6bb8a0633b5c15c6ac7116fe3` | 是 |

## 2. Findings

### Major 1：所谓 durable terminal commit 当前既不 durable，也与异步转写 artifact 生命周期冲突

候选架构 `07-relay-architecture.md:95`、开发计划 `08-relay-development-plan.md:27`、验收 A15 `09-relay-acceptance-plan.md:40` 和主实施提示 `18-main-implementation-prompt.md:39` 均冻结以下顺序：

```text
sink finalize
-> transcript create/start
-> MediaAcquisitionCoordinator.complete(taskId) returns succeeded
-> durable terminal commit
-> completed frame best effort
```

这没有被现有实现支撑，且计划没有冻结为使其成立所需的持久化与生命周期改造：

1. `SenseVoiceTranscriptService.start()` 只启动 daemon thread 并立即返回 queued/running 公共状态；它不等待 ASR、验证或 staging 完成（`transcript_service.py:99-107`）。
2. 真正的转写线程稍后才执行 `TaskAudioStager.stage()`（`transcript_service.py:117-145`）。
3. 转写服务自己在 `finally` 中、ASR 完成或失败以后才调用 acquisition cleanup；成功路径调用的正是 `MediaAcquisitionCoordinator.complete()`（`transcript_service.py:167-183`，构造绑定见 `app.py:251-256`）。
4. 若 WebSocket handler 按 v7 文档在 `start()` 返回后立即再调用 `complete()`，`complete()` 会删除 acquisition sandbox（`coordinator.py:668-712`），可能在转写线程 stage 音频前删除刚 finalize 的 WAV。这会制造确定性的竞态，而非 durable success。
5. `MediaAcquisitionCoordinator._tasks`、`_inputs`、`_cleanup_events` 均为进程内结构（`coordinator.py:59-72`）。`complete()` 只更新该字典为 `succeeded`，没有 SQLite 事务或可重建记录（`coordinator.py:708-712`）。
6. 既有 `GET /v1/media/acquisitions/{taskId}` 只读取该进程内字典（`app.py:1223-1230`、`coordinator.py:553-558`）。Runtime 重启后，它返回 404，而不是候选所称的 durable succeeded task。
7. 持久 `media_source_authority` 只保留 source owner 与 `active/published/failed/...` 状态；acquisition `succeeded` 没有持久记录。hard-crash recover 对未发布结果会清理并标记 failed/cancelled 后返回 `abandoned`（`coordinator.py:255-305`），不能恢复崩溃前仅存在于内存的 succeeded acquisition。

这意味着 v6 M1 只在文字上把 “terminal frame 必须成功” 改成了 “frame best effort”，但没有定义真正的 durable commit。`completed_frame_send` 失败且 Runtime 仍活着时，现有 GET 可以读内存 success；Runtime 在 commit 后、frame 前或 Background GET 前重启时，同一 success 无法恢复。两种观察结果不具备候选声称的单一权威语义。

**必须关闭：**

- 冻结并实现 acquisition terminal 的真实持久权威，包括 task/source、state、terminalAt、failureCode、幂等键与恢复读取；或明确改写合同，不再称其 durable，并重新设计 crash 后权威语义。
- 明确 transcript staging/执行与 acquisition cleanup 的所有权。不能在异步 `start()` 后立即删除输入 artifact；应冻结可观测的 staging barrier、等待条件或事务边界。
- 增加三个独立注入窗口：`transcript_start_returned_before_stage`、`authoritative_commit_before_completed_send`、`commit_then_runtime_restart_before_background_GET`。每个窗口都必须证明同一权威结果、0 artifact 竞态和可恢复观察面。
- verifier 不能只冻结描述字符串；fixture 必须包含跨进程重建事实和持久记录读取。

### Major 2：30 项 source inventory 与当前相关源码不相等，v6 M3 仍未关闭

v7 宣称 source inventory 精确覆盖 capture/grant/sink/controller/recovery 公共边界，并要求每个 source code 恰好属于 shared、rename 或 public-only。独立提取当前相关源码中的固定错误码后，至少有以下 4 个实际公共 source 未进入 `sourceInventory`：

| 漏项 | 当前来源 |
|---|---|
| `V3_MEDIA_CAPTURE_CHUNK_INVALID` | `capture_sink.py:97-107` |
| `V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID` | `capture_sink.py:100-104` |
| `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` | `media-capture-offscreen/main.ts:172-176` |
| `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED` | `media-capture-offscreen/main.ts:35-57,72-104` |

其中前两项由现有 Runtime sink 直接产生，并通过当前 WebSocket failure/public error 路径对外；后二项由正在被迁移的现有 Offscreen/controller 边界产生，公共 Runtime/UI 合同又被 v7 明确要求保持不变。它们不能仅因同时出现在 relay target 列表或未来会移动 owner，就从 source inventory 消失。

当前 verifier 的 `boundaryFailureNormalizationClosed` 只检查候选自报的三个集合并集、互斥、mapping target 与 20 项 target 闭集；它没有从权威源码/注册表独立生成 source 集。因此 36/36 与 digest immutability 会稳定接受这个不完整 inventory。

此外，现有 sink 在 `begin()` 的 sandbox/create-private-temp 路径可能抛出 `TaskArtifactError`，当前 WebSocket handler 只捕获 `MediaCaptureFailure` 和 `CaptureSinkFailure`。v7 应明确这些内部 artifact 错误如何归一化；不能依赖未冻结的通用 500。

**必须关闭：**

- 从明确列出的 capture grant、sink、controller、offscreen、recovery 权威文件或单一代码注册表生成 source inventory，不能手写后仅做内部集合校验。
- 对每个迁移前公共 code 明确 `identity / rename / retired-with-proof / public-only`，并证明 UI/API 行为不变。若某 code 因 v7 删除，必须有源码删除和回归测试，不得静默漏项。
- 把 source-registry 与 relay target-registry 的集合差异纳入 verifier；未知、遗漏、重复分类均结构化 exit 2。
- 冻结 `TaskArtifactError` 到 relay/public code 的映射与故障注入。

### Minor 1：删除 cleanup rename 时 verifier 以未捕获 KeyError 退出

删除 `V3_MEDIA_CLEANUP_INCOMPLETE` rename 的变异确实非零，但退出码为 1，原因是 verifier 直接下标访问缺失键，而不是输出结构化 failed check 并 exit 2。它是 fail-closed，不构成 Major；应修为稳定、可审计的结构化失败。

### Minor 2：开发计划称“四个 revision 域”，机器合同实际定义三个 revision 域

`08-relay-development-plan.md:20` 使用“四个 revision 域”，而机器合同与验收 A07 实际为 consent、transcript、product 三个 revision 域，另有 task/source identity 规则。语义主体已从 v6 的全链 same-revision 错误中纠正，但数量措辞应统一。

### Minor 3：Archify 没有浏览器视觉证据

Archify JSON 在带 `--repo-root` 的 showcase validation 中 9/9、composition error=0/warning=0，repository revision 与 6 个引用文件均存在。HTML hash 可复算；但 `.visual-check.json` 明确为 `status=skipped`、`visualReview=pending`、0 viewport。不得外推为视觉 PASS。

## 3. 五项 v6 Major 关闭审查

| v6 Finding | v7 独立结论 | 说明 |
|---|---|---|
| M1 durable success 与 completed frame 矛盾 | **未关闭** | frame 已改为 best effort，但 acquisition success 非持久且与异步 transcript staging 竞争 |
| M2 recover receipt / interrupted 事实错误 | **文档层关闭** | 现有 recover 仅返回 disposition/taskId；cleanup 非零公开失败；interrupted 由 owner PID/start token 推导 |
| M3 source/target inventory 不闭合 | **未关闭** | source inventory 漏 4 个当前相关公共 code；verifier 未与源码集合对账 |
| M4 专项架构引用 v5 | **关闭** | 当前专项文档、schema、fixture、verifier、Port、marker、RLY 均指向 v7；旧版本只作为拒绝历史出现 |
| M5 跨域 same revision 不可判定 | **关闭（Minor 措辞待修）** | task/source identity 与 consent/transcript/product revision 已分域，outline/workspace 共享 product fence |

## 4. Verifier 与对抗结果

### 4.1 基线

```text
python3 docs/active/project/external-audit-package/17-internal-relay-v7-verifier.py
exit 0
36/36 passed
```

通过虚拟浅层平铺目录 `/v7-flat/` 以只读内存文件注入同一 schema/fixture 后再次执行：exit 0，36/36。路径逻辑不依赖外审包目录深度。

### 4.2 变异

所有变异均在子进程内存中注入，未写候选文件或临时副本。

| 变异组 | 结果 |
|---|---|
| Schema `additionalProperties`、chunk max、credit、marker forbidden field | 全部 exit 2 |
| schema+fixture Port 回退 v6 | exit 2 |
| source 未知/遗漏、target 扩张、分类重叠 | 全部 exit 2 |
| cleanup rename 删除 | exit 1，KeyError，fail-closed |
| 第十消息、decoded length、noncanonical padding | 全部 exit 2 |
| sender Chrome/context 边界 | exit 2 |
| durable terminal 字符串、completed send 预期 | 全部 exit 2 |
| recover 观察面 | exit 2 |
| task identity、跨域 revision equality | 全部 exit 2 |
| 24 步主 trace、8 步 restart、6 步 terminal | 全部 exit 2 |
| 五 terminal case、七 recovery case | 全部 exit 2 |
| 30 负例、marker expiry、RLY7 ID | 全部 exit 2 |

共 27 项变异，27/27 非零。该结果证明冻结字节抗漂移，不证明冻结语义与现有源码完备一致。

## 5. Archify 独立复算

| 项 | 结果 |
|---|---|
| JSON SHA-256 | `f62f3767683708e099dea4b63b9883698827795fbd3f578690dc2fcee35d508b` |
| HTML SHA-256 | `41bd7f7c0f5b6c13d25c9ffedd43f5bcfd825fe6f91489586525af4b278d4dd9` |
| visual receipt SHA-256 | `19eaf77ca54c81ededed6ddb9d0d36df94ad16c26fe9b0bcaedd7b80866f222e` |
| Repository revision | `a303551a5bf89c26ff36b24ac06c7e30c334db27`，等于当前 HEAD |
| Repository evidence | 6/6 引用路径在固定 revision 存在 |
| Showcase validate | 9/9 checks，exit 0 |
| Composition | errors=0，warnings=0 |
| Browser visual-check | skipped，Chrome unavailable；不得声明视觉通过 |

首次不带 `--repo-root` 的 validate 按预期 exit 1 并要求 repository root；补充 `--repo-root /mnt/c/workspace/navia` 后 exit 0。这不是候选失败。

## 6. 已确认成立的设计点

- v7 正确将 durable authority 与 `completed` 通知在概念上拆分；问题在于当前指定的 authority 实体并不 durable。
- hard crash 不假定 finally；`interrupted` 由持久 owner PID/start token 推导。
- recover 公开观察面没有新增虚构 cleanup receipt；cleanup 非零时现有实现抛 `V3_MEDIA_CLEANUP_INCOMPLETE`。
- MessageSender 与 ExtensionContext 职责分开；incognito 从 `runtime.getContexts(documentId)` 结果读取，而非不存在的 sender 字段。
- Chrome 116 minimum 被明确列为 R0 必改，且禁止弱校验降级。
- Base64 canonical、chunk length、单信用、有界 outstanding、quiesce/drain/stop、marker expiry 与 secret 禁止字段都有机器冻结。
- v1-v6 仅作为 rejected 历史；当前实现输入唯一指向 v7。

## 7. 审查限制

- 严格遵守只读边界；未修改候选、产品代码、测试、外审包或既有证据。
- 唯一写入是本报告。
- 未运行产品代码、Runtime、Chrome、Provider、真实媒体、pytest、pnpm 或构建。
- 未进行视觉人工签署；Archify browser visual-check 保持 skipped。
- 源码追踪仅覆盖对 terminal durability、recover、错误码 inventory、sender 与 revision 可实现性有直接关系的实体。

## 8. 下一门禁

v8 至少必须：

1. 冻结 acquisition terminal 的真实持久化模型与 transcript staging barrier，消除提前 cleanup 竞态。
2. 增加 commit 后 Runtime restart 的可执行恢复 trace，而非只测存活进程内 GET。
3. 由权威源码/注册表生成完整 source inventory，关闭 4 个已确认漏项及 artifact error 映射。
4. 修复结构化 mutation 错误、revision 域数量措辞。
5. 重建全新 immutable flat package，重新执行双重独立外审。

在 v8 双审均 Fatal=0/Major=0 且用户另行明确授权前：

```text
P0 R0-R7 IMPLEMENTATION NO-GO
P1 SIX-VIDEO RUN BLOCKED
V3 NOT PASSED
```
