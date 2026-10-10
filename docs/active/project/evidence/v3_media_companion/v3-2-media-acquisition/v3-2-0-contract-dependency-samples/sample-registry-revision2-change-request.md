# V3-2 Revision 2 样本矩阵变更请求

日期：2026-09-18。状态：`PROPOSED / NOT APPLIED`。

## 1. 变更原因

Cookie 主路径揭示 revision 1 三个 ASR 样本实际有平台字幕。旧 registry 保持不可变，但不能再作为 production-positive ASR 分母。该变更不减少 12 个 URL、不改变 6+3+1+1+1，也不移除 PRD 锚点 `BV1ZpYd66ELP`。

## 2. 拟议 12 项矩阵

| sampleId | BVID | 主分类 | 处置 |
|---|---|---|---|
| 01 | `BV1yLuwzpEt2` | subtitle | 保留 |
| 02 | `BV1VG4117775` | subtitle | 保留 |
| 03 | `BV1Bt411D78C` | subtitle | 保留 |
| 04 | `BV1CiFMenEye` | subtitle | 保留 |
| 05 | `BV1Fh1VYFEDu` | subtitle | 保留 |
| 06 | `BV1ZpYd66ELP` | subtitle | 锚点保留；由 asr 按授权态事实重分类 |
| 07 | `BV1sMNtzJE5B` P1 | asr | 新增；中文单 P |
| 08 | `BV1xz4y1S7yF` P1 | asr | 新增；`cid=286754257` |
| 09 | `BV1Bb411w741` P1 | asr | 新增；`cid=61744125` |
| 10 | `BV1PA4m1w7ya` | multipart | 保留 |
| 11 | `BV1vt1sBgEzc` | restricted | 保留 |
| 12 | `BV1goA2zrEEq` | low_signal | 保留 |

移除 `BV1BfNVeBENc`、`BV1zv1ZBCErv`，因为授权态已有字幕；移除字幕样本 `BV1iv411j7wL`，为锚点重分类腾出固定的第 6 个 subtitle 名额，并保留其余字幕样本中的短视频、长视频、音乐和多 P 形态覆盖。

## 3. Gold window

三个主 ASR 候选均拟固定 `startMs=30000`、`endMs=150000`、`durationMs=120000`。当前 `reviewerCount/adjudicationStatus/goldTextSha256/artifact` 全部 pending，因此本请求不得写成符合 production Schema 的实例。

## 4. 应用前门槛

1. 两位不同人类 reviewer 独立完成三段转写；reviewer 之间在提交前不得互看文本。
2. adjudicator 解决差异并生成每段唯一 gold text；保存 reviewer identity、时间、文本 hash 和最终 artifact hash。
3. 独立审查确认样本替换未缩分母、目标分 P 与 cid 正确、备选未混入正式分母、Cookie/路径未进入公开材料。
4. 用户明确批准本矩阵后，才允许生成新的 revision 2 候选和修改 sample-registry 生成器；revision 1 永不覆写。

## 5. 当前门禁

```text
Candidate discovery: PASS
Revision 2 matrix: PROPOSED / USER + HUMAN REVIEW REQUIRED
V3-2-0: FAIL / REPLAN remains
V3-2-1+: BLOCKED
```
