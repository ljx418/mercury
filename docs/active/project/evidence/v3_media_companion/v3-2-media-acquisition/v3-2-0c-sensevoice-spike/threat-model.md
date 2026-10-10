# V3-2-0c 路线 C Spike 威胁模型

日期：2026-09-22

| 威胁 | 控制 | 失败结果 |
|---|---|---|
| 供应链替换 | 官方固定 revision、bytes、SHA-256、license；逐跳 HTTPS allowlist | `ASSET_IDENTITY_MISMATCH` |
| 模型下载越界 | 私有目录、`.part` 原子替换、512 MiB 上限 | `ASSET_BUDGET_EXCEEDED` |
| 任意命令/路径 | argv list、no shell、realpath/owner/mode/hash 检查 | `PROCESS_BOUNDARY_BYPASSED` |
| 推理外联 | 资产完成后 network namespace/equ价断网；不传 Cookie/URL | `INFERENCE_NETWORK_NOT_ISOLATED` |
| 时间戳造绿 | 强制 VAD+SRT；解析和窗口边界检查；禁止整窗替代 | `TIMESTAMP_UNTRUSTWORTHY` |
| 选择性样本 | 固定 3 tuple；3/3 原子判定 | `SPIKE_DENOMINATOR_CHANGED` |
| 文本造绿 | 原始 stdout 私有保存，公开仅 hash/count；0 rewrite | `TRANSCRIPT_REWRITE_FORBIDDEN` |
| 资源放大 | 8 cores/8 GiB/no-GPU，逐窗口 peak RSS/wall | `RESOURCE_LIMIT_EXCEEDED` |
| 隐私泄漏 | 私有 0700/0600；公开递归 secret/path/media/text scan | `PRIVATE_DATA_EXPOSED` |
| 状态误标 | 不写 catalog/UI；仅 feasibility enum | `SPIKE_SCOPE_ESCALATED` |

残余风险：3 个窗口不能证明 24-bin 覆盖、语义质量、跨平台安装或用户体验；VAD 时间戳也不是词级时间戳。这些必须保留到后续生产候选，不能由本 spike 消减。
