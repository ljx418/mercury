# V3-2-7 PRD 规格检视

日期：2026-10-08。基线：`01-prd.md`、V3 stage gate、V3 Media Companion 开发/验收总计划。

## 结论

本候选在 V3-2 边界内符合 PRD：用户可在真实 B站当前分 P 上经授权会话获得字幕或本机媒体转写；下载不可用时存在可信 tabCapture；处理中、等待 capture、转写、清理和终态在 Chat/Workspace 可见；取消、重试、故障和资源清理均可验证。

没有把 V3-2 扩大为视频视觉理解、图文大纲、Media Mindmap、时间轴问答或 V3 总体完成。V3-3..V3-7 仍未实现。restricted 只返回 blocked，low-signal 只返回 degraded，不制造伪 transcript。

## 用户体验核对

1. 用户打开 B站页并授权，点击转写；系统优先字幕，必要时媒体 ASR，再必要时可信 capture。
2. 双容器读取同一 Runtime task；四视口无横向溢出，Axe serious/critical 为 0，键盘路径通过。
3. 用户取消后资源清理；重试创建新 task/credential binding，不复用已取消任务。
4. 平台、Runtime、磁盘、配额、授权或 capture 失败均显示机器原因，不显示假成功。

规格偏移：0 项 Fatal、0 项 Major。保留门禁：外部独立审计仍 pending，因此本文件不签署阶段 PASS。
