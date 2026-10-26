# Stage B B-5.3 P0 Background Capture Relay v9 验收计划

日期：2026-10-15。状态：`DOCUMENT CANDIDATE`。

## 1. 用户场景

用户在已完成一次站点授权的 B站视频页打开 Navia。平台字幕和可下载媒体路径不可用时，界面显示一个可信捕获动作。用户确认后，Navia 静音采集当前标签页音频并在本机转写；完成后自动显示视频内容，用户无需操作 ticket、WebSocket、Runtime endpoint 或 materialize。

## 2. 固定正例步骤

1. 构建同一候选扩展，创建 fresh Chrome profile、Runtime、database、task root。
2. 使用固定 `BV1pohR6rEEh`；预置的 permission/consent 只代表日常已授权，不代签 extension action。
3. Chrome 命令必须含 `--mute-audio`；页面不得播放声音。
4. 打开 Side Panel，观察 resolve、同源 authority 和 `awaiting_trusted_capture`。
5. 点击产品 arm；通过真实 extension action 开始 capture。
6. 观察 Background transport 收到 Runtime `started`，Offscreen Port 产生有序 chunk，Runtime 收到非空 PCM。
7. 达到冻结最小采集条件后点击产品 finish。
8. 等待 SenseVoice/acquisition succeeded；只观察 Side Panel effect 发起 materialize。
9. 断言最终 `ready|degraded`、UI busy 停止、Workspace 可复读。
10. 关闭本轮 owned 资源并复算 cleanup/secret。

## 3. 自动验收门槛

| ID | 门槛 | 必须结果 |
|---|---|---|
| A01 | 内部 sender | 非精确 Offscreen sender 全拒绝 |
| A02 | Ticket | 30 秒、一次性、task/tab/page/adapter/surface 绑定；重放拒绝 |
| A03 | WS ownership | Offscreen 网络调用为 0；Background 是唯一 Runtime WS owner |
| A04 | Protocol | Runtime `started` 前 chunk 为 0；quiesce 后只 drain 既有队列；Runtime stop 发出后 chunk 为 0 |
| A05 | Sequence | 0 起严格递增；重复/跳号/倒序全部拒绝 |
| A06 | Backpressure | Base64 chunk 原始 <=49,152 bytes/编码 <=65,536 chars；单信用；producer outstanding <=32 chunks/1,572,864 raw bytes；下一 enqueue 将超限时先 abort；同一 chunk 不重复计数 |
| A07 | Authority | 各层存在字段时 taskId/sourceIdentity 一致；consent revision 在 resolve/authority/acquisition request 一致；transcript revision 独立单调；outline/workspace 共享 product revision 与 expected-revision fence；禁止跨 revision 域强求相等 |
| A08 | Real media | Runtime 收到非空真实 PCM；不得 fixture/静音空包冒充 |
| A09 | Terminal | acquisition succeeded 后由产品 effect materialize 到 ready/degraded |
| A10 | UX | 10 秒内有阶段/计时变化；终态停止黄色 busy；错误给明确恢复动作 |
| A11 | Privacy | Cookie/ticket/streamId/PCM/WAV/API key/私有路径公开命中 0 |
| A12 | Cleanup | track/context/Port/WS/offscreen/private sink/profile/runtime/port 全归零 |
| A13 | Audio policy | 所有 Chrome `--mute-audio`；0 扬声器播放 |
| A14 | False green | runner 0 次 controller/materialize/database 直调；失败 exit 非 0 |
| A15 | Handoff/terminal | sink finalize 不构成 terminal；同步 stage barrier 在 worker 前完成；barrier 前后 cleanup owner 唯一；completed frame 仅通知 handoff；只有 SQLite ready/degraded 产品提交允许 recover=published |
| A16 | Recovery owners | connecting 用既有 DELETE；Runtime-alive 按 stage ownership 由 handler/transcript service 清理；hard crash/SIGTERM 只凭 authoritativeTaskId 定位确定性 owner manifest；manifest 以临时 O_EXCL write、file fsync、atomic replace、parent-directory fsync 后才发布 receipt；missing/torn/corrupt/mismatch/unsafe 一律 cleanup incomplete；existing recover composite cleanup 后 acquisition/ASR/product/sink 四项残留全零，未持久发布返回 abandoned；GET 404 停轮询 |
| A17 | Boundary codes | 40 个现行 source code 恰好分类为 shared/rename/public-only；20 个 relay target code 闭集；11 个冻结源码 scope 的 semantic AST boundary set、中央 registry 与 inventory 精确相等；四个递归 discovery root 内所有其他 `V3_MEDIA_*` 必须属于冻结 non-relay allowlist，sibling/嵌套/imported emitter 均不可逃逸；公共 Runtime/grant/UI code 保持不变 |
| A18 | Contract immutability | Schema/protocol canonical digest 固定；Schema 放宽、v5 回退、fixture 同步漂移均非零 |

A01 的前置能力门槛为：WXT/build manifest 精确声明 `minimum_chrome_version: "116"`，真实目标 Chrome 中 `chrome.runtime.getContexts` 存在；旧版本不得降级到仅依赖 URL 或 payload 的弱 sender 校验。

## 4. 负例矩阵

| 场景 | 预期 FailureCode/行为 |
|---|---|
| permission missing | 明确 blocked；不创建 stream/ticket |
| ticket expired/replayed/binding mismatch | Runtime 拒绝；不写 sink |
| fake sender/Port | Background 拒绝；不打开 WS |
| Offscreen disconnect | abort Runtime sink；UI 可重试 |
| sequence invalid | `V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID` |
| Base64/decoded length/chunk invalid | `V3_MEDIA_CAPTURE_CHUNK_INVALID` |
| queue overflow | `V3_MEDIA_CAPTURE_BACKPRESSURE` |
| Runtime alive / WS close | `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`；Runtime finally 终结 task，capture 停止 |
| Service Worker restart: connecting | 新 worker 调用既有认证 DELETE，GET 观察 cancelled；不续传旧 PCM/ticket |
| Service Worker restart: valid start 后 | Runtime WS finally 先 cleanup 并通过进程内 coordinator 幂等终结旧任务；新 worker 仅用既有 GET 观察 terminal |
| sink finalize 至 worker start | finalize/create/before-stage 由 handler 清理；stage 后由 transcript service 清理；均 `V3_MEDIA_CAPTURE_FINALIZE_FAILED` 且 cleanup 0 |
| completed frame send failure | handoff owner 保持，转写继续；不得声明产品 succeeded；重启后只能按 SQLite 产品终态 published 或 abandoned |
| Runtime graceful SIGTERM | 由持久 owner PID/start token 推导 interrupted；产品重附着调用既有 recover 并核对 disposition/taskId |
| Runtime hard crash/restart | 在 owner manifest 临时 O_EXCL write、file fsync、atomic replace、parent-directory fsync 和 receipt 后、worker 前真实 kill；不假定 finally；重启只凭 authoritativeTaskId 发现 manifest，依次清 acquisition/ASR stage/unpublished product，连同 active sink 四项归零，否则公开 cleanup error；abandoned 后 fresh begin 证明单 sink |
| owner manifest 缺失或损坏 | missing、torn JSON、identity/hash/length/WAV-shape/state mismatch、path escape/symlink、缺 parent-directory fsync receipt 共 8 类均返回 `V3_MEDIA_CLEANUP_INCOMPLETE`，不得继续 worker 或宣称 published |
| tab close/navigation | capture cancelled；无 materialize 成功 |
| SIGTERM | owned child/port/profile/scratch 清零 |
| cleanup failure | terminal 不得为 succeeded |

错误码最终名称在 R0 fixture 冻结；实现不得用自由文本替代。

R0 v1-v8 候选均已被独立审查拒绝。机器权威改为 `v3_media_capture_internal_relay_v9.schema.json` 与 `v3-media-capture-internal-relay-v9-fixtures.json`；30 个负例 ID 必须精确为 `RLY9-N01..RLY9-N30`，owner manifest 负例为 `OM9-N01..OM9-N08`。Schema、protocol、24 步主链、8 步 Runtime-alive 重启链、6 步 handoff failure 链、13 步 hard-crash cleanup 链、七类 recovery owner、六个 handoff/product failure case、40 项 source inventory 分类、non-relay allowlist 与三个 revision 域必须全对象 immutable；verifier 必须运行 Schema 放宽、旧 port 回退、未知 code、第十消息、长度/padding、trace/restart/mapping/source-hash，以及 scope/boundary/registry/sibling/nested/imported-emitter 增删对抗探针，全部稳定结构化 exit 2。

Worker restart 验收还必须证明：`storage.session` 为 `TRUSTED_CONTEXTS`，marker 只含 schemaVersion/captureSessionId/taskId/startedAt/phase/expiresAt；expiry 固定为 startedAt+1,080,000 ms且 phase 更新不续期；ticket/grantId/streamId/PCM/sourceIdentity/path/Cookie/API key 命中 0。每个 phase 与 Runtime alive/crash 状态都有唯一 owner；marker 过期只清 marker，不写成功、不删除 authority。fresh `started` 前必须证明 prior active sink=0。

## 5. 人类最小验收

自动门槛通过后，人类只验证：B站视频页打开 Navia -> 按提示确认一次可信捕获 -> 看见真实进度/计时 -> 完成后看见可读大纲并可反跳。人类不做听写、不提供测试数据、不检查内部 WebSocket。可见 Chrome/UIAutomation 会抢占焦点时必须提前通知。

## 6. 反退化

- 有字幕/可下载媒体的自动路径不能新增 capture 确认。
- MiniMax 默认、DeepSeek 手动选择和系统凭据库语义不变。
- Chat/Know、普通网页、视觉选帧、五种导出不因 relay 修改而回退。
- 单视频通过不等于六视频、Stage B、V3 或人类最终 PASS。

## 7. 出门与停止

P0 出门要求：A01-A18 全绿；真实正例 1/1；负例矩阵全闭合；PRD review 无偏移；独立审查 Fatal=0/Major=0。

立即停止：需要放宽公共合同/Origin/ticket；无法证明真实 PCM；任何声音播放；秘密或原始媒体进入公开证据；cleanup 不完整；runner 伪造终态；条件未改变的重复 run。

