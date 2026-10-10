# V3-5-1 验收计划

日期：2026-10-08。所有生产正例使用 fresh 真实 B站数据。

| ID | 操作 | 必须结果 |
|---|---|---|
| S01 | 真实页面点击开始 | 既有授权/credential/acquisition 路线不回退，taskId 全链一致 |
| S02 | 字幕或 ASR 完成 | Materializer 只从 Runtime projection 读取 segments，前端不提交正文 |
| S03 | materialize 同一 task | 私有 evidence 落盘，公开 catalog 无 text/绝对路径/secret |
| S04 | 无视觉证据 | terminal=`degraded` 且 code=`VISUAL_EVIDENCE_UNAVAILABLE`，UI 不声称画面理解完成 |
| S05 | 重复 materialize/reload | 幂等返回同 task/revision/outline，不重复发布 |
| S06 | source/task/segment 无效 | 4xx fail closed，零 outline 发布 |
| S07 | 本地 ASR 路线 | 显示预计等待、CPU/内存/临时磁盘和可取消；终态 residual=0 |
| S08 | 快速摘要 | 只显示 published outline 的 title/summary/首章，不前端总结 |
| S09 | 打开完整工作台 | canonical `#/media/tasks/:taskId`，Workspace 读取相同 revision/outlineId |
| S10 | 运行中取消或失败 | 唯一终态和可恢复操作，无无限 loading |
| S11 | 自动回归 | Runtime/contract/frontend/typecheck/build 全绿 |
| S12 | 真实 Chrome | 原生 Side Panel + 真实 B站页完成路线；临时媒体/profile/截图按策略清理 |

出门条件：S01..S12 全 PASS、PRD review Fatal=0/Major=0。若真实站点、Provider 或平台限制造成大分母缺失，必须停止并保留失败证据，不得以 fixture 代替。

