# V3-5-0 验收结果

日期：2026-10-08。结论：`PASS`。范围仅为产品集成合同、Media Router、Runtime task read API 与 Workspace 产品壳。

## 验收基线

- 扩展构建：`apps/chrome-extension/chrome-mv3-unpacked/`
- Runtime：桌面 Companion 最新代码，`http://127.0.0.1:17861`
- Chrome：仓库固定 Chrome-for-Testing，稳定扩展 ID `gcifeacdafknfikkfccniigjdcofpcha`
- 数据：Runtime 当前真实数据库；数据库为空时必须显示空状态，不注入 V3-4 封存任务。
- 隔离：每次 Chrome 验收使用新的 Windows 可访问 profile；临时 profile、截图和诊断目录在执行结束后删除。

## R01..R08

| ID | 结果 | 实测证据 |
|---|---|---|
| R01 | PASS | `MediaWorkspaceRouter.test.ts` 15/15；八条 canonical route 与非法 route fail-closed。 |
| R02 | PASS | legacy transcript route 仅返回 canonical replacement，入口使用 `history.replaceState`。 |
| R03 | PASS | 真实 Chrome 打开 `#/knowledge/sources?workspaceId=ws_default`，`workspace-shell=1` 且安全会话已连接。 |
| R04 | PASS | Media shell 以 route path 为依赖，每次 route/reload 重新调用 Runtime list/get；无 task 正文 React 持久缓存。 |
| R05 | PASS | shell 对无效路由、读取失败和无投影分别显示可恢复状态；没有伪 task。 |
| R06 | PASS | Runtime API 测试验证倒序有限列表、`limit=0` 拒绝、列表无 `projections`。真实 Chrome 空库显示“还没有视频分析任务”。 |
| R07 | PASS | Runtime outline + product contract：36 passed。product v1/v2 均保留。 |
| R08 | PASS | Router Vitest 15 passed；`npm run typecheck` exit 0；`npm run build` exit 0。 |

## 真实失败与复验

首次真实 Chrome 验收中，扩展已连接 Companion，但任务列表显示“媒体任务请求失败”。独立探测确认占用 17861 的进程是代码更新前启动的旧 Runtime，`GET /v1/media/outline-tasks` 返回 404。该失败没有被降级或隐藏。

停止旧实例并通过 `Start Navia Runtime.cmd` 启动最新 Companion 后：

1. 未认证请求返回 401 `V3_COMPANION_SESSION_REQUIRED`，证明路由已存在且受会话保护；
2. 真实扩展自动建立安全会话；
3. Media 任务库显示真实空库状态；
4. Knowledge route 同轮仍正常；
5. 隔离 profile 与临时截图全部删除。

## 边界

- 本结论不代表 V3-5 整体通过。
- Ask、export、seek、Side Panel 启动任务和 H01..H10 仍未在本子阶段实现。
- V3-4 封存 run 未写入当前 Runtime 数据库，也未作为产品 UI 的假数据注入。

