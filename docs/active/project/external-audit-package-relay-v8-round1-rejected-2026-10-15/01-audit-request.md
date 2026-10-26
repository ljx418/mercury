# V3 P0 Background Capture Relay v8 独立文档审查请求

日期：2026-10-15。性质：v8 immutable document candidate 只读外审。v1-v7 均为历史拒绝候选；不得采信 v7 Claude 宽口径 PASS，当前整改基线是 v7 严格审查 Fatal=0/Major=2/Minor=3。

## 审查入口与约束

先复算 `AUDIT_MANIFEST.md` 的 18 项 payload，再运行 `17-internal-relay-v8-verifier.py`，要求 39/39。审查期间不得修改冻结目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。只允许在 evidence 对应目录新增独立报告。

## 上轮打回事实

v7 严格 reviewer 发现两个 Major：第一，进程内 `MediaAcquisitionCoordinator.succeeded` 并不 durable，且 `SenseVoiceTranscriptService.start()` 在 `TaskAudioStager.stage()` 前启动 daemon worker并返回，handler cleanup 会与 worker staging 竞态；第二，source failure inventory 漏掉四个当前 relay code 和两个 `TaskArtifactError` code。三个 Minor 为变异异常 exit 1、revision 域计数文字错误和视觉检查 pending。

## 必审问题

1. **同步 staging 屏障**：sink finalize、transcript create 后，`TaskAudioStager.stage()` 是否必须同步完成 copy、fsync、SHA-256、byte length 与 WAV shape 验证，再发布 ownership receipt 并启动异步 worker？是否禁止 worker 在 barrier 前运行？
2. **唯一 cleanup owner**：barrier 前是否只有 Runtime capture handler 可清 acquisition sandbox；barrier 后是否只有 transcript service/既有 recover 可清 staged audio 与 acquisition sandbox？after-stage-before-worker、completed-frame-send 和 crash 是否不存在双重 cleanup 或原件提前删除？
3. **持久产品 authority**：是否明确 capture `completed` 只是 handoff 通知，进程内 coordinator succeeded 不是跨重启成功；唯一 durable 成功是否为现有 SQLite `MediaTaskStore.commit_terminal(ready|degraded)`？重启后只有该终态存在才允许 published，否则必须 abandoned+cleanup+fresh analysis？
4. **code inventory 完备性**：36 个现行 source、20 个 relay target 与 identity/rename/public-only 是否精确完备、互斥？四个遗漏 relay code 是否 identity-shared；`V3_MEDIA_CROSS_TASK_REUSE` 与 `V3_MEDIA_TEMP_FILE_MODE_INVALID` 是否映射到固定 target？R0 是否要求中央 registry 与 AST/source emit scan 精确相等？
5. **稳定拒绝与 revision 域**：任何字段删除或错配是否结构化 exit 2，而不是 KeyError/exit 1？consent、transcript、product 是否明确为三个 revision 域，只有 outline/workspace 共享 product fence？
6. **sender/协议/恢复**：Chrome 116 exact sender、Base64/credit/bounded queue、quiesce/drain、marker、七类 owner、GET 404、existing recover 与公共 API 不变是否仍闭合？
7. **R0-R7 与假绿拒绝**：A01-A18、真实静音 canary、真实 Uvicorn、故障矩阵、runner purity、secret/raw-media/path/cleanup 是否拒绝 mock/空 PCM、跨 run、无限 queue、秘密泄漏和 TestClient 替代？P0 出门前是否严格阻止 P1 六视频？

## 对抗动作

在只读副本或内存中执行，所有变异必须返回 exit 2：

- Schema `additionalProperties`、chunk 上限、credit、marker 放宽；
- schema+fixture portName 回退 v7；
- 删除同步 stage barrier、把 worker start 移到 barrier 前、允许 handler 在 transfer 后 cleanup；
- 把 completed notification 改成产品 terminal，或把 crash disposition 强制为 published；
- 删除四个当前 relay code、任一 TaskArtifactError mapping、中央 registry/AST scan 要求；
- source hash 错配、revisionDomainCount 改为 4、三类集合重叠；
- 第十消息、decoded length、padding、sender context、24+8+6 trace、七 recovery case、六 handoff/product case、RLY8-N01..N30 任一字段。

另在浅层目录运行 verifier，确认路径不依赖审计包目录深度。独立复算 Archify JSON/HTML SHA-256、repository evidence、showcase 9/9 与 composition 0/0；browser visual-check skipped 不得外推为视觉 PASS。

## 输出门禁

报告必须列输入 hashes、权威源逐字节比对、命令/退出码、Fatal/Major/Minor、限制和以下二选一结论：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。任一 Major 触发 v9 重规划；不得以另一 reviewer 的 PASS 覆盖。
