# V3-5.9 自动化验收结果

日期：2026-10-11。状态：`MACHINE PASS / HUMAN ACCEPTANCE PENDING`。

## 结果

| 分母 | 结果 | 证据摘要 |
|---|---|---|
| A01 Cookie 输入 | PASS | JSON / Netscape / Header 正负例通过 |
| A02 在线登录校验 | PASS（含真实负例） | 桌面 `myCk.txt` 可解析且含 SESSDATA，但真实 B站返回未登录；Runtime 正确拒绝保存为有效配置。有效 Cookie 正向留给人工验收 |
| A03 秘密边界 | PASS | 1,639 文件 / 378,859,862 bytes 扫描；认证秘密 0 命中。唯一原始 needle 命中为公开数值型 `DedeUserID` 与历史页面正文碰撞，不是认证秘密持久化 |
| A04 Settings 生命周期 | PASS | 保存/刷新/启停/重验/二次删除组件测试通过 |
| A05 缓存控制 | PASS | 配额、TTL、状态与二次清空测试通过 |
| A06 私有文件 | PASS | 权限、link、hash、source identity 正负例通过；真实 8 帧均为私有文件 |
| A07 一次下载 | PASS | 真实 `BV1ZpYd66ELP`：video 52,791,446 bytes，audio 25,320,602 bytes；video 后和 audio 后缓存均 1 项且字节不变 |
| A08 真实 B站抽帧 | PASS（本地链） | 生产分布时间点 8/8 抽帧通过；云视觉发布需有效登录设置后由人工新任务确认 |
| A09 视觉视图 | PENDING HUMAN | 既有 ready 任务已证明 8 frame/8 OCR/8 caption；本轮持久登录正向需新鲜 Cookie 后确认缩略图与反跳 |
| A10 短租约回退 | PASS | resolver 与旧 acquisition 回归通过 |
| A11 清理恢复 | PASS | stage/cookie 残留、TTL/LRU/clear 测试通过；真实隔离探针结束后清空 |
| A12 全量回归 | PASS | Runtime 705 passed；Extension 360 passed；typecheck、production build 通过 |
| A13 PRD 检视 | PASS | 见 `prd-spec-review.md` |
| A14 人工验收 | PENDING | 不代签 |

## 真实探针边界

真实公开视频下载、音频导出和 8 帧抽取使用桌面 Cookie 文件作为受控输入，但 B站登录校验已明确判定该文件失效。因此该探针只证明公开媒体的一次下载/缓存/抽帧链，不证明登录态正向通过，也不把任何 Cookie 值、URL token 或本地私有路径写入结果。

隔离 Chrome 在 360x900 与 420x900 两个视口完成 Settings 面板检查，4/4 检查通过，Axe serious/critical 为 0，并保存 2 张无秘密截图。隔离扩展 ID 与用户已配对 ID 不同，因此 Runtime 按设计拒绝该隔离页面的在线请求；该结果只证明页面布局与可访问性，真实配对连接由人工验收确认。

## 自动化停止点

所有可由机器完成的实现与回归已关闭。下一步必须由用户提供一次当前有效 B站 Cookie，在 Settings 保存并验证，再执行最小视觉体验验收；本轮按约定停在人工验收。
