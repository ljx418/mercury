# V3-5-7 失败尝试记录

run：v3-5-7-inpage-20261009T142254Z。状态：PRODUCT NEGATIVE / DO NOT REUSE。

- 受信任嵌入式侧栏点击成功发出 arm，但 Chrome 拒绝 getMediaStreamId：Extension has not been invoked for the current page (activeTab)。
- 结论：不能把 trusted tabCapture 的 Chrome 工具栏调用静默合并进 iframe 点击；直接启动实现已撤回。
- 正常路径继续优先 Cookie 字幕、真实 yt-dlp 媒体和公开字幕；只有三路失败时显示浏览器必需的回退动作。
- 本 run 不封存、不拼接、不复用。

