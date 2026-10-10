# V3-3-5 证据合并与清理开发计划

日期：2026-10-08。前置：V3-3-4 LIMITED PASS。

## 目标

把同一 task 的 frame、OCR、VLM 和 consent 回执合并为 `v3-media-vision-evidence/v1`，关闭引用、计数和终态清理；不调用新模型、不生成大纲。

## 顺序

1. 为 `TaskArtifactSandbox` 增加受控单 artifact 删除，不允许跨 task、symlink 或 hash 漂移删除。
2. 实现 `FrameEvidenceRecord` 与 `VisionEvidenceBuilder`，只接受同 task 且 evidenceId 唯一的实体。
3. 将 OCR block 映射为稳定 blockId；VLM observation 原样保持 provider/model/consent/hash/usage。
4. finalize 时验证 sampling 24/12/8、引用闭合、selected VLM、consent decision/sequence 和 dispatch 数量。
5. 三终态删除 `delete_at_terminal` 帧，保留 `evidence_until_task_delete` 帧，生成 cleanup receipt。
6. 用 JSON Schema + semantic validator 复核最终回执，公开序列化不得包含绝对路径、原图、Cookie 或密钥。
7. 执行三终态、跨 task、重复 ID、未闭引用、删除失败、pending outbound 负例。
8. 执行回归、PRD 检视和出门审计。

