# V3-1P B站真实样本探测验收结果

日期：2026-09-17  
正式 run：`v3-1p-bilibili-probe-20260917T041114Z`  
结论：`PASS`

## 1. 固定验收结果

| ID | 结果 | 实测 |
|---|---|---|
| V3-1P-A01 | PASS | 锚点 `BV1ZpYd66ELP`：`cid=41828944992`、单 P、792 秒、标题/作者可回读；无 subtitle item/贡献者，归类 `asr` |
| V3-1P-A02 | PASS | 6 个唯一字幕样本均在当前页面 HTML 出现 `字幕制作者`，播放器 DOM 出现主字幕语言选项 |
| V3-1P-A03 | PASS | 3 个唯一 ASR 样本的 WBI/legacy subtitle item 均为 0，且页面 HTML 无字幕贡献者 |
| V3-1P-A04 | PASS | `BV1PA4m1w7ya` 实测 `partCount=100`，100 个 part/cid 完整 |
| V3-1P-A05 | PASS | `BV1vt1sBgEzc` 同时出现“充电专属”和“即可观看”，预期 `blocked` |
| V3-1P-A06 | PASS | `BV1goA2zrEEq` 页面原文明确“全程无解说，仅有雨声、脚步声与环境音”，预期 `degraded` |
| V3-1P-A07 | PASS | Schema 实例通过；12 URL / 12 BVID 唯一；分类精确 `6/3/1/1/1` |
| V3-1P-A08 | PASS | 12 observation hash 与 12 screenshot hash 独立重算一致；截图均为 1280x900 PNG |
| V3-1P-A09 | PASS | JSON/Markdown 扫描 0 `SESSDATA/bili_jct/DedeUserID/Bearer/Cookie:` 命中；临时 profile 删除；对应 Chrome 进程 0 |
| V3-1P-A10 | PASS | 保持 12 页固定分母和锚点，不把探测声明为 V3-1 产品实现、字幕下载、ASR 或媒体理解通过 |

## 2. 哈希与视觉证据

- `raw-observations.json`：`a0ce78ce156e07d37a7015abfdacd2faf964fe2786e3c243f0adae3bd1cdace1`
- `sample-registry.json`：`b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1`
- `registry-verification.json`：`b93c506a1102f877d70475660e503a525192e51b798814090e0f1c797983fe0b`
- `screenshots/contact-sheet.png`：`249f23500def6c6ede2f02e00ecb6a7ab7c321358b314edeee514bfe2939047a`
- Chrome：`152.0.7977.84`，profile class `fresh_temporary_public`。

视觉抽查确认 12 张页面均正常渲染；充电专属样本显示观看限制；低信号样本显示真实风景视频；无空白、验证码、登录 profile 或 Navia mock 页面。

## 3. 作废与非权威 run

- `...T035216Z`：清理失败且字幕请求策略错误，FAIL。
- `...T035716Z`：Windows 进程树未清理，FAIL。
- `...T040124Z`、`...T040543Z`、`...T041019Z`：发现/诊断 run，不是注册表权威输入。

任何后续实现只能引用正式 run 和上述 registry hash，不得拼接其他 run。
