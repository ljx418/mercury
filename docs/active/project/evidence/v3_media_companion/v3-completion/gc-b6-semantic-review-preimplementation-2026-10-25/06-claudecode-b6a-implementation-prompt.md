# ClaudeCode 提示词：GC-B6A 私有评审包捕获器

```text
你在 /mnt/c/workspace/navia 工作。当前精确坐标是：V3 Chat + Know / V3-5.10 Stage B / GC-B5R B-5 CLOSED / GC-B6A REVIEW-CAPTURE IMPLEMENTATION MAY START。

本工作包只实现 B6A 离线评审捕获工具与反假绿测试。不得执行 B6B，不得启动真实六视频、Chrome、Runtime 媒体任务、下载、Cookie 读取或 Provider；完成后必须停在 GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT，不得宣布 B6、Stage B 或 V3 PASS。

必读：
1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md，尤其 5.1
3. docs/active/project/design/v3-post-wp-b-completion-rebaseline.md
4. docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-final-closure-codex-2026-10-25/{00-final-closure-report.md,real-run/sequencer-summary.json,PAYLOAD_MANIFEST.sha256}
5. docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6-semantic-review-preimplementation-2026-10-25/{00-current-coordinate-and-decision.md,01-target-architecture.md,02-detailed-development-plan.md,03-acceptance-plan.md,04-risk-and-anti-false-green.md,05-preimplementation-audit.md}
6. scripts/stage_b_b5_3/run_one_bvid.mjs 及 lib/{aggregate,artifact_integrity,v21_artifact,machine_identity,registry,audit_finalizer}.mjs
7. services/local-runtime/navia_runtime/modules/media_companion/{task_store,product_materializer}.py 与 comprehension/service.py；只读理解生产路径，默认不要改产品 Python。

目标：
- 在 scripts/stage_b_b5_3 内实现 acceptance-harness-only 的 B6ReviewCapture、私有 bundle validator、blind evaluator projection 和 B6 aggregate。
- 捕获点必须位于 durable V2.1 publication 已验证之后、runner owner cleanup 之前。
- 通过公共 workspace route 获取 metadata，通过认证 thumbnail route 获取 PNG；完整派生文本只能按 workspace 声明的 relative ref 从该 runner 自有 Runtime 私有根精确读取。
- 私有包只能包含 derivative、workspace metadata、派生 transcript/OCR/vision-caption 文本、PNG thumbnail、seek-map、capture receipt 和 manifest；禁止原始视频/音频、Cookie、key、bearer、Provider response 和绝对路径。
- evaluator projection 必须移除 Provider/model/endpoint/receipt 原文和运行路径。
- public receipt 只允许 bundle hash、计数、状态和稳定错误码，不得包含全文、图片字节、文件名或私有路径。
- 捕获失败必须让 candidate fail closed，同时原 runner cleanup 仍执行。

实现顺序：A0 基线/零动作 -> A1 精确私有合同与纯校验器 -> A2 runner 只读捕获接线 -> A3 blind projection/B6 aggregate -> A4 54 项固定义务及额外负例 -> A5 合并验证与 handoff。

固定门禁：
- identity/hash 12，evidence/text mutation 10，thumbnail/seek 8，blind/privacy 8，lifecycle/cleanup 6，aggregate/sentinel 10，共 54 项不得减少或合并；可以增加。
- exact threshold 和 one-under 都要驱动；缺行、重复、同 session、3/5、critical error、sentinel 反转、Provider identity 泄漏均须非正。
- 测试必须驱动真实生产 workspace/thumbnail 路由和真实 runner 生命周期边界；静态字符串扫描只能作补充。
- 默认/离线命令必须证明 Chrome 0、Runtime 媒体任务 0、Provider 0、下载 0、Cookie 读取 0、音频 0、tabCapture 0。

禁止：
- 修改公共 API/schema/FailureCode/阈值/六 BVID registry/Provider registry/Origin-auth 顺序/上传政策/relay inventory；
- 复制或弱化冻结 V2.1 schema；
- 直接 SQL 制造产品状态、调用 materializer 重生成 evidence、目录搜索猜文件；
- 运行真实 B6B、可见 Chrome 或云 Provider；
- refreeze relay、commit/push/reset/clean/checkout/revert，或覆盖无关 dirty changes。

验证：
1. 新增 Node 聚焦测试，逐组报告固定分母；
2. npm/Node 的 stage_b_b5_3 离线合并套件一次；
3. 若改 Runtime Python，跑受影响定向 pytest；未改则明确 not run；
4. relay-v11 baseline 50/50 与 mutations 16/16；
5. secret/private-path/raw-media/generated-artifact 扫描；
6. cleanup：owned process/port/profile/temp root 全 0；
7. 默认入口零外部动作收据。

证据目录：
docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-review-capture-implementation-2026-10-25/

至少交付：状态报告、changed file hashes、case->production oracle、命令与 exit、零动作收据、privacy scan、cleanup、PRD coverage、risk、handoff、最后生成并校验的 PAYLOAD_MANIFEST.sha256。明确 contract changes: none；若不得不改公共/安全边界，立即 NO-GO 并停止，不得自行改合同。

最终状态只能写：GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT，或如实 NO-GO。不要进入 B6B/B7/Stage C。
```
