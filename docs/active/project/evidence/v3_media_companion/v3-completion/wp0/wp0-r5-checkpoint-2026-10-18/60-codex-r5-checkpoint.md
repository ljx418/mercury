# WP0 R5 Codex checkpoint

日期：2026-10-18  
结论：`R5-A USER-PATH PASS / R5-B RELAY POSITIVE UNVERIFIED / P0 NO-GO`

## 1. 裁决范围

R5 固定输入 `BV1pohR6rEEh` 在有效登录态下存在凭据字幕。真实产品按冻结顺序选择
`credentialed_subtitle` 并在首个成功路线停止，这是正确行为。该 run 可以关闭生产 UI 用户路径，
但不能关闭 R5 对 `tabCapture -> SenseVoice` 的正向组合要求。

因此 R5 分成两个不互相替代的分母：

- **R5-A**：真实生产用户路径。已通过。
- **R5-B**：真实浏览器 Relay/SenseVoice 正控。未验证。

R5-B 通过前，R5/P0 仍为 NO-GO，R6/R7/P1 均不得开始。不存在“迁移到 R6 后视为 R5 通过”的
状态重命名。

## 2. R5-A 已证明事实

证据目录：`../wp0-r5-cookie-canary-2026-10-18/`

- Cookie 经产品 parser 和 Settings UI 导入，状态为 configured/verified/enabled；公开证据不含值。
- production unpacked extension、owned visible Chrome、owned Runtime 和固定 BVID 均为本轮真实资源。
- 用户从页面内 Navia 入口触发分析；task 为
  `media_task_a9e631cb571a48098c8f066419a04aba`。
- source 为 `portal:bilibili:BV1pohR6rEEh:42216784482:p1`。
- 仲裁路线为 `credentialed_subtitle`，acquisition `succeeded`，598 个非空带时间戳分段。
- transcript revision 3；outline `degraded` revision 6；UI 显示“视频已就绪”并退出 busy。
- materialize-visual 首次 503 后，冻结文字 fallback 200；后续受治理视觉重试 200。
- Chrome 全程静音；Cookie/raw media/token/private path 公开命中 0；owned 资源归零。

该 run 的 Offscreen PCM、Runtime capture sink、SenseVoice canary invocation 均为 0，故不计 R5-B。

## 3. R5-B 输入冻结

2026-10-18 使用用户授权 Cookie 和产品 `parse_bilibili_cookies` 进行只读 B站元数据探测；未启动
Chrome、未播放声音、未下载媒体、未输出 Cookie 值。

| 字段 | 冻结值 |
|---|---|
| URL | `https://www.bilibili.com/video/BV1Bb411w741` |
| BVID | `BV1Bb411w741` |
| CID / playbackUnitId | `61744125` |
| part | `p1` |
| duration | `258s` |
| authenticated subtitle count | `0` |
| view/player API code | `0 / 0` |

六视频质量分母的 6/6 当前均有 1 条字幕，不能用作自然 capture 正控。选择上述历史真实 ASR 样本，
因为它短、可访问、无字幕，且已在项目既有 ASR 比较中使用；这不改变 P1 六视频分母。

R5-B 的隔离环境只把 `NAVIA_MEDIA_YT_DLP_PATH` 指向本轮 owned、确认不存在的路径，使产品既有
`build_media_downloader()` 返回 `None`。这不是 route override：

1. 身份解析和字幕探测仍访问真实 B站边界，预期字幕路线产生
   `V3_MEDIA_SUBTITLE_UNAVAILABLE`；
2. 产品调用真实 `BilibiliMediaAcquirer.acquire_audio()`，因 downloader unavailable 产生
   `V3_MEDIA_RUNTIME_OFFLINE`；
3. production `MediaAcquisitionClient` 从真实页面上下文确认 transcript unavailable，并由产品自己
   记录 `public_or_page_subtitle=V3_MEDIA_SUBTITLE_UNAVAILABLE`；
4. 三条失败同 task、严格顺序后，真实 `TrustedTabCaptureCard` 才可出现。

runner 对 `recordMediaCaptureRouteFailure`、Controller、grant、materialize、database/store 的直调
必须为 0。若页面上下文不是 `transcriptAvailability=absent`，或任一预期 code/顺序不一致，立即
R5-B NO-GO，不改输入、不伪造结果。

## 4. 门禁

当前只允许 ClaudeCode 执行 R5-B。成功后状态写 `R5-B AWAITING CODEX CHECKPOINT` 并停止；由
Codex 复核后才能产生 `R5 PASS / R6 MAY START`。失败则保留证据并维持 P0 NO-GO。

产品公共 API、endpoint、Origin、ticket TTL、v10 schema/fixture、FailureCode、40/20 inventory、
阈值、SourceAuthority、仲裁顺序和产品 terminal 均不得改变。

Fatal 0 / Major 0 / Minor 0 / R5-B hard gate 1。
