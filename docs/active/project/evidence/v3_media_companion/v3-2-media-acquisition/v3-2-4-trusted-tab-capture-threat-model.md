# V3-2-4 可信 tabCapture 威胁模型

日期：2026-10-06。

| 威胁 | 控制 | 验收 |
|---|---|---|
| 后台静默录音 | 只接受 Side Panel/Workspace 新鲜 `isTrusted` 点击；前三路失败前不显示 | TC02-TC04/TC08 |
| grant/ticket 劫持或重放 | 256-bit private ticket、30 秒、one-shot、首次握手消费 | TC05/TC06 |
| 跨 tab/page/task 捕获 | Background 和 Runtime 双重 identity binding | TC07 |
| streamId 泄漏 | 仅 Background->Offscreen 内存传递，禁止日志/storage/public evidence | TC09/TC19 |
| 多路并发/残余麦克风图标 | Offscreen 单例、最大一个 capture、全部停止事件销毁 tracks | TC10/TC14-TC17 |
| 用户听不到原视频 | AudioContext 回接默认输出；失败即停止 | TC11 |
| chunk 注入/乱序/洪泛 | ticket-bound WebSocket、seq/size/duration 上限 | TC12 |
| 断线后静默重连 | ticket 已消费，断线终止，不自动生成新 grant | TC14 |
| 原始音频持久化 | task-private 临时 WAV，仅供当前 ASR，终态 barrier 删除 | TC17/TC19 |
| UI 或测试造可信事件 | 真实 CDP/Chrome 用户输入；禁止 JS `dispatchEvent/evaluate` 计正例 | TC03/TC04/TC13 |

残余高风险：`tabCapture` 本质上可接触当前标签页音频，所以任何权限扩大、后台启动或持久化改变都必须重新取得用户明确授权。
