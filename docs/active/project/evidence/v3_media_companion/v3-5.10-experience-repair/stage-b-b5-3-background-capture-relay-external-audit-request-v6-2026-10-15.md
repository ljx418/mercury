# V3 P0 Background Capture Relay v6 独立文档审查请求

日期：2026-10-15。性质：v6 immutable candidate 只读外审。v1-v5 均为历史拒绝候选；尤其不得采信 v5 Claude 宽口径 PASS 摘要，当前权威是 v5 严格审查的 Fatal=0/Major=5。

## 审查入口与约束

先复算 `AUDIT_MANIFEST.md` 的 18 项 payload，再运行 `17-internal-relay-v6-verifier.py`。审查期间不得修改冻结目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。只允许在 evidence 对应目录新增独立报告。

## 上轮打回事实

v5 的一轮 Claude 外审错误给出 Major=0；严格 reviewer 发现 Major=5：Schema authority 可漂移假绿、terminal 过早、connecting 无 owner、Runtime hard crash 无恢复链、内部/公共 FailureCode 边界未闭合。v6 必须逐项证明五项都关闭，不得只复述候选自报。

## 必审问题

1. sender 是否可实现：只从 MessageSender 读取 id/url/tab/frameId/documentId，再以 documentId 调用 `runtime.getContexts`；是否要求恰好一个 URL 匹配的 OFFSCREEN_DOCUMENT ExtensionContext，并从它读取 incognito？WXT manifest 固定 `minimum_chrome_version: "116"` 且禁止弱校验降级后，是否还有伪造/替换/竞态或版本缺口？
2. terminal 是否精确：sink finalize 必须不是 terminal；只有权威 task transition + transcript create/start + completed frame send 均成功才 commit。五个注入点是否都通过统一 finally 清理/终结 task 与 authority？
3. restart 是否按 phase 可达且不扩大公共 API：connecting 用既有认证 DELETE；valid-start 后由 Runtime finally + GET；hard crash/SIGTERM 用持久 authority + 既有 recover；GET 404 停轮询；marker expiry 不写成功？
4. v6 是否为唯一实施权威：schema/fixture/verifier/Port/marker/RLY6/24+8+6 trace/提示词是否一致，v1-v5 是否明确禁止实现？Schema/protocol digest 是否能拒绝 Schema 放宽及 schema+fixture 同步回退 v5？
5. 20 项 code 是否明确只属于内部 relay；当前 Runtime/grant/UI 可达 code 是否全部有唯一归一化或明确留在公共边界，且不暗改公共合同？
6. R0-R7、A01-A18、真实静音 canary、故障矩阵、runner purity、secret/cleanup 是否能拒绝 mock/空 PCM、跨 run、无限 queue、秘密泄漏和 cleanup 假绿？
7. 完整 goal 是否仍要求文档外审 + 明确用户授权后才编码，并阻止 P0 出门前启动 P1 六视频？

## 对抗动作

在 `/tmp` 副本执行并确认 verifier 非零：Schema `additionalProperties`/chunk 上限/credit/marker 放宽、schema+fixture portName 回退 v5、未知 FailureCode、第十消息、decoded length、padding、terminalBoundary、recoveryOwnership、boundary normalization、主 trace、8 步 restart、6 步 terminal、五 failure cases、七 recovery cases、marker expiry和 negative mapping。另在浅层目录运行 verifier。

## 输出门禁

报告必须列输入 hashes、命令/退出码、Fatal/Major/Minor、限制和以下二选一结论：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。
