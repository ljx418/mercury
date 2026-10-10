# V3 剩余开发总验收计划

日期：2026-10-06。状态：`FROZEN FOR SEQUENTIAL IMPLEMENTATION`。

## 1. 固定用户场景

用户在受支持 B站详情页授权后开始分析；系统按凭据字幕、凭据媒体 ASR、公开/页内字幕、可信 tabCapture 顺序得到 transcript，再生成关键帧/OCR/VLM 证据、VideoOutline、时间线、Mindmap 和 Ask。用户可以点击证据跳回播放器并导出本地结果；不可用时显示 degraded/blocked。

## 2. 阶段验收

1. V3-2：12 个唯一 URL；6 subtitle、3 ASR、1 multipart、1 restricted、1 low_signal；A01..A20 无 N/A；终态私有残留为 0。
2. V3-3：10 个应成功样本具有本地 OCR；至少 8 个具有真实授权 VLM；字幕推断不得冒充画面事实。
3. V3-4：一个强类型 VideoOutline 派生大纲、时间线和 Mindmap；重启/重试不重复、不串 task。
4. V3-5：四视口、Axe serious/critical=0、键盘主流程、5 次 seek 误差 <=2 秒、Ask 有证据回答与无证据拒答、导出 hash；随后 H01..H10 全执行。
5. V3-6：全新 build/profile/runtime/task root 的 12 页单 run；故障、隐私、清理和回归全部重跑；只引用 V3-5 已签署人类结果。
6. V3-7：独立复算 manifest、Schema、分母、hash、秘密扫描和人工签署绑定；Fatal=0/Major=0。

## 3. 真实数据与假绿拒绝

生产验收只能使用真实 Chrome、真实 B站页面、真实字幕/媒体/SenseVoice/OCR/VLM/播放器时间。合同 fixture 只证明拒绝逻辑。禁止跨 run 拼接、标题补 transcript、静态原型代产品、模型常识补证据、降低分母或把待处理状态改写为 PASS。

## 4. 人工验收时点

H01..H10 在 V3-5 自动门槛全部通过后执行。此前人类不承担听写、采集、截图或排障。任何 H 项未执行、BLOCKED 或缺截图均禁止 V3-6 最终候选升级。
