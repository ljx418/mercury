# V3-2-0 ASR 人工验收方法变更

日期：2026-09-18。状态：`USER-DIRECTED METHOD CHANGE / IMPLEMENTING`。

## 决策

用户明确要求不再让人类逐字听写，由自动化系统对同一真实音频窗口产生不同 ASR 输出，人类只负责听原视频、盲选结果、标记错误并复核分歧。旧“人工 gold transcript + CER”方案自本文件起为 `SUPERSEDED`，不得继续要求人类录入整段文本。

机器输出不能互相充当 gold，也不能继续声称 CER。新的质量声明限定为：两名不同人类审查者在原视频旁，对 3 个固定样本、每个 8 个固定 15 秒区间完成 48 次独立比较；生产候选的关键含义保留率、逐样本下限、关键错误和 neither-acceptable 数量达到冻结阈值。

## 不变分母

- 3 个真实、无平台字幕的中文/粤语 B站样本。
- 每个样本固定 `00:30..02:30`，120 秒，不允许挑选机器表现更好的区间。
- 两名不同 reviewer 独立审查，提交前不得查看对方选择。
- 必须听原视频；只看两段机器文本不能完成判断。
- 原媒体、Cookie、cookiefile 与音频窗口仍为私有临时材料，终态删除。

## 双模型

- 生产候选：`Systran/faster-whisper-small@536b066...`，即后续 V3-2 产品候选；比较清单用统一的 `path/byteLength/sha256` 行聚合算法得到 fileSet hash，并逐文件对账原模型清单。
- 独立基线：`Systran/faster-whisper-base@ebe41f7...`，只用于比较，不得自动成为产品 fallback。
- 两者使用同一 `faster-whisper 1.2.1 / CPU / int8 / beam=1 / VAD 500ms / no previous context`，避免用不同解码参数制造优势。
- 页面按样本交替映射 Candidate A/B；不展示模型名称。完整 label map 只用于机器汇总。

## 人类操作

每个 15 秒区间必须选择 `A 更准确 / B 更准确 / 等价可接受 / 两者均不可接受`，分别判断两候选是否保留关键含义，并标记遗漏、幻觉、专名、数字、语言、时间或其他错误。可写不超过 160 字的错误备注，但禁止要求逐字转写。

## 出门阈值

- 24 个区间 x 2 reviewer = 48 个独立判断，0 缺失。
- 生产候选关键含义保留不少于 44/48，且每个样本不少于 15/16。
- `criticalMeaningErrorCount = 0`。
- `neitherAcceptableCount = 0`。
- reviewer 分歧必须由 adjudicator 听同一原视频后关闭；不得由机器投票代替。

任一阈值失败必须回模型/profile ADR。不得降低阈值、换窗口、删除困难区间或把 baseline 输出作为 gold。
