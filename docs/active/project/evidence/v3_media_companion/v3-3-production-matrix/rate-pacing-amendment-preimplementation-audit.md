# V3-3-6 生产矩阵调用节奏修订实施前审计

日期：2026-10-08。

决定：`GO`。Fatal=0，Major=0，Minor=1。

## 修订边界

- 仅在 V3-3-6 批量验收 runner 的相邻 MiniMax dispatch 之间强制等待至少 65 秒。
- 不修改产品端单任务调用语义，不增加 retry，不切换 Provider/模型。
- 8 个固定 cloud target 仍各只有一次 dispatch；10/10 OCR、8/8 VLM 和 M01..M16 不变。
- runner 增加 `sample_started`、`provider_rate_cooldown`、`sample_completed` 去敏进度事件，便于定位失败样本；不输出 URL、Cookie、密钥、帧或 caption。
- 新 run 必须从样本 1 开始，不读取前三个失败 run。

Minor M-1：矩阵耗时将增加约 7.5 分钟；这是外部个人 API 稳定性的验收成本，不进入用户日常单任务延迟承诺。
