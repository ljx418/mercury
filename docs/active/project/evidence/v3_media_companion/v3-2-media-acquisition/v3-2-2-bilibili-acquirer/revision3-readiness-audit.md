# V3-2-2 Revision 3 内部文档与数据准备审计

日期：2026-10-06。范围：PRD、V3-2 计划、revision 2/3 Schema、V3-2-2 ADR/开发/验收/威胁模型和真实探测。

## 结论

`DOCUMENT PASS / IMPLEMENTATION NO-GO`。Fatal=0、Major=1、Minor=1。

## 已通过

1. Revision 2 保持原文件，revision 3 使用新 `$id` 和新路径，未原地放宽历史合同。
2. Revision 2/3 均通过 Draft 2020-12 meta validation。
3. Revision 3 保留 12、6+3+1+1+1、身份/分P/hash/授权 probe，并删除 V4 范围的 comparison/reviewer/adjudication。
4. SenseVoice model/revision/weights 与 `development_baseline` 精确冻结。
5. V3-2-2 BA01..BA16 有具体操作、真实结果和停止条件；威胁模型覆盖 secret、SSRF、跨 task、分P、下载器和清理。
6. 真实 Chrome 已完成 12/12 页面探测，run 公开文件对 Cookie 真值 0 命中。
7. Revision 3 外部独立文档审查已完成，19 项载荷哈希一致、两份 Schema meta 通过、六项审查问题全部 PASS；未新增 Fatal/Major。

## Major

- M-1：授权 Cookie 已过期；server validation 为 `code=-101/isLogin=false`，BA02 和 revision 3 `productionReady=true` 不能通过。
- 已关闭 M-2：V3-2-1 外部独立实施审查已落盘，结论 `LIMITED PASS`、Fatal=0/Major=0/Minor=3。

## Minor

- m-1：九月样本中的字幕能力依赖页面 DOM 标识，当前 API subtitleItems 为 0；V3-2-2 必须真实获取字幕 body 后才能确认 BA07，不能只依赖“字幕制作者”文本。失败 run 同时证明锚点仍应为 ASR；revision 3 已恢复 `BV1iv411j7wL` 为第六字幕样本并移除第三个非锚点 ASR 候选，恢复后必须整组重跑。

## 决定

允许继续编写后续 V3 文档和 revision 3 生成器/负例测试；禁止启动会读取 Cookie、写 cookiefile、调用 B站凭据 API 或下载真实媒体的 V3-2-2 产品实现。Revision 3 文档外审已完成；M-1 关闭并生成全新 schema-valid Revision 3 后重新执行实施前审计。
