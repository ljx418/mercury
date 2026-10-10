# V3-3-6 前端回归进程池修复

日期：2026-10-08。

## 失败事实

默认 Vitest `forks` pool 两次均在 `workspaceOpen.test.ts` 启动 worker 时超时。两次已启动范围均为 46 files / 310 tests 全通过，但存在 1 unhandled error，因此不得计为全量 PASS。目标文件单独执行为 1 file / 7 tests PASS，排除测试逻辑故障。

宿主当时存在其他工作树的高 CPU pytest/E2E 与高 swap 压力；本任务不终止、不修改这些外部进程。

## 修订与实施前审计

决定：`GO`。Fatal=0，Major=0，Minor=0。

- 只修改 `apps/chrome-extension/vitest.config.ts`，把默认 pool 固定为 `threads`、`maxWorkers=4`。
- 保持 jsdom、文件隔离、测试发现规则与断言不变；不排除 `workspaceOpen.test.ts`，不缩减分母。
- 先以 CLI 等价参数验证：47 files / 317 tests PASS，0 error。
- 修订后必须用默认 `npm test` 再跑，只有同样 47/317 且 0 error 才关闭本问题。

该修复只提高验收 runner 在 WSL 资源竞争下的确定性，不改变 Extension 产品行为或 PRD 规格。
