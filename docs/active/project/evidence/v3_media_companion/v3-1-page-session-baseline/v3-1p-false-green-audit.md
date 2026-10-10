# V3-1P False-green 审计

日期：2026-09-17  
结论：`Fatal=0 / Major=0 / Minor=1`

## 已拒绝的假绿路径

1. 两个清理失败 run 均保留 `FAILED.md`，没有补 seal 或转正。
2. “标题含字幕”不构成字幕样本；正式 6 个字幕样本必须同时有当前 HTML `字幕制作者` 和播放器主字幕语言选项。
3. 导航中的通用“大会员”不构成 restricted；正式样本同时要求“充电专属”与“即可观看”。
4. 搜索引擎摘要不进入 registry；所有字段来自同一正式 Chrome run。
5. 低信号不是人工猜测；页面原文必须包含“全程无解说”等确定性依据。
6. 注册表构建器重算 observation/screenshot hash，精确验证分类计数和唯一性。
7. 正式 run 使用全新临时 profile，结束后 profile 和对应 Chrome 进程均为 0。

## Minor

- M-1：公开匿名 player API 的 subtitle item 为 0，字幕样本依赖当前页面 HTML 贡献者和播放器语言 DOM。V3-1 collector 必须同时实现 API/DOM 多源判定并保留 `unknown`，不得只信其中一路。

该 Minor 已转入 V3-1 产品验收，不阻断样本注册表冻结。
