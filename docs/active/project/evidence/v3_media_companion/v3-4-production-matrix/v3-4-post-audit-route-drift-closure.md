# V3-4 外审后路线漂移闭环

日期：2026-10-08。

## 发现

独立报告的生产矩阵显示，冻结 registry 中 01..06 的 `primaryClass=subtitle`，但 fresh run 的实际 `route` 均为 `credentialed_media_asr`。因此候选报告/PRD 检视中“01..06 当前字幕”的文字说明不准确；密封 result 本身正确记录了实际 route，没有篡改或假报机器数据。

## 定性

- V3-4：不撤销 LIMITED PASS。V409 固定的是同 run 12 页、10 ready + 1 degraded + 1 blocked 和投影闭合，不固定字幕/ASR 路由计数；所有 ready 任务仍由真实本地证据生成。
- V3-5：作为实施前 Major 风险处理。UI 必须展示 Runtime 实际 route、预计时长/CPU/磁盘影响与取消，不得从 registry class 推导“字幕快路径”。
- V3-6/7：最终 production matrix 必须同时记录 `registryClass` 和 `observedRoute`，不得把二者合并为一个字段。

## 处置

1. 保留 sealed result、外审报告及候选报告原字节，不在审计后重写载荷。
2. 以本闭环文档纠正叙述层错误，并把 route drift 加入 V3-5 开发/验收/威胁模型。
3. V3-5-A03 必须从 Runtime event 显示实际 route；字幕不可用转 ASR 时显示低资源影响和进度。
4. V3-5 实施前外审必须复核该项已落入产品合同和自动验收，Fatal=0/Major=0 后才可请求代码授权。

## 隐私与清理

本闭环不重新采集、不调用模型、不恢复已删除媒体/截图，不改变 private evidence 或公开 Seal。
