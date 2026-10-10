# V3-2-0 双模型比较 PRD 规格检视

日期：2026-09-18。

## 覆盖结论

- 保留 B站优先、Cookie 主路径、字幕优先、本地 ASR、可信 capture 回退和开放 portal adapter 边界。
- 固定三样本、固定 120 秒窗口、两名独立人类和分歧复核均未缩减。
- 取消的是人类逐字听写，不是人类真值判断；人类仍必须听原视频。
- 机器输出不称为 gold，不计算 CER，不以两个模型一致自证正确。
- ASR 质量阈值改为可由非听写交互直接验收的关键含义、critical 和 neither-acceptable 指标。
- 未新增 V3-2-1 产品代码、云 ASR、YouTube/小红书实现、OCR/VLM、大纲、RAG 或 V4 能力。

## 用户体验结果

人类只需对每个 15 秒区间执行“打开原视频 -> 听取 -> 比较 A/B -> 标记含义与错误”。无需暂停并录入整段文字。两名 reviewer 完成后，adjudicator 只复核实质分歧项。

## 声明边界

当前只能声明比较材料和页面机器验收通过。没有两份真实人类 review 与 adjudication，不能声明 production small 质量通过、revision 2 productionReady、V3-2-0 PASS 或 V3-2-1 GO。
