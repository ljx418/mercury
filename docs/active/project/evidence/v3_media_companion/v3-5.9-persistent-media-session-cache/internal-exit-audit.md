# V3-5.9 内部实施出门审计

日期：2026-10-11。

## 决定

`CONDITIONAL GO TO HUMAN ACCEPTANCE`。Fatal=0，Major=0，Minor=2。

## 已核验

- 新增持久 Cookie 设置、OS secret store、在线校验、停用/删除与 Runtime API。
- 新增私有有界缓存、TTL/LRU/配额/hash/权限/恢复和手动清理。
- 音频与视觉复用一份完整低清视频；真实探针缓存条目保持 1。
- 生产分布策略真实抽帧 8/8；未使用极端末帧作为虚假失败或放宽门槛。
- Runtime 705 tests、Extension 360 tests、typecheck、build 全通过。
- 认证秘密扫描 0 命中；SQLite 中唯一原始 Cookie needle 命中是公开数值型 `DedeUserID` 与历史 `pages.payload_json` 正文碰撞，不含 `SESSDATA` / `bili_jct` 等认证秘密。
- 隔离 Chrome 360/420 两视口 4/4，Axe serious/critical 0，截图无 Cookie；隔离 extension ID 的 Runtime 拒绝属于 exact-Origin 预期，未冒充真实配对通过。

## Minor

- M-1：用户桌面 Cookie 当前已失去 B站登录态；有效 Cookie 正向只能在人工验收时关闭。
- M-2：本轮真实探针验证本地 8 帧，但未用失效 Cookie执行新的云视觉 task；最终 Workspace 缩略图与反跳需人工新任务确认。

## 假绿检查

没有把公开视频可下载等同于 Cookie 登录通过；没有把旧 task 的 8 帧拼接到新 run；没有把组件测试等同于人工视觉质量；没有泄漏或打印 Cookie。上述 Minor 不要求代码返工，但阻止声明 V3-5.9 最终人类 PASS。

## 停止原因

自动化开发与机器验收已经完成；剩余动作需要用户提供当前有效登录态并判断实际大纲/时间线截图及反跳体验，属于约定的人类验收边界。
