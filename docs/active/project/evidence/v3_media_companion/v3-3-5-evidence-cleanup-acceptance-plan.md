# V3-3-5 证据合并与清理验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 合并同 task frame/OCR/VLM | Schema-valid，引用全部闭合 |
| A02 | 检查 frame 类型 | candidate<=24、selected/retained<=12、VLM<=8 |
| A03 | 检查 OCR | frame 引用存在；blockId 唯一且稳定；不改写 OCR 文本 |
| A04 | 检查 VLM | 只引用 selected frame；decision/sequence/dispatch 数一致 |
| A05 | succeeded finalize | 非证据帧 0 残留、pending outbound=0 |
| A06 | failed finalize | 非证据帧 0 残留、pending outbound=0 |
| A07 | cancelled finalize | 非证据帧 0 残留、pending outbound=0 |
| A08 | 跨 task/重复 ID/未闭引用 | `EVIDENCE_IDENTITY_MISMATCH` |
| A09 | artifact 漂移/清理失败 | `VISION_CLEANUP_FAILED`，不得伪造 cleanup PASS |
| A10 | 公开 DTO 扫描 | 0 path/Cookie/key/raw image/base64 |
| A11 | 重复相同输入 | canonical content hash 相同 |
| A12 | 回归和 PRD 检视 | Runtime 全绿；V3-4/V3-5 范围未提前实现 |

