# V3-3-4 授权 VLM 实施出门审计

日期：2026-10-08。

结论：`V3-3-4 LIMITED PASS`。Fatal=0，Major=0，Minor=2。

## 实现结果

- `VisionConsentStore` 持久化 grant/revoke/barrier，并在 `BEGIN IMMEDIATE` 事务内为每个 task 原子消费 dispatch permit。
- 8 帧预算绑定 task 全生命周期；新增测试证明重新 grant 不会重置预算。
- `GovernedMediaVisionAdapter` 在网络前校验 selected、task、artifact hash、图片尺寸、已测试当前 Provider 和 consent permit。
- Provider 请求只含一张 PNG 与最小画面提示；不含 Cookie、路径、HTML、transcript 或原视频。
- MiniMax/OpenAI adapters 均输出 typed caption/model/usage；429、5xx、timeout、invalid response 闭集失败且不 failover。
- request/response 使用不含秘密的 canonical hash；unknown cost 为 null。

## 真实验收

- 首个全新真实任务收到 MiniMax HTTP 529，正确终止为 `VISION_PROVIDER_UNAVAILABLE`，私有资产清理，未生成成功证据。
- 随后同 Provider/模型的全新任务通过；加强任务级预算后又以全新任务复验通过。
- 最终候选：`BV1ZpYd66ELP` 4000ms、852x480、535,519-byte 单帧；MiniMax 中国区 `MiniMax-M3`。
- usage：554 input tokens、105 output tokens、cost=null；Provider dispatch 精确 1。
- 授权前 `VISION_CONSENT_REQUIRED`，撤销后 `VISION_CONSENT_REVOKED`，两者均未调用 Provider；post-revocation dispatch=0。
- 机器证据：`v3-3-dependency-freeze/v3-3-4-real-minimax-frame-result.json`；caption 仅保存 hash 与字符数。

## 自动验收

- 定向治理/Provider/OCR：23 passed。
- Runtime 全量：611 passed（71.25s）；唯一 warning 为既有 Starlette/httpx deprecation。
- `git diff --check` PASS；关键实现与候选结果精确 API key 扫描 0 命中；私有临时目录 0 残留。

Minor M-1：单帧探针不替代 V3-3-6 至少 8/10 生产分母。

Minor M-2：已获 permit 的在途请求不可远端撤回；实现仅承诺 barrier 后不发新请求，与威胁模型一致。

允许进入 V3-3-5；禁止声明 V3-3 或视频完整理解 PASS。

