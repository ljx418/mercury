# T02.3 Forget recovery bridge 同步重计划审计

日期：2026-09-14
状态：`GO WITHIN FROZEN T02.3 SCOPE`

## 1. 触发事实

两个完整真实 Chrome run 均在 `collectForgetChains()` 的同一位置 fail closed：错误页点击“返回来源库”后，`/v1/knowledge/status` 与 `/v1/knowledge/workspaces` 各留下一个 request-only observation，30 秒内没有 response 或 transport_failure。两个 run 均未 seal，cleanup 4/4 通过。

## 2. 根因

runner 在确认 `SOURCE_NOT_FOUND` 后立即执行可信恢复点击，只在路由切换完成后调用 settle。错误页自动启动的 Status/Workspace 请求可能仍在飞行中；路由切换销毁旧视图后，这些请求无法通过产品 E2E message bridge 提交终态。偶然等待足够久的执行可以通过，构成非确定性验收风险。

## 3. 限定修复

在 `SOURCE_NOT_FOUND` route observation 完成后、可信恢复点击之前增加一次 `drainR2ObservationsUntilSettled()`；点击并进入 Source Library 后保留原有第二次 settle。临时 reopen 页仍只在第二次 settle 成功后关闭。

该修复：

- 不增加 Page/BrowserContext 网络 fallback；
- 不根据 URL、HTTP 状态或后续探测补终态；
- 不删除 orphan，不降低 exact-one-terminal；
- 不修改 Workspace、Runtime、API 或 Schema；
- 任一 barrier 超时仍使 run 未封存失败。

## 4. 审计结论

Fatal 0 / Major 0。该同步 barrier 属于已批准的 R2 runner/collector 修复范围。允许生成新 snapshot 并从零执行下一次完整 R2 run；此前四个失败 run 保持 unsealed 且排除在候选之外。
