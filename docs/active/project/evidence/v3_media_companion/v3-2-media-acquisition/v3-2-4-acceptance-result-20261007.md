# V3-2-4 自动验收结果

日期：2026-10-07。结论：`FAIL / REPLAN REQUIRED`。

## TC01..TC20

| 门槛 | 结果 | 证据/原因 |
|---|---|---|
| TC01 | PASS | Chrome manifest 权限精确为原集合 + `offscreen/tabCapture`；host 无变化；无 `<all_urls>` |
| TC02 | CONTRACT PASS / E2E PENDING | Runtime 只在三 route 有序失败后 eligible；产品编排尚未产生这些事实 |
| TC03 | PENDING | Side Panel 按钮/可信事件合同已实现，未完成真实点击 capture |
| TC04 | PENDING | Workspace 单一 B站 source-tab 选择与 surface binding 已实现，未完成真实点击 capture |
| TC05 | PASS | 256-bit ticket、TTL=30s、one-shot、public grant 无 ticket/tabId/streamId |
| TC06 | PASS | replay/expired ticket 固定失败 |
| TC07 | PASS | task/tab/page/adapter/surface 六类 binding 全部 fail closed |
| TC08 | PASS | sender 必须为 exact Side Panel/Workspace extension document 且无 sender.tab |
| TC09 | CODE PASS / E2E PENDING | streamId 仅 Background→Offscreen 消息；真实消费未验证 |
| TC10 | CODE PASS / E2E PENDING | controller/sink 单例；真实 Offscreen 残留未验证 |
| TC11 | PENDING | source 连接 AudioContext destination 已实现；真实可听回放未验证 |
| TC12 | PASS | WebSocket 顺序作为 sequence 权威；乱序/重复/超限 fail closed |
| TC13 | FAIL | 无真实 B站 capture + SenseVoice transcript |
| TC14 | CODE PASS / E2E PENDING | socket 错误不重连、finally abort；真实断线未验证 |
| TC15 | CODE PASS / E2E PENDING | tab onRemoved/onUpdated 停止；真实导航/关页未验证 |
| TC16 | CODE PASS / E2E PENDING | cancel/timeout/900s 上限已实现；真实运行未验证 |
| TC17 | UNIT PASS / E2E PENDING | temp WAV abort 为 0；真实 tracks/socket/offscreen/process 总残留未验证 |
| TC18 | COMPONENT PASS / E2E PENDING | 原生按钮与 responsive CSS；四视口/Axe/键盘真实任务未验证 |
| TC19 | STATIC PASS / PACKAGE PENDING | capability 未持久化；最终 public package 尚未生成 |
| TC20 | PARTIAL | Runtime 486、frontend 298、typecheck/build/smoke 通过；独立实施审计未执行 |

## 防假绿决定

- 不用 fixture/pre-recorded WAV 代替 TC13。
- 不用 `evaluate`、`dispatchEvent` 或 E2E bridge 伪造 trusted click。
- 不通过 query 参数、storage 注入或 runner 直写 route failure 让按钮出现。
- 不把 Chromium extension-load smoke 扩大为真实 Chrome tabCapture。

**自动验收停止原因**：生产 UI 缺少从“开始视频分析”到同 task 三路真实 route attempt 的产品编排，导致可信 capture 按钮没有可由真实用户流程到达的 production positive state。继续执行需要先回到开发计划，补充并审计 V3-2-4a acquisition orchestration closure；这属于新增重大实现面，超出已冻结 V3-2-4-0..7 的代码实体清单。

