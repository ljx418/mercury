# T01 实施前独立只读审查（第二轮）

日期：2026-09-10  
审查者：ClaudeCode CLI 独立 session；仅 Read/Grep/Glob，未修改文件、未运行测试或浏览器。  
结论：`T01 GO`，Fatal 0 / Major 0 / Minor 2。

## M-1..M-9 复审

| ID | 复审结论 | 闭环位置 |
|---|---|---|
| M-1 | `RuntimeRequestError`、四类 kind、requestId 和 stale 规则已冻结 | `development-plan.md`、T01-A02 |
| M-2 | POSIX 路径前置检查和 Runtime 最终权威已冻结 | `development-plan.md`、T01-A05 |
| M-3 | Forget 严格成功式及失败不导航已冻结 | `development-plan.md`、T01-A07 |
| M-4 | credential generation、集中 abort 和晚到响应规则已冻结 | `development-plan.md`、T01-A02/A04 |
| M-5 | 单 active-root 与五类临时状态 reset 已冻结 | `development-plan.md`、T01-A05 |
| M-6 | connecting/connected/authentication_required/offline 四态已冻结 | `development-plan.md`、T01-A03 |
| M-7 | Workspace 公共壳层单挂载认证组件已冻结 | `development-plan.md` |
| M-8 | 六个稳定 testid 已冻结 | `development-plan.md`、T01-A03 |
| M-9 | detached HEAD + source overlay + fresh build，排除旧构建产物已冻结 | `development-plan.md`、T01-A01 |

## 非阻塞意见

1. 截图前使用稳定等待，确认 React 已提交且 password input 的 DOM value 为空；不得只依赖调用 `setToken("")` 的同步时点。
2. `snapshot-input-manifest.json` 必须显式记录 `pnpm-lock.yaml` 的路径、mode 与 SHA-256，证明 lockfile 和源码来自同一隔离输入。

两项均属于 T01 隔离执行与证据采集细节，不改变产品合同，也不阻塞实施；T01 出门前必须在输入 manifest、测试日志或截图元数据中形成证据。

## 范围决定

本轮 GO 仅放行 T01 的 E03 Side Panel、E04 Workspace、E05 `runtimeClient.ts`、E06 认证/状态/权限/Forget 组件及直接测试。不得进入 T02，不得运行旧 PX-5 generator/validator，不得修改 Chat/Agent/Debug/Settings 业务，不得把结果提升为 PX-5、PX-6 或 RKM 完成声明。
