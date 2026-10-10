# V3-2-0b-5 首轮音频帧数过严断言

日期：2026-09-22  
runId：`v3-2-0b-5-20260922T062105Z`  
结论：`INVALID / NOT AN ACCEPTED RUN`

首个真实样本下载与 trim 成功，输出为 16 kHz、mono、PCM S16LE，`ffprobe=119.999813s`，WAV 为 `1,919,997` frames。开发计划与 B05-04 固定的是 `120±0.05s`，但 runner 错误要求 frames 必须精确等于 `1,920,000`，因此在进入 ASR 前作废。

修复：保持固定窗口不变，将 shape validator 改为格式精确 + `abs(duration-120)<=0.05`；不修改 ffmpeg 参数、样本或验收阈值。该 run 未产生 candidate transcript，Cookie 临时文件和 source media 已删除，残留私有 WAV 已在重跑前删除，不得拼接到后续 run。
