# T04-1 Playwright revision 定位失败记录

日期：2026-09-14T17:21:00+08:00

## 结论

`t04-r4-snapshot-revalidation-20260914t091715z` 的 T04-0 保持 PASS；该 run 的 T04-1 为 `VOID / NOT PASSED`，不得补写或进入 T04-2。

## 停止原因

隔离 pnpm 安装已完成，Playwright Core 按 pnpm 内容寻址布局安装在 `node_modules/.pnpm/playwright-core@<version>/node_modules/playwright-core/`。实现错误地从不存在的顶层 `node_modules/playwright-core/browsers.json` 读取 revision，因 `ENOENT` 停止。

## 修订处置

- 只在隔离安装的 `.pnpm` 目录中解析 `playwright-core@*`；候选必须精确为一个。
- 从该候选的 `browsers.json` 读取 Chromium revision。
- 不使用主工作树 `node_modules`，不填默认 revision，不降低环境可重建门槛。

本问题是 T04 工具路径假设错误，不是产品或 T02/T03 evidence 失败。后续以新 run 从 T04-0 重建。
