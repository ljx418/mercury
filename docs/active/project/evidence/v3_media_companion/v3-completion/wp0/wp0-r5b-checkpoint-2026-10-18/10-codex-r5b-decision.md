# WP0 R5-B Codex checkpoint

日期：2026-10-18

## 决定

`R5-B NO-GO / R6 MUST NOT START`

Fatal 0 / Major 1 / Minor 0。

## 已证明

- 固定输入仍为 `BV1Bb411w741 / CID 61744125 / p1 / 258s / subtitleCount=0`。
- SenseVoice `funasr-sensevoice-small-q8` 为 ready、verified、effective，revision 为
  `90c1c61912018b70ada0fcc024ea24aca62f2e63`。
- production build、fresh Runtime/database/profile、用户授权 Cookie 和页面内 Navia 入口可用。
- 同一真实任务按冻结顺序出现：
  1. `credentialed_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE`
  2. `credentialed_media_asr -> V3_MEDIA_RUNTIME_OFFLINE`
  3. `public_or_page_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE`
- 产品真实展示 `TrustedTabCaptureCard`；runner 未直调 route failure、Controller、grant、materialize、
  database 或 store。
- Chrome 全部显式 `--mute-audio`，声音输出 0。

## Major

`M-R5B-01 user-reachable trusted capture input is not automatable in the current Chrome environment`。

当前 Chrome 在 `Extensions.loadUnpacked` 后仍未产生可附加的原生 Side Panel WebContents；只暴露
`sidepanel.html?naviaInPage=1` iframe。页面内面板能到达捕获卡片，但跨进程 iframe 的自动化点击没有
形成产品要求的 `isTrusted && navigator.userActivation.isActive`，因此没有创建 grant、streamId、PCM、
transcript 或产品终态。不得以 DOM `click()`、Controller 直调或伪造 grant 代替。

## 门禁

- R5-A：PASS（字幕产品路径）。
- R5-B：NO-GO（relay 正控未完成）。
- R5/P0：NO-GO。
- R6/R7/P1：未授权、未启动。

