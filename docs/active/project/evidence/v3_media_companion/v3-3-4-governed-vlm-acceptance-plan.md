# V3-3-4 授权 VLM 验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 未 grant 调用 | `VISION_CONSENT_REQUIRED`，Provider 请求 0 |
| A02 | grant 后对 task-owned frame 调用 | 单图真实成功，decision/sequence/provider/model/hash/usage 完整 |
| A03 | 检查请求 | 仅一张 <=1280px 图片和最小提示；无 Cookie/path/HTML/transcript/API key |
| A04 | 连续 dispatch | sequence 从 0 连续；最多 8 次，第 9 次 `VISION_BUDGET_EXCEEDED` |
| A05 | revoke 后调用 | `VISION_CONSENT_REVOKED`，barrier 后 Provider 请求 0 |
| A06 | permit 与 revoke 竞争 | revoke 前已获 permit 只算在途；revoke 后无新 permit |
| A07 | 跨 task/hash 漂移/非 frame | `EVIDENCE_IDENTITY_MISMATCH`，Provider 请求 0 |
| A08 | 429/5xx/timeout/invalid response | 对应闭集错误；不换 Provider、不生成成功 caption |
| A09 | 检查回执 | request/response hash 可复算；inputImageCount=1；未知 cost=null |
| A10 | 检查公开输出和日志 | 0 API key/Cookie/绝对路径/原始图片/base64 |
| A11 | 真实 MiniMax 中国区调用 | 当前选定 Provider/model 成功；仅去敏证据落盘 |
| A12 | 回归与 PRD 检视 | Runtime 全绿；不提前声明 8/10 或 V3-3 PASS |

