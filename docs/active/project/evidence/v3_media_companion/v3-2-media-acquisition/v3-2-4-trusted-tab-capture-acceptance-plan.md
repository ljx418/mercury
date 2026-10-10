# V3-2-4 可信 tabCapture 验收计划

日期：2026-10-07。状态：`AUTOMATED ACCEPTANCE FAIL / REAL PRODUCTION PATH BLOCKED / REPLAN REQUIRED`。

## 1. 固定门槛 TC01..TC20

| ID | 操作 | 必须结果 |
|---|---|---|
| TC01 | manifest/Chrome 版本 | Chrome>=116；权限精确；无 `<all_urls>` 或新增 host |
| TC02 | 前三条 route 均机器失败 | 仅此时显示 capture；原因顺序与 policy 一致 |
| TC03 | Side Panel 真实点击 | `isTrusted=true`，grant 绑定 task/tab/page/adapter/surface |
| TC04 | Workspace 真实点击 | 同 TC03；两个入口消费同一 Runtime task 事实 |
| TC05 | grant/ticket | TTL<=30 秒、one-shot、ticket 256-bit、public grant 不含 ticket/tabId/streamId |
| TC06 | 重复/过期 ticket | WebSocket 拒绝且不能生成第二 stream |
| TC07 | 错 task/tab/page/adapter/surface | 全部拒绝，当前任务状态不前进 |
| TC08 | content script/page/后台 sender | 全部返回 `V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN` 或等价固定码 |
| TC09 | streamId 生命周期 | 获取后立即由唯一 Offscreen 消费，不持久化、不公开 |
| TC10 | Offscreen 单例 | 并发第二 capture 拒绝；结束后 document/track/socket=0 |
| TC11 | 原声回放 | 捕获期间真实用户仍听到视频；连接失败则 capture 失败并停止 |
| TC12 | chunk 协议 | seq 从 0 连续；缺失/重复/乱序/超限均 fail closed |
| TC13 | 真实回退 | 至少一个固定样本前三路失败后完成真实 capture + SenseVoice transcript |
| TC14 | WebSocket/Runtime 断线 | 立即停止；旧 ticket 不重放、不自动重连 |
| TC15 | 导航/关页/reload | tracks/socket/sink 停止；旧 grant 失效 |
| TC16 | 撤销/取消/900 秒上限 | 全部停止且恰一个终态，无后续 chunk/segment |
| TC17 | cleanup | raw audio、private WAV、active capture、Offscreen、句柄和 task temp 全为 0 |
| TC18 | UI/键盘 | 360/420/768/1280 无溢出；键盘可开始/取消；Axe serious/critical=0 |
| TC19 | 隐私扫描 | public 对 ticket、streamId、tabId、绝对路径、原始音频、Cookie/token 0 hit |
| TC20 | 回归/审计 | V3-1.1/1.2/1.3、V3-2-1..3、前端/Runtime 全量通过；Fatal=0/Major=0 |

## 2. 真实数据与防假绿

必须使用可见真实 Chrome、真实 B站播放页、真实用户点击、真实 `tabCapture` stream 和真实 SenseVoice 输出。禁止用 `getUserMedia` fixture、预录 WAV、`dispatchEvent`、`evaluate` 伪造 `isTrusted`、静音流、旧 grant、旧 transcript 或测试页代替生产正例。

## 3. 人工边界

本阶段机器自动验证原声回放、按钮状态和真实 capture；不执行 H01..H10，不要求人类听写或构造证据。完整人类产品判断仍在 V3-5。

## 4. 出门声明

通过后只允许声明“V3-2-4 可信标签页音频回退在固定 B站样本上可用”。不能扩大为 V3-2、图文大纲或 V3 完成。
