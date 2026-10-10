# V3-2-3 恢复文档外审 Round 1 Major 闭环

日期：2026-10-07。来源报告：`v3-2-3-resumption-independent-document-audit-20261007.md`。

## 1. 原结论

- Fatal：0。
- Major：1。
- Minor：2。
- 门禁：`FAIL / REPLAN`。

Major M-1：计划要求 succeeded receipt 的 `SRT count == FSMN-VAD count`，但 positive fixture 为 `result.segmentCount=120`、`coverage.speechIntervalCount=24`，语义测试仍只判断 `coverageRatio>=0.9`。

## 2. 修复

1. `v3-media-pipeline-observability-positive.json`：`result.segmentCount` 改为 24，与 `speechIntervalCount=24` 精确相等。
2. `validate_transcript_semantics`：succeeded 时强制：
   - `result.segmentCount == coverage.speechIntervalCount`；
   - `coveredSpeechDurationMs == speechDurationMs`；
   - `coverageRatio == 1.0`；
   - `passed is True`。
3. 新增 `test_transcript_semantics_reject_vad_srt_count_mismatch`，把 segmentCount 增加 1 后必须 `AssertionError`。

## 3. 验证

- Draft 2020-12 Schema meta：PASS。
- positive fixture instance：PASS。
- strict coverage 独立断言：PASS。
- `test_v3_media_pipeline_contracts.py`：31 passed。

## 4. Minor 处置

- m-1 `RawAsrTranscript.vad_segment_count`：属于 `2-3-3` 明确待实现项，实施出门前必须完成。
- m-2 provider `close()`：native host 当前不保留异步进程句柄，`transcribe()` finally 清 task；后续 service 仍须验证 close 幂等、close 后拒绝 transcribe、取消/timeout 后进程和两个 task root 为 0。若实现需要 host 全局回收，须通过受控 task registry 实现，不允许扫描任意目录。

当前仍是 `IMPLEMENTATION NO-GO`，必须完成 Round 2 独立文档复审并取得 Fatal=0/Major=0。
