# V3-3-5 证据合并与清理实施出门审计

日期：2026-10-08。

结论：`V3-3-5 LIMITED PASS`。Fatal=0，Major=0，Minor=1。

- 新增受控 `TaskArtifactSandbox.delete_artifact`，删除前复核 task ownership、regular/private、size 和 SHA-256。
- `VisionEvidenceBuilder` 实现 frame/OCR/VLM/consent 引用闭合、24/12/8 预算、每帧 observation 唯一和三终态 cleanup。
- finalize 重新校验保留与删除帧完整性；漂移或删除失败统一 `VISION_CLEANUP_FAILED`。
- OCR 保留原文/confidence/bbox 并生成稳定 blockId；VLM 保留 provider/model/consent/hash/usage，不改写 caption。
- succeeded/failed/cancelled 三终态定向验证均为 non-evidence residual=0、pending outbound=0。
- 同任务真实链路：3 frame、2 OCR、1 MiniMax VLM，最终 Schema-valid；2 selected 保留到 task delete、1 non-evidence 终态删除，随后 task root 全清理。
- 机器证据：`v3-3-dependency-freeze/v3-3-5-real-evidence-cleanup-result.json`，精确 API key 扫描 0 命中。
- 定向测试 17 passed；Runtime 全量 616 passed（71.77s）。

Minor M-1：本阶段 1 个真实 task 不替代 V3-3-6 的 10/10 OCR 与 8/10 VLM 单 run 分母。

允许进入 V3-3-6；不得声明 V3-3 总体 PASS。

