# V3 剩余开发总计划

日期：2026-10-06。状态：`ACTIVE / IMPLEMENTATION SEQUENCE FROZEN`。

## 1. 目标与完成定义

完成 PRD §18.2 的 B站首版路径：真实媒体获取与本地转写、关键帧/OCR/授权 VLM、同源 VideoOutline/时间线/Mindmap、Ask、播放器反跳、历史与导出。V3 完成必须经过 12 页单 run 自动验收、V3-5 人工 H01..H10 和 V3-7 独立终审；任何子阶段通过都不能扩大为 V3 完成。

## 2. 唯一顺序

| 阶段 | 开发内容 | 实施前材料 | 自动出门条件 |
|---|---|---|---|
| V3-2-2 | Revision 3 样本、B站字幕和当前分 P 媒体 acquirer | 开发/验收/威胁模型、Schema、真实授权探测、审计 | 6 字幕、2 credentialed media、1 multipart、1 blocked；0 secret/path 泄漏 |
| V3-2-3 | SenseVoice 全长 ASR 与 MediaTranscript | 详细开发/验收/威胁模型和 transcript execution v2 合同已落盘；仍需前序 PASS 与外审 | 3/3 全长非空、覆盖率 >=90%、hash/时间/cleanup 闭合 |
| V3-2-4 | 可信 tabCapture | 详细开发/验收/威胁模型和 capture stream v1 合同已落盘；仍需前序 PASS、外审和高风险授权 | 至少 1 个真实 trusted capture；错误 tab/replay/后台启动全拒绝 |
| V3-2-5..7 | 双容器 transcript UI、故障矩阵、12 页出门 | 三阶段 `-0..-7` 详细计划、A01..A14、A01..A12+F01..F14、总 A01..A20、三份威胁模型/预审和 transcript exit v1 合同已落盘；仍需前序 PASS 与外审 | A01..A20、四视口、Axe/键盘、独立审计通过 |
| V3-3 | 关键帧、本地 OCR、授权云端 VLM | `-0..-7` 详细计划、A01..A16、威胁模型、vision evidence v1 Schema 与负例已落盘；仍需 V3-2 PASS、RapidOCR/VLM 精确冻结和外审 | 10 页 OCR、至少 8 页真实 VLM、分型证据完整 |
| V3-4 | MediaTaskStore、VideoOutline、Timeline、Mindmap | `-0..-7` 详细计划、V401..V418、SQLite 事务/恢复威胁模型、outline taskstore v1 Schema 与负例已落盘；仍需 V3-3 PASS 和外审 | 同一 outline 派生三视图，重启恢复且无跨 task 事实 |
| V3-5 | 双容器完整产品、Ask、证据、seek、导出；人工 H01..H10 | `-0..-7` 详细计划、A01..A18、H01..H10、路由/Ask/seek/export/签署威胁模型已落盘；产品与人类 submission Schema 仍需 V3-5-0 冻结外审 | 自动 UI 门槛通过后执行唯一一轮人类验收并签署 |
| V3-6 | 12 页生产矩阵、故障与隐私包 | `-0..-7` 单 run、A01..A20、故障矩阵、public/private/seal/H binding 已落盘；final contracts/tooling 待 V3-6-0 冻结 | 自动分母完整，引用 V3-5 签署，不新增人工步骤 |
| V3-7 | 最终独立出门审计 | 最终只读复算、限定声明与威胁模型已落盘；实施必须等待 V3-6 sealed candidate | Fatal=0/Major=0 后仅作 B站限定声明 |

## 3. 人工验收边界

V3-2 至 V3-4 不请求人类测试、听写或补证。H01..H10 只在 V3-5 功能完整后执行一次。V3-6/V3-7 只验证签署来源、完整性、候选绑定和结论，不得自动代签。

## 4. V4 边界

跨模型 ASR 退化检测、质量失败智能回退、知识库导入、Query、Graph、Durable Forget 和 RKM 均为 V4。V3 保留 Tiny 技术安全兜底，但不把它声明为质量等价回退。

## 5. 全程停止条件

- 固定真实分母不足或跨 run 拼接；
- Cookie、token、绝对私有路径、原始音频进入公开证据；
- 未授权下载、后台自动 capture 或平台限制绕过；
- mock/fixture/原型被计为 production pass；
- PRD、Schema、实现状态或模型身份出现双轨；
- 任一实施前审计新增 Fatal/Major。
