# WP0 R6 交接

## 当前坐标

`V3 completion / WP0 / R6 corrective / 58 of 65`

R0-R5 已通过。R6 的 G1/G3/G4 已闭合；G2 需要下一次单窗口可见正控。R7 未授权、未进入。

## 下一步

1. 不再改产品合同，先运行一次修正后的 `apps/chrome-extension/e2e/r6/r6-g2-browser-lifecycle.mjs`。
2. 启动前通知用户；owned Chrome 必须带 `--mute-audio`，不得触碰用户 Chrome。
3. 验证 N01/N02/N03/N05/N06/N07/N10 的精确生产 oracle 和四类残留为零。
4. N07 仍需重点审查：当前通过产品 stop 消息进入取消路径，但若阶段合同要求“真实 TrustedTabCaptureCard 原生点击”，则必须补真实 UI 控件点击，不能把消息调用算作原生点击。
5. G2 全绿后只做一次 Codex checkpoint；不要重复外审，不进入 R7，等待明确门禁。

## 资源与安全

上次 owned Chrome、Runtime、17861/9222 端口均已清理。无 Cookie、API key、token、原始音视频或私有绝对路径写入本证据包。未执行 commit、push、reset、clean、checkout 或 revert。

