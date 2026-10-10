# V3-3-6 第四次真实生产矩阵失败记录

日期：2026-10-08。runId：`v3-3-vision-production-20261008T065446Z`。

## 事实

- 本轮启用相邻云 dispatch 至少 65 秒的固定节流；retry=0，Provider/模型/样本/验收分母均未改变。
- `v3-sample-01..06` 各自完成全新媒体下载、抽帧、OCR、一次 MiniMax 调用和 task cleanup。
- `v3-sample-07` 在 15:00（Asia/Shanghai）节流后调用仍返回 HTTP 529；整轮立即失败，样本 8..10 未执行。
- run 无 `run-result.json`、无 seal；公开目录为空；私有 task、媒体、Cookie 和 consent DB 已全部清理。
- 6 个局部成功不得计入下一 run，也不得作为 V3-3-6 通过依据。
- 官方额度接口返回 HTTP 200：general 窗口状态正常、剩余百分比 99%，排除额度耗尽。
- 同凭据/端点/模型的中性图与冻结样本 1 单帧隔离请求均返回 200；排除持续凭据、区域、图像能力和请求格式错误。

## 决定

`FAILED / EXTERNAL PEAK-CAPACITY BLOCK / NO SEAL`。

V3-3-6 实现保留，但生产矩阵不得 PASS。停止在高峰期反复重跑；恢复路径必须保持单 run 10/10 OCR、8/8 VLM、0 retry 和不跨 run 拼接。
