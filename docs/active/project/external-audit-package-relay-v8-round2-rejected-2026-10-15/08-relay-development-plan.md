# Stage B B-5.3 P0 Background Capture Relay v8 开发计划

日期：2026-10-15。状态：`DOCUMENT CANDIDATE`。范围仅为 P0 单视频可信捕获中继，不授权 P1-P9。

## 1. 输入与完成定义

输入为当前已 arm 的同源 task、30 秒 one-shot ticket、可信 extension action 得到的 tab streamId，以及 Runtime `capture-stream` endpoint。完成定义是固定 BVID 在 fresh muted Chrome 中经真实捕获、本地 SenseVoice、acquisition 和 Side Panel materialize 到达 `ready|degraded`，且 taskId/sourceIdentity 跨层一致、各 revision 域分别单调、product revision fence 一致，secret/raw-media/path/cleanup 均满足门槛。

## 2. 子阶段

### R0 合同冻结

- 新增 v8 内部 Port 实际消息 schema/types、20 项 relay FailureCode 闭集、RLY8-N01..N30 固定映射、36 项源码错误 inventory 与公共边界归一化矩阵、credit/queue/backpressure 常量、五阶段 marker 实例、24 步主链、8 步 Runtime-alive 重启链、6 步 handoff failure 链、8 步 after-stage hard-crash 恢复链、六注入点与七类 phase/recovery owner fixture。
- 明确不改变公共 API/schema、Runtime endpoint、ticket TTL 和用户流程。
- 在 WXT manifest 冻结 `minimum_chrome_version: "116"`，并以 build manifest 静态断言和 Chrome 116+ capability probe 证明 `runtime.getContexts` 存在；不允许兼容性降级到弱 sender 校验。
- 建立 `captureRelaySourceFailureCodes` 中央注册表；按 fixture 冻结的 9 个路径和 Python AST symbol/TypeScript literal selector 推导 emit set，并扫描两个 discovery root 拒绝未登记发码文件，证明 emit sites、注册表与冻结 36 项 inventory 精确相等；单测覆盖文件/emit/registry 增删与 sender、sequence、length、duplicate、out-of-order、disconnect、restart。

出门：schema/fixture 静态验证全绿，实施前审计 Fatal=0/Major=0。

v1-v7 均已作废。v8 在 v7 digest/trace 基础上冻结同步 staging 屏障、handler/transcript cleanup 所有权转移、ASR owner manifest、recover composite cleanup、现有 SQLite 产品终态、36 source/20 target code 完备分类和三个 revision 域；当前 verifier 47/47 PASS。该结果只证明文档静态合同一致，不表示 TypeScript/Python 实现、真实 Chrome capability 或 R0 代码出门。

### R1 Background transport

- 新增 `RuntimeCaptureTransport`；只允许一个 active task。
- WebSocket open -> start JSON -> `started` -> binary chunk -> stop/final receipt。
- 超时、close code、协议错误和 abort 均映射固定 FailureCode；日志不得含 payload。
- 连接前写入 v8 六字段 `TRUSTED_CONTEXTS` marker；在五个 phase 边界更新 phase 但不刷新 18 分钟 expiry。capture handoff 只在 sink finalize、transcript create、同步 staging/fsync/hash/shape 屏障和 worker start 全部成功后成立；terminal frame 发送失败不回滚 handoff，也不得声明产品成功。任何合法 start 后的退出均按 barrier receipt 把 cleanup 分派给唯一 owner。
- connecting 且 valid start 未成立时，新 worker 用既有认证 DELETE 取消 acquisition 再 GET；Runtime alive 的其他 phase 只 GET finally 结果；GET 404 停止轮询并等待产品重新附着调用既有 recover。hard crash/SIGTERM 通过 owner manifest、持久 authority 与 recover 内部 `MediaRecoveryCleanupCoordinator` 闭环；依次清 acquisition、ASR stage、未发布产品证据并校验 active sink，全零后才允许 fresh begin，不假定 finally 执行且不新增公共接口。

出门：状态机、重放、单任务、socket loss、Runtime rejection、Runtime finally 内部终结幂等、connecting DELETE、GET 404 停轮询、existing recover、边界错误归一化与 cleanup 单测全绿。

### R2 Offscreen producer

- 删除 Offscreen 直连 Runtime 的职责。
- 保留 getUserMedia/AudioContext/downsample/PCM16；通过精确 Port 发送 Base64 JSON chunk，解码后每块不超过 49,152 bytes。
- exact Port 校验五个 `MessageSender` 字段；以 documentId 调用 `runtime.getContexts`，要求恰好一个 OFFSCREEN_DOCUMENT 且 ExtensionContext.incognito 与当前 extension context 一致。
- 实现单信用窗口和 producer 侧 32 chunks/1,572,864 raw bytes 总 outstanding 上限；正常完成采用 quiesce source -> drain existing queue -> stopped -> Runtime finalize。只有 Runtime stop 已发送后才拒绝 chunk。

出门：音频处理合同、sequence、byteLength、stop idempotency、Port disconnect 全绿；无网络调用静态断言。

### R3 Controller integration

- Controller 先创建 transport 并获得 Runtime `started`，再启动 Offscreen capture。
- stop 顺序：quiesce producer -> drain/确认 -> Offscreen stopped -> Runtime finalize -> cleanup -> response。
- 任一路失败统一走 abort；所有 idle/error 分支关闭 offscreen。

出门：controller/router/client 集成测试全绿；没有第二编排者。

### R4 Runtime 与安全回归

- 保持 endpoint；必要时只增加脱敏诊断和真实 Uvicorn integration fixture。
- 校验 exact Origin、ticket/binding/replay、private directory mode、socket close cleanup。
- 重新验证 extension CSP 只有确切 loopback origin。
- 修改 WebSocket handler 与 transcript service 的 handoff 边界：`TaskAudioStager.stage()` 必须在 daemon worker 启动前同步完成并返回完整 receipt。对 after-finalize、transcript create、before-stage、after-stage-before-worker、completed-frame-send、product-commit-before-observe 六点逐一注入，证明唯一 cleanup owner、无原件提前删除、无内存成功冒充持久成功。
- 为 `TaskAudioStager` 增加私有、fsync 的 owner manifest，并把 stager cleanup 接入 existing recover 的内部 composite callback；真实 kill 必须发生在 stage 后/worker 前，重启 recover 后 acquisition/ASR/product/sink 四类残留均为 0，再证明 fresh begin 单 sink。
- 新增 36 项当前源码错误到 20 项内部 relay code 的差集测试；两项 `TaskArtifactError` 显式映射，公共 code 和 HTTP/WS 语义本身不改。

出门：Runtime capture pytest、真实 Uvicorn WS、secret scan、CSP purity 全绿。

### R5 单视频真实 canary

- fresh build/profile/runtime/db/task root；固定 BVID；visible Chrome 仅在提前通知后执行；必须 `--mute-audio`。
- runner 只做用户可达动作和观察；不直接调用 controller/materialize/数据库。
- 证明 Background WS、Offscreen PCM、Runtime sink、SenseVoice、acquisition、materialize、terminal 全链。

出门：`ready|degraded`、taskId/sourceIdentity 一致、各 revision 域单调且 product fence 一致、UI 停止 busy、cleanup/secret 0。

### R6 故障矩阵

- permission missing、worker missing、Offscreen Port disconnect、WS loss、backpressure、tab close/navigation、用户取消、connecting restart、六个 handoff/product 注入点、Runtime graceful SIGTERM、Runtime hard crash/restart、GET 404、cleanup failure。
- 每个故障必须是真实边界或可证明等价的进程/上下文故障，不接受只 stub 返回值。

出门：全部 typed terminal，错误不被吞，资源归零；cleanup failure 不能成功。

### R7 候选封存与外审

- 冻结 build、源码清单、测试、真实 run、日志摘要、secret/cleanup、PRD review、false-green audit。
- 创建 immutable candidate ID；独立 reviewer 逐文件复算。

出门：Fatal=0/Major=0 才解锁 P1 六视频；Minor 必须列明所有者与关闭阶段。

## 3. 预期修改边界

允许修改：capture module、background/offscreen entrypoint、相关测试、P0 canary、必要的 Runtime 脱敏诊断和文档证据。

禁止修改：Cookie/provider 合同、BVID 分母、grounded comprehension schema、SourceAuthority 语义、Side Panel materialize ownership、V4 Query/Graph/Durable Forget。

## 4. ClaudeCode 高 token 分工

`navia-主干开发` 承担 R0-R7 的跨目录源码检视、长 diff、Node/Python 矩阵、visible Chrome runner、故障注入、日志和 candidate package。`navia-审查` 仅在 immutable candidate 后只读复算。Codex 维护权威文档、抽查关键合同、执行 PRD/验收门禁并决定是否放行。

## 5. 失败恢复

- Claude `429/529`：停止重复请求，写 checkpoint（最后成功动作、diff、命令/退出码、PID/端口/run、cleanup、nextSafeAction），不得拼接部分 run。
- 工具/Provider `422`：保存脱敏 request hash、schema/version、错误码，修复输入或 adapter 后再试；禁止原样重试。
- Chrome/Runtime 失败：先完成本轮 owned resources cleanup，再诊断；条件未改变不得重跑。
- 任何声音、秘密泄漏、私有路径泄漏或 cleanup 失败：立即 NO-GO。

## 6. 回滚点

每个 R 子阶段独立提交候选和测试证据；不使用 destructive Git 命令。若 Background relay 不成立，保留当前失败证据，回到架构评审，不恢复 Offscreen 直连并伪称成功。

