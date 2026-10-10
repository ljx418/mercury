# V3-2-0b-6 失败尝试：20260922T064528Z

状态：`INVALIDATED / DO NOT REUSE`

全量 run 在第二个 Small worker 中止。冻结的 120 秒 WAV 经 Whisper 固定 30 秒解码窗口量化后产生尾段 `endMs > 120050`，初版 worker 将其直接拒绝。首样本 partial transcript/metrics 不得复用。

最小修复：只要尾段 `startMs < 120000` 且 `endMs > startMs`，将 `endMs` 截到真实音频上界 120000；仍拒绝起点越界、零/负时长和逆序。文本、模型、decode profile、音频和分桶算法均不变。新 run 必须从三个 worker 全量重跑。
