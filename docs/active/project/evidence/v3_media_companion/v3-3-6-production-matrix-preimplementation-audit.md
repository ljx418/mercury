# V3-3-6 实施前审计

日期：2026-10-08。

决定：`GO`。Fatal=0，Major=0，Minor=2。

- 10 个样本和前 8 个 cloud target 已在 V3-3-0 外部审查逐项对账，无动态换样入口。
- V3-3-1..5 均取得真实单样本和全量回归 LIMITED PASS。
- RapidOCR 资产、MiniMax 中国区/MiniMax-M3、系统凭据、24/12/8 和真实上传授权均已关闭。
- Runner 必须全新单 run；任何样本失败均不得从旧 run 复制或只重跑缺口后拼接。

Minor M-1：平台当前媒体可变化；bytes/hash 允许新值，但 mediaId/playbackUnitId/current part 不允许替换。

Minor M-2：MiniMax 可能 529；单 run 内不自动切换 Provider/模型，失败则 run 无 seal并回到计划阶段。

允许实施 V3-3-6；8 次真实用户帧上传是既有明确授权和冻结分母的执行，不扩大到第 9 帧。

