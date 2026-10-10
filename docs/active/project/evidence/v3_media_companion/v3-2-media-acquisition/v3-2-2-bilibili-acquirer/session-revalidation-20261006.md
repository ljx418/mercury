# V3-2-2 授权会话复验记录

日期：2026-10-06。操作：只读 B站 `/x/web-interface/nav` 私有探测；未打印、散列、复制或持久化 Cookie 值。

## 输入边界

- 用户此前明确授权的桌面 `myCk.txt` 存在，8526 bytes，mtime 为 2026-09-17 16:31:49。
- JSON 中 26 个 B站 Cookie，包含 `SESSDATA`、`bili_jct`、`DedeUserID`、`DedeUserID__ckMd5`、`sid`、`buvid3`、`buvid4`、`buvid_fp`、`b_nut` 等冻结名称。
- 本记录不包含 Cookie 原值、账号信息或可逆 hash。

## 结果

```json
{"httpStatus":200,"code":-101,"isLogin":false,"cookieCountSent":26,"message":"账号未登录"}
```

2026-10-06 后续自动续跑再次检查同一授权文件：文件仍为 8526 bytes，mtime 仍为 2026-09-17 16:31:49；按冻结九 Cookie 名白名单在内存中重放 `/x/web-interface/nav`，未输出或持久化任何值，结果仍为：

```json
{"httpStatus":200,"code":-101,"isLogin":false,"cookieCountSent":9,"message":"账号未登录"}
```

## 决定

与 `session-risk-stop-20261006.md` 一致，授权会话仍失效。不得创建 `productionReady=true` Revision 3，不得进入 V3-2-2 产品实现或将公开页面 200 解释为登录成功。恢复条件仍是用户在浏览器重新登录并更新授权 Cookie，然后创建全新 run；旧失败 run 不得拼接。
