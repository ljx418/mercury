# V3-2-2 Route B3 运行时能力路由修订

日期：2026-10-07。状态：用户已批准 B3 方向；本文件冻结实现与验收边界，不声明实现通过。

## 1. 问题与决定

Revision 4 把 `BV13W41137qV` 固定为自然无字幕样本。该页面在修复后全新 run 中出现 B站异步生成的 AI 字幕，使产品能力没有回退但验收被外部可变事实阻断。继续替换 BV 号会形成时间窗口挑样本，不能作为可重复出门门禁。

Route B3 新建 Sample Registry Revision 5，不修改 Revision 1..4。固定 12 个 URL、`6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal`、三个真实媒体和 SenseVoiceSmall Q8 基线均保持。变化仅限三个 ASR 槽位的触发分类：

1. 每个槽位先执行真实、同 run、授权字幕发现。
2. 当前发现 0 个字幕时，记录 `runtime_no_subtitle`，直接进入真实媒体 ASR。
3. 当前发现至少 1 个字幕时，记录 `audited_subtitle_failure`，由仅验收编排器执行该槽位预冻结的字幕体失败，再进入真实媒体 ASR。
4. 三个槽位必须全部得到真实当前分 P 的 16 kHz mono PCM；`runtimeNoSubtitle + auditedSubtitleFailure = 3`。
5. 自然无字幕计数允许 `0..3`，只描述平台在本 run 的事实，不是单独 PASS 条件；不得把未观测到自然无字幕写成产品不支持。

## 2. 冻结映射与防挑选

| sampleId | BVID | 固定角色 | 字幕存在时的验收故障 |
|---|---|---|---|
| `v3-sample-07` | `BV13W41137qV` | ASR capability slot 1 | `subtitle_body_http_503` |
| `v3-sample-08` | `BV1ZpYd66ELP` | ASR capability slot 2 / anchor | `subtitle_body_http_403` |
| `v3-sample-09` | `BV1pW421c7DH` | ASR capability slot 3 | `subtitle_body_empty` |

- URL、顺序、故障映射在 Chrome 探测前冻结；不得按探测结果换样本或换故障。
- 每个槽位的分类必须来自 acquisition task 内 `probe_subtitles` 的真实结果；浏览器页面探测只用于 identity、截图和交叉核对。
- `audited_subtitle_failure` 必须保存真实发现数量/hash、故障类、故障一次、媒体 artifact hash/bytes/shape。
- `runtime_no_subtitle` 必须保存 discovery count=0、真实发现 hash、fallback reason 和媒体 artifact hash/bytes/shape。
- fault plan 只允许存在于 `services/local-runtime/scripts/v3_route_b_acquisition_runner.py`；Runtime API、env、请求 schema、生产 acquirer 和 package 均不得表达它。

## 3. 用户体验与架构边界

产品路径不变：有可用字幕时优先字幕；无字幕、字幕体不可用或来源校验失败时获取当前任务媒体并交给本地 ASR。B3 不向产品加入“强制 ASR”按钮，不改变用户权限、Cookie lease、Portal Adapter 或下载器合同。

```text
真实 B站页面/会话
  -> BilibiliMediaAcquirer.probe_subtitles
  -> 有字幕: production 获取字幕
  -> 无字幕: MediaAcquisitionCoordinator.acquire_audio
  -> 16 kHz mono WAV
  -> V3-2-3 SenseVoiceSmall Q8
  -> 带时间戳 MediaTranscript
```

验收专用分支仅用于稳定证明“字幕尝试失败后仍能取得真实媒体”；它不属于用户可见产品架构。

## 4. 出门边界

Route B3 通过只允许声明 V3-2-2 媒体获取 LIMITED PASS，并放行 V3-2-3 SenseVoice 实施。它不声明 ASR 语义质量、V3-2、图文大纲、V3 或跨门户完成。V3-2-3 必须继续用本 run 的三个真实媒体输入完成全长本地转写、时间戳、覆盖率、资源和清理验收。

