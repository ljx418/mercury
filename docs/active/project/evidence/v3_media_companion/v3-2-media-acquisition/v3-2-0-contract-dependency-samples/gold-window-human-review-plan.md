# V3-2 中文 Gold Window 双人审查计划（SUPERSEDED）

> 2026-09-18 用户明确取消人工逐字听写。本文件仅保留历史决策，不再是当前门禁。当前权威方法为 `asr-comparison-method-change.md`、`asr-comparison-development-plan.md` 与 `asr-comparison-acceptance-plan.md`。

日期：2026-09-18。状态：`HUMAN ACTION REQUIRED`。

## 目标

对三个主 ASR 样本的 `00:30..02:30` 各 120 秒建立人工 gold transcript。机器 ASR 输出不得预填、展示给 reviewer 或用作人工文本。

## 独立审查步骤

1. Reviewer A 在独立浏览器会话打开 `gold-window-review.html`，输入自己的非敏感 reviewer ID。
2. 逐项打开 B站目标视频，从 00:30 播放到 02:30；只按听到的中文/粤语逐字转写，不参考机器字幕或机器 ASR。
3. 导出 A 的 JSON 后关闭页面。Reviewer B 使用新的浏览器会话重复相同步骤，提交前不得读取 A 的文本。
4. 第三步完成后，由 adjudicator 对照两个 JSON 和原视频解决差异，生成最终 UTF-8 gold text 文件；统一标点、数字和不可辨识标记规则必须在 adjudication 记录中声明。
5. 对每个最终文本计算原始文件 SHA-256；记录两位 reviewer ID、各自提交时间和最终 artifact 相对路径/hash。
6. 只有三段都达到 `reviewerCount>=2` 且 `adjudicationStatus=completed`，才能进入 revision 2 registry 生成。

## 目标样本

| BVID | partIndex / cid | 窗口 |
|---|---|---|
| `BV1sMNtzJE5B` | 1 / `30592600559` | 30,000..150,000 ms |
| `BV1xz4y1S7yF` | 1 / `286754257` | 30,000..150,000 ms |
| `BV1Bb411w741` | 1 / `61744125` | 30,000..150,000 ms |

## 失败与回退

- 任一窗口存在长段静音、无法辨识、语言并非中文/粤语或目标分 P 漂移：拒绝该候选，按顺序启用 `BV13741117Nz` P1，再重新执行页面/音频/双人审查。
- 只有一位 reviewer、两份文本来自同一人、机器文本被预填、文本 hash 缺失：保持 pending。
- 不允许降低 CER 阈值或把英语备选计入中文 CER 分母。
