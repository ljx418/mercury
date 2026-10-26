# V3 PRD 与工作包覆盖矩阵

本表证明新增工作包只扩展、不替换既有 V3-0..7、Stage A-E、G1-G6 和人工门槛。

| 权威范围 | 必须结果 | 实施 WP | 最终验收 |
|---|---|---|---|
| V3-0/0X | B站优先、通用 adapter、Chat/Know 产品边界 | 文档既有 | WP7 PRD/架构复算 |
| V3-1.3 | exact Origin、一次性凭据、短租约、秘密隔离 | 兼容回归 | WP5/WP6 |
| V3-1.4 / G1 | 桌面手动启动、一次配对、状态、停止；不自动拉起 | WP5 | G1 + CX-H01 |
| V3-2 | subtitle/credential media ASR/public subtitle/trusted capture、SenseVoice、cleanup | WP0、WP1、WP6 | WP0 canary；A04-A07/A15-A19 |
| V3-3 | 10/10 OCR、>=8/10 授权 VLM、24/12/8 预算、真实帧 | 兼容回归，WP3消费 | A08/A09/A19 |
| V3-4 | 单 TaskStore/Outline、同 task/revision、重启幂等 | WP1-WP3 | Stage A/C + A09 |
| Stage A | 状态/计时/恢复、route/seek/focus、NJ-01..10 | WP1 | 完整 Stage A 独立审查 |
| Stage B | <=100 字 brief、全片章节、claim-evidence、六视频 | WP2 | B5/B6/B7 |
| Stage C | 真实截图、秒数时间线、wheel/drag/keyboard、概念关系 | WP3 | 六视频 + 宿主 LLM + UX |
| Stage D | 五种独立导出、范围/图片/引用、取消恢复 | WP4 | 15 风格输出 + 六视频默认输出 |
| Stage E / V3-5 | 同 build 综合体验、H01-H10 | WP5 | 自动门槛后真人签署 |
| G2 | 普通网页正文、问答/摘要、来源、内容变化失效、无正文拒绝 | WP5 | 3 固定网页 + CX-H02 |
| G3 | B站 Chat、真实 route、时间反跳、0 残留 | WP0-WP5 | 六视频 + CX-H03 |
| G4 | Draft 编辑/取消/确认；未确认 0 写入 | WP5 | transaction fixtures + CX-H04 |
| G5 | Know 真实 CRUD/排序/aging/归档/删除/来源/重启 | WP5 | 0 Mock + CX-H05 |
| G6 | 生产一级导航仅 Chat/Know；Settings 辅助；Agent/Debug 移除 | WP5 | 四视口 + CX-H06 |
| V3-6 | Revision 5 Route B3 12 页单 run、故障、隐私、cleanup、seal | WP6 | A01-A20；Revision 1..4 只读 |
| V3-7 | 独立重算、限定声明 | WP7/Codex | Fatal 0/Major 0 |
| B-7 | Stage B 独立实施出门审计 | WP2 后 Codex | Fatal=0/Major=0 后才进 WP3 |
| H/V3-5.1/CX | 人类体验签署 | WP5 后用户 | V3-6 A17 只读绑定 |
| V4/V5 边界 | Query/Graph/Durable Forget 不计入；Agent V5+ | 无 | WP7 false-green audit |

## 不得遗漏的横切门槛

- 普通网页内容发生变化时旧 `ContextEnvelope` 失效；无正文 fail closed。
- Settings 显示 Runtime 版本/配对/任务/停止及 ASR requested/effective、下载、磁盘、内存/显存；失败给手动安装说明。
- 生产导航不显示 Agent/Debug；开发构建 Debug 不得成为一级产品域。
- H01-H10/V3-5.1/CX 必须在 V3-5 same-build 自动门槛后签署，并在 V3-6 前冻结；Stage B 的 B-7 是 WP2 后 Codex 独立审计，不是人工签署。V3-6/V3-7 只读引用。
- 原固定分母、FailureCode、失败证据和历史 LIMITED PASS 不因本表而删除或升格。
