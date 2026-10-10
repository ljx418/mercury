# V3-3 VLM Provider 冻结基线

日期：2026-10-08。状态：`MINIMAX CHINA CAPABILITY PASS / PRODUCTION TIMEOUT AMENDMENT 1`。

| 项 | 冻结值 |
|---|---|
| provider | `minimax-cn-openai-vision` |
| adapter | `minimax_chat_completions` |
| base URL | `https://api.minimaxi.com/v1` |
| endpoint | `POST /chat/completions` |
| model | `MiniMax-M3` |
| image input | 单张 PNG，最长边不超过 1280 px，`detail=low` |
| inference | `thinking.type=disabled`，`temperature=0.1`，`stream=false` |
| max output | 500 tokens |
| production timeout | 120 s |
| retry/provider fallback | 0 次；timeout/429/5xx 令当前 run 失败，不切换 Provider 或模型 |
| credential | Windows Credential Vault；仅进程内短时读取，禁止日志、证据包和 SQLite |

## 固定预算

- 每个 task 生命周期最多 8 次 Provider dispatch；撤销后重新授权不得重置预算。
- V3-3-6 固定 registry 的前 8 个 `cloudVisionTarget=true` 样本各调用一次，后 2 个调用 0 次。
- 每个 observation 只发送一张由当前 task 持有、哈希和尺寸均已验证的帧。
- Provider、模型、样本和上传分母不可在同一 run 内动态替换。

## 授权、撤销与数据边界

- scope 固定为 `selected_frame_cloud_vision`，授权只覆盖当前 task。
- 上传前必须明确提供商、模型、最大帧数、分辨率、成本/留存风险以及“不上传原视频”。
- 用户拒绝时允许本地 frame/OCR，但 VLM 必须为 `not_authorized`，不得以 OCR 冒充画面理解。
- 授权前和撤销后 Provider dispatch 必须为 0；撤销后清除未进入证据的输出。
- 禁止发送视频原件、整段音频、Cookie、页面正文、ASR 全文或其他 task 的帧。

## Capability probe 与生产修订

中性图能力探测及真实 B 站单帧受控调用均已通过：凭据有效、模型接受图像、返回 typed observation，公开材料秘密扫描为 0。

V3-3-6 首次生产矩阵 `v3-3-vision-production-20261008T064500Z` 在 60 秒读取超时处 fail-closed：未产生 result/seal，私有工作目录已清理，未跨 run 复用。修订仅把单次生产请求超时从 60 秒提高到 120 秒；重试仍为 0，8 帧总分母、单 task 预算、Provider、模型、请求字段和验收门槛均不变。

## 开放架构

`MediaVisionProviderRegistry` 的公共入口只接收受治理的 selected frame，并输出 provider-neutral `VisionObservation`。MiniMax 是当前冻结 adapter；调度、consent ledger、budget、evidence 和 cleanup 不依赖 MiniMax 私有字段。以后增加本地 VLM、OpenAI、Gemini 或其他 Provider 时，必须新增独立 manifest、capability probe 和显式用户选择，不能继承本基线 PASS。
