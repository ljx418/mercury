# V3-5-4 ZIP 验收器可移植性修订实施前审计

日期：2026-10-09。决定：`GO`。Fatal=0 / Major=0 / Minor=1。

## 审计结论

- 产品 ZIP 写入实现已有 Runtime 单元测试覆盖，本次不改产品代码。
- `unzip` 是未在仓库或验收计划声明的系统依赖，当前环境实测不存在；继续依赖它会稳定产生基础设施假失败。
- 仓库已要求 Python local Runtime，使用 Python 标准库 `zipfile` 不引入新依赖，并可同时验证 ZIP 可打开与成员名。
- 新 runner 必须对 Python 非零退出 fail-closed，不得在读取失败时跳过成员白名单比较。

Minor-1：验收器仍依赖项目既有 Python 运行环境；该依赖属于 Local Runtime 的显式基础环境，不新增用户侧安装步骤。

允许修改：`apps/chrome-extension/e2e/v3-acquisition-orchestration-e2e.mjs` 的 ZIP 成员读取实现。禁止修改产品导出包、降低成员白名单或复用失败 run。
