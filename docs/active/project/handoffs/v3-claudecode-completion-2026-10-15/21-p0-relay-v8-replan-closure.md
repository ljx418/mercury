# P0 Relay v8 重规划闭环

日期：2026-10-15。状态：`V8 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## v7 严格审查结论

v7 Claude 审查为 DOCUMENT PASS，但独立严格 reviewer 给出 Fatal=0/Major=2/Minor=3；按更严格结论，v7 已拒绝且不得实现。

1. `MediaAcquisitionCoordinator` 终态只在内存中，不能称为 durable。`SenseVoiceTranscriptService.start()` 在 `TaskAudioStager.stage()` 前启动 daemon worker 并返回，handler 随后 cleanup acquisition WAV，存在真实所有权竞态；Runtime 重启后的 GET 已实证 404。
2. v7 的 30 项 source inventory 漏掉四个当前 relay code 和两个 `TaskArtifactError` code，无法证明完整归一化。
3. cleanup rename 删除变异曾以 KeyError/exit 1 异常退出；revision 域文字计数错误；Archify 浏览器视觉检查仍 pending。

## v8 首轮外审与修订闭环

v8 首轮 Claude 审查为 PASS，但严格 reviewer 给出 Fatal=0/Major=2/Minor=2：ASR staged root 无 hard-crash recover owner；source inventory 的 scope/hash/emit 不相等；删除 handoff case 会 IndexError。首轮候选已拒绝，本节记录同一 v8 版本号下的修订候选，不把首轮 PASS 外推到修订版。

| v7 Finding | v8 冻结修订 | 可执行验收 |
|---|---|---|
| M1 staged audio hard-crash owner | capture 只承诺 handoff；同步 stage 后 fsync 私有 owner manifest；existing recover 内部调用 `MediaRecoveryCleanupCoordinator` 清 acquisition、ASR stage、unpublished product 并验证 active sink；唯一 durable 产品终态仍为 SQLite ready/degraded | 新增 8 步 hard-crash trace；after-stage-before-worker 真实 kill；四项残留全零后 abandoned + fresh begin；completed frame 不声明产品成功 |
| M2 inventory 权威不闭合 | 9 个精确路径带 SHA；Python AST module/symbol selector 和 TypeScript literal selector 推导 emit set；两个 discovery root 拒绝未登记发码文件 | verifier 实算 emit=registry=frozen 36，scope/emit/registry/unlisted-file 增删均结构化 exit 2 |
| Minor 稳定失败 | handoff case 改按 injectionPoint 安全索引，所有数组删项在输出前均有长度屏障 | 47/47 基线；本轮 8/8 关键增删变异全部结构化 exit 2 |
| Minor 视觉 | Archify deterministic validation 与浏览器 visual-check 分开记录 | 无 Chrome 时只能标记 visual pending，不外推视觉 PASS |

## v8 机器合同

- Schema：`docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json`
- Fixture：`docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json`
- Verifier：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py`
- 当前修订基线：47/47 PASS；scope 推导精确为 36，unlisted emit=0。
- 当前仅允许重建不可变包并从零双重独立文档审查。两份新审查均 Fatal=0/Major=0 后，仍须用户明确授权才能实施 R0-R7；P1 六视频保持 BLOCKED。
