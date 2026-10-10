# V3-5.1 生产候选 PRD 规格检视

日期：2026-10-10。候选：`v3-5.1-production-candidate-20261010T210000Z`。

## 结论

机器实现覆盖 V3 PRD 的工作台增量目标，但最终质量门槛仍等待固定候选的人类提交。当前只允许声明 `MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING`，不得声明 V3-5.1、V3-6 或 V3 完成。

## 已覆盖

- 三条真实 B站视频在同一 fresh run 内完成 SenseVoice 全长转写、每条 8 个分布式真实帧与 MiniMax-M3 画面理解。
- 每条 12 个章节、>=8 时间节点、三层导图、12 个固定问题；原始媒体/音频/完整转写/OCR 未上传云端。
- 时间线具备真实刻度、章节色带、滚轮、拖动、缩放、fit、游标和截图节点；大纲与导图由同一 outline 派生。
- 三条视频各有五类入口各 2 次真实播放器 readback，共 30 次，全部 `deltaMs<=2000`。
- 360/420/768/1280、Axe serious/critical=0、键盘导图、低资源交互与 CSP 门槛通过。

## 未覆盖及禁止扩大

- 候选问答中的 `criticalMeaningError` / `citationSupported` 是生产者输出字段，不再被接受为独立质量结论。真实人类提交缺失，因此 `passed=false`。
- 部分 SenseVoice 文本有口语噪声；是否构成关键含义错误必须由审查者判断，自动化不得代签。
- 旧“人工验收通过”只绑定旧功能流，不绑定本候选哈希，也不替代旧 V3-5 H01..H10 正式 submission。
- YouTube、小红书、直播、V4 Query/Graph/Memory/Durable Forget、完整 BiliNote parity 均不在本候选声明内。

## PRD 判定

规格偏移：0 个已知 Fatal，0 个未闭合机器 Major。人工质量门禁：1 个 pending。V3-6 输入门禁未满足。
