# V3-2-4 可信 tabCapture 开发计划

日期：2026-10-07。状态：`IMPLEMENTATION CANDIDATE / ACCEPTANCE FAIL / V3-2-4a REPLAN REQUIRED`。

## 1. 目标与触发条件

仅当 `credentialed_subtitle -> credentialed_media_asr -> public_or_page_subtitle` 均以机器原因失败后，UI 才显示“捕获当前标签页”。用户在 Side Panel 或 Workspace 的新鲜可信点击是唯一启动入口；Background、content script、定时器、页面脚本和恢复逻辑均不得自动开始。

```text
trusted UI click
-> Runtime creates 30s one-shot private capture ticket + public MediaCaptureGrant
-> Background revalidates sender/task/tab/page identity and chrome.tabCapture permission
-> chrome.tabCapture.getMediaStreamId(targetTabId)
-> OffscreenDocument(USER_MEDIA) consumes streamId once
-> preserve local tab playback + sequence chunks
-> authenticated one-shot loopback WebSocket
-> RuntimeCaptureSink -> task-private PCM WAV
-> SenseVoiceTranscriptService
-> stop tracks/socket/process -> cleanup barrier
```

## 2. 代码实体

| 实体 | 目标路径 | 职责 |
|---|---|---|
| `MediaCaptureGrantService` | Runtime `acquisition/capture_grants.py` | 生成 ticket/grant，绑定 task/adapter/tab/page/surface/TTL，首次握手消费 |
| Capture session API | `navia_runtime/app.py` | 创建 session 与专用 WebSocket；generic proxy 禁止 |
| `MediaCaptureController` | extension `media_companion/capture/` | 只接受 trusted UI command，重验当前 tab/page/task |
| `MediaCaptureMessageRouter` | 同目录 | 精确 extension sender/surface/message shape；拒绝 content script/page sender |
| `MediaCaptureOffscreen` | `entrypoints/media-capture-offscreen/` | 单例 Offscreen、stream 消费、原声回放、PCM chunk、停止清理 |
| `RuntimeCaptureSink` | Runtime `acquisition/capture_sink.py` | 检查 ticket、连续序号、字节/时长上限并写 task-private WAV |
| `MediaAcquisitionClient` | extension `media_companion/acquisition/` | Side Panel/Workspace 共享等待/开始/停止状态，不保存 ticket/streamId |

## 3. 权限与安全不变量

- Chrome >=116；`tabCapture`、`offscreen` 为冻结权限，不新增 `<all_urls>`。
- grant TTL <=30 秒、one-shot、不可持久化、不可跨 task/tab/page/adapter/surface。
- streamId 获取后立即由唯一 Offscreen Document 消费，不进入 Redux/storage/log/evidence。
- capture 最长 900 秒；每个时刻最多一个 Offscreen capture。
- 捕获期间用户必须继续听到原视频；回放连接失败则停止任务。
- 导航、关页、撤销、取消、Runtime/WebSocket 断线、超时均停止 tracks/socket 并进入 cleanup。
- 原始 chunk 不写 EventStore、Trace、IndexedDB、Cache、Downloads 或 OPFS。

## 4. 子阶段顺序

| 子阶段 | 内容 | 自动出门 |
|---|---|---|
| `2-4-0` | capture contract/fixtures/message allowlist/threat model | Schema/meta + 全负例通过；权限无意外扩大 |
| `2-4-1` | Runtime grant service/session API/WebSocket | ticket 256-bit、TTL/one-shot、错误绑定/重放拒绝 |
| `2-4-2` | Background controller/router | 仅 trusted UI sender；task/tab/page 二次校验 |
| `2-4-3` | Offscreen lifecycle 与原声回放 | 单例、streamId 一次消费、用户仍听见原声 |
| `2-4-4` | chunk sequence / Runtime sink / WAV finalize | seq 从 0 连续；缺包/乱序/超限 fail closed |
| `2-4-5` | SenseVoice 连接及全部停止事件 | 至少 1 个真实 capture 产生 transcript；停止后无晚到 chunk |
| `2-4-6` | 四视口、键盘、故障、秘密扫描和回归 | 按钮可操作；public 0 ticket/stream/path；全量通过 |
| `2-4-7` | PRD review、独立实施出门审计 | Fatal=0/Major=0，只放行 V3-2-5 文档/审计 |

## 5. 停止与重新授权条件

若实现要求新增 host permission、扩大 `web_accessible_resources`、允许 content script 持有 ticket、持久化原始音频、后台自动 capture、或绕过 Chrome 用户手势约束，必须立即停止并重新冻结 PRD/权限/威胁模型及用户高风险授权。
