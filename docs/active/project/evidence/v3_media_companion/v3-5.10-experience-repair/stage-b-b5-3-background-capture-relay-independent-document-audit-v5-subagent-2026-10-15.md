# V3 P0 Background Capture Relay v5 独立文档审查

日期：2026-10-15。审查者：全新独立只读 reviewer（subagent）。审查对象：`docs/active/project/external-audit-package/` 的 v5 immutable snapshot。审查方式：静态文档/源码事实核查、SHA-256 独立复算、Schema/fixture/verifier 隔离执行与对抗变异。未运行 Chrome、Runtime、Provider 或真实媒体，未播放音频。

## 0. 决定

**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**

- Fatal：0
- Major：5
- Minor：2

v5 的 Chrome 116 sender 身份路线、Background WebSocket ownership、Base64 JSON、单信用和 quiesce/drain 方向具备实现基础；但当前冻结文档仍未给出完整可达的 restart/terminal 语义，且所谓 anti-false-green verifier 可以在 Schema 被实质放宽、甚至 Port authority 回退为 v4 时继续报告 26/26 PASS。当前候选不能授权 R0-R7，也不能解锁 P1 六视频。

## 1. 输入完整性

### 1.1 18 项 SHA-256

独立执行 `sha256sum 0[1-9]-* 1[0-8]-*`，结果与 `AUDIT_MANIFEST.md` 逐项一致：

| 文件 | SHA-256 |
|---|---|
| `01-audit-request.md` | `545816ff8fbf376d5bcef0e65ffed8f63a4e9ee8e6734082f2ae46313529af5e` |
| `02-prd.md` | `0e3279a9901e2b8b98a76805e66dede42094418f3c41904f43232258b203f2c6` |
| `03-architecture.md` | `99b5626d64698be3ffa334d17feedd668257e8c18ebc6c3a2f804779a80a17b6` |
| `04-development-plan.md` | `920a701650468f26d2a8ca995069d300e0d166a63d0ee87f2ef2d4272b98730f` |
| `05-acceptance-plan.md` | `8656b64e5081e4eeb1c54acdaf8261d82f15d39567e25e349aca174d0920cbb8` |
| `06-stage-gate.md` | `375694763e846c77c43e0c14a03c2cfeff0612023cfcba20a0257b6437e69f84` |
| `07-relay-architecture.md` | `f837d6c84bfa47ca5bbce6e2960e978d1a9d3f83cf347dbc16c17ae754714f7a` |
| `08-relay-development-plan.md` | `5150f960ba16c8288fca075e80d6ab91d3bce8fa00747edec36e06b23ed663f2` |
| `09-relay-acceptance-plan.md` | `d8cb34e94174567f624fbfc894cb47c280375601812c1e86409e7bdaee894cbf` |
| `10-relay-preimplementation-audit.md` | `476f67bd6628e455714aea597360c9707360d3b38aa1789cba28c715f2f141b1` |
| `11-phase0-test-results.md` | `6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88` |
| `12-v5-replan-closure.md` | `357ab6e92309b936b863a4ec3a7ccc743b6eaa5161add6e80a517c3b6687a963` |
| `13-current-checkpoint.md` | `32edb65fd2e04e7e93f676df8b4e563dc634155d123c4dbbe3125ab1cb560ff8` |
| `14-relay-architecture.json` | `ae99de3a12a917f5720a3da200394524545901cb1f71d8e65d1c156ff4c17123` |
| `15-internal-relay-v5.schema.json` | `17af8e3de2aa8650e6cd15ece1b83285afb2d820d32cd67b13f1e9dc13ef192e` |
| `16-internal-relay-v5-fixtures.json` | `a1dc2d95de47833d2cc507586e11388d6e251cb1e4413e25ee920fd6eee124e6` |
| `17-internal-relay-v5-verifier.py` | `ea04110c0b64e6928205794800e5c0f522fcec8eb11ce57b2a63f93ba832cd93` |
| `18-main-implementation-prompt.md` | `f4dbc0beaed5b28b2f22eeaf248111b5b3cd5009d0d2a005dbae21d5f61aafff` |

目录实测为 19 个文件、0 子目录；18 个 manifest entry 全部存在且 mismatch=0。通过独立定位，18 个 staged payload 与对应权威源逐字节相等。

### 1.2 verifier 与浅层隔离

- 原包执行 `python3 17-internal-relay-v5-verifier.py`：exit 0，26/26 PASS。
- 仅复制 `15/16/17` 到 `/tmp/navia-v5-audit-*` 浅层目录后执行：exit 0，26/26 PASS。
- 浅层执行不依赖固定 `parents[N]`，此项关闭。

## 2. Major 发现

### M-1：verifier 未冻结 Schema authority，可在合同被放宽或回退 v4 后假绿

`17-internal-relay-v5-verifier.py` 对 `positiveTrace`、`restartRecoveryTrace` 和 `negativeCases` 固定 digest，但没有固定 Schema 全对象 digest，也没有逐条负测 Schema 中所有约束。隔离副本中的以下变异均返回 exit 0、`passed=true`：

- `ready.additionalProperties: false -> true`；
- `chunk.rawByteLength.maximum: 49152 -> 98304`；
- `chunk.pcmBase64.maxLength: 65536 -> 131072`；
- `restartMarkerInstance.additionalProperties: false -> true`；
- `chunk_credit.credit` 从 `const:1` 放宽为 `[1,2]`；
- 同时把 Schema 与 fixture 的 `portName` 从 `navia.mediaCapture.audio/v5` 改回 `navia.mediaCapture.audio/v4`。

最后一项仍报告 26/26，直接违反“v5 唯一实施权威、v1-v4 无可执行混用”。这不是审计包当前哈希失配，而是 R0 提示词要求“保持 26/26”时 verifier 无法阻止未来合同漂移。必须至少冻结 Schema canonical digest，并增加 Schema 约束的独立负例；portName/schemaVersion/消息闭集/`additionalProperties`/数值上限/credit/marker 字段均须由 verifier 独立锁定。

### M-2：`terminal` 精确边界未冻结，当前代码会在 sink finalize 后、transcript/completed 前跳过失败终结

当前事实链：

1. `services/local-runtime/navia_runtime/app.py:1035-1042` 先执行 `runtime_capture_sink.finalize()`，随后立即设置 `terminal = True`。
2. `app.py:1043-1044` 之后才创建并启动 transcript；`app.py:1045-1056` 更晚才发送 `completed` 并关闭 WS。
3. `app.py:1075-1077` 的 `finally` 只有在 `not terminal` 时才 abort。故 transcript start 抛错、completed 发送失败或该窗口内 WS 断开时，finally 不清理、不调用 acquisition failure owner。
4. 当前 `coordinator._fail_acquisition`（`coordinator.py:537-551`）才会清 sandbox、写 `state=failed/terminalAt/failureCode` 并更新 source authority；当前 WS finally 并未调用它。

v5 文档只写“after valid start before terminal”，没有定义 terminal 是“sink finalize”“transcript terminal”“acquisition terminal”“completed receipt 已提交”中的哪一个，也没有冻结上述窗口的 fault injection。8 步 restart trace 也不覆盖 finalize 后/transcript 前或 completed send 前。

必须把 exact terminal boundary 写成机器可验收不变量：在 acquisition 已持久/内存终结并满足 cleanup 之前，WS handler 仍属于 nonterminal；对 `after sink finalize`、`transcript create`、`transcript start`、`before completed send`、`completed send failure` 分别注入异常，均须通过同一幂等 owner 清理并终结旧 task。不能沿用当前过早的 `terminal=True`。

### M-3：五阶段 marker 中 `connecting` 没有可达的旧任务终结 owner

计划要求连接 Runtime 前写 marker，且 fixture 明确包含 `connecting`。但 Runtime owner 仅在“valid start accepted”后才能从 start 取得已验证 taskId并在 WS finally 终结；新 worker 又被严格限制为只调用既有 GET、不得写旧 task。

若 Service Worker 在 marker=`connecting`、Runtime 接受 start 之前退出：

- Runtime 可能没有 active sink，也没有可执行的 valid-start finally owner；
- acquisition/source authority 已可能存在非终态 task；
- 新 worker GET 只能观察，不能使该 task 进入 terminal；
- 当前 8 步 restart trace 只以 `phase=capturing` 为样本，没有 connecting 分支；
- marker 到期语义只校验时间，没有冻结“到期后旧 task 如何 terminal/cleanup”。

因此“old task terminal + cleanup 0 + fresh started”的出门链在该窗口不可达。必须为五个 phase 分别冻结 owner、动作、幂等结果和负例；要么延后 marker/调整 task 建立顺序，要么使用一个已存在且明确授权的内部/公共恢复通道。不能一边要求 connecting marker，一边把新 worker 限制为 GET-only且只给 valid-start finally 写权限。

### M-4：Runtime 进程崩溃不能执行 WS finally，GET-only marker 流程与现有持久恢复通道未接轨

PRD、架构和验收把 `Runtime crash` 与普通 WS loss 一起承诺为 typed fail-closed，但硬进程崩溃不会执行进程内 `finally`。当前 `MediaAcquisitionCoordinator._tasks` 是进程内字典；Runtime 重启后 `GET /v1/media/acquisitions/{taskId}` 会因内存任务缺失返回 404，而不是 v5 restart trace 的 terminal task。

仓库已有持久 source authority 与 `POST /v1/media/acquisitions/recover`，它基于 `sourceIdentity` 和 owner pid/start 完成中断恢复；Side Panel 也已有显式 retry/recover 路径。但 v5 marker 明确禁止保存 sourceIdentity，且新 worker 被限定为只 GET，当前文档没有说明 Runtime hard crash 应由现有 recover 路径、Runtime 启动扫描还是其他 owner 接管。

必须把“Service Worker restart”“Runtime WS loss但进程存活”“Runtime graceful SIGTERM”“Runtime hard crash/restart”拆成四条不同链，明确复用现有 recover API 是否属于允许路径、由谁提供 sourceIdentity、是否增加用户动作，以及 cleanup/authority/fresh-start 证据。否则 R6 的 Runtime crash 无法按当前 8 步链验收。

### M-5：20 项 FailureCode 闭集与当前 grant/Runtime 边界不一致，缺少精确归一化表

`12-v5-replan-closure.md` 声称 relay 直接覆盖 10 项、其余 10 项在 grant/Runtime owner 边界验证，但没有给出后 10 项的请求/响应/归一化矩阵。当前真实边界仍会产生闭集之外的错误，例如：

- `V3_MEDIA_CAPTURE_BINDING_INVALID`：grant body/start shape/capture sink binding；
- `V3_MEDIA_CAPTURE_ORIGIN_MISMATCH`：WS Origin；
- `V3_MEDIA_CAPTURE_NOT_ACTIVE`：sink `_require()`；
- `V3_MEDIA_CAPTURE_NOT_ELIGIBLE`：grant eligibility；
- `V3_MEDIA_CAPTURE_GRANT_INVALID`：grant lookup/revoke。

其中 v5 列表只包含 `BINDING_MISMATCH`，没有说明上述 code 保持在公共边界外、由 Background 映射为何值，还是要修改 Runtime code。若修改 Runtime error semantics，便与“公共 API/schema 不变”存在潜在冲突；若不修改，所谓闭集不是跨边界闭集。

R0 前必须冻结每个 owner 的输入 code、输出 code、HTTP/WS close 语义和 UI 恢复动作，并明确哪些错误不属于内部 Port 闭集。验收需对当前所有可达 Runtime code 做差集检查，不能只验证 RLY5-N01..N30。

## 3. Minor 发现

### m-1：AUDIT_MANIFEST 未记录权威源路径、审计用途和遗漏理由

`EXTERNAL_AUDIT_PACKAGE_PROCESS.md` 要求 manifest 记录每项权威源路径、staged 文件名、SHA-256、用途和低优先级文件遗漏原因。当前 manifest 只有 staged 文件名和 SHA-256。本次 reviewer 通过仓库搜索恢复了 18 项映射并确认逐字节一致，但后续外审不应依赖猜测。

### m-2：实施前内部审计的 Major=0 结论已被本轮事实否定

`10-relay-preimplementation-audit.md` 把 restart 与 verifier 判为已闭合，但没有检查 Schema-only 漂移、connecting 窗口、Runtime hard crash及 finalize/transcript 窗口。修订候选时应重新执行内部审计，不能只附加一份 closure 并保留“Major=0”作为当前摘要。

## 4. 已通过的独立核查

- Chrome 官方 API 与本地 `@types/chrome` 一致：`runtime.getContexts` 为 Chrome 116+ MV3；`MessageSender` 有 id/url/tab/frameId/documentId而无 incognito；`ExtensionContext` 有 contextType/documentId/documentUrl/incognito；`chrome.extension.inIncognitoContext` 可用于当前 extension context。
- exact `documentId` 查询、恰好一个 OFFSCREEN_DOCUMENT、URL/incognito 复核、首次绑定并拒绝替换的设计在 context 消失/替换竞态下可 fail-closed。
- Chrome Port 使用 JSON serialization；Base64 PCM 而非 transferable ArrayBuffer 的方向正确。
- 49,152 raw bytes -> 65,536 Base64 chars、PCM16 偶数字节、单信用、producer 32 chunks/1,572,864 raw bytes和 Background 无第二队列的边界相互一致。
- quiesce 停止新生产、同向 Port 顺序、单信用 drain、stopped 后 Runtime stop 的正常链可实现；Port/WS disconnect 需要 abort 的方向正确。
- v5 当前 fixture 为 20 个唯一 FailureCode、9 类消息、24 步主链、8 步 restart 链、5 个 marker phase、30 个唯一 RLY5 negative ID；30 个 mapping 只使用其中 10 个 code，文档已正确说明“30 mappings 不等于 30 codes”。
- 当前候选没有新增公开 HTTP/WS endpoint、权限、ticket 字段、云上传或用户操作；`fail_capture_stream` 被描述为进程内方法。P0 前禁止 P1，提示词保持该门禁。

## 5. 对抗执行记录

在自动销毁的 `/tmp` 副本中共执行 222 个 fixture 变异，全部 exit 2：

| 组 | 数量 | 结果 |
|---|---:|---|
| unknown FailureCode、第十消息、decoded length、noncanonical padding | 4 | 全拒绝 |
| senderPolicy 每个字段 | 8 | 全拒绝 |
| restartTermination 每个字段 | 9 | 全拒绝 |
| 24 步主 trace 全部标量叶 | 126 | 全拒绝 |
| 8 步 restart trace 全部标量叶 | 40 | 全拒绝 |
| 5 个 marker expiry | 5 | 全拒绝 |
| RLY5-N01..N30 每个 expected mapping | 30 | 全拒绝 |

但另执行 6 个 Schema/authority 变异，全部错误地 exit 0；详见 M-1。这证明 fixture digest 很强，但 verifier 仍不能称为完整 anti-false-green verifier。

## 6. 再审前必须关闭

1. 给 Schema canonical object 增加不可变 digest及约束级负例，证明 Schema-only weakening、schema+fixture v4 port 回退必定非零。
2. 冻结 acquisition terminal 的 exact boundary，并覆盖 finalize/transcript/completed 五个异常注入点。
3. 为 marker 五个 phase 分别给出终结 owner；特别关闭 valid start 前的 connecting 窗口。
4. 分开冻结 SW restart、live Runtime WS loss、SIGTERM、hard Runtime crash；明确现有 recover API/Side Panel recovery 的角色，保证 GET 404 不会无限等待。
5. 给出当前 Runtime/grant 全部错误码到 v5 内部闭集的精确映射或明确范围边界，证明不暗改公共合同。
6. 重建带权威源路径/用途/遗漏说明的平铺审计包，重新执行内部审计和独立外审。

## 7. 限制与门禁

本轮没有运行产品代码、Chrome、Runtime、Provider、ASR 或真实媒体；没有证明真实 PCM、SenseVoice、materialize、UI 进度、secret scan 或 cleanup。报告只判定文档候选。即使后续文档 PASS，仍必须另有明确用户实施授权，且 R0-R7、P0、P1、Stage B 和 V3 均不能由文档审查自动升格。

最终结论：**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**。
