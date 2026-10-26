# V3 P0 Background Capture Relay v6 独立文档审查

日期：2026-10-15  
角色：严格独立只读 reviewer  
范围：`external-audit-package/` 的 18 个载荷、manifest，以及只读追踪当前 `app.py` / acquisition coordinator / task store。未修改产品代码、测试、候选包或既有文档。

## 结论

**DOCUMENT REPLAN / IMPLEMENTATION NO-GO**

Fatal=0，Major=5，Minor=1。v6 verifier 基线 34/34 且所有要求的内存变异均被拒绝，但冻结的是一个仍有终态提交矛盾、恢复收据不可观察和错误码边界不闭合的候选。34/34 不能替代语义可实现性。

## Findings

### Fatal

无。

### Major

#### M1. `completed` 发送失败后无法同时满足“权威任务已成功迁移”和“最终改为 failed”

- 文档要求先满足 authoritative task transition 和 completed frame send，才设置 protocol terminal commit；发送失败仍须由 finally 以 `V3_MEDIA_CAPTURE_FINALIZE_FAILED` 把 task/authority 终结为 failed（`07-relay-architecture.md:95-96`，`15-internal-relay-v6.schema.json:19-20`，`16-internal-relay-v6-fixtures.json:20-21,97-98`）。
- 同一合同又规定 `terminal_returns_same_task`（`15...schema.json:19`）。因此若权威 task 已迁移为 succeeded，`completed_send` 失败后内部 fail 调用只能返回原 succeeded task，不能得到 fixture 要求的 failed task。
- 当前实现正好暴露该边界：`app.py:1042` 在 transcript create/start 和 frame send 前设置 `terminal=True`；`app.py:1075-1077` 因而跳过 finally abort。现有 coordinator 的 terminal task 也不可再失败：`coordinator.py:621-630` 对 terminal cancel 原样返回，`coordinator.py:668-677` 拒绝再次 complete。
- verifier 只比较冻结字符串和 digest（`17-internal-relay-v6-verifier.py:91-92`），没有证明跨持久 task transition 与 WebSocket send 的可执行提交协议。

最小修订建议：冻结一个明确的逐步状态/持久化协议，并选择一种可实现语义：要么 durable succeeded 成为唯一权威，frame delivery 失败由 GET 重取而不回滚 task；要么引入明确的非终态 prepared 状态、客户端 ACK 和可恢复提交规则。同步改写五个 failure case、6 步 trace、`fail_capture_stream` 幂等规则和 verifier，不能继续同时要求“terminal 原样返回”与“send 失败后 succeeded 改 failed”。

#### M2. hard-crash / GET-404 恢复要求的 cleanup receipt 不能通过声明的既有 API 取得

- schema 声称 existing recover 返回 matching taskId **and cleanup receipt**，且 `publicApiChange=none`（`15...schema.json:21`）；fixture 也要求 `abandoned_or_published_receipt_cleanup_zero`（`16...fixtures.json:90-91`）。
- 当前 `POST /v1/media/acquisitions/recover` 只是透传 coordinator 结果（`app.py:1186-1200`）。`recover_interrupted` 虽内部检查 sandbox residual count，但成功只返回 `disposition` 和 `authoritativeTaskId`（`coordinator.py:289-305`），没有 cleanup receipt，更没有 `activeCaptureCount/residualRawAudioCount/privateTempAudioCount` 三项。
- “persistent authority marks interrupted”也不是当前持久状态：task store 允许写入的 authority 状态没有 `interrupted`（`task_store.py:233-240`）；`interrupted` 是 coordinator 在读取时根据旧 PID 临时推导（`coordinator.py:228-246`）。这条推导可用于 recover，但不等于持久 owner receipt。
- marker 又明确禁止 sourceIdentity，GET 404 后只能等待产品重新附着；该 owner 是可达的，但候选没有定义何种现有、用户可达观察面证明三项 cleanup 0，A16/R6 因而无法按文字验收。

最小修订建议：列出不改公共 API 时可实际读取的既有证据链及字段来源，并将 fixture 的 `requiredReceipt` 改成这些真实可观察值；若三项 receipt 必须由 `/recover` 返回，则明确承认并冻结公共响应合同变更，再回到相应合同门禁。另将“持久标记 interrupted”改为“由持久 owner PID/start token 推导 interrupted”，或实现并迁移真实持久状态。

#### M3. “20 项仅内部 relay code”与当前公共 Runtime/UI 事实冲突，14 项归一化矩阵不完备

- 文档声称 20 项只属于内部 wire contract（`07-relay-architecture.md:104`），机器矩阵只有 14 个 source code 加 scope（`15...schema.json:22`，`16...fixtures.json:23`）；verifier 仅检查对象长度为 15（`17...verifier.py:94`），不检查当前可达 code 的集合闭包。
- 多个所谓内部 code 已在公共 Runtime WS/grant/controller 边界使用：`app.py:1030-1066` 发送 `V3_MEDIA_CAPTURE_STREAM_INVALID`；`capture_grants.py:110-136` 使用 TICKET_INVALID/EXPIRED/REPLAYED/BINDING_MISMATCH；`capture_sink.py:75,104,110,132-142` 使用 ALREADY_ACTIVE/BYTE_LIMIT/DURATION_LIMIT/EMPTY/FINALIZE_FAILED；`MediaCaptureController.ts:41,60,168` 也直接公开 ALREADY_ACTIVE/FINALIZE_FAILED。
- 一个关键当前公共码 `V3_MEDIA_CLEANUP_INCOMPLETE` 出现在 `coordinator.py:526-531,644-659,688-707`，却不在归一化矩阵；内部目标则是不同名字 `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`。因此 cleanup failure 没有唯一边界映射。

最小修订建议：机器化冻结“当前公共 source code 全集合、内部 target code 全集合、identity pass-through、rename mapping、禁止映射”四部分；至少补 `V3_MEDIA_CLEANUP_INCOMPLETE -> V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`，并明确同名 code 是共享词法值还是仅内部值。verifier 应从冻结 source inventory 验证每个可达公共码恰有一种处置，而不是只断言 `len(...) == 15`。

#### M4. 专项架构仍把 v5 文件列为“内部机器合同”，破坏 v6 唯一实施权威

- 同文件前文明确 v1-v5 禁止实现（`07-relay-architecture.md:54,68`），但末尾直接指向 v5 schema 和 v5 fixtures（`07-relay-architecture.md:133`）。
- manifest、acceptance plan 和 implementation prompt 都指向 v6；该冲突位于开发者最可能跟随的架构权威内，不能以 manifest hash 消除。

最小修订建议：把该行改为 v6 schema/fixture，并补充 v6 verifier 路径；重新生成 18 载荷 manifest 与 hash 后重审。

#### M5. A07 的“acquisition/transcript/outline/workspace 同 revision”在现有合同上不可判定

- A07 要求 resolve、authority、acquisition、transcript、outline、workspace 使用同一 `taskId/revision`（`09-relay-acceptance-plan.md:32`；顶层 `05-acceptance-plan.md:2222` 同样要求）。
- 当前 acquisition task 没有 `revision` 字段（`coordinator.py:326-343`）；持久 source authority 只有 consent policy revision，并非 product task revision（`task_store.py:100-105`）。transcript projection 自己维护独立 revision，不能天然等于 outline revision。
- 同时计划禁止改变公共 API/schema（`08-relay-development-plan.md:14,85`），所以 A07 既可能永远失败，也可能被报告用含糊的“同 revision”自报假绿。

最小修订建议：将 A07 拆成可观察断言：所有层 `taskId/sourceIdentity` 一致；各有 revision 的 projection 分别满足单调性和 expected-revision fence；只有共享同一版本域的 outline/workspace 才要求 revision 相等。若确需 acquisition revision，先显式批准并冻结公共 schema 变化。

### Minor

#### m1. cleanup failure 名称在专项架构正文与机器合同不一致

`07-relay-architecture.md:96` 写作 `V3_MEDIA_CLEANUP_INCOMPLETE`，v6 内部机器合同为 `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`（`15...schema.json:19,26`）。这也印证 M3 的公共/内部边界尚未写清；修订映射后统一正文用语。

## Manifest 与权威源

manifest 声明 18 个载荷，目录实际为 18 个载荷 + 1 manifest；18/18 SHA-256 全匹配，且每个载荷与 manifest 所列权威源逐字节一致：

```text
01 cdc983c3ea9f04c95c8e67ad500140c2b04db0372be83aea7143306dc3f06dbd
02 562178ae8a5c38e6057d975f9912bc7662eca0c31ae28774ab5144bd84cf907a
03 304a1de633ceac5857bcbd38cba160ff146aa23318de4311f02d97198bc2666c
04 d3cdff5b7bff188262d6aaa97152a3c60ff527a2a933c3f6308432c8e2d6dbbd
05 99348115a5c17b805130ccae8723364afd54b55362fc6bd944bf081d80288c85
06 0ab8b9a37a1da8b764a7ac002bc771ddf30f81421a8197cf73d07059bcab4864
07 11e5e2c326f584a0184e76fb16e914cac47c6d0e95bf2959a79281b517137a30
08 9133284ed375318177a6bf66c8f1018b6d407acfd204621f7127c6627b2ab9f4
09 fea8101f564f1be5342eaec1dc5bb2a1960224d12039fa3013437cfc72c42f3f
10 62227e0917c422aad86b2d98012a395a24f2544491a885ea06b7ad1325240e19
11 6fbef7d0b1ce2cff42d987ed1b23a0779d042bc024e92cb9f8fbf18b50b13f88
12 701d506bc5f0d34ad410273e69e575af88995dcd94c1795f6ea030a98d59370c
13 f4728904a77257207244dfb43eb50c11aa4ab8145f046980e384b28cb941c933
14 f1bb393e05bc75c67e8e64ba55d08203937d44f74d3d9ab550cee0d339eb0789
15 584ff420c6c179429576fc0cb33916852de663c711b5366ca1279a74dcf3064f
16 11c63cfb806348a2ceaa507cd621bcbfb9b8d3d236e05312afa0c723c502523b
17 9d0cd344ffc6ecb19b78ee6e493d210f4097be21d97d90776a51933eb8fcf63f
18 16ec469f7d6b6a10bd3689bfa4208f9977837524f4aa1384a9dc46501d9038b2
```

## Verifier 与变异

基线：`PYTHONDONTWRITEBYTECODE=1 python3 .../17-internal-relay-v6-verifier.py`，exit 0，34/34。

采用 stdin Python harness 在内存中 monkeypatch `Path.read_text`，未创建或修改候选副本。harness 自身 exit 0；以下每个被测 verifier 均 exit 2：

```text
schema additionalProperties 放宽
schema chunk maximum 放宽
schema credit 放宽
schema marker phase 放宽
schema + fixture portName 同步回退 v5
terminalBoundary 变异
restart terminal owner 变异
phase recovery owner 变异
24 步 positive trace 任意字段变异
8 步 restart trace 任意字段变异
6 步 terminal trace 任意字段变异
7 recovery cases 任意字段变异
5 terminal cases 任意字段变异
30 negative cases/mapping 任意字段变异
```

结论：schema authority 和 fixture 字节冻结已关闭 v5 的“同步漂移仍绿”问题；但 digest 只能拒绝变更，不能证明当前冻结语义正确。M1-M3 正是在未改任何冻结字节时仍可成立的假绿。

## R0-R7 / A01-A18 评价

计划对真实 PCM、fresh muted Chrome、runner purity、非零退出、bounded queue、secret scan、owned cleanup、真实 Uvicorn、故障矩阵和 P1 阻塞的文字门槛总体充分，能拒绝 mock/空 PCM/跨 run/无限 queue/泄密等常见假绿。sender 的 Chrome 116 + `getContexts(documentId)` 路线也具备实现路径；当前 manifest 尚未声明 minimum version 是已知 R0 待办，不是当前实现事实。

但 A15/A16/A17/A18 的静态 verifier 并未关闭 M1-M3，A07 又不可判定。故不能据 34/34 或 R0-R7 章节文字给 DOCUMENT PASS。

## 命令与退出码

```text
find external-audit-package -maxdepth 1 -type f ...       exit 0
sha256sum external-audit-package/*                        exit 0
manifest 解析 + 18 个权威源逐字节比对                  exit 0
python3 -m json.tool 14/15/16                             exit 0 / 0 / 0
v6 verifier baseline                                      exit 0 (34/34)
in-memory mutation harness                                exit 0
14 个 mutation 内的 verifier                              各 exit 2
rg/nl/sed 只读追踪 app.py/coordinator.py/task_store.py    exit 0
```

## 限制

- 按审计约束未运行产品代码、Runtime、Chrome、Provider、真实媒体或音频；未把未来 R0-R7 计划当作当前实现。
- 工作树在审查开始前已有大量未提交改动；本报告评估的是 2026-10-15 文件系统中的 manifest 封存载荷及当前相关源码，不代表某个 Git commit。
- 因“唯一允许写入”为本报告，未创建 `/tmp` 或浅目录副本；路径独立性未实测。所有必需 schema/port/owner/trace/case 变异均以内存方式完成，候选目录 hash 未改变。
- 未执行人类体验或 P0 implementation exit；即使文档修订通过，实施仍需独立 Fatal=0/Major=0 和用户明确授权。
