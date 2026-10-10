# V3-2-0b-3 SRT / Segment Normalizer 开发计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`

## 目标

把 Provider 的受限 SRT stdout 转换为统一 `AsrTranscriptCandidate`，为后续真实样本分 bin 提供唯一时间轴。解析器 fail closed，不猜测、不补写、不重排时间戳。

## 实施

- 新增 `srt_normalizer.py`，解析 `HH:MM:SS,mmm --> HH:MM:SS,mmm`。
- 每段必须有唯一正整数 source ID、非空文本、`0 <= start < end <= audioDuration`。
- 全局必须严格按 start/end 非递减且相邻段不重叠；重复 ID/重复时间段拒绝。
- 限制 segment 数、单段字符、总字符与输入 bytes，拒绝控制字符和混入 diagnostics。
- 输出稳定 `AsrSegment(segment_id,start_ms,end_ms,text)` 和 transcript duration。
- 单元 fixture 覆盖 CRLF/BOM/多行文本及空段、逆序、重叠、越界、重复 ID、坏时间格式、过大输入。

## 边界

不做 ASR 文本改写、纠错、实体修复、分 bin 或质量打分；不接受无时间戳纯文本；不修改 Provider/native host/catalog/UI。
