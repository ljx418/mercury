# V3-2-2 授权会话风险停止记录

日期：2026-10-06。

## 事实

- Run：`v3-2-sample-probe-20261006T120000Z`。
- Google Chrome `154.0.8037.95` 临时授权 profile 完成 12/12 页面探测；12 页均 navigation 200、page state 0、view/player API 可访问。
- 临时 profile 与 Chrome 进程已清理。
- 桌面 `myCk.txt` 结构合法，冻结九个 Cookie 名均存在；独立 `/x/web-interface/nav` 校验返回 HTTP 200、业务 `code=-101`、`isLogin=false`。
- 13 个 run 文件、5,593,653 bytes 对 Cookie 真值扫描为 0 命中。

## 判断

页面公开探测有效，但不能支持 `credentialEvidenceClass=user_authorized_cookie_lease` 或 BA02 授权会话通过。不得生成 `productionReady=true` revision 3，也不得把公开页面 200 冒充登录有效。

## 恢复条件

用户更新已登录 B站 Cookie 后，从零创建新临时 profile 和新 run；先验证 `/x/web-interface/nav code=0/isLogin=true`，再执行 12 页探测并生成 revision 3。旧 run 保留为失败证据，不与新 run 拼接。
