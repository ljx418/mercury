# Stage B B-5.3 Background Capture Relay revised v8 第二路独立文档审计

日期：2026-10-15  
角色：严格独立只读 reviewer  
审计入口：`external-audit-package/AUDIT_MANIFEST.md`、`01-audit-request.md`  
范围：revised v8 文档、机器合同、当前源码静态证据与 Archify deterministic evidence；不继承旧 Claude PASS、首轮 reviewer 结论或对话摘要。

## 1. 结论与分级

**结论：`DOCUMENT REPLAN / IMPLEMENTATION NO-GO`**

| 等级 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | 2 |
| Minor | 2 |

任一 Major 已足以触发 REPLAN；其他 reviewer 的 PASS 不能覆盖本结论。R0-R7 产品实施仍未获授权，P1 六视频继续 BLOCKED。

## 2. Findings

### Major 1：hard-crash owner manifest 尚未形成可证明 durable 的发布合同

`07-relay-architecture.md:95,99`、`08-relay-development-plan.md:54-55`、`12-v8-reaudit-closure.md:11-13` 和 fixture 的 `stagedAudioOwnerManifest` 已要求：同步 `TaskAudioStager.stage()` 在 worker 前完成 copy、文件 fsync、hash/length/WAV shape，并在 ownership transfer 前 fsync 私有 owner manifest。barrier 前后 owner、after-stage-before-worker hard crash、三层 cleanup 顺序、active sink=0 以及任一错误/非零残留映射 `V3_MEDIA_CLEANUP_INCOMPLETE` 也已写清。

但冻结合同只写了 manifest 文件本身 `fsync`，没有冻结以下 crash-durability 必需语义：

1. manifest 的确定性、可枚举恢复位置，以及 existing recover 如何只凭 task authority 找到它；
2. 临时文件写入后以原子 rename/link 发布完整 manifest，禁止 torn/partial manifest 被当成 ownership receipt；
3. 新建或替换 manifest 后对承载目录执行 fsync，再发布 ownership transfer receipt；
4. recovery 对缺失、截断、字段/hash/state 不一致 manifest 的统一 fail-closed 行为。

新文件只 `fsync(fd)` 不保证其目录项在掉电/硬崩溃后可发现。候选的核心故障点正是 `after_stage_before_worker`，此时进程内 receipt 和 daemon worker 都不能作为恢复依据；若 manifest 目录项未 durable，`MediaRecoveryCleanupCoordinator` 无法可靠发现 ASR staged root owner，旧 Major 的 crash window 仍未从合同上关闭。47/47 verifier 只比较一段声明字符串，没有检查 atomic publish、parent-directory fsync、discoverability 或 corrupt/missing manifest 负例。

**修复门槛：** v9 应冻结 manifest path/namespace、atomic publish、file fsync + parent-directory fsync、receipt 发布顺序和 missing/torn/corrupt/state/hash mismatch 负例；真实 kill 必须位于目录 fsync 后、worker start 前，并证明 recover 三层顺序 cleanup、四类 residual 全零、失败统一 `V3_MEDIA_CLEANUP_INCOMPLETE`。

### Major 2：source inventory 的 discovery roots 不闭合，未列 offscreen 文件可新增边界码而 47/47 假绿

fixture 声明 9 个权威 scope，其中包括：

`apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts`

但 `sourceInventoryEvidence.discoveryRoots` 只有：

```text
services/local-runtime/navia_runtime/modules/media_companion/acquisition/*.py
apps/chrome-extension/src/modules/media_companion/capture/*.ts
```

它没有覆盖已列 offscreen scope 的目录。隔离副本中新增：

```text
apps/chrome-extension/entrypoints/media-capture-offscreen/BoundaryFailureHelper.ts
```

并写入新的字符串字面量 `V3_MEDIA_CAPTURE_NEW_UNDECLARED` 后，verifier 仍返回：

```json
{"exit":0,"passed":true,"failedChecks":[],"summary":{"total":47,"passed":47,"failed":0}}
```

这直接反证 `unlistedEmitPolicy=reject_unlisted_file_containing_any_frozen_source_code_or_new_V3_MEDIA_CAPTURE_code`、`07-relay-architecture.md:105`、`08-relay-development-plan.md:16`、A17 以及 closure 中“未列文件新增边界码会被拒绝”的声明。当前 TypeScript extractor 也只是 whole-file quoted-literal 收集，不足以单独证明真实 emit sites；R0 必须用能够覆盖所有边界实现/辅助文件的闭合发现集合和实际 emit-site/registry 验证。

**修复门槛：** v9 至少把 offscreen entrypoint 目录纳入 discovery roots，并定义新增子目录/辅助文件的递归策略；对每个权威 scope 证明其实现目录均被未列文件扫描覆盖。加入 offscreen sibling、嵌套 helper、imported emitter 的增删变异，均须结构化 exit 2。若仍宣称 `emit sites`，需采用语义上识别 emit/return/raise/mapping site 的 AST/TS parser，不能把任意字符串字面量等同于 emit。

### Minor 1：`current checkpoint` 的“最新事实”已被同包后续证据替代

`13-current-checkpoint.md:3,124-132` 仍把最新 canary 定为 `capture-command-not-observed`，而 `11-phase0-test-results.md:219-225` 明确记录 19:04 visible muted Chrome 已触发真实 extension action 并达到 Offscreen start，旧失败已被替代。虽然两者都保持 P0 NO-GO，不会造成误放行，但名为 current 的恢复入口会把实施者导向过期 next action。v9 包应更新 checkpoint，或明确把它标为历史快照并指向最新事实。

### Minor 2：Archify browser visual evidence 仍 pending

Archify deterministic validate 为 showcase 9/9、composition 0 error / 0 warning；JSON/HTML hash 与 closure 一致。但 `.visual-check.json` 为 `status=skipped`、`visualReview=pending`、Chrome unavailable、0 viewport。本审计不把 deterministic validation 外推为视觉 PASS。

## 3. 冻结包与字节证据

目录为平铺 19 文件：18 payload + `AUDIT_MANIFEST.md`；一级子目录 0。18 个 payload 均与 manifest 声明相同，且逐项 `cmp` 权威源均 exit 0。

| Payload | SHA-256 |
|---|---|
| 01 | `5624899d04e6c42927b3e0cd182b59ccd02402b9a74f270e2f2ab150610c6d85` |
| 02 | `6328845d4f5682a1de100042f263d43da8012d220c15f99b7523cb8e2225ce40` |
| 03 | `c24e645468390271e27a487e3080745b63650708fd7f2ec82d9a81b61d9fe7c4` |
| 04 | `91c7704305fa386f9cbdd8b3e2147011098a6c0190aabc42c3669c82b3669dcb` |
| 05 | `7983e12751fa8f68a438a6b989698692e944a6d5385d41d750c4f485ac748918` |
| 06 | `ff217a518909baeb20be1d8d83e35d1b7deb559ff492215194a8c8f78d7087d7` |
| 07 | `3b68a6a4ce43c38cca74709d3e3c4f4ed9a527e9bc11059aac48e7cc4ae08eac` |
| 08 | `a88426a91f04fa46a1995f40daefbbbe004f7f4824f9e7e2e866836dccb86928` |
| 09 | `5dfac6a3821cafdbdd0fd990a9b52bbd266d1dc4384927fcebc11ade494b18e6` |
| 10 | `d85c9e7c022d9c8a29372927c4b0321e3a411a8a2855b10a3bc9ddef0cecfa38` |
| 11 | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` |
| 12 | `c256c1b9161d5f481485b1f80fbd20dbb571fd6754e84a6e4ace577f505713ba` |
| 13 | `3ed7274ec8c4df42ba58620b54d0e26c3e7d07ea6ad2f6e3bba307ea19cf5c73` |
| 14 | `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` |
| 15 | `a3385cef1185ee723945dbc867753a03e8606024110c4eb28a2f324da521e847` |
| 16 | `e9bd0c0cd93c67136109c268309c5ff72b213e8bd6ded5cbfdc1cb511cfc90c0` |
| 17 | `a0677f83df7692e39d39514c95457c7c9c91fbf66729cd0a4301906866518aac` |
| 18 | `7dee59f87ab891b7dc2c03e88297e64ba284cbef58e9de38bf4295a286e6a6d2` |

## 4. Verifier、源码复算与变异

### 基线

| 动作 | 结果 | Exit |
|---|---|---:|
| 原包 `python3 17-internal-relay-v8-verifier.py` | 47/47，`passed=true`，`failedChecks=[]` | 0 |
| `/tmp` 浅层三文件副本，`NAVIA_REPO_ROOT=/mnt/c/workspace/navia` | 47/47，路径深度无依赖 | 0 |

### 独立 source/target 复算

- 9 个 scope：全部文件 hash 匹配，Python AST module/symbol selectors 与 TypeScript whole-file literal selector 均可执行。
- unique actual emit set：36；frozen source inventory：36；missing 0、extra 0。
- target inventory：20；protocol failureCodes：20；集合精确相等。
- 分类：identity 15、rename 17、public-only 4；union=36，三类两两互斥。
- 当前两个声明 discovery roots 内 unlisted boundary emit 文件：0。
- 两项 `TaskArtifactError` 映射与四个旧漏 relay code 均在合同中。

上述结论只适用于声明 scope/roots；Major 2 的 offscreen sibling 逃逸证明该范围并不闭合。

### 要求的 8 类隔离变异

每项均在 `/tmp` 独立副本运行，并同时断言 exit 2、`passed=false`、`failedChecks` 非空。总计 8/8。

| Mutation | failedChecks（摘要） | Exit |
|---|---|---:|
| 删除 handoff case | immutable、trace count、owners、hard crash case | 2 |
| source scope remove | immutable、manifest paths、emit set、unlisted | 2 |
| source scope add | immutable、manifest paths | 2 |
| registry/sourceInventory code remove | protocol immutable/schema、count、classification、emit set | 2 |
| registry/sourceInventory code add | protocol immutable/schema、count、classification、emit set | 2 |
| listed source emit remove | source hash、extractor validity、emit set | 2 |
| listed source emit add | source hash、extractor validity、emit set | 2 |
| declared discovery root 内 unlisted emit add | `unlistedSourceFilesEmitNoBoundaryCodes` | 2 |

补充反证变异 `unlisted_offscreen_sibling_new_boundary_emit` 返回 47/47、exit 0，形成 Major 2。

## 5. 关键语义复核

- `completed` 已限定为 best-effort handoff notification，不是产品 terminal。
- 唯一 durable 产品 authority 明确为 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`；无提交只能 recover=`abandoned`，清理后 fresh analysis。
- `18-main-implementation-prompt.md` 中 `task succeeded` 与 `GET recoverable` 均为 0 次；六注入点已改为 completed notification + SQLite published/abandoned 语义。
- 同步 stage barrier、worker start 顺序、barrier 前后 cleanup owner、handler transfer 后禁止 cleanup、after-stage hard crash、`MediaRecoveryCleanupCoordinator` 三层顺序与四类 residual=0 均有声明；但 Major 1 所述 manifest durable publish 缺口仍阻断该语义成立。
- R0-R7 在开发计划和主 prompt 均完整；A01-A18 编号完整。
- 真实 Uvicorn WS、visible Chrome、所有 Chrome `--mute-audio`、真实非空 PCM、runner 不直调 controller/materialize/database、失败 exit 非零、TestClient/mock/空 PCM 禁代替真实链均已写入门禁。
- 当前状态保持 `IMPLEMENTATION NO-GO / P1 BLOCKED`，文档通过也仍要求用户明确授权；本次因 Major 不通过。

## 6. Archify 复算

| 项目 | 结果 |
|---|---|
| JSON SHA-256 | `4b8b2bd9d998fd675e48186ce0c73769b03e4ef53d48d04da783814e9383b968` |
| HTML SHA-256 | `8e815df4b70f8d7fd6e5ec301fd896d34355c37b4499a0bfc69f42ea03346f77` |
| visual receipt SHA-256 | `4daaf746a1bc54f78763fb0653455f6f9c631592038287c4d8376ffbad08666b` |
| repository revision | `a303551a5bf89c26ff36b24ac06c7e30c334db27`，等于当前 HEAD |
| repository sources | 7 个去重 path，全部存在 |
| validate | showcase 9/9；composition errors=0、warnings=0；exit 0 |
| browser visual-check | skipped；Chrome unavailable；0 viewport；visual review pending |

第一次未带 `--repo-root` 的 validate 按 Archify repository-evidence 规则返回 exit 1；按诊断加入 `--repo-root /mnt/c/workspace/navia` 后 exit 0，以上 deterministic 结果取自后者。

## 7. 命令与退出码摘要

| 命令/动作 | Exit |
|---|---:|
| `find` 平铺清单、`sha256sum`、18 组 `cmp` | 0 |
| 原包 verifier | 0 |
| 浅层副本 verifier | 0 |
| 8 类 mutation harness（内部各变异 exit 2，harness 断言） | 0 |
| source scope/hash/selector/36 emit/20 target 独立复算 | 0 |
| offscreen sibling 逃逸反证（verifier 自身） | 0，错误地 PASS |
| Archify validate（缺 `--repo-root` 的诊断尝试） | 1 |
| Archify validate（带 `--repo-root`） | 0 |
| `jq` 可用性尝试 | 127；随后改用 Python JSON parser，不影响候选 |

## 8. 限制

- 严格遵守只读边界：未运行产品代码、Chrome、Runtime、Provider 或媒体；未播放音频。
- 只在 `/tmp` 创建并自动清理 verifier/源码隔离副本；未修改 external-audit-package、产品代码或其他既有文件。
- 未执行 browser visual-check；读取既有 skipped receipt，并保持视觉 pending。
- 未验证未来实现，只审查其冻结合同是否足以防止假绿。当前实现证据、真实 Uvicorn、真实 Chrome、R0-R7 和 P0 出门仍须后续独立验收。

## 9. 最终门禁

`DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

v9 必须同时关闭 durable manifest 发布/发现语义与 discovery-root 逃逸，并重新冻结 payload、复跑 baseline/浅层/对抗变异及独立双路审计。P1 六视频不得启动。
