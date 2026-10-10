# V3-1.4 Manual Companion Runtime 威胁模型

日期：2026-10-07。

| 威胁 | 防线 | 必须验证 |
|---|---|---|
| 任意网页探测 loopback | session 签发要求精确 Chrome extension Origin；无 Origin 不得签发 | A04/A05 |
| 其他扩展抢占会话 | 配置固定 32 字符 extensionId；运行时不可 TOFU 改写 | A04 |
| token 落盘或进入 Chrome storage | master 与 session 仅进程/页面内存 | A11 |
| 重放旧进程 token | token 绑定随机 runtimeInstanceId；重启清空 broker | A07 |
| 会话泄露后长期使用 | 短 TTL、主动撤销、generation 中止在途请求 | A08 |
| stop CSRF/DoS | stop 需要有效 session + exact Origin，响应后延迟终止 | A09 |
| 重复进程写同一 DB | 配置目录单实例锁，第二实例 fail closed | A10 |
| Runtime 暴露到局域网 | launcher 拒绝非 loopback host | A01 |
| 日志或异常回显秘密 | 错误只返回固定 failureCode；secret scan | A11 |
| 新 broker 弱化媒体凭据边界 | 只扩展 bootstrap authenticator，不改变 channel/lease 合同 | A06/A12 |

Chromium 对扩展发出的无请求体 `GET` 可能省略 `Origin`。因此后续受保护请求的规则为：有效短期 bearer 必须存在；若请求带 `Origin`，必须精确匹配配置中的扩展 Origin；仅当 `Origin` 被浏览器省略时，允许 broker 依据签发时已绑定 Origin 的进程内 bearer 鉴权。该例外不适用于 session 签发，也不接受空字符串、`null` 或错误 Origin。

## 残余风险

同一用户账户下的恶意本机进程可伪造 HTTP Origin；本阶段假设已取得同账户代码执行权限的恶意程序不在浏览器扩展隔离威胁边界内。正式分发若要求抵抗该攻击，升级到 Native Messaging challenge broker，并保留当前上层 session API。
