# V3 P0 Background Capture Relay v10 独立文档审查

日期：2026-10-15  
审查者：Codex 独立只读审查  
审查对象：V3 P0 Background Capture Relay v10 文档候选  
结论：**DOCUMENT PASS / R0-R7 IMPLEMENTATION AUTHORIZED BY EXISTING USER APPROVAL**

## 0. 决定摘要

```text
Fatal = 0
Major = 0
Minor = 3

DOCUMENT PASS
允许依据用户既有“继续实际开发”授权直接进入 R0-R7：YES
P1 六视频：仍 BLOCKED，必须等待 P0 R7 实施出门 Fatal=0/Major=0
```

v9 的三项 Major 已在 v10 机器合同中真实关闭：

1. TypeScript imported enum 中的边界错误码已被 AST closure 捕获；跨文件对抗样本稳定以 exit 2 拒绝。
2. owner manifest 在 parent-directory fsync 后，以 SQLite `synchronous=FULL` 事务提交跨进程持久 receipt；receipt 与 manifest canonical SHA-256 精确绑定，恢复不依赖进程内存。
3. verifier 与 mutation runner 均以 `python3 -B` 和 `PYTHONDONTWRITEBYTECODE=1` 执行；本轮复算后未发现任何 v10/relay verifier `.pyc`。

本轮按用户最新要求只审当前 v10 权威文件，不复审 flat external package，不建议或要求生成 v11。Minor 全部转为实现测试义务，不阻断实施。

## 1. 审查边界

读取并交叉核对：

- `AGENTS.md`；
- `design/project-stage-workflow.md`；
- v9 独立审查报告；
- v10 Schema、fixtures、baseline verifier、mutation verifier；
- 主 PRD、主架构、主开发/验收计划、V3 stage gate 和 V3-5.10 修复计划中的 P0 段落；
- 当前 v10 relay 架构、开发计划、验收计划和实施前审计。

本轮只执行静态读取、JSON Schema 复算、canonical SHA-256 复算、baseline verifier 和隔离 mutation verifier。未运行或修改产品代码，未启动 Chrome、Runtime、Provider 或媒体链路，未播放声音。除本报告外未修改任何项目文件。

## 2. 独立机器复算

### 2.1 输入哈希

| 文件 | SHA-256 |
|---|---|
| `v3_media_capture_internal_relay_v10.schema.json` | `65b31eadd4acf41386c6f21f8172ccc7176a604a8a2a1c55a8ccc5ac751c6dd4` |
| `v3-media-capture-internal-relay-v10-fixtures.json` | `7bb9d8a5192a13ce1fd5978e691e82f2505eadb34e331da8543d55487a3812f7` |
| `verify-...-v10-contract.py` | `e2ca22ff8f6d80e4556c1a1fc72f992457bdc0750203ead418700f8cf848d31c` |
| `verify-...-v10-mutations.py` | `9c376719117a8cb0740c9eda28e23cab5b12b2c1da5d0846615fbda9ee453f0e` |

### 2.2 Schema meta 与实例

执行：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B - <<'PY'
import json
from pathlib import Path
from jsonschema import Draft202012Validator
s = json.loads(Path('docs/active/project/contracts/v3_media_capture_internal_relay_v10.schema.json').read_text())
f = json.loads(Path('docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json').read_text())
Draft202012Validator.check_schema(s)
errors = list(Draft202012Validator(s).iter_errors(f['protocol']))
print({'meta': 'PASS', 'instance': 'PASS' if not errors else 'FAIL', 'errors': len(errors)})
raise SystemExit(0 if not errors else 2)
PY
```

结果：exit 0；Draft 2020-12 meta `PASS`；`fixtures.protocol` 实例 `PASS`；errors=0。

说明：审查过程中曾先把 fixture 容器而非其中的 `protocol` 当作协议实例，得到 24 条类型边界不匹配；确认 Schema 的根对象是 relay protocol 后按正确实例重算，结果为 0 error。该操作错误不属于候选缺陷，也未作为通过依据。

### 2.3 Baseline 50 checks

执行：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/\
  verify-stage-b-b5-3-background-capture-relay-v10-contract.py
```

结果：exit 0；`passed=true`；`total=50, passed=50, failed=0`；Schema errors 为空；source inventory 为 `actual=40/frozen=40/missing=0/extra=0`；unlisted boundary emit 为空。

### 2.4 Mutation 15 cases

执行：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/\
  verify-stage-b-b5-3-background-capture-relay-v10-mutations.py
```

结果：exit 0；`passed=true`；`total=15, passed=15, failed=0`。14 个危险变异均得到预期 exit 2，非边界词法字符串对照得到 exit 0。

关键对抗结果：

- `offscreen_imported_enum_boundary_emit`：捕获 `IndependentFailure.Code = V3_MEDIA_CAPTURE_INDEPENDENT_IMPORTED`，触发 `unlistedSourceFilesEmitNoBoundaryCodes` 和 `discoveredCodeUniverseClosed`；
- `owner_manifest_parent_fsync_removed`：触发 protocol immutability 与 owner manifest durability 检查；
- `owner_receipt_write_removed`：触发 protocol immutability、schema instance 与 owner durability 检查；
- `owner_receipt_manifest_hash_mismatch`：触发 protocol immutability 与 staged crash owner 检查；
- sibling、nested TypeScript 和 Python emitter 均稳定被发现；
- source inventory 与 non-relay allowlist 的增删均稳定失败。

### 2.5 Canonical receipt 绑定

独立按 UTF-8、递归 key 排序、无额外空白的 canonical JSON 对 `ownerManifestExample` 计算 SHA-256：

```text
manifest canonical SHA-256 = f585d34021377fabf6cefa41b700a25337726ca845b838723cd83c692e1c8409
receipt.manifestSha256     = f585d34021377fabf6cefa41b700a25337726ca845b838723cd83c692e1c8409
match                      = true
```

合同同时冻结：manifest 临时文件 `O_EXCL`、file fsync、atomic replace、parent-directory fsync、SQLite `BEGIN IMMEDIATE`/`synchronous=FULL` committed receipt、receipt 后且 worker 前的 hard-kill 点，以及恢复时 `processMemoryUsed=false`。

### 2.6 无字节码污染

所有 Python 复算均带 `-B` 和 `PYTHONDONTWRITEBYTECODE=1`。复算后执行：

```bash
rg --files docs/active/project | rg 'v10.*\.pyc$|relay.*v10.*\.pyc$'
```

结果：0 matches。仓内存在其他历史阶段的既有 `__pycache__`，本轮未修改或据此扩大 v10 结论。

## 3. v9 Major 关闭判定

### M9-1 Imported enum AST 逃逸

**关闭。** TypeScript extractor 已把 `ts.isEnumMember(parent)` 纳入 boundary value；对抗测试使用两个独立文件声明并导入 enum，不依赖同文件词法巧合，稳定发现新增错误码并 exit 2。

### M9-2 Parent fsync receipt 不可跨进程判定

**关闭。** v10 不再使用内存 receipt。冻结顺序为：

```text
stage file fsync
-> canonical owner manifest temp O_EXCL
-> manifest file fsync
-> atomic replace owner.json
-> parent directory fsync
-> SQLite media_capture_owner_receipts synchronous=FULL commit
-> async worker start
```

receipt 保存 taskId、manifest canonical SHA-256、`ownership_committed`、committedAt 和 durability。recover 要求合法 manifest 与 committed receipt 精确匹配；missing/uncommitted/mismatch 均 fail-closed 为 `V3_MEDIA_CLEANUP_INCOMPLETE`。这使 hard crash 后的所有权判断可由磁盘事实复算。

### M9-3 `.pyc` 污染

**关闭于当前 v10 执行方式。** verifier 主进程和 mutation 子进程都固定 `-B` 与 `PYTHONDONTWRITEBYTECODE=1`，本轮无 v10 `.pyc` 生成。按用户最新范围，本结论不复审当前 external-audit-package 的历史 v9 内容。

## 4. 架构与规格审查

### 4.1 可实现性

结论：`PASS FOR IMPLEMENTATION`。

- Background 是唯一 Runtime WebSocket owner；Offscreen 只做 tab audio、downsample 和受信 Port 数据面。
- JSON/Base64 PCM 与 Chrome extension messaging 的序列化能力一致；不依赖不可用的 transferable ArrayBuffer。
- 单信用、32 chunks/1,572,864 raw bytes、严格 sequence 和超限前 abort 形成有界背压。
- quiesce、drain、stopped、Runtime finalize 的顺序明确，不把 sink finalize 或 completed frame 冒充产品终态。
- 唯一 durable 产品终态仍为现有 `MediaTaskStore.commit_terminal(ready|degraded)`。

### 4.2 公共边界

结论：`PASS`。

v10 只新增扩展内部 Port、Background transport 和 Runtime 内部 owner receipt/recovery callback，不新增公共 endpoint、用户动作、Origin、ticket TTL、Cookie/provider 合同或产品成功数据库。connecting 分支复用既有认证 DELETE/GET，其余分支复用既有 GET/recover。R0-R7 若需要扩大这些公共边界，必须立即停止并重新审查，不能把本报告当授权。

### 4.3 Chrome 116 sender

结论：`PASS WITH IMPLEMENTATION GATE`。

合同不再读取不存在的 `MessageSender.incognito`。它验证 sender ID、精确 Offscreen URL、tab 缺失、frameId 缺失或 0、非空 documentId，再通过 `chrome.runtime.getContexts` 要求唯一 `OFFSCREEN_DOCUMENT` 和正确 incognito context。WXT/build manifest 的 `minimum_chrome_version: "116"` 及真实 capability probe 是 R0 必须完成的实现门槛；禁止为旧 Chrome 降级到 URL/payload 弱校验。

### 4.4 Cleanup owner 与 fail-closed

结论：`PASS`。

- stage barrier 前：Runtime capture handler 独占 acquisition sandbox；
- stage barrier 与 committed receipt 后：transcript service 独占 staged audio 与 acquisition sandbox；handler cleanup 被禁止；
- hard crash/restart：existing recover 内部 `MediaRecoveryCleanupCoordinator` 独占 composite cleanup；
- connecting 且 start 未成立：新 Background worker 走既有 DELETE/GET；
- GET 404：停止轮询并等待产品重新附着或 marker expiry，不写成功。

七类 phase/runtime-state fixture 的条件互斥，四类残留 `acquisition/asr/product/sink` 必须全部为 0；任一 cleanup error 或非零残留均 fail-closed，fresh begin 不得提前发生。

### 4.5 Revision 域

结论：`PASS`。

合同固定三个独立 revision 域：consent policy revision、transcript projection revision、outline/workspace product revision。只要求各域内部一致和单调，明确禁止跨域强求相等；taskId/sourceIdentity 仅在字段存在的层间保持一致。该规则与主 PRD、relay 计划和 A07 一致。

## 5. Minor 与实现测试义务

以下均不要求生成新文档版本，不阻断 R0-R7：

- **Minor 1 / R0 义务**：文档中的 Chrome 116 能力仍是待实现事实。R0 必须断言源码配置与 build manifest 都输出 `minimum_chrome_version=116`，并加入 `runtime.getContexts` 正负 capability test；不得仅检查源配置。
- **Minor 2 / R4-R6 义务**：SQLite FULL receipt 目前由合同和变异证明，不是实现证据。必须用真实 SQLite 文件、进程级 hard kill（receipt commit 后、worker 前）和重启 recover 证明 receipt 可见、manifest hash 匹配、四类残留归零、fresh begin 单 sink；mock repository 不足以出门。
- **Minor 3 / R0-R7 义务**：imported enum closure 依赖当前 TypeScript compiler AST 和递归 discovery roots。实现阶段须把该两文件负例及 source inventory 差集检查纳入固定自动化门槛，并在源码 scope/hash 变化时 fail closed，而不是自动重写 inventory。

## 6. 最终门禁决定

```text
V3 P0 Background Capture Relay v10 documentation: DOCUMENT PASS
Fatal: 0
Major: 0
Minor: 3（全部转为实现测试义务）

Existing user authorization may directly start R0-R7 implementation: YES
Additional Claude document review required: NO
Additional v11 document candidate required: NO
Chrome/Runtime/Provider/media execution performed by this review: NO
P1 six-video run unlocked: NO
```

放行范围仅为当前开发计划中的 R0-R7。每个 R 子阶段仍须按计划执行实现、自动化验证、PRD 检视和 handoff；任何 Fatal/Major、公共 API 扩大、弱 sender 回退、声音播放、秘密/原始媒体泄漏、cleanup 非零或 runner 假绿都应立即停止。只有 P0 R7 独立实施出门 Fatal=0/Major=0 后，才允许进入 P1 六视频 fresh run。
