# V3 P0 Background Capture Relay v9 独立文档审查请求

日期：2026-10-15。性质：v9 immutable document candidate 从零只读外审。v1-v8 均为历史拒绝候选；v8 第二轮 Claude PASS 已被严格 reviewer 的 Fatal=0/Major=2/Minor=2 推翻，不得继承任何旧 PASS。

## 1. 审查入口与边界

1. 先复算 `AUDIT_MANIFEST.md` 全部 payload，并逐项比对权威源。
2. 运行 `17-internal-relay-v9-verifier.py`，要求 exit 0、50/50、source actual/frozen 均为 40、差集为空、unlisted emit 为空。
3. 运行 `18-internal-relay-v9-mutations.py`，要求 exit 0、12/12；其中 11 个危险变异必须使内层 verifier exit 2，非边界词法对照必须 exit 0。
4. 审查期间不得修改冻结包，不得运行产品代码、Chrome、Runtime、Provider 或媒体。允许在只读临时副本做额外变异。
5. 只允许在权威 evidence 目录新增独立审查报告；不得写回平铺审计包。

## 2. v8 第二轮 Major 与 v9 闭环

### M-1 Owner manifest 不具备跨崩溃 durable discovery

必须验证：

- 固定路径为 `private_asr_staging_root/<taskId>/owner.json`；recover 只用 validated authoritativeTaskId 定位，不依赖进程内存。
- 发布严格按 canonical temp `O_EXCL` write -> file fsync -> atomic replace -> parent-directory fsync -> ownership-transfer receipt；worker 只能在 receipt 后启动。
- hard crash 注入点在 parent-directory fsync/receipt 后、worker 前，真实语义是进程被杀且 finally 不执行。
- 13 步 trace 必须证明重启后发现 manifest，依次清 acquisition sandbox、ASR staged root、unpublished product evidence，四类 residual=0 后返回 abandoned，再允许 fresh begin。
- `OM9-N01..N08` 必须覆盖 missing、torn/invalid JSON、identity、hash、length/shape、state、path escape/symlink、缺 parent-directory-fsync receipt，全部 fail closed 为 `V3_MEDIA_CLEANUP_INCOMPLETE`。

### M-2 Discovery roots 漏掉 offscreen sibling/helper

必须验证：

- 11 个带 SHA-256 的 authoritative scope 精确存在，semantic boundary emit set 为 40。
- 四个递归 root 同时覆盖 Runtime acquisition、Runtime 顶层、capture 模块和 `entrypoints/media-capture-offscreen/**/*.ts`。
- discovery universe 精确等于 40-source inventory 与冻结 non-relay allowlist 的不交并集；target inventory 固定 20。
- Python 使用 AST boundary site；TypeScript 使用 compiler AST boundary-value，不得退回 regex-only。
- 新增 offscreen direct sibling、nested helper、Python acquisition helper 中任意新 `V3_MEDIA_CAPTURE_*` 必须被识别并 exit 2；注释或裸表达式里的非边界词法对照不得误杀。

## 3. 其余必审问题

1. Chrome 116 exact sender、Base64 canonical encoding、decoded length、credit=1、有界 queue、quiesce/drain、marker 和七类 recovery owner 是否仍闭合。
2. `completed` 是否仅为 transport handoff 通知；唯一持久产品成功是否仍为 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`。
3. barrier 前后 cleanup owner 是否唯一，是否禁止 handler 在 transfer 后删除 staged audio。
4. consent、transcript、product 三个 revision 域是否相互独立；是否禁止误用同 revision 相等作为成功条件。
5. 公共 API、用户动作和六视频分母是否未扩张；P0 通过前是否严格阻止 P1。
6. v9 图纸是否与合同一致：Archify JSON SHA-256 `bb3c2fe18352b0b0f5374c882221459e2e1b016ac814f0d6bdd02bc59b5d56f7`，HTML SHA-256 `22502d6f296c1f9a474b0d15e25291953f554beaea3f4eac0a67f8e77255c044`，showcase 9/9、composition 0/0。browser visual-check 未执行，不得外推为视觉 PASS。

## 4. 强制对抗动作

除运行 `18-internal-relay-v9-mutations.py` 外，审查者至少独立抽取以下四类变异：

- 删除 parent-directory fsync 或 ownership receipt；
- 删除任一 `OM9-Nxx`、hard-crash trace 步骤或 authoritative scope；
- 在 offscreen 根目录与嵌套 helper 各增加一个新边界 failure code；
- source inventory/non-relay allowlist 各做一次删除和新增。

所有危险变异必须结构化 exit 2；异常 exit 1、静默 PASS 或未发现新增 emit 均为 Major。

## 5. 输出门禁

报告必须列输入 hashes、权威源逐字节比对、命令/退出码、独立变异、Fatal/Major/Minor、限制和以下二选一结论：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。两份独立报告均 Fatal=0/Major=0 后，仍必须由用户明确授权 `approved P0 Background Capture Relay R0-R7 implementation`；否则产品代码保持 NO-GO。
