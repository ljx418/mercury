# V3-5-8 本机媒体私有目录修复内部出门审计

日期：2026-10-09。决定：`PASS`。

## 审计结果

- Fatal：0。
- Major：0。
- Minor：1（用户 Chrome 需要重新加载 unpacked extension）。

## 实现复核

1. Runtime 默认媒体根从数据库相邻目录解耦，使用 XDG cache/WSL home；显式环境变量仍优先。
2. 没有为 DrvFS 增加不安全白名单，也没有取消权限位校验。
3. execute endpoint 将 sandbox 异常封装为现有 acquisition error envelope。
4. sidepanel 保留 `RuntimeRequestError.code`，UI 不再把目录安全失败误报为 Runtime 离线。
5. one-step runner 等待真实 execute 200 后才做 secret scan，消除了扫描与 `finally` 删除 Cookie staging 的竞态。

## 证据

- Runtime tests：24 passed。
- Frontend focused tests：4 passed。
- TypeScript：PASS。
- Build：PASS。
- Real Chrome：PASS，run `v3-5-8-real-20261009T150325Z`。
- Secret scan：0 hit。
- Desktop Companion：HTTP 200；默认根 mode 0700。

## 自动化开发停止原因

V3-5-8 的代码、真实数据验收、PRD 检视和内部审计均已完成。自动化在此停止，仅等待用户重新加载当前 Chrome 中的 unpacked extension 并点击一次“重新尝试”；这一步是替换浏览器当前内存中的旧前端 bundle，不是新增授权或配置流程。

