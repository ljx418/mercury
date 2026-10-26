# V3 P0 Background Capture Relay v5 独立文档审查请求

日期：2026-10-15。性质：v5 immutable candidate 只读外审。v1-v4 均为历史拒绝候选；不得采信其 PASS 摘要。

## 审查入口与约束

先复算 `AUDIT_MANIFEST.md` 的 18 项 payload，再运行 `17-internal-relay-v5-verifier.py`。审查期间不得修改冻结目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。只允许在 evidence 对应目录新增独立报告。

## 上轮打回事实

v4 的一轮 Claude 外审错误给出 Major=0；第二独立 reviewer 发现 Major=3：Chrome `MessageSender` 不含 incognito、worker restart 后旧任务终结 owner/通道未定义、v3/v4 权威混用。v5 必须逐项证明这三项已关闭，不得只复述现有审计结论。

## 必审问题

1. sender 是否可实现：只从 MessageSender 读取 id/url/tab/frameId/documentId，再以 documentId 调用 `runtime.getContexts`；是否要求恰好一个 URL 匹配的 OFFSCREEN_DOCUMENT ExtensionContext，并从它读取 incognito？WXT manifest 固定 `minimum_chrome_version: "116"` 且禁止弱校验降级后，是否还有伪造/替换/竞态或版本缺口？
2. restart 是否可实现且不扩大公共 API：Runtime WS 在合法 start 后意外断线，是否先 abort 得到三项 0，再通过进程内 coordinator 以已验证 taskId 幂等终结 acquisition；新 worker 是否只用既有 GET 观察 terminal、等待 grace、清 marker而从不写任务？
3. v5 是否为唯一实施权威：schema/fixture/verifier/Port/marker/RLY5/24+8 trace/提示词是否全部一致，v1-v4 是否明确禁止实现？
4. Chrome JSON Port、九类消息、canonical Base64、raw/encoded 上限、单信用、producer ownership/32 chunks/1.5 MiB、quiesce/drain、timeout 和 20 项 FailureCode 闭集是否可实现？RLY5-N01..N30 是否是三十个固定映射而非三十个不同 code？
5. worker restart、Port/WS disconnect、cancel、tab navigation、Runtime crash、SIGTERM、cleanup failure 是否 fail-closed？Runtime 进程本身崩溃与仅 Service Worker 重启是否被正确区分？
6. R0-R7、A01-A14、真实静音 canary、故障矩阵、runner purity、secret/cleanup 是否能拒绝 mock/空 PCM、跨 run、无限 queue、秘密泄漏和 cleanup 假绿？
7. 完整 goal 是否仍要求文档外审 + 明确用户授权后才编码，并阻止 P0 出门前启动 P1 六视频？

## 对抗动作

在 `/tmp` 副本执行并确认 verifier 非零：未知 FailureCode、第十消息、decoded length、noncanonical padding、senderPolicy 任一来源字段、restartTermination owner/operation/publicApiChange/taskIdSource、主 trace 任意字段、8 步 restart trace 任意字段、marker expiry、restart cleanup、negative mapping。另把平铺三文件复制到浅层临时目录运行 verifier，确认不会因 `parents[N]` 崩溃。

## 输出门禁

报告必须列输入 hashes、命令/退出码、Fatal/Major/Minor、限制和以下二选一结论：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。
