# V3-2-2 Route B PRD 规格检视

日期：2026-10-06。基线：`docs/active/project/01-prd.md` §18.4、§18.9 与 V3 stage gate。

## 结论

实现没有新增用户操作：用户仍在当前 B站视频页启动分析。portal-neutral `MediaAcquirer` / coordinator 保留后续 YouTube、小红书等 adapter 扩展点；BVID、cid、WBI、B站 Cookie 与下载 URL 仅存在于 `bilibili` plugin 和固定下载器构造逻辑。

字幕优先、无字幕/字幕体失败后获取当前分 P 媒体、受限内容不绕过、低信号不伪造 transcript、Cookie 任务租约和任务结束清理均与 PRD 一致。SenseVoiceSmall Q8 仍是后续 V3 转写基线；本阶段只交付真实 acquisition input，不把媒体 hash 扩大宣称为 V3-2-3 全长转写通过。

## 未完成边界

- V3-2-3 真实 3/3 SenseVoice 全长转写及覆盖率门禁未在本阶段执行。
- V3-3 视觉证据、V3-4 图文大纲/TaskStore、V3-5 产品与人类验收、V3-6/7 最终封装均未实现。
- V4 的跨模型退化检测、质量失败智能回退与进一步比较优化仍 deferred。

规格偏差：0。体验回退：0。过度承诺：0。独立审计前状态仍是 V3-2-2 CANDIDATE，不是 V3 或 Media Companion PASS。
