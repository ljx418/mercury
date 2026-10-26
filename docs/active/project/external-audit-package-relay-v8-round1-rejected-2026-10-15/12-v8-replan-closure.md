# P0 Relay v8 重规划闭环

日期：2026-10-15。状态：`V8 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## v7 严格审查结论

v7 Claude 审查为 DOCUMENT PASS，但独立严格 reviewer 给出 Fatal=0/Major=2/Minor=3；按更严格结论，v7 已拒绝且不得实现。

1. `MediaAcquisitionCoordinator` 终态只在内存中，不能称为 durable。`SenseVoiceTranscriptService.start()` 在 `TaskAudioStager.stage()` 前启动 daemon worker 并返回，handler 随后 cleanup acquisition WAV，存在真实所有权竞态；Runtime 重启后的 GET 已实证 404。
2. v7 的 30 项 source inventory 漏掉四个当前 relay code 和两个 `TaskArtifactError` code，无法证明完整归一化。
3. cleanup rename 删除变异曾以 KeyError/exit 1 异常退出；revision 域文字计数错误；Archify 浏览器视觉检查仍 pending。

## v8 逐项闭环

| v7 Finding | v8 冻结修订 | 可执行验收 |
|---|---|---|
| M1 非持久终态与 staging 竞态 | capture 只承诺 handoff；同步 `TaskAudioStager.stage(copy/fsync/hash/length/WAV-shape)` 在 worker 前完成；barrier 前 handler、后 transcript service 独占 cleanup；唯一 durable 产品终态为现有 SQLite ready/degraded | 六注入点验证 ownership；frame send 不声明成功；重启后只有持久产品终态可 published，否则 abandoned+cleanup+fresh analysis |
| M2 inventory 漏项 | source inventory 由 30 扩为 36；四个 relay code identity-shared；两项 TaskArtifactError 显式 rename；R0 建立中央 registry 与 AST/source emit scan | verifier 检查 36=identity∪rename∪public-only、集合互斥、target=20、源码 hash/必需 code、registry/scan 要求 |
| Minor 稳定失败 | verifier 所有字段使用安全读取，变异必须结构化 exit 2；revisionDomainCount=3 明示 | 39/39 基线；缺 mapping/source/hash/revision 变异均不得异常退出 |
| Minor 视觉 | Archify deterministic validation 与浏览器 visual-check 分开记录 | 无 Chrome 时只能标记 visual pending，不外推视觉 PASS |

## v8 机器合同

- Schema：`docs/active/project/contracts/v3_media_capture_internal_relay_v8.schema.json`
- Fixture：`docs/active/project/fixtures/v3-media-capture-internal-relay-v8-fixtures.json`
- Verifier：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v8-contract.py`
- 当前基线：39/39 PASS。
- 当前仅允许双重独立文档审查。两份审查均 Fatal=0/Major=0 后，仍须用户明确授权才能实施 R0-R7；P1 六视频保持 BLOCKED。
