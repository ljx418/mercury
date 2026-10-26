# V3-5.9 验收计划

## 固定分母

| ID | 验收项 | 必须结果 |
|---|---|---|
| A01 | 三类 Cookie 输入 | 全通过；非法输入全拒绝 |
| A02 | 在线登录校验 | `isLogin=true` 才可启用 |
| A03 | 秘密持久化边界 | SQLite/响应/日志/公开包 0 secret |
| A04 | Settings 生命周期 | 保存、reload、停用、重验、删除完整 |
| A05 | 缓存控制 | 配额/TTL 状态正确；二次确认清空为 0 |
| A06 | 私有文件 | root 0700、file 0600、0 symlink/hardlink |
| A07 | 一次下载 | 同源 audio + visual 只有 1 次 yt-dlp 下载 |
| A08 | 真实 B站 | transcript 成功且发布 8 个 frame evidence |
| A09 | 视觉视图 | 大纲/时间线缩略图可见，反跳 <=2 秒 |
| A10 | 兼容回退 | 未配置时浏览器短租约路径不回归 |
| A11 | 清理恢复 | stage/cookie 残留、到期和用户清空闭环 |
| A12 | 全量回归 | Runtime、Extension、typecheck、build 全通过 |
| A13 | PRD 规格检视 | 无 V4/其他门户/原始媒体云上传越界 |
| A14 | 人工验收 | 仅交接，不自动代签 |

任一 secret 泄漏、跨来源缓存、重复下载、无画面冒充 ready、真实 run 使用 mock 或缓存清理失败均为 Major，并停止交接。
