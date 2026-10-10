# V3-2-5..7 Transcript 产品化与出门独立文档审查请求

日期：2026-10-06。只读审查 `docs/active/project/external-audit-package/`，先读 manifest 和本请求。不得运行产品代码、读取 Cookie/秘密、修改仓库或把 fixture 当生产事实。

## 审查目标

判断 V3-2-5 双容器 UI、V3-2-6 故障清理、V3-2-7 单 run 出门文档是否能在前序通过后无歧义指导自动化实现，并拒绝缩分母、跨 run、自动 capture、清理假绿、候选自批和 V3 scope 扩大。

## 必查

1. Side Panel/Workspace 是否只读同一 Runtime task，是否存在前端第二事实源。
2. trusted capture 是否只能由可见真实点击启动，取消是否必须等 cleanup receipt。
3. A01..A14、A01..A12、F01..F14 和总 A01..A20 是否固定且无 N/A。
4. fault profile 是否 test-only，生产 API/message/用户输入是否不可选择 faultClass。
5. 每个故障是否独立 task、唯一终态、终态后零写、零残留、零秘密。
6. 12 页是否精确 6+3+1+1+1，sourceIdentity/URL hash 唯一，3 ASR 和至少 1 capture 是否不可省略。
7. ExitCandidate 是否必须 false/pending，独立审查是否不得回写 sealed candidate。
8. H01..H10 是否仍只在 V3-5，V3-2 是否禁止大纲/OCR/VLM/Mindmap/Ask/导出完成声明。

## 独立复算

- 全部 payload hash 与权威源。
- Schema meta、三个 positive receipt。
- 至少验证：四视口/状态缩减、秘密可见、双终态、后写、残留、故障重复、样本重分类/重复、缺 capture/ASR、提前 PASS。
- 输出 Fatal/Major/Minor、逐问题结论、允许/禁止项和文件/行号。

建议报告：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-5-7-independent-document-audit.md`。
