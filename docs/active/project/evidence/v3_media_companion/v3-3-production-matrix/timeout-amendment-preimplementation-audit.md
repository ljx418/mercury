# V3-3-6 Provider 超时修订实施前审计

日期：2026-10-08。

决定：`GO`。Fatal=0，Major=0，Minor=1。

## 审查结论

- 根因是 MiniMax 单次真实请求超过既有 60 秒读取期限，不是 Schema、授权、预算、媒体、OCR 或 cleanup 缺陷。
- 唯一运行时修订为 `MiniMaxChatVisionAdapter` 默认 timeout 60→120 秒。
- retry 保持 0；timeout/429/5xx 仍令整个 run 失败，不得自动切换 Provider/模型。
- 10/10 样本、8/8 固定 cloud target、每 task 一次本轮调用、task 生命周期 8 次上限和所有 M01..M16 门槛不变。
- 新 run 必须使用全新 namespace 并从样本 1 执行；不得读取或拼接失败 run 的中间结果。

Minor M-1：远端服务仍可能超过 120 秒或返回 529；该情况必须再次 fail-closed，不得继续扩大 timeout 或增加重试而不重新审计。
