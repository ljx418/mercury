# P0 Relay v5 重规划闭环

日期：2026-10-15。状态：`V5 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 独立审查触发

Claude v4 外审给出 Fatal=0/Major=0/Minor=3，但第二个独立 reviewer 发现 Fatal=0/Major=3/Minor=2。按更严格结论，v4 已作废，不能授权编码。

## Major 关闭设计

1. `MessageSender` 不含 `incognito`：v5 只从 MessageSender 读取 id/url/tab/frameId/documentId；Background 用 documentId 调用 `chrome.runtime.getContexts`，要求恰好一个 URL 匹配的 `OFFSCREEN_DOCUMENT ExtensionContext`，再比较其 `incognito` 与当前 extension context。
   - `runtime.getContexts` 要求 Chrome 116+；R0 必须给 WXT manifest 增加 `minimum_chrome_version: "116"`，不提供弱 sender 校验回退。
2. worker 重启旧任务终结 owner：合法 WebSocket start 后的意外断线由 Runtime `finally` 先 abort sink，再以 start 的已验证 taskId 调用进程内 `MediaAcquisitionCoordinator.fail_capture_stream`。它幂等写 terminal，不新增公共接口；新 worker 只用既有 acquisition GET 观察 terminal，等待 grace 后清 marker。
3. 权威混用：current schema/fixture/verifier、Port、marker、负例和提示词全部使用 v5/RLY5/24+8；v1-v4 只保留历史拒绝证据。

## Minor 关闭设计

- v5 verifier 先检测同目录平铺载荷，再定位仓库根；复制到浅层 `/tmp` 仍可运行。
- preimplementation audit 已更新为 v5 当前状态，不再把已冻结常量写成未完成。
- FailureCode 闭集为 20；RLY5-N01..N30 是 30 个固定负例映射，不是 30 个不同错误码。relay 直接覆盖 10 项，其余 10 项在 grant/Runtime owner 边界验证。

## 静态结果

v5 authority verifier 当前为 26/26 PASS。该结果只证明文档机器合同一致；新 v5 外审 Fatal=0/Major=0 和用户明确授权前，R0-R7 仍 NO-GO，P1 仍 BLOCKED。
