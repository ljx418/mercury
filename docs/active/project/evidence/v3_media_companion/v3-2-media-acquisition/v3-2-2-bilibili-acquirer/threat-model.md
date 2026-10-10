# V3-2-2 威胁模型

日期：2026-10-06。

| 威胁 | 控制 | 验证 |
|---|---|---|
| Cookie 泄漏到 argv/log/evidence | 值只在进程内 lease 和随机 0600 cookiefile；redactor；公开 ref 无 path | BA06/BA15 needle scan |
| 任意 URL/SSRF | URL 由注册 adapter 根据 mediaId 构造；拒绝 caller URL、file/localhost/private redirect | BA12 |
| 跨 task 或过期租约 | 私有 borrow API 强制 task/adapter/state/expiry | BA04/BA05 |
| 多 P 越权/误下载 | registry playbackUnitId/partId 与 B站 cid/page 精确绑定 | BA10 |
| yt-dlp 配置/插件/exec 注入 | `--ignore-config --no-plugin-dirs --no-update --no-playlist`，argv array，无 shell | 静态审计与恶意环境测试 |
| 受限内容绕过 | DRM/付费/地区/风控拒绝即 blocked，不尝试规避参数 | BA11 |
| 临时媒体残留 | 0700/0600 sandbox、cleanup barrier、startup owner orphan recovery | BA13/BA14 |
| 证据假绿 | 真实 Chrome/真实 B站/单 run，fixture 不计正例，revision/hash 固定 | BA02/BA07..11/BA16 |
| 平台变化 | machine failure code + degraded/blocked，不静默换事实来源 | BA08/BA11/BA13 |

剩余风险：B站接口和风控会变化；V3 只对冻结日期和样本矩阵作限定声明。Cookie 会话真实性只能在用户授权的私有运行中证明，独立公开审计只验证不可泄漏属性。
