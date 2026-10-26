# V3 P0 Background Capture Relay v9 独立文档外审

日期：2026-10-15  
审查性质：严格、独立、只读、从零文档外审  
唯一入口：`external-audit-package/AUDIT_MANIFEST.md`、`external-audit-package/01-audit-request.md`  
审查对象：V3 P0 Background Capture Relay v9 冻结候选  
结论：**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**

## 0. 决定摘要

```text
Fatal = 0
Major = 3
Minor = 3

DOCUMENT REPLAN / IMPLEMENTATION NO-GO
```

候选的 19 项声明 payload SHA-256 与权威源均逐字节一致；包内 baseline verifier 为 50/50，mutation verifier 为 12/12。Chrome 116 sender、Base64/长度、单信用与有界队列、quiesce/drain、SQLite 唯一持久产品终态、三个 revision 域、A01-A18 和 P1 阻塞均已在静态合同中表达。

但独立对抗变异证明 TypeScript imported enum emitter 可以逃过所谓 semantic AST closure，内层 verifier 错误地 exit 0、50/50。owner manifest 合同又没有给 parent-directory-fsync receipt 一个可跨进程重启判定的持久表示，导致 `OM9-N08` 在真实 crash window 中不可确定实现。冻结目录还预先存在两个未列入 manifest 的 `.pyc` 文件及子目录，直接违反“平铺 19 payload + 1 manifest”边界。任一 Major 均要求 REPLAN，本候选不得授权 R0-R7 实施。

## 1. 审查边界与实际动作

本轮只执行：

- Markdown/JSON/Python 静态读取；
- SHA-256、逐字节比较；
- JSON Schema Draft 2020-12 meta/instance 校验；
- 包内 baseline/mutation verifier；
- `/tmp` 隔离副本中的独立 fixture/source 变异；
- Archify JSON 的确定性静态 `validate`。

本轮未执行：

- 产品代码；
- Chrome；
- Runtime/Uvicorn；
- Provider；
- 视频、音频、字幕、ASR 或媒体下载；
- 任何冻结包、产品代码或候选权威文档修改。

唯一新增文件是本报告。

## 2. 输入完整性复算

### 2.1 包结构

候选声明：平铺 19 payload + 1 manifest，共 20 文件。实际观察：

```text
top-level manifest/payload files = 20
unexpected subdirectories         = 1 (__pycache__)
unexpected unmanifested files     = 2
```

未清单化文件：

```text
__pycache__/17-internal-relay-v9-verifier.cpython-312.pyc
__pycache__/18-internal-relay-v9-mutations.cpython-312.pyc
```

两者时间戳均早于本轮首次 verifier 执行，故不是本轮外审创建后再倒推为候选问题。

### 2.2 19 项 payload 与权威源

| # | Payload | 独立 SHA-256 | Manifest | 权威源 hash | 逐字节 |
|---:|---|---|---|---|---|
| 01 | `01-audit-request.md` | `4b095352603197067b6b28fd0c2b64cc4fd7588e080a2f16174398c6ad0e30e0` | match | match | equal |
| 02 | `02-prd.md` | `7ae031958be689f9b129f6b8333e27a8ce7e389b6406f79113db86c945b345b3` | match | match | equal |
| 03 | `03-architecture.md` | `1818b8f0d8801ded021ff53a94acaef3516c2a756b5e53b3277d82a5084d6b67` | match | match | equal |
| 04 | `04-development-plan.md` | `00a90fbee1f58b9e733f9055f920d1f11f3fb28609b324dc6c1c94ee2d70b151` | match | match | equal |
| 05 | `05-acceptance-plan.md` | `164b2e5d771af92a637cc0f65b5238b850de2463effb78d34c21a08c4b446e19` | match | match | equal |
| 06 | `06-stage-gate.md` | `a0e539eb2092944cab53b68a7aade728e02aed2fa219ceaa3f9b7ced2daddd49` | match | match | equal |
| 07 | `07-relay-architecture.md` | `e2531e8a47154a5ffc0aebe92b2ba160653f2953446cf843a4a6c24d436b35e9` | match | match | equal |
| 08 | `08-relay-development-plan.md` | `e5188694714cd924700320dfb1db90ce829e98c83c08595f3ea9d081ff2090b8` | match | match | equal |
| 09 | `09-relay-acceptance-plan.md` | `4c003c77ff9a22fb075594cdf3cc3d7d75dedaf682c612ed61756050186668a7` | match | match | equal |
| 10 | `10-relay-preimplementation-audit.md` | `09419ee8e26cef221b621d2e0513e0819600f82144005df684fefd61e364cdd4` | match | match | equal |
| 11 | `11-phase0-test-results.md` | `6e8f11f655a814b505c3eb21f46a6d481aacef7f153e335fcf0c6b9bad72885b` | match | match | equal |
| 12 | `12-v9-replan-closure.md` | `e42c5c5011fe800245ad29edee0594291f7e133a71c086ae93257321284f8062` | match | match | equal |
| 13 | `13-current-checkpoint.md` | `c7bfdfe359b4e8dd4ecc11486e840dd54500fb46b5030e066c8297ec878527ff` | match | match | equal |
| 14 | `14-relay-architecture.json` | `bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7` | match | match | equal |
| 15 | `15-internal-relay-v9.schema.json` | `25239411ab44d46c66da391bf17c92f900a5f4700e870eee9792bf6eb03fea97` | match | match | equal |
| 16 | `16-internal-relay-v9-fixtures.json` | `4630716df47be737c83c550bcf9f10fce2fb91270cd6ec05c954f56019a39723` | match | match | equal |
| 17 | `17-internal-relay-v9-verifier.py` | `1e39d7c9d107fd97f54155c618fae8bd65ffec644df1317b887a8dca6722d28a` | match | match | equal |
| 18 | `18-internal-relay-v9-mutations.py` | `0a3e2a4c20a344437d3dee5002923315ca289b5c30cb42f0978c8b3b399ddb54` | match | match | equal |
| 19 | `19-main-implementation-prompt.md` | `71d18915a131a3b9e0876776137bf73333ce9cbe02d41f10d006c372d5564bc4` | match | match | equal |

结果：`19/19` manifest hash match，`19/19` authority hash match，`19/19` raw bytes equal。verifier 执行后再次复算仍全部一致。

## 3. 包内 verifier 实跑

### 3.1 Baseline

命令：

```bash
python3 docs/active/project/external-audit-package/17-internal-relay-v9-verifier.py
```

结果：

```text
exit = 0
passed = true
summary = 50/50
source actual/frozen = 40/40
missing = []
extra = []
unlistedBoundaryEmits = {}
```

### 3.2 内置 mutation verifier

命令：

```bash
python3 docs/active/project/external-audit-package/18-internal-relay-v9-mutations.py
```

结果：

```text
exit = 0
passed = true
summary = 12/12
11 dangerous mutations -> inner exit 2
1 non-boundary lexical control -> inner exit 0
```

内置 12 例覆盖 owner case 删除、parent-fsync 文本删除、hard-crash step 删除、scope 删除、inventory/allowlist 增删、offscreen direct/nested、Python helper 和词法对照，但没有实现审查请求明确要求的 **imported emitter** 对抗。

## 4. 独立隔离变异

所有变异均在临时 repo/audit 副本中执行，使用包内 v9 verifier/schema/fixture 的冻结字节；产品工作树与冻结包未写入。

| 独立变异 | 内层 exit | 关键 failed check / 观察 | 判定 |
|---|---:|---|---|
| 删除 `stagedAudioOwnerManifestReceipt` | 2 | immutable/schema/atomic durability | 拒绝正确 |
| 删除 `OM9-N08` | 2 | immutable/count/manifest fail-close | 拒绝正确 |
| hard crash 改为 `finallyExecuted=true` | 2 | hardCrashTraceRecoveryBarrierExact | 拒绝正确 |
| ASR residual 改为 1 | 2 | hardCrashTraceRecoveryBarrierExact | 拒绝正确 |
| 删除一个 authoritative scope | 2 | scope paths/emit inventory | 拒绝正确 |
| source inventory 删除 | 2 | 39/40、classification/universe | 拒绝正确 |
| source inventory 新增 | 2 | 40/41、classification/universe | 拒绝正确 |
| allowlist 删除 | 2 | transcript code 成为 unlisted emit | 拒绝正确 |
| allowlist 新增 | 2 | universe 不闭合 | 拒绝正确 |
| offscreen direct throw 新 code | 2 | unlisted emit 精确定位 | 拒绝正确 |
| offscreen nested helper 新 code | 2 | unlisted emit 精确定位 | 拒绝正确 |
| offscreen enum + import + throw | **0** | **50/50，unlisted 为空** | **假绿** |

逃逸样例：

```ts
// helpers/IndependentImportedCode.ts
export enum IndependentFailure {
  Code = "V3_MEDIA_CAPTURE_INDEPENDENT_IMPORTED",
}

// IndependentImportedEmitter.ts
import { IndependentFailure } from "./helpers/IndependentImportedCode";
export function emit() {
  throw new Error(IndependentFailure.Code);
}
```

原因：`typescript_codes()` 只把字符串字面量的直接语法父节点限定在 call/property/return/variable/binary/conditional/case/array/throw 等类型。enum 字面量父节点为 `EnumMember`，实际 throw 位置只有 imported property access，扫描器不做符号解析/常量传播，因此两处都未识别。四递归 root 虽覆盖文件路径，但并未形成 promised semantic emitter closure。

## 5. 深度语义复核

### 5.1 Owner manifest、hard crash 与 composite cleanup

静态正向内容已存在：

- 固定发现路径：`private_asr_staging_root/<taskId>/owner.json`；
- 13 步 trace 的 step 1..13 连续；
- temp `O_EXCL`、file fsync、atomic replace、parent-directory fsync、receipt、真实 hard-crash、不执行 finally、仅凭 authoritativeTaskId 重发现；
- acquisition/ASR/product/sink 四类 residual=0；
- `OM9-N01..N08` 均映射 `V3_MEDIA_CLEANUP_INCOMPLETE`；
- fresh begin 前置为 abandoned + 四残留全零。

但机器合同没有 owner manifest 的 JSON Schema、schemaVersion、精确字段类型、`state` 枚举、receipt 字段/文件/SQLite 位置或 receipt 的持久写入协议。`artifactOwnershipPolicy.stagedAudioOwnerManifest` 列出的字段只有 taskId、pid、processStartToken、source/staged hash、byteLength、waveShape、state；`asyncWorkerPrecondition` 还明确称 receipt 是 `published_in_memory`。

现有顺序是：写 manifest -> fsync 文件 -> replace -> fsync 目录 -> 发布内存 receipt。若进程在 replace 后、directory fsync/receipt 前崩溃，而 `owner.json` 在重启后恰好可见，recover 没有任何持久字段可以区分它与“directory fsync/receipt 已完成”的 manifest。故 `OM9-N08 parent_directory_fsync_receipt_missing` 不能按当前合同确定性判定。13 步 trace 只覆盖 receipt 后 kill 的正向窗口，没有关闭这个负向 crash window。

### 5.2 Handoff 与唯一持久产品终态

以下边界一致：

- sink finalize 明确不是产品 terminal；
- `completed` 仅是 best-effort handoff notification；
- SQLite `MediaTaskStore.commit_terminal(ready|degraded)` 是唯一 durable product authority；
- completed-frame send failure 不回滚 handoff，也不声明产品成功；
- commit 后重启按 SQLite terminal 判 published，否则 abandoned；
- barrier 前 handler、barrier 后 transcript/recover 是互斥 cleanup owner。

该部分静态合同未发现新的独立 Major，但真实实现/kill/Uvicorn 证据仍属于 R4-R6，不在文档 PASS 范围。

### 5.3 Chrome 116 sender、消息与流控

合同明确并冻结：

- `minimumChromeVersion=116` 和 `runtime.getContexts`，禁止弱降级；
- extensionId、offscreen URL、tab absent、frame absent/0、documentId 首次绑定、唯一 OFFSCREEN_DOCUMENT、incognito 一致；
- 9 类消息闭集与 `additionalProperties:false`；
- canonical Base64、decoded length、PCM16LE/16k/mono；
- raw <=49,152、encoded <=65,536；
- sequence 0 起严格递增；
- credit=1、Runtime in-flight=1、queue 32/1,572,864；
- quiesce 停新源、drain 既有队列、stopped 后才 Runtime finalize；
- marker 五 phase、18 分钟固定 expiry、不续期、禁止秘密字段。

该部分的静态 shape 闭合；真实 Chrome capability 与 sender 行为仍必须在获授权后的 R0/R2/R5 证明。

### 5.4 11 scope、40/20 code 与 discovery closure

静态数据复算：

```text
authoritative scopes = 11
source inventory     = 40 unique
target inventory     = 20 unique
discovery roots      = 4
non-relay allowlist  = 14
classification union/disjoint = true/true
baseline AST actual/frozen     = 40/40
```

direct、nested 和 Python helper 新 code 均能被拒绝；inventory/allowlist 增删也能被拒绝。但是 imported enum emitter 假绿直接否定 A17 所称的 sibling/nested/imported emitter 全闭包，因此本节不能 PASS。

### 5.5 三个 revision 域、公共边界和 P1

合同明确区分：

1. consent policy revision；
2. transcript projection revision；
3. product/media task revision 与 expected-revision fence。

跨域 revision 相等被禁止；outline/workspace 只共享 product revision。公共 API/new user action 均标记为 none。`09-relay-acceptance-plan.md` 包含 A01-A18，无 N/A；manifest、request、stage gate、development plan 和 implementation prompt 均明确 P0/R7 独立出门前 P1 六视频 BLOCKED。该部分一致。

## 6. Archify 复核

独立 hash：

```text
JSON bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7
HTML 22502d6f296c1f9a474b0d15e25291953f554beaea3f4eac0a67f8e77255c044
```

静态命令：

```bash
archify validate architecture 14-relay-architecture.json --quality showcase --json
```

结果：exit 0，9/9，composition 0 error / 0 warning。browser visual-check 未执行，保持 `pending`，本报告不外推视觉 PASS。

当前磁盘上的 visual-check receipt 仍绑定旧 HTML hash `8e815df4...`，不是本轮 `22502d6f...`；这不会被当作 v9 视觉证据。

## 7. Findings

### Major-1：TypeScript imported emitter 可逃过 semantic AST closure

要求 A17、开发计划 R0 和实现提示词均明确 sibling/nested/**imported emitter** 不可逃逸。独立 enum/import/throw 变异却让 verifier exit 0、50/50，`unlistedBoundaryEmits={}`。这是可复现的假绿，不是测试覆盖偏好问题。

必须至少让 TypeScript 扫描处理 enum member、import/alias、property access 与可静态求值的常量传播，或建立由编译器 type checker/central registry 驱动的实际 emit-site 验证；并加入 imported emitter 负例，要求结构化 exit 2。

### Major-2：parent-directory-fsync receipt 没有可跨 crash 判定的持久表示

当前 manifest 字段不含 receipt，合同没有 receipt schema/path/transaction；worker 前 receipt 被称为内存 receipt。因而 replace 后、dir-fsync/receipt 前的 crash 如果留下可见 `owner.json`，recover 无法判定 `OM9-N08`。这使 deterministic discovery + eight-case fail-close 在关键 crash window 中不可实现/不可验收。

必须冻结真正的持久状态机：manifest schema、state 值、每次状态转换的原子写/fsync/dir-fsync 顺序、receipt 的持久位置与 recover 判定算法；然后加入该 crash window 的真实 kill 计划和隔离变异。

### Major-3：冻结外审目录不是声明的平铺 20 文件

候选在本轮 verifier 执行前已含 `__pycache__/` 与两个未清单化 `.pyc`。这违反 manifest 自身和项目外审流程的 flat/20-files/manifest-only 约束，也使“冻结包全部可审字节”不成立。

必须重建干净平铺包，并防止 verifier 在包目录产生缓存，例如使用 `PYTHONDONTWRITEBYTECODE=1`/`python -B`，随后重新计算 manifest。

### Minor-1：mutation verifier 不是冻结包自包含执行

`18-internal-relay-v9-mutations.py` 第 25-27 行把 verifier/schema/fixture 指向 repo 权威路径，而不是同目录 `17/15/16` payload。当前权威源恰与 payload 相等，所以本轮 12/12 可复算；但审查期间若权威源漂移，冻结 mutation payload 会运行另一组字节。

应改为同目录输入，并仅通过 `NAVIA_REPO_ROOT` 指定只读源码发现根。

### Minor-2：v9 机器合同仍带 v8 名称

`15-internal-relay-v9.schema.json` 的 `$id`、protocol version、port 均为 v9，但 `title` 仍是 `Contract v8`；restart marker schema 仍为 `/v8`，而架构/提示词多处称“v9 tombstone”。若 marker 有意复用 v8，应明确“relay v9 reuses marker v8”；否则统一版本，避免实现者创建第二种 marker。

### Minor-3：当前 visual-check receipt 不绑定 v9 HTML

visual-check 明确 pending 是正确的，但现存 receipt 的 artifact hash 为旧 `8e815df4...`，与当前 HTML `22502d6f...` 不同。后续视觉审查必须重新生成 receipt，不得复用旧 sidecar。

## 8. 限制与未外推项

- 50/50 与 12/12 只证明候选静态 verifier 对其已覆盖样例的结果；Major-1 已证明它不能支持全量 boundary closure 声明。
- 本轮没有验证真实 Chrome 116 capability、真实 sender、WS、PCM、SenseVoice、真实 kill、SQLite terminal、cleanup 或 UI；这些仍必须在获得明确授权后的 R0-R7 完成。
- Archify 只完成确定性静态校验，视觉状态仍 pending。
- 本报告不授权 R0-R7，不解锁 P1，不构成 P0、Stage B、V3 或人工验收 PASS。

## 9. 最终门禁

```text
V3 P0 Background Capture Relay v9 document candidate:
DOCUMENT REPLAN / IMPLEMENTATION NO-GO

Fatal = 0
Major = 3
Minor = 3

R0-R7 implementation = NO-GO
P1 six-video run      = BLOCKED
Archify visual        = PENDING
```

下一候选必须关闭三个 Major、重建干净平铺包，并重新执行两份从零独立文档外审。即使下一轮两份报告均 Fatal=0/Major=0，仍需用户另行明确授权 `approved P0 Background Capture Relay R0-R7 implementation` 才能开始产品代码实施。
