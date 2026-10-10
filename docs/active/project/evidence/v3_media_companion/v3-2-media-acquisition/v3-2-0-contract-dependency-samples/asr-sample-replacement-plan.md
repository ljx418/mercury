# V3-2-0 ASR 样本替换计划

日期：2026-09-21。状态：`CANDIDATES VERIFIED / HUMAN QUALITY FAIL / MODEL-PROFILE REPLAN REQUIRED`。

## 目标矩阵

维持 12 个唯一 URL：6 subtitle、3 ASR、1 multipart、1 restricted、1 low_signal。`BV1ZpYd66ELP` 必须保留，但按授权态事实进入 subtitle；从原 6 个 subtitle 中移出 1 个，以容纳 3 个新的 ASR URL。

## 候选发现门槛

1. 新的 disposable authorized Chrome run，候选不得来自当前 12 个生产样本。
2. navigation=200，BVID/CID/duration/title/author 完整，授权态 player API subtitleItems=0，页面字幕贡献标记不存在。
3. restriction signal=0，且不得使用已标 low_signal 的无解说/纯音乐内容。
4. 通过固定 yt-dlp binary 的只读 metadata/audio probe 后，至少 120 秒音频可获取；本地 VAD/ASR 能产生非空语音片段。
5. 候选发现材料保持私有，Cookie/cookiefile/profile/raw audio 终态 0 残留；公开文档只记录 BVID、分类事实和 artifact hash。

## 验收与审查

- 至少得到 5 个合格候选，选 3、备选 2，避免单 URL 再漂移。
- 新矩阵与 revision 1 差异逐项列明；不静默替换。
- 先更新 sample registry 计划与验收分母并做内部独立文档审查；Fatal=0/Major=0 后才重跑正式 revision 2。
- 没有 3 个合格候选时停止，不降低“真实无字幕且有语音”标准。

## 发现结果

授权态页面与真实音频探针已得到 3 个中文主候选和 2 个备选。主候选均满足 player API 字幕项为 0、限制信号为 0、目标分 P 至少 120 秒、冻结版 yt-dlp 可获取音频、本地 `faster-whisper small/int8` 判为 `zh` 且产生非空语音。证据见 `asr-candidate-discovery-report.md`。

拟议主候选：

1. `BV1sMNtzJE5B`，P1，`cid=30592600559`，中文单 P。
2. `BV1xz4y1S7yF`，P1，`cid=286754257`，中文访谈。
3. `BV1Bb411w741`，P1，`cid=61744125`，粤语访谈。

备选：`BV13741117Nz` P1（中文/粤语）和 `BV1mx411x7pm` P1（英语下载与多语言回归）。备选不计入正式 3 个 ASR 盲评分母。

## 当前门禁

自动化不能完成双人独立 gold transcript。三个主候选的 `30s..150s` 窗口仅冻结为待审窗口；在两位不同人类 reviewer 独立转写、完成 adjudication、产出 gold text hash 前：

- 不生成 `productionReady=true` 的 revision 2 registry；
- 不修改 revision 1 或旧 accepted run；
- 不进入 V3-2-1 产品实现；
- 不把 150 秒机器 ASR 探针当作 gold 或 CER 通过证据。
