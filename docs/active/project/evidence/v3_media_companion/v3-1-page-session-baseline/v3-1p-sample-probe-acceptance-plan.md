# V3-1P B站真实样本探测验收计划

日期：2026-09-17  
状态：`FROZEN BEFORE EXECUTION`

## 1. 固定验收项

| ID | 用户/系统场景 | 操作 | 必须结果 |
|---|---|---|---|
| V3-1P-A01 | 打开锚点 | 临时 Chrome 访问 `BV1ZpYd66ELP` | `bvid/cid/partCount/duration/title/author` 可回读，公开字幕不可用，归入 `asr` |
| V3-1P-A02 | 字幕样本 | 分别打开 6 个唯一视频 | 每个都有真实字幕入口或公开 subtitle item，不能仅凭标题含“字幕”判断 |
| V3-1P-A03 | ASR 样本 | 分别打开 3 个唯一视频 | 字幕观测为空/不可用，页面身份仍有效 |
| V3-1P-A04 | 多 P 样本 | 打开多 P 视频 | `partCount > 1`，记录首 P cid 与各 P 基本信息 |
| V3-1P-A05 | 受限样本 | 打开受限视频 | 页面或 API 显示机器可读限制事实，预期 `blocked` |
| V3-1P-A06 | 低信号样本 | 打开低信号视频 | 记录可重算的低信号依据，预期 `degraded`；不可只凭主观标题 |
| V3-1P-A07 | 注册表完整性 | 校验 `sample-registry.json` | 精确 12 URL、12 BVID；分类计数 `6/3/1/1/1`；0 重复、0 空观测时间 |
| V3-1P-A08 | 原始证据 | 重算观测与截图 | 每项 response/page snapshot hash 和 screenshot hash 可重算 |
| V3-1P-A09 | 隐私 | 扫描全部输出 | 0 Cookie 值、token、Authorization、用户 profile 路径 |
| V3-1P-A10 | PRD 检视 | 对照 PRD §18、架构 §22、Stage Gate §4 | 不缩小 12 页分母，不把探测声明为 V3-1 产品实现或媒体理解通过 |

## 2. 判定

全部 A01-A10 PASS 且内部审计 `Fatal=0/Major=0`，才允许把 revision 1 注册表作为 V3-1 产品开发输入。任何 N/A、人工猜测或跨 run 拼接均为 FAIL。
