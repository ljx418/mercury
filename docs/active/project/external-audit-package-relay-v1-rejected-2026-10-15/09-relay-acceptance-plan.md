# Stage B B-5.3 P0 Background Capture Relay 验收计划

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
| A04 | Protocol | Runtime `started` 前 chunk 为 0；stop 后 chunk 为 0 |
| A05 | Sequence | 0 起严格递增；重复/跳号/倒序全部拒绝 |
| A06 | Backpressure | 队列有界；硬阈值返回固定错误并 abort |
| A07 | Authority | resolve/acquisition/transcript/outline/workspace 同 taskId/revision |
| A08 | Real media | Runtime 收到非空真实 PCM；不得 fixture/静音空包冒充 |
| A09 | Terminal | acquisition succeeded 后由产品 effect materialize 到 ready/degraded |
| A10 | UX | 10 秒内有阶段/计时变化；终态停止黄色 busy；错误给明确恢复动作 |
| A11 | Privacy | Cookie/ticket/streamId/PCM/WAV/API key/私有路径公开命中 0 |
| A12 | Cleanup | track/context/Port/WS/offscreen/private sink/profile/runtime/port 全归零 |
| A13 | Audio policy | 所有 Chrome `--mute-audio`；0 扬声器播放 |
| A14 | False green | runner 0 次 controller/materialize/database 直调；失败 exit 非 0 |

## 4. 负例矩阵

| 场景 | 预期 FailureCode/行为 |
|---|---|
| permission missing | 明确 blocked；不创建 stream/ticket |
| ticket expired/replayed/binding mismatch | Runtime 拒绝；不写 sink |
| fake sender/Port | Background 拒绝；不打开 WS |
| Offscreen disconnect | abort Runtime sink；UI 可重试 |
| sequence/length invalid | `V3_MEDIA_CAPTURE_PROTOCOL_INVALID` |
| queue overflow | `V3_MEDIA_CAPTURE_BACKPRESSURE` |
| Runtime crash/WS close | `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`；capture 停止 |
| Service Worker restart | 旧任务中断并清理；新 worker 不续传旧 PCM/ticket |
| tab close/navigation | capture cancelled；无 materialize 成功 |
| SIGTERM | owned child/port/profile/scratch 清零 |
| cleanup failure | terminal 不得为 succeeded |

错误码最终名称在 R0 fixture 冻结；实现不得用自由文本替代。

R0 机器权威为 `v3_media_capture_internal_relay_v1.schema.json` 与 `v3-media-capture-internal-relay-fixtures.json`；16 个负例 ID 必须精确为 `RLY-N01..RLY-N16`，expected FailureCode 必须属于闭集。

Worker restart 验收还必须证明：storage.session marker 只含 captureSessionId、taskId/grantId 哈希和 startedAt；ticket/streamId/PCM/sourceIdentity/path 命中 0；新 worker 发出固定失败、验证 Runtime active sink=0、清 marker，且没有恢复旧 sequence。

## 5. 人类最小验收

自动门槛通过后，人类只验证：B站视频页打开 Navia -> 按提示确认一次可信捕获 -> 看见真实进度/计时 -> 完成后看见可读大纲并可反跳。人类不做听写、不提供测试数据、不检查内部 WebSocket。可见 Chrome/UIAutomation 会抢占焦点时必须提前通知。

## 6. 反退化

- 有字幕/可下载媒体的自动路径不能新增 capture 确认。
- MiniMax 默认、DeepSeek 手动选择和系统凭据库语义不变。
- Chat/Know、普通网页、视觉选帧、五种导出不因 relay 修改而回退。
- 单视频通过不等于六视频、Stage B、V3 或人类最终 PASS。

## 7. 出门与停止

P0 出门要求：A01-A14 全绿；真实正例 1/1；负例矩阵全闭合；PRD review 无偏移；独立审查 Fatal=0/Major=0。

立即停止：需要放宽公共合同/Origin/ticket；无法证明真实 PCM；任何声音播放；秘密或原始媒体进入公开证据；cleanup 不完整；runner 伪造终态；条件未改变的重复 run。

