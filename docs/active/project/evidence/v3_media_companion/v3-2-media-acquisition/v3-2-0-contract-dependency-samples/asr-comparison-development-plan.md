# V3-2-0 双模型 ASR 比较材料开发计划

日期：2026-09-18。范围仅为 V3-2-0 比较证据与人工验收页面。

## 实施顺序

1. 冻结比较 Schema、三样本窗口和两个模型的 revision/file hash。
2. 用已授权 B站 Cookie 通过固定 yt-dlp 读取每个目标 P，只截取 `30s..150s` 单声道 16kHz 音频。
3. 对同一音频分别运行 small 与 base；模型和音频均只从本地路径读取。
4. 按 segment 中点归入 8 个 15 秒 bin，生成交替 A/B label map 和私有 standalone HTML。
5. 删除 cookiefile、源媒体、音频窗口和 work directory；扫描 Cookie 原值 0 命中。
6. 对 bundle/schema/hash/bin/label/cleanup 做机器验收；用真实 Chrome 检查页面在 360/420/768/1280、键盘和导出流程。

## 文件边界

- 产品代码：不修改。
- 自动化：新增比较生成器、比较 verifier 和 HTML 模板。
- 权威合同：新增 `v3_asr_comparison_contracts.schema.json`。
- 私有结果：位于 `.tmp/v3-2-asr-comparison/runs/<runId>/`，不进入公开审计包。
- 公开证据：只记录 bundle hash、模型 hash、统计、清理和页面 hash，不公开完整机器 transcript。

## 停止条件

真实媒体无法取得、任一模型离线失败、三样本/24 bin 不完整、Cookie 原值命中、临时媒体残留、页面泄漏 model label、Schema 错误或浏览器流程不能导出时停止。人类比较未完成时 V3-2-0 仍不得 productionReady。
