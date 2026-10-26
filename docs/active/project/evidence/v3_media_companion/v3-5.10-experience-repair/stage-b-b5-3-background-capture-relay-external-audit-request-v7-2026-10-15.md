# V3 P0 Background Capture Relay v7 独立文档审查请求

日期：2026-10-15。性质：v7 immutable document candidate 只读外审。v1-v6 均为历史拒绝候选；不得采信 v6 Claude 宽口径 PASS，当前整改基线是 v6 严格审查 Fatal=0/Major=5/Minor=1。

## 审查入口与约束

先复算 `AUDIT_MANIFEST.md` 的 18 项 payload，再运行 `17-internal-relay-v7-verifier.py`，要求 36/36。审查期间不得修改冻结目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。只允许在 evidence 对应目录新增独立报告。

## 上轮打回事实

v6 严格 reviewer 发现五项 Major：durable task success 与 `completed` frame failure 互相矛盾；recover cleanup receipt 不存在且 interrupted 被误写为持久状态；公共 source 与 relay target code inventory 不闭合；专项架构仍引用 v5；跨域 `same revision` 不可判定。v7 必须逐项证明闭环，不得只复述候选自报或 verifier 总数。

## 必审问题

1. **durable commit 与通知**：sink finalize、transcript create/start、coordinator complete 返回 succeeded 后，durable task 是否成为唯一权威？`completed_frame_send` 失败是否明确保持 succeeded，并允许 Background 通过既有 GET 恢复，而不是试图回滚 terminal task？前四个注入点是否仍能由 finally 幂等 abort、终结非终态 task 并 cleanup=0？
2. **真实 recover 观察面**：hard crash 是否由持久 owner PID/start token 推导 interrupted？验收是否只依赖既有 recover 的 HTTP success、`disposition`、`authoritativeTaskId`、authority terminal/published 与 fresh begin，而没有虚构 cleanup receipt/字段？现有实现 cleanup 非零时是否公开失败？
3. **code inventory 完备性**：30 个公共 source、20 个 relay target 与 `identityShared`、`renameMapping`、`publicOnlyNotEmittedOnRelayWire` 是否精确完备、互斥且 target 集闭合？`V3_MEDIA_CLEANUP_INCOMPLETE -> V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE` 是否唯一？是否保持公共 Runtime/UI 合同不变？
4. **唯一机器权威**：专项架构、主 PRD/架构/计划/验收、handoff、schema、fixture、verifier、Port、marker、RLY7、24+8+6 trace 是否都指向 v7？v1-v6 是否明确禁止实现？
5. **身份与 revision 域**：是否只要求存在字段的层保持 taskId/sourceIdentity 一致；consent、transcript、product revision 各自单调并执行 expected-revision fence；只有 outline/workspace 共享 product revision？是否拒绝跨域相等的不可判定验收？
6. **sender 与 Chrome 边界**：只从 MessageSender 读取 id/url/tab/frameId/documentId，再以 documentId 调用 `runtime.getContexts`，要求恰好一个 URL 匹配的 OFFSCREEN_DOCUMENT 并从 ExtensionContext 读取 incognito；WXT manifest 固定 Chrome 116 且无弱校验降级，是否仍有替换、竞态或版本缺口？
7. **R0-R7 与假绿拒绝**：A01-A18、真实静音 canary、真实 Uvicorn、故障矩阵、runner purity、secret/raw-media/path/cleanup 是否拒绝 mock/空 PCM、跨 run、无限 queue、秘密泄漏、TestClient 替代和 cleanup 假绿？P0 出门前是否严格阻止 P1 六视频？

## 对抗动作

在只读副本或内存中执行且确认 verifier 非零：

- Schema `additionalProperties`、chunk 上限、credit、marker 放宽；
- schema+fixture portName 回退旧版本；
- 未知/遗漏 source code、target code、三类集合重叠、cleanup rename 删除或错配；
- 第十消息、decoded length、noncanonical padding、sender context；
- durable terminal/notification、completed send、recover 观察面；
- task/source identity、consent/transcript/product revision 域；
- 24 步主 trace、8 步 restart、6 步 terminal、五个 failure case、七个 recovery case、marker expiry、RLY7-N01..N30 任一字段。

另在浅层目录运行 verifier，确认路径不依赖审计包目录深度。独立复算 Archify JSON/HTML SHA-256、repository evidence、showcase 9/9 与 composition 0/0；browser visual-check skipped 不得外推为视觉 PASS。

## 输出门禁

报告必须列输入 hashes、权威源逐字节比对、命令/退出码、Fatal/Major/Minor、限制和以下二选一结论：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。任一 Major 触发 v8 重规划；不得以另一 reviewer 的 PASS 覆盖。
