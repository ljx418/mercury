# V3-2-0 授权态样本分母漂移风险停止

日期：2026-09-18。状态：`V3-2-0 FAIL / REPLAN`。该结论不撤销 V3-1.3 PASS，也不否定 Cookie 主路径。

## 事实

全新私有 run `v3-2-sample-probe-20260918T125149Z` 使用用户授权 B站 Cookie、全新 disposable Chrome profile 和 revision 1 的同 12 个 URL。12/12 导航成功，profile 与 Chrome 进程完成清理，私有 raw 13 files / 6,509,089 bytes / Cookie 原值 0 hit。

原 3 个 ASR 样本在授权态均出现可用字幕项：

| BVID | 原分类 | 授权态字幕项 | 结论 |
|---|---|---:|---|
| `BV1ZpYd66ELP` | asr | 4 | 不能计 ASR；保留为 PRD 锚点并重分类 subtitle 候选 |
| `BV1BfNVeBENc` | asr | 2 | 不能计 ASR |
| `BV1zv1ZBCErv` | asr | 7 | 不能计 ASR |

该变化符合“Cookie 主路径补全内容”的目标，却使 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal 固定分母不再成立。继续沿用旧标签会构成虚假验收。

## 决定

- 不生成 production-ready revision 2，不进入 V3-2-1。
- 不覆写 revision 1，也不把本次 raw 与旧 run 拼接。
- 允许在独立 discovery run 中探测未入选候选；候选必须授权态字幕项为 0、页面身份完整、非 restricted/low-signal，并在后续受控音频片段中证明有人声。
- 最终替换矩阵需要新文档审查 Fatal=0/Major=0；保留总数 12、PRD 锚点和 6+3+1+1+1 分母。

## 门禁

```text
V3-2-0: FAIL / REPLAN
Candidate discovery: GO (private, non-production)
Revision 2 productionReady: NO-GO
V3-2-1+: BLOCKED
```
